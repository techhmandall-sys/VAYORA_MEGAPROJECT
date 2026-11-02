package com.dypcet.vayora.call;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.dypcet.vayora.PostgresIntegrationTest;
import com.dypcet.vayora.booking.BookingService;
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
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.web.client.RestClientException;
import org.springframework.web.server.ResponseStatusException;

/** Feature 61 with a Twilio account, Twilio replaced here: a real call bridged, no number shown. */
@AutoConfigureMockMvc
class CallBridgeIntegrationTest extends PostgresIntegrationTest {

    private static final List<StopInput> STOPS = List.of(
            new StopInput("Kolhapur", 16.7050, 74.2433, 0),
            new StopInput("Pune", 18.5204, 73.8567, 270));
    private static final AtomicLong PHONES = new AtomicLong(9_600_000_000L + System.nanoTime() % 1_000_000L);

    @MockitoBean
    private TwilioVoice voice;

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
        when(voice.configured()).thenReturn(true);
        driverId = user(UserRole.DRIVER);
        passengerId = user(UserRole.PASSENGER);
    }

    @Test
    void aCallIsBridgedBetweenTheirConfirmedNumbersAndTheOtherSideIsTold() throws Exception {
        long bookingId = booking();
        when(voice.bridge(anyString(), anyString())).thenReturn("CA123");

        String body = mvc.perform(post("/api/v1/bookings/" + bookingId + "/call")
                        .header("Authorization", "Bearer " + tokens.issue(passengerId, UserRole.PASSENGER)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.provider").value("twilio"))
                .andExpect(jsonPath("$.calleeName").value("Test DRIVER"))
                .andReturn().getResponse().getContentAsString();

        // Twilio rings the passenger, then the driver: the numbers go to Twilio and nowhere else.
        verify(voice).bridge(phoneOf(passengerId), phoneOf(driverId));
        assertThat(body).doesNotContain(phoneOf(driverId).substring(3)).doesNotContain(phoneOf(passengerId).substring(3));
        assertThat(notifications.forUser(driverId)).filteredOn(n -> n.type() == Type.CALL_REQUESTED)
                .extracting(Notification::message)
                .containsExactly("Test PASSENGER is calling you through VAYORA, from the platform's number. "
                        + "Neither of you sees the other's number.");
    }

    @Test
    void aCallTwilioRefusesIsSaidSoAndNobodyIsTold() {
        long bookingId = booking();
        when(voice.bridge(anyString(), anyString())).thenThrow(new RestClientException("Twilio is down"));

        assertThatThrownBy(() -> calls.call(driverId, bookingId)).isInstanceOfSatisfying(ResponseStatusException.class, e -> {
            assertThat(e.getStatusCode()).isEqualTo(HttpStatus.SERVICE_UNAVAILABLE);
            assertThat(e.getReason()).isEqualTo("The call could not be placed. Try again, or use the ride's chat.");
        });
        assertThat(notifications.forUser(passengerId)).noneMatch(n -> n.type() == Type.CALL_REQUESTED);
    }

    private long booking() {
        long vehicleId = vehicles.create(driverId, "Maruti", "Ertiga", 2022, "Silver", 7).id();
        long rideId = rides.publish(driverId, new PublishRide(vehicleId, Instant.now().plus(Duration.ofHours(3)), 3,
                true, STOPS, List.of(new BigDecimal("400.00")))).id();
        return bookings.request(passengerId, rideId, 0, 1, 1, null).id();
    }

    private String phoneOf(long userId) {
        return jdbc.queryForObject("SELECT phone FROM users WHERE id = ?", String.class, userId);
    }

    private long user(UserRole role) {
        long id = identity.register(UUID.randomUUID() + "@example.test", "correct-horse-battery", "Test " + role, role).id();
        jdbc.update("UPDATE users SET phone = ?, phone_verified_at = now() WHERE id = ?", "+91" + PHONES.incrementAndGet(), id);
        return id;
    }

}
