package com.dypcet.vayora.booking;

import com.dypcet.vayora.booking.BookingService.Booking;
import static com.dypcet.vayora.booking.BookingService.conflict;
import static com.dypcet.vayora.booking.BookingService.notFound;

import com.dypcet.vayora.booking.BookingService.Cancelled;
import com.dypcet.vayora.booking.BookingService.Decided;
import com.dypcet.vayora.booking.BookingService.LockedRide;
import com.dypcet.vayora.bus.BusService.Bus;
import com.dypcet.vayora.bus.BusService;
import com.dypcet.vayora.eventlog.EventLogService;
import com.dypcet.vayora.eventlog.EventType;
import com.dypcet.vayora.eventlog.HasActor;
import com.dypcet.vayora.notification.NotificationService.Type;
import com.dypcet.vayora.notification.NotificationService;
import com.dypcet.vayora.notification.Text;
import com.dypcet.vayora.payment.PaymentService.DueReason;
import com.dypcet.vayora.payment.PaymentService;
import com.dypcet.vayora.referral.ReferralService;
import com.dypcet.vayora.ride.RideService.Candidate;
import com.dypcet.vayora.ride.RideService.Ride;
import com.dypcet.vayora.ride.RideService;
import com.dypcet.vayora.routing.RouteService.Point;
import java.time.Clock;
import java.time.Duration;
import java.time.LocalTime;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * What a driver does to a whole ride: start it, complete it, withdraw it.
 *
 * <p>Trip events are per passenger booking, not per vehicle: the primary metric divides
 * completed trips by searches, and a search is one passenger's. Every booking that gets a
 * {@code trip_started} later gets exactly one {@code trip_completed} or {@code trip_failed}.
 *
 * <p>Takes the ride lock first, like {@link BookingService}.
 */
@Service
public class TripService {

    record Trip(long bookingId, long rideId, long passengerId, long driverId) implements HasActor {
        @Override
        public String actorType() {
            return "driver";
        }

        @Override
        public Long actorId() {
            return driverId;
        }
    }

    record TripFailed(long bookingId, long rideId, long passengerId, long driverId,
            String reason) implements HasActor {
        @Override
        public String actorType() {
            return "driver";
        }

        @Override
        public Long actorId() {
            return driverId;
        }
    }

    // How far either side of the withdrawn ride an alternative may leave.
    private static final Duration ALTERNATIVES_WINDOW = Duration.ofHours(3);
    private static final ZoneId INDIA_ZONE = ZoneId.of("Asia/Kolkata");

    private final JdbcTemplate jdbc;
    private final ReferralService referrals;
    private final BusService buses;
    private final FlexibleRebooking flexible;
    private final BookingService bookings;
    private final PaymentService payments;
    private final NotificationService notifications;
    private final RideService rides;
    private final EventLogService events;
    private final Clock clock;
    private final Duration earlyStart;

    public TripService(JdbcTemplate jdbc, BookingService bookings, PaymentService payments,
            NotificationService notifications, RideService rides,
            EventLogService events, Clock clock,
            @Value("${vayora.trip.early-start}") Duration earlyStart, ReferralService referrals,
            BusService buses, FlexibleRebooking flexible) {
        this.flexible = flexible;
        this.referrals = referrals;
        this.buses = buses;
        this.jdbc = jdbc;
        this.bookings = bookings;
        this.payments = payments;
        this.notifications = notifications;
        this.rides = rides;
        this.events = events;
        this.clock = clock;
        this.earlyStart = earlyStart;
    }

    /**
     * Starts the ride. Requests the driver never answered are rejected and their seats
     * returned; each confirmed booking becomes a trip.
     */
    @Transactional
    public Ride start(long driverId, long rideId) {
        LockedRide ride = lockOwned(driverId, rideId);
        if (!"SCHEDULED".equals(ride.status())) {
            throw conflict("Only a scheduled ride can be started");
        }
        if (clock.instant().isBefore(ride.departureTime().minus(earlyStart))) {
            throw conflict("It is too early to start this ride");
        }
        setStatus(rideId, "IN_PROGRESS");
        jdbc.update("UPDATE rides SET started_at = ? WHERE id = ?",
                OffsetDateTime.ofInstant(clock.instant(), ZoneOffset.UTC), rideId);
        for (Booking unanswered : bookings.lockAll(rideId, BookingStatus.PENDING)) {
            bookings.move(unanswered, BookingStatus.REJECTED);
            // Never answered: not the driver's decision, whoever started the ride.
            bookings.recordRejectedBy(unanswered.id(), "platform");
            payments.oweNothing(unanswered.id());
            bookings.notifyDeclined(unanswered);
            events.write(EventType.BOOKING_REJECTED,
                    new Decided(unanswered.id(), rideId, driverId, false));
        }
        for (Booking booking : bookings.lockAll(rideId, BookingStatus.CONFIRMED)) {
            events.write(EventType.TRIP_STARTED,
                    new Trip(booking.id(), rideId, booking.passengerId(), driverId));
        }
        return rides.get(rideId);
    }

