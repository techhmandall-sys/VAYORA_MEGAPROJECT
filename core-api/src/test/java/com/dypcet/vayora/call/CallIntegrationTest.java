package com.dypcet.vayora.call;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.dypcet.vayora.PostgresIntegrationTest;
import com.dypcet.vayora.booking.BookingService;
import com.dypcet.vayora.call.CallService.Relay;
import com.dypcet.vayora.identity.IdentityService;
import com.dypcet.vayora.identity.TokenService;
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
import java.util.concurrent.atomic.AtomicLong;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.web.server.ResponseStatusException;

/** Feature 61, simulated: who may call whom and when, and that nothing reveals a number. */
@AutoConfigureMockMvc
class CallIntegrationTest extends PostgresIntegrationTest {

    private static final List<StopInput> STOPS = List.of(
            new StopInput("Kolhapur", 16.7050, 74.2433, 0),
            new StopInput("Pune", 18.5204, 73.8567, 270));
    // Phone numbers belong to one account each, so every test user gets a fresh one.
    private static final AtomicLong PHONES = new AtomicLong(9_700_000_000L + System.nanoTime() % 1_000_000L);

    @Autowired
    private IdentityService identity;

    @Autowired
    private VehicleService vehicles;

    @Autowired
    private RideService rides;

    @Autowired
    private BookingService bookings;

    @Autowired
    private CallService calls;

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
        driverId = user(UserRole.DRIVER, true);
        passengerId = user(UserRole.PASSENGER, true);
    }

    @Test
    void eachSideCanCallTheOtherAndTheOtherIsToldNoCallCameThrough() {
        long bookingId = booking(Duration.ofHours(3), true);

        Relay toDriver = calls.call(passengerId, bookingId);
        Relay toPassenger = calls.call(driverId, bookingId);

        assertThat(toDriver).isEqualTo(new Relay("mock", "Test DRIVER"));
        assertThat(toPassenger).isEqualTo(new Relay("mock", "Test PASSENGER"));
        assertThat(notifications.forUser(driverId)).filteredOn(n -> n.type() == Type.CALL_REQUESTED)
                .extracting(Notification::message)
                .containsExactly("Test PASSENGER tried to call you through VAYORA. Calls are simulated, "
                        + "so no call came through. Reply in the ride's chat.");
        assertThat(notifications.forUser(passengerId)).filteredOn(n -> n.type() == Type.CALL_REQUESTED).hasSize(1);
    }

    @Test
    void theAnswerOverHttpCarriesNoPhoneNumber() throws Exception {
        long bookingId = booking(Duration.ofHours(3), true);
        String phone = jdbc.queryForObject("SELECT phone FROM users WHERE id = ?", String.class, driverId);

        String body = mvc.perform(post("/api/v1/bookings/" + bookingId + "/call")
                        .header("Authorization", "Bearer " + tokens.issue(passengerId, UserRole.PASSENGER)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.provider").value("mock"))
                .andReturn().getResponse().getContentAsString();

        assertThat(body).doesNotContain(phone.substring(phone.length() - 10));
    }

    @Test
    void nobodyElseMayCallAndTheBookingLooksAbsentToThem() {
        long bookingId = booking(Duration.ofHours(3), true);

        assertStatus(HttpStatus.NOT_FOUND, "Booking not found",
                () -> calls.call(user(UserRole.PASSENGER, true), bookingId));
        assertStatus(HttpStatus.NOT_FOUND, "Booking not found", () -> calls.call(passengerId, Long.MAX_VALUE));
    }

    @Test
    void onlyWhileTheBookingIsConfirmedAndOnlyShortlyBeforeTheTrip() {
        long pending = booking(Duration.ofHours(3), false);
        long farOff = booking(Duration.ofDays(3), true);

        assertStatus(HttpStatus.CONFLICT, "A call can only be made while the booking is confirmed",
                () -> calls.call(passengerId, pending));
        assertStatus(HttpStatus.CONFLICT, "It is too early to call: calls open shortly before the trip",
                () -> calls.call(passengerId, farOff));
    }

    @Test
    void onlyBetweenConfirmedPhoneNumbers() {
        long bookingId = booking(Duration.ofHours(3), true);
        jdbc.update("UPDATE users SET phone_verified_at = NULL WHERE id = ?", driverId);

        assertStatus(HttpStatus.CONFLICT, "They have no confirmed phone number. Use the chat instead.",
                () -> calls.call(passengerId, bookingId));
        assertStatus(HttpStatus.CONFLICT, "Confirm your phone number on your account page before calling",
                () -> calls.call(driverId, bookingId));
        assertThat(notifications.forUser(driverId)).noneMatch(n -> n.type() == Type.CALL_REQUESTED);
    }

    private long booking(Duration untilDeparture, boolean instantBooking) {
        long vehicleId = vehicles.create(driverId, "Maruti", "Ertiga", 2022, "Silver", 7).id();
        long rideId = rides.publish(driverId, new PublishRide(vehicleId, Instant.now().plus(untilDeparture), 3,
                instantBooking, STOPS, List.of(new BigDecimal("400.00")))).id();
        return bookings.request(passengerId, rideId, 0, 1, 1, null).id();
    }

    private long user(UserRole role, boolean confirmedPhone) {
        long id = identity.register(UUID.randomUUID() + "@example.test", "correct-horse-battery",
                "Test " + role, role).id();
        if (confirmedPhone) {
            jdbc.update("UPDATE users SET phone = ?, phone_verified_at = now() WHERE id = ?",
                    "+91" + PHONES.incrementAndGet(), id);
        }
        return id;
    }

    private static void assertStatus(HttpStatus expected, String reason, Runnable action) {
        assertThatThrownBy(action::run).isInstanceOfSatisfying(ResponseStatusException.class, e -> {
            assertThat(e.getStatusCode()).isEqualTo(expected);
            assertThat(e.getReason()).isEqualTo(reason);
        });
    }
}
