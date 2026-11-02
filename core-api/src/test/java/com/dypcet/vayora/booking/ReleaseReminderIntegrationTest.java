package com.dypcet.vayora.booking;

import static org.assertj.core.api.Assertions.assertThat;

import com.dypcet.vayora.PostgresIntegrationTest;
import com.dypcet.vayora.booking.BookingService.Booking;
import com.dypcet.vayora.identity.IdentityService;
import com.dypcet.vayora.identity.UserRole;
import com.dypcet.vayora.notification.NotificationService;
import com.dypcet.vayora.notification.NotificationService.Notification;
import com.dypcet.vayora.notification.NotificationService.Type;
import com.dypcet.vayora.ride.RideService;
import com.dypcet.vayora.ride.RideService.PublishRide;
import com.dypcet.vayora.ride.RideService.StopInput;
import com.dypcet.vayora.vehicle.VehicleService;
import java.math.BigDecimal;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.TestPropertySource;

/**
 * Feature 79: one reminder per confirmed seat, 48 hours before boarding, to release it if
 * plans changed; nothing is cancelled. With targeting off, everyone alike: the window and the
 * message are the same whoever is asked. Targeting is TargetedReminderIntegrationTest.
 */
@TestPropertySource(properties = "vayora.reminders.targeting.enabled=false")
class ReleaseReminderIntegrationTest extends PostgresIntegrationTest {

    private static final List<StopInput> STOPS = List.of(
            new StopInput("Kolhapur", 16.7050, 74.2433, 0),
            new StopInput("Pune", 18.5204, 73.8567, 270));

    @Autowired
    private IdentityService identity;

    @Autowired
    private VehicleService vehicles;

    @Autowired
    private RideService rides;

    @Autowired
    private BookingService bookings;

    @Autowired
    private ReleaseReminders reminders;

    @Autowired
    private NotificationService notifications;

    @Autowired
    private JdbcTemplate jdbc;

    private long driverId;

    @BeforeEach
    void setUp() {
        jdbc.update("TRUNCATE events");
        // Bookings left by other tests must not be reminded here.
        jdbc.update("UPDATE bookings SET release_reminded_at = now() WHERE release_reminded_at IS NULL");
        driverId = user(UserRole.DRIVER);
    }

    @Test
    void aSeatInsideTheWindowIsRemindedOnceWithTheRefundItWouldGetNow() {
        long passenger = user(UserRole.PASSENGER);
        Booking booking = bookedDaysAgo(passenger, Duration.ofHours(47), true);

        assertThat(reminders.remindDue()).isEqualTo(1);
        assertThat(reminders.remindDue()).isZero();

        // 47 hours ahead is in the 50% tier: half of the Rs 400 fare.
        assertThat(notifications.forUser(passenger)).filteredOn(n -> n.type() == Type.RELEASE_REMINDER)
                .singleElement().extracting(Notification::message).asString()
                .startsWith("Your seat from Kolhapur to Pune leaves ")
                .contains("you would owe your driver Rs 200.00 of your Rs 400.00 fare")
                .endsWith("If you are still travelling, there is nothing to do.");
        assertThat(jdbc.queryForObject("""
                SELECT payload->>'action' FROM events
                WHERE event_type = 'intervention_issued' AND (payload->>'booking_id')::bigint = ?""",
                String.class, booking.id())).isEqualTo("release_reminder");
        assertThat(jdbc.queryForObject("""
                SELECT payload->'survival_probability' IS NOT NULL FROM events
                WHERE event_type = 'intervention_issued'""",
                Boolean.class)).isFalse();
        // Nothing is done to the booking.
        assertThat(jdbc.queryForObject("SELECT status FROM bookings WHERE id = ?", String.class, booking.id()))
                .isEqualTo("CONFIRMED");
    }

    @Test
    void notBeforeTheWindowNorForABookingMadeInsideIt() {
        bookedDaysAgo(user(UserRole.PASSENGER), Duration.ofHours(50), true);
        long rideId = ride(Duration.ofHours(30), true);
        bookings.request(user(UserRole.PASSENGER), rideId, 0, 1, 1, null);

        assertThat(reminders.remindDue()).isZero();
    }

    @Test
    void onlyConfirmedSeatsOnRidesStillToLeave() {
        bookedDaysAgo(user(UserRole.PASSENGER), Duration.ofHours(40), false); // pending
        long cancelling = user(UserRole.PASSENGER);
        Booking cancelled = bookedDaysAgo(cancelling, Duration.ofHours(40), true);
        bookings.cancel(cancelling, cancelled.id());

        assertThat(reminders.remindDue()).isZero();
    }

    @Test
    void withTargetingOffEveryPassengerIsAskedAlikeWhateverTheModelSays() {
        Booking scoredRisky = bookedDaysAgo(user(UserRole.PASSENGER), Duration.ofHours(40), true);
        bookedDaysAgo(user(UserRole.PASSENGER), Duration.ofHours(40), true);
        // A low score is on record for one booking only: the reminder must not depend on it.
        jdbc.update("""
                INSERT INTO events (sim_time, actor_type, event_type, payload)
                VALUES (now(), 'platform', 'hazard_scored',
                        jsonb_build_object('booking_id', ?::bigint, 'survival_probability', 0.1))""",
                scoredRisky.id());

        assertThat(reminders.remindDue()).isEqualTo(2);
    }

    /** A booking on a ride leaving in {@code untilBoarding}, made three days ago. */
    private Booking bookedDaysAgo(long passenger, Duration untilBoarding, boolean instantBooking) {
        long rideId = ride(untilBoarding, instantBooking);
        Booking booking = bookings.request(passenger, rideId, 0, 1, 1, null);
        jdbc.update("UPDATE bookings SET created_at = now() - interval '3 days' WHERE id = ?", booking.id());
        return booking;
    }

    private long ride(Duration untilDeparture, boolean instantBooking) {
        long vehicleId = vehicles.create(driverId, "Maruti", "Ertiga", 2022, "Silver", 7).id();
        return rides.publish(driverId, new PublishRide(vehicleId, Instant.now().plus(untilDeparture), 3,
                instantBooking, STOPS, List.of(new BigDecimal("400.00")))).id();
    }

    private long user(UserRole role) {
        return identity.register(UUID.randomUUID() + "@example.test", "correct-horse-battery",
                "Test " + role, role).id();
    }
}
