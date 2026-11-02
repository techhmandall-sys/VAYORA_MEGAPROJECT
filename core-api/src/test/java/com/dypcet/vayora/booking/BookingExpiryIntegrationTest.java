package com.dypcet.vayora.booking;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.dypcet.vayora.PostgresIntegrationTest;
import com.dypcet.vayora.booking.BookingService.Booking;
import com.dypcet.vayora.identity.IdentityService;
import com.dypcet.vayora.identity.TokenService;
import com.dypcet.vayora.identity.UserRole;
import com.dypcet.vayora.notification.NotificationService;
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
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.web.server.ResponseStatusException;

/** Runs with the shipped two-hour rule, which the other tests turn off. */
@AutoConfigureMockMvc
@TestPropertySource(properties = "vayora.booking.close-before-boarding=PT2H")
class BookingExpiryIntegrationTest extends PostgresIntegrationTest {

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
    private BookingExpiryJob job;

    @Autowired
    private NotificationService notifications;

    @Autowired
    private TokenService tokens;

    @Autowired
    private JdbcTemplate jdbc;

    @Autowired
    private MockMvc mvc;

    private long driverId;
    private long passengerId;

    @BeforeEach
    void setUp() {
        driverId = user(UserRole.DRIVER);
        passengerId = user(UserRole.PASSENGER);
    }

    @Test
    void aRequestNobodyAnsweredInTwelveHoursIsClosedAndEverythingGoesBack() {
        long rideId = ride(Duration.ofDays(3), false, 1);
        Booking pending = request(rideId);
        assertThat(pending.status()).isEqualTo(BookingStatus.PENDING);
        assertThat(seatsAvailable(rideId)).isZero();
        assertThat(bookings.unanswered()).doesNotContain(pending.id());
        assertThat(bookings.expire(pending.id())).isFalse(); // not yet

        age(pending.id(), Duration.ofHours(12));
        assertThat(bookings.unanswered()).contains(pending.id());
        job.closeUnanswered();

        Booking closed = bookings.load(pending.id());
        assertThat(closed.status()).isEqualTo(BookingStatus.REJECTED);
        assertThat(closed.paymentStatus()).isEqualTo("VOID");
        assertThat(seatsAvailable(rideId)).isEqualTo(1);
        assertThat(notifications.forUser(passengerId)).first().satisfies(notice -> {
            assertThat(notice.type()).isEqualTo(Type.REQUEST_EXPIRED);
            assertThat(notice.message()).contains("did not answer").contains("You owe nothing");
        });
        assertThat(notifications.forUser(driverId)).first().satisfies(notice -> {
            assertThat(notice.type()).isEqualTo(Type.REQUEST_EXPIRED);
            assertThat(notice.message()).startsWith("Test PASSENGER's request");
        });

        // The log says the platform closed it, not the driver, and why.
        assertThat(jdbc.queryForObject("""
                SELECT actor_type || ':' || COALESCE(actor_id::text, '-') || ':' || (payload->>'reason')
                FROM events
                WHERE event_type = 'booking_rejected' AND payload->>'booking_id' = ?""",
                String.class, String.valueOf(pending.id())))
                .isEqualTo("platform:-:not_answered_in_time");

        // Closed once.
        assertThat(bookings.expire(pending.id())).isFalse();
        assertThat(bookings.unanswered()).doesNotContain(pending.id());
        // The seat can be asked for again.
        assertThat(request(rideId).status()).isEqualTo(BookingStatus.PENDING);
    }

    @Test
    void aRecentRequestIsClosedOnceBoardingIsTwoHoursAway() {
        long rideId = ride(Duration.ofDays(3), false, 2);
        Booking pending = request(rideId);

        leaveIn(rideId, Duration.ofHours(2).plusMinutes(5));
        assertThat(bookings.unanswered()).doesNotContain(pending.id());

        leaveIn(rideId, Duration.ofMinutes(119));
        assertThat(bookings.unanswered()).contains(pending.id());
        assertThat(bookings.expire(pending.id())).isTrue();
        assertThat(bookings.load(pending.id()).status()).isEqualTo(BookingStatus.REJECTED);
    }

    @Test
    void anAnsweredRequestIsLeftAloneHoweverOld() {
        long rideId = ride(Duration.ofDays(3), false, 2);
        Booking accepted = request(rideId);
        bookings.accept(driverId, accepted.id());
        long instant = request(ride(Duration.ofDays(3), true, 2)).id();
        age(accepted.id(), Duration.ofDays(2));
        age(instant, Duration.ofDays(2));

        assertThat(bookings.unanswered()).doesNotContain(accepted.id(), instant);
        assertThat(bookings.expire(accepted.id())).isFalse();
        assertThat(bookings.expire(Long.MAX_VALUE)).isFalse();
        assertThat(bookings.load(accepted.id()).status()).isEqualTo(BookingStatus.CONFIRMED);
    }

    @Test
    void aRequestThatCouldNotBeAnsweredInTimeIsNotTakenAtAll() {
        long tooLate = ride(Duration.ofMinutes(90), false, 2);
        long instant = ride(Duration.ofMinutes(90), true, 2);

        assertThatThrownBy(() -> request(tooLate))
                .isInstanceOfSatisfying(ResponseStatusException.class, e -> {
                    assertThat(e.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
                    assertThat(e.getReason()).contains("too close to departure");
                });
        assertThat(seatsAvailable(tooLate)).isEqualTo(2);
        // A ride that confirms at once needs no answer, so it can be booked to the last minute.
        assertThat(request(instant).status()).isEqualTo(BookingStatus.CONFIRMED);
    }

    @Test
    void anyoneSignedInCanSeeHowLongADriverHasToAnswer() throws Exception {
        mvc.perform(get("/api/v1/booking-terms")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/v1/booking-terms")
                        .header("Authorization", "Bearer " + tokens.issue(passengerId, UserRole.PASSENGER)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.answerWithinMinutes").value(720))
                .andExpect(jsonPath("$.closesMinutesBeforeBoarding").value(120));
    }

    private Booking request(long rideId) {
        return bookings.request(passengerId, rideId, 0, 1, 1, null);
    }

    /** Makes the request look as if it was made this long ago. */
    private void age(long bookingId, Duration by) {
        jdbc.update("UPDATE bookings SET created_at = created_at - make_interval(secs => ?) WHERE id = ?",
                (double) by.toSeconds() + 1, bookingId);
    }

    private void leaveIn(long rideId, Duration untilDeparture) {
        jdbc.update("UPDATE rides SET departure_time = now() + make_interval(secs => ?) WHERE id = ?",
                (double) untilDeparture.toSeconds(), rideId);
    }

    private int seatsAvailable(long rideId) {
        return jdbc.queryForObject(
                "SELECT seats_available FROM ride_segments WHERE ride_id = ?", Integer.class, rideId);
    }

    private long ride(Duration untilDeparture, boolean instantBooking, int seats) {
        long vehicleId = vehicles.create(driverId, "Maruti", "Ertiga", 2022, "Silver", 7).id();
        return rides.publish(driverId, new PublishRide(vehicleId, Instant.now().plus(untilDeparture),
                seats, instantBooking, STOPS, List.of(new BigDecimal("520.00")))).id();
    }

    private long user(UserRole role) {
        return identity.register(UUID.randomUUID() + "@example.test", "correct-horse-battery",
                "Test " + role, role).id();
    }
}
