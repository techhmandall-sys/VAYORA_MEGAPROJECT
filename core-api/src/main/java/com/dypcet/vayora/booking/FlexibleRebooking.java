package com.dypcet.vayora.booking;

import com.dypcet.vayora.booking.BookingService.Booking;
import com.dypcet.vayora.notification.NotificationService;
import com.dypcet.vayora.notification.NotificationService.Type;
import com.dypcet.vayora.notification.Text;
import com.dypcet.vayora.payment.PaymentChoice;
import com.dypcet.vayora.ride.RideService;
import com.dypcet.vayora.ride.RideService.Candidate;
import com.dypcet.vayora.routing.RouteService.Point;
import java.time.Duration;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.server.ResponseStatusException;

/**
 * When a driver withdraws a ride, books each passenger who chose a flexible tier on the
 * closest other ride that fits, as they agreed to when booking. A new booking is like any
 * other: a fresh payment hold, and on a ride the driver approves, a request.
 *
 * <p>It runs after the withdrawal has committed, each passenger in a transaction of their
 * own, so a rebooking that fails never undoes the withdrawal or anyone else's refund.
 */
@Service
public class FlexibleRebooking {

    private static final Logger log = LoggerFactory.getLogger(FlexibleRebooking.class);
    private static final ZoneId INDIA_ZONE = ZoneId.of("Asia/Kolkata");
    // Enough to step past rides this passenger cannot book (a women-only ride, say).
    private static final int TRIED = 5;

    /** What is needed after the commit, read while the booking was still locked. */
    /** @param paymentMethod null for a booking paid after the ride, which is rebooked the same way */
    record Withdrawn(long rideId, Booking booking, FlexTier tier, Point from, Point to, String paymentMethod) {
    }

    private final BookingService bookings;
    private final RideService rides;
    private final NotificationService notifications;
    private final JdbcTemplate jdbc;
    private final TransactionTemplate ownTransaction;
    private final Duration flexibleWindow;

    public FlexibleRebooking(BookingService bookings, RideService rides, NotificationService notifications,
            JdbcTemplate jdbc, PlatformTransactionManager transactions,
            @Value("${vayora.tiers.flexible-window}") Duration flexibleWindow) {
        this.bookings = bookings;
        this.rides = rides;
        this.notifications = notifications;
        this.jdbc = jdbc;
        this.ownTransaction = new TransactionTemplate(transactions);
        this.ownTransaction.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
        this.flexibleWindow = flexibleWindow;
    }

    /**
     * Called inside the withdrawal, for a booking it is cancelling. Does nothing for an exact
     * booking; otherwise arranges the rebooking for after the withdrawal commits.
     */
    void afterWithdrawal(long rideId, Booking booking) {
        FlexTier tier = booking.flexTier();
        if (tier == FlexTier.EXACT) {
            return;
        }
        List<Point> ends = jdbc.query("""
                SELECT ST_Y(location::geometry) AS lat, ST_X(location::geometry) AS lon
                FROM ride_stops WHERE ride_id = ? AND seq IN (?, ?) ORDER BY seq""",
                (rs, n) -> new Point(rs.getDouble("lat"), rs.getDouble("lon")),
                rideId, booking.fromSeq(), booking.toSeq());
        List<String> method = jdbc.queryForList("SELECT method FROM payment_intents WHERE booking_id = ?",
                String.class, booking.id());
        // A passenger picked up away from the stops is where the pickup was, not at the stop
        // before it, which may be far from them: that is why they were picked up.
        Point from = booking.pickupLat() != null && booking.pickupLon() != null
                ? new Point(booking.pickupLat(), booking.pickupLon()) : ends.get(0);
        Withdrawn withdrawn = new Withdrawn(rideId, booking, tier, from, ends.get(1),
                booking.payAfterRide() ? null : method.isEmpty() ? PaymentChoice.Method.CARD.name() : method.get(0));
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override
            public void afterCommit() {
                rebook(withdrawn);
            }
        });
    }

    void rebook(Withdrawn withdrawn) {
        Booking was = withdrawn.booking();
        Duration window = withdrawn.tier() == FlexTier.FLEXIBLE ? flexibleWindow : Duration.ofHours(24);
        List<Candidate> fits;
        try {
            fits = rides.alternatives(was.passengerId(), withdrawn.rideId(), withdrawn.from(), withdrawn.to(),
                    was.boardingTime(), was.seats(), window, 50).stream()
                    .sorted(Comparator.comparing(c -> Duration.between(was.boardingTime(), c.boardingTime()).abs()))
                    .limit(TRIED)
                    .toList();
        } catch (RuntimeException e) {
            log.warn("Flexible rebooking of booking {} not tried: {}", was.id(), e.getMessage());
            fits = List.of();
        }
        for (Candidate ride : fits) {
            // A ride that picks the passenger up at their own point is booked with that point.
            Point pickup = ride.detourMinutes() != null ? withdrawn.from() : null;
            boolean payAfterRide = withdrawn.paymentMethod() == null;
            try {
                Booking booked = ownTransaction.execute(status -> bookings.request(was.passengerId(), ride.rideId(),
                        ride.fromSeq(), ride.toSeq(), was.seats(), payAfterRide ? null
                                : new PaymentChoice(PaymentChoice.Method.valueOf(withdrawn.paymentMethod()), null), null,
                        withdrawn.tier(), pickup, null, null, payAfterRide));
                boolean confirmed = booked.status() == BookingStatus.CONFIRMED;
                tell(was, pickup != null
                        ? Text.of(confirmed
                                        ? "As you chose a flexible booking, you are booked on the {time} ride with {driver}, who will pick you up at your own point."
                                        : "As you chose a flexible booking, you have asked for a seat on the {time} ride with {driver}, who would pick you up at your own point. The driver will answer.",
                                "time", time(ride), "driver", ride.driverName())
                        : Text.of(confirmed
                                        ? "As you chose a flexible booking, you are booked on the {time} ride from {stop} with {driver}."
                                        : "As you chose a flexible booking, you have asked for a seat on the {time} ride from {stop} with {driver}. The driver will answer.",
                                "time", time(ride), "stop", ride.fromStop(), "driver", ride.driverName()));
                return;
            } catch (ResponseStatusException e) {
                // Full, women-only, or too close to departure for an answer: try the next.
                log.info("Flexible rebooking of booking {} skipped ride {}: {}", was.id(), ride.rideId(), e.getReason());
            } catch (RuntimeException e) {
                log.warn("Flexible rebooking of booking {} failed on ride {}: {}", was.id(), ride.rideId(), e.getMessage());
            }
        }
        tell(was, Text.of("You chose a flexible booking, but no other ride with seats fits it. Nothing new has been booked."));
    }

    /**
     * In a transaction of its own: this runs after the withdrawal committed, when a
     * notification waiting for "after commit" would otherwise wait for a commit that has
     * already happened, and never be written.
     */
    private void tell(Booking was, Text text) {
        ownTransaction.executeWithoutResult(status ->
                notifications.send(was.passengerId(), Type.RIDE_CANCELLED, text, was.id()));
    }

    private static String time(Candidate ride) {
        return DateTimeFormatter.ofPattern("HH:mm", Locale.ENGLISH).withZone(INDIA_ZONE).format(ride.boardingTime());
    }
}
