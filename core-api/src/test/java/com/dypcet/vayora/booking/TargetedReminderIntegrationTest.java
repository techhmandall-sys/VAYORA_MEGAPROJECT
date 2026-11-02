package com.dypcet.vayora.booking;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.dypcet.vayora.PostgresIntegrationTest;
import com.dypcet.vayora.booking.BookingService.Booking;
import com.dypcet.vayora.hazard.IntelContactScheduler;
import com.dypcet.vayora.hazard.IntelContactScheduler.Candidate;
import com.dypcet.vayora.hazard.IntelContactScheduler.Limits;
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
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

/**
 * Features 79 and 80 on the platform: the release reminder asks only bookings the
 * durability model rates below the threshold (0.8), as intel's contact scheduler chooses
 * within the budget, replaced here. Nothing is ever cancelled.
 */
class TargetedReminderIntegrationTest extends PostgresIntegrationTest {

    private static final List<StopInput> STOPS = List.of(
            new StopInput("Kolhapur", 16.7050, 74.2433, 0),
            new StopInput("Pune", 18.5204, 73.8567, 270));

    @MockitoBean
    private IntelContactScheduler scheduler;

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
    @SuppressWarnings("unchecked")
    void onlyBookingsTheModelRatesBelowTheThresholdAreAskedAsTheSchedulerChooses() {
        Booking likely = due(user(UserRole.PASSENGER), 0.3);
        Booking unsure = due(user(UserRole.PASSENGER), 0.6);
        Booking safe = due(user(UserRole.PASSENGER), 0.95);
        Booking unscored = due(user(UserRole.PASSENGER), null);
        when(scheduler.plan(any(), any())).thenReturn(Optional.of(List.of(likely.id())));

        assertThat(reminders.remindDue()).isEqualTo(1);

        ArgumentCaptor<List<Candidate>> offered = ArgumentCaptor.forClass(List.class);
        ArgumentCaptor<Limits> limits = ArgumentCaptor.forClass(Limits.class);
        verify(scheduler).plan(offered.capture(), limits.capture());
        assertThat(offered.getValue()).extracting(Candidate::bookingId).containsExactlyInAnyOrder(likely.id(), unsure.id());
        assertThat(offered.getValue()).filteredOn(c -> c.bookingId() == likely.id()).singleElement().satisfies(c -> {
            assertThat(c.survivalProbability()).isEqualTo(0.3);
            assertThat(c.seats()).isEqualTo(1);
            assertThat(c.hoursToDeparture()).isBetween(39.0, 40.0);
        });
        assertThat(limits.getValue()).isEqualTo(new Limits(2, 1, 4, 168, 5));

        assertThat(reminded()).containsExactly(likely.id());
        assertThat(jdbc.queryForObject("""
                SELECT payload->>'survival_probability' || ' ' || (payload->>'chosen_by') FROM events
                WHERE event_type = 'intervention_issued'""", String.class)).isEqualTo("0.3 scheduler");
        // The message is the same as anyone's: nothing about a model or a risk.
        assertThat(notifications.forUser(passengerOf(likely))).filteredOn(n -> n.type() == Type.RELEASE_REMINDER)
                .singleElement().extracting(Notification::message).asString()
                .startsWith("Your seat from Kolhapur to Pune leaves ")
                .doesNotContainIgnoringCase("model").doesNotContainIgnoringCase("risk").doesNotContainIgnoringCase("likely");

        // Not chosen, so due again: the next run may choose it. The safe and the unscored never are.
        when(scheduler.plan(any(), any())).thenReturn(Optional.of(List.of(unsure.id())));
        assertThat(reminders.remindDue()).isEqualTo(1);
        assertThat(reminded()).containsExactlyInAnyOrder(likely.id(), unsure.id());
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM bookings WHERE id IN (?, ?, ?, ?) AND status = 'CONFIRMED'",
                Integer.class, likely.id(), unsure.id(), safe.id(), unscored.id())).isEqualTo(4);
    }

    @Test
    void nobodyIsAskedWhileTheSchedulerCannotBeReachedAndTheyStayDue() {
        Booking likely = due(user(UserRole.PASSENGER), 0.2);
        when(scheduler.plan(any(), any())).thenReturn(Optional.empty());

        assertThat(reminders.remindDue()).isZero();
        assertThat(reminded()).isEmpty();

        when(scheduler.plan(any(), any())).thenReturn(Optional.of(List.of(likely.id())));
        assertThat(reminders.remindDue()).isEqualTo(1);
    }

    /** A confirmed booking 40 hours from boarding, made three days ago, with this latest score. */
    private Booking due(long passenger, Double survival) {
        long vehicleId = vehicles.create(driverId, "Maruti", "Ertiga", 2022, "Silver", 7).id();
        long rideId = rides.publish(driverId, new PublishRide(vehicleId, Instant.now().plus(Duration.ofHours(40)), 3,
                true, STOPS, List.of(new BigDecimal("400.00")))).id();
        Booking booking = bookings.request(passenger, rideId, 0, 1, 1, null);
        jdbc.update("UPDATE bookings SET created_at = now() - interval '3 days' WHERE id = ?", booking.id());
        if (survival != null) {
            jdbc.update("""
                    INSERT INTO events (sim_time, actor_type, event_type, payload)
                    VALUES (now(), 'platform', 'hazard_scored',
                            jsonb_build_object('booking_id', ?::bigint, 'survival_probability', ?::float8,
                                               'model_version', 'h2-cox'))""",
                    booking.id(), survival);
        }
        return booking;
    }

    private List<Long> reminded() {
        return jdbc.queryForList("""
                SELECT (payload->>'booking_id')::bigint FROM events
                WHERE event_type = 'intervention_issued' ORDER BY id""", Long.class);
    }

    private long passengerOf(Booking booking) {
        return jdbc.queryForObject("SELECT passenger_id FROM bookings WHERE id = ?", Long.class, booking.id());
    }

    private long user(UserRole role) {
        return identity.register(UUID.randomUUID() + "@example.test", "correct-horse-battery",
                "Test " + role, role).id();
    }
}