    /** Records that a passenger with a confirmed booking never boarded. */
    @Transactional
    public Booking noShow(long driverId, long bookingId) {
        Long rideId = bookings.rideOf(bookingId);
        if (rideId == null) {
            throw notFound("Booking not found");
        }
        LockedRide ride = bookings.lockRide(rideId);
        if (ride.driverId() != driverId) {
            throw notFound("Booking not found");
        }
        if (!"IN_PROGRESS".equals(ride.status())) {
            throw conflict("A no-show can only be recorded while the ride is in progress");
        }
        Booking booking = bookings.lockBooking(bookingId);
        bookings.move(booking, BookingStatus.NO_SHOW);
        payments.oweInFull(bookingId, DueReason.PASSENGER_NO_SHOW);
        notifications.send(booking.passengerId(), Type.MARKED_NO_SHOW, payments.due(bookingId)
                .map(due -> Text.of("The driver reported that you did not board for {seats}. The full Rs {amount}"
                        + " is owed to them: see My bookings.",
                        "seats", BookingService.seatsText(booking), "amount", due.toPlainString()))
                .orElseGet(() -> Text.of("The driver reported that you did not board for {seats}.",
                        "seats", BookingService.seatsText(booking))), bookingId);
        events.write(EventType.TRIP_FAILED, new TripFailed(bookingId, rideId,
                booking.passengerId(), driverId, "passenger_no_show"));
        return bookings.load(bookingId);
    }

    /** Ends the ride. Every booking still confirmed is completed. */
    @Transactional
    public Ride complete(long driverId, long rideId) {
        LockedRide ride = lockOwned(driverId, rideId);
        if (!"IN_PROGRESS".equals(ride.status())) {
            throw conflict("Only a ride in progress can be completed");
        }
        setStatus(rideId, "COMPLETED");
        List<Long> travelled = new ArrayList<>();
        for (Booking booking : bookings.lockAll(rideId, BookingStatus.CONFIRMED)) {
            bookings.move(booking, BookingStatus.COMPLETED);
            payments.oweInFull(booking.id(), DueReason.TRIP_COMPLETED);
            notifications.send(booking.passengerId(), Type.TRIP_COMPLETED, payments.due(booking.id())
                    .map(due -> Text.of("Your trip from {from} to {to} is complete. Pay your driver Rs {amount}, in"
                            + " cash or by UPI: see My bookings.",
                            "from", booking.fromStop(), "to", booking.toStop(), "amount", due.toPlainString()))
                    .orElseGet(() -> Text.of("Your trip from {from} to {to} is complete. You can rate your driver in"
                            + " My bookings.", "from", booking.fromStop(), "to", booking.toStop())), booking.id());
            events.write(EventType.TRIP_COMPLETED,
                    new Trip(booking.id(), rideId, booking.passengerId(), driverId));
            travelled.add(booking.passengerId());
        }
        // A completed trip qualifies anyone among them who was referred.
        travelled.add(driverId);
        referrals.qualify(travelled);
        return rides.get(rideId);
    }

    /**
     * Withdraws every ride of this ride's series that has not yet run, each exactly as if
     * withdrawn on its own: every passenger owes nothing and is told of other rides.
     *
     * @return how many rides were withdrawn
     */
    @Transactional
    public int cancelSeries(long driverId, long rideId) {
        lockOwned(driverId, rideId);
        List<Long> scheduled = jdbc.queryForList("""
                SELECT s.id FROM rides r JOIN rides s ON s.series_id = r.series_id
                WHERE r.id = ? AND r.series_id IS NOT NULL AND s.status = 'SCHEDULED'
                ORDER BY s.departure_time""",
                Long.class, rideId);
        if (scheduled.isEmpty()) {
            throw conflict("This ride is not part of a series with rides still to run");
        }
        scheduled.forEach(id -> cancel(driverId, id));
        return scheduled.size();
    }

