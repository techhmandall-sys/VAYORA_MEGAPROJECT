package com.dypcet.vayora.aftertrip;

import com.dypcet.vayora.notification.NotificationService.Type;
import com.dypcet.vayora.notification.NotificationService;
import com.dypcet.vayora.notification.Text;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

/**
 * What happens after a trip: the passenger's side of whether it happened, and a reminder
 * to rate it.
 *
 * <p>A trip is completed on the driver's word. The passenger may confirm it or say it did
 * not happen; the second flags the booking for an administrator. Nothing is reversed
 * automatically: the money went directly to the driver, and a dispute is for a person to judge.
 */
@Service
public class AfterTripService {

    /** A completed trip the passenger says did not happen. */
    public record Dispute(long bookingId, long passengerId, String passengerName, long driverId,
            String driverName, String fromStop, String toStop, Instant boardingTime, Instant disputedAt) {
    }

    private static final Logger log = LoggerFactory.getLogger(AfterTripService.class);

    private final JdbcTemplate jdbc;
    private final NotificationService notifications;
    private final Clock clock;
    private final Duration remindAfter;

    public AfterTripService(JdbcTemplate jdbc, NotificationService notifications, Clock clock,
            @Value("${vayora.rating.remind-after}") Duration remindAfter) {
        this.jdbc = jdbc;
        this.notifications = notifications;
        this.clock = clock;
        this.remindAfter = remindAfter;
    }

    /** The passenger says whether a completed trip happened. Once only. */
    @Transactional
    public void confirm(long passengerId, long bookingId, boolean travelled) {
        List<String> found = jdbc.queryForList("""
                SELECT status FROM bookings WHERE id = ? AND passenger_id = ? FOR UPDATE""",
                String.class, bookingId, passengerId);
        if (found.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Booking not found");
        }
        if (!"COMPLETED".equals(found.get(0))) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Only a completed trip can be confirmed");
        }
        int changed = jdbc.update("""
                UPDATE bookings SET passenger_confirmed = ?, passenger_confirmed_at = ?
                WHERE id = ? AND passenger_confirmed IS NULL""",
                travelled, utc(clock.instant()), bookingId);
        if (changed == 0) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "You have already answered for this trip");
        }
        if (!travelled) {
            for (Long adminId : jdbc.queryForList(
                    "SELECT id FROM users WHERE role = 'ADMIN' AND status = 'ACTIVE'", Long.class)) {
                notifications.send(adminId, Type.TRIP_DISPUTED,
                        Text.of("A passenger says a trip marked completed did not happen. See disputed trips."), bookingId);
            }
        }
    }

    /** Trips passengers say did not happen, newest first. */
    public List<Dispute> disputes() {
        return jdbc.query("""
                SELECT b.id, b.passenger_id, p.full_name AS passenger, r.driver_id, d.full_name AS driver,
                       s.name AS from_stop, t.name AS to_stop,
                       r.departure_time + make_interval(mins => s.offset_minutes) AS boarding,
                       b.passenger_confirmed_at
                FROM bookings b
                JOIN rides r ON r.id = b.ride_id
                JOIN users p ON p.id = b.passenger_id
                JOIN users d ON d.id = r.driver_id
                JOIN ride_stops s ON s.ride_id = b.ride_id AND s.seq = b.from_seq
                JOIN ride_stops t ON t.ride_id = b.ride_id AND t.seq = b.to_seq
                WHERE b.passenger_confirmed IS FALSE
                ORDER BY b.passenger_confirmed_at DESC LIMIT 100""",
                (rs, n) -> new Dispute(rs.getLong("id"), rs.getLong("passenger_id"), rs.getString("passenger"),
                        rs.getLong("driver_id"), rs.getString("driver"), rs.getString("from_stop"),
                        rs.getString("to_stop"), rs.getObject("boarding", OffsetDateTime.class).toInstant(),
                        rs.getObject("passenger_confirmed_at", OffsetDateTime.class).toInstant()));
    }

    @Scheduled(cron = "${vayora.rating.reminder-cron}", zone = "Asia/Kolkata")
    void scheduledRun() {
        int reminded = remindToRate();
        if (reminded > 0) {
            log.info("Sent {} rating reminders", reminded);
        }
    }

    /**
     * One reminder per completed trip, to each side that has not rated it, once the trip is
     * old enough. Never a second one.
     *
     * @return how many reminders were sent
     */
    @Transactional
    public int remindToRate() {
        record Due(long bookingId, long passengerId, long driverId, String passengerName, String driverName,
                boolean passengerRated, boolean driverRated) {
        }
        List<Due> due = jdbc.query("""
                SELECT b.id, b.passenger_id, r.driver_id, p.full_name AS passenger, d.full_name AS driver,
                       EXISTS (SELECT 1 FROM ratings g WHERE g.booking_id = b.id AND g.rater_id = b.passenger_id)
                           AS passenger_rated,
                       EXISTS (SELECT 1 FROM ratings g WHERE g.booking_id = b.id AND g.rater_id = r.driver_id)
                           AS driver_rated
                FROM bookings b
                JOIN rides r ON r.id = b.ride_id
                JOIN users p ON p.id = b.passenger_id
                JOIN users d ON d.id = r.driver_id
                WHERE b.status = 'COMPLETED' AND b.rating_reminded_at IS NULL AND b.updated_at <= ?
                FOR UPDATE OF b SKIP LOCKED""",
                (rs, n) -> new Due(rs.getLong("id"), rs.getLong("passenger_id"), rs.getLong("driver_id"),
                        rs.getString("passenger"), rs.getString("driver"),
                        rs.getBoolean("passenger_rated"), rs.getBoolean("driver_rated")),
                utc(clock.instant().minus(remindAfter)));
        int sent = 0;
        for (Due trip : due) {
            if (!trip.passengerRated()) {
                notifications.send(trip.passengerId(), Type.RATING_REMINDER,
                        Text.of("How was your trip with {driver}? You can still rate it.", "driver", trip.driverName()),
                        trip.bookingId());
                sent++;
            }
            if (!trip.driverRated()) {
                notifications.send(trip.driverId(), Type.RATING_REMINDER,
                        Text.of("How was {passenger} as a passenger? You can still rate the trip.",
                                "passenger", trip.passengerName()),
                        trip.bookingId());
                sent++;
            }
            jdbc.update("UPDATE bookings SET rating_reminded_at = ? WHERE id = ?",
                    utc(clock.instant()), trip.bookingId());
        }
        return sent;
    }

    private static OffsetDateTime utc(Instant instant) {
        return OffsetDateTime.ofInstant(instant, ZoneOffset.UTC);
    }
}