    /**
     * Up to three other rides that could take this passenger, as one sentence for the
     * notification, or nothing if there are none. A suggestion only: nothing is booked.
     */
    private Text otherRides(long rideId, Booking booking) {
        List<Point> ends = jdbc.query("""
                SELECT ST_Y(location::geometry) AS lat, ST_X(location::geometry) AS lon
                FROM ride_stops WHERE ride_id = ? AND seq IN (?, ?) ORDER BY seq""",
                (rs, n) -> new Point(rs.getDouble("lat"), rs.getDouble("lon")),
                rideId, booking.fromSeq(), booking.toSeq());
        // From the passenger's own pickup point if they had one, not the stop before it.
        Point from = booking.pickupLat() != null && booking.pickupLon() != null
                ? new Point(booking.pickupLat(), booking.pickupLon()) : ends.get(0);
        List<Candidate> others = rides.alternatives(booking.passengerId(), rideId, from, ends.get(1),
                booking.boardingTime(), booking.seats(), ALTERNATIVES_WINDOW, 3);
        if (others.isEmpty()) {
            List<Text> listed = buses(rideId, booking);
            return listed.isEmpty() ? Text.of("No other ride with seats leaves near that time.")
                    : Text.of("No other ride with seats leaves near that time. Buses listed by VAYORA staff"
                            + " (check with the operator before travelling): {buses}.", "buses", listed);
        }
        DateTimeFormatter time = DateTimeFormatter.ofPattern("HH:mm", Locale.ENGLISH).withZone(INDIA_ZONE);
        return Text.of("Other rides that could take you: {rides}. Search again to book one.", "rides",
                others.stream().map(c -> c.detourMinutes() != null
                        ? Text.of("{time} with {driver}, picking you up at your own point", "time",
                                time.format(c.boardingTime()), "driver", c.driverName())
                        : Text.of("{time} from {stop} with {driver}", "time",
                                time.format(c.boardingTime()), "stop", c.fromStop(), "driver", c.driverName())).toList());
    }

    /**
     * Up to three buses between the passenger's stops leaving from an hour before their
     * boarding time, as one sentence, or nothing. Administrators enter these; they are not
     * checked against the operator, and the sentence says so.
     */
    private List<Text> buses(long rideId, Booking booking) {
        List<String> names = jdbc.queryForList(
                "SELECT name FROM ride_stops WHERE ride_id = ? AND seq IN (?, ?) ORDER BY seq",
                String.class, rideId, booking.fromSeq(), booking.toSeq());
        LocalTime boarding = booking.boardingTime().atZone(INDIA_ZONE).toLocalTime();
        LocalTime from = boarding.isBefore(LocalTime.of(1, 0)) ? LocalTime.MIN : boarding.minusHours(1);
        List<Bus> found = buses.between(names.get(0), names.get(1), from, 3);
        return found.stream()
                .map(b -> Text.of("{time} {operator}, Rs {fare}", "time", b.departs().toString(),
                        "operator", b.operator(), "fare", b.fare().toPlainString()))
                .toList();
    }

    /** Withdraws a ride that has not started, cancelling every live booking on it. */
    @Transactional
    public Ride cancel(long driverId, long rideId) {
        LockedRide ride = lockOwned(driverId, rideId);
        if (!"SCHEDULED".equals(ride.status())) {
            throw conflict("Only a scheduled ride can be cancelled");
        }
        setStatus(rideId, "CANCELLED");
        for (BookingStatus live : new BookingStatus[] {BookingStatus.PENDING, BookingStatus.CONFIRMED}) {
            for (Booking booking : bookings.lockAll(rideId, live)) {
                bookings.move(booking, BookingStatus.CANCELLED);
                bookings.recordCancelledBy(booking.id(), "driver");
                payments.oweNothing(booking.id());
                flexible.afterWithdrawal(rideId, booking);
                notifications.send(booking.passengerId(), Type.RIDE_CANCELLED,
                        Text.of("The driver cancelled the ride you booked for {seats}. You owe nothing."
                                + " {more}", "seats", BookingService.seatsText(booking),
                                "more", otherRides(rideId, booking)),
                        booking.id());
                events.write(EventType.BOOKING_CANCELLED, new Cancelled(booking.id(), rideId,
                        booking.passengerId(), booking.seats(), booking.boardingTime(),
                        "driver", driverId));
            }
        }
        return rides.get(rideId);
    }

    /** Someone else's ride looks the same as one that does not exist. */
    private LockedRide lockOwned(long driverId, long rideId) {
        LockedRide ride = bookings.lockRide(rideId);
        if (ride == null || ride.driverId() != driverId) {
            throw notFound("Ride not found");
        }
        return ride;
    }

    private void setStatus(long rideId, String status) {
        jdbc.update("UPDATE rides SET status = ? WHERE id = ?", status, rideId);
    }
}
