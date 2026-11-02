package com.dypcet.vayora.hazard;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyDouble;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.dypcet.vayora.PostgresIntegrationTest;
import com.dypcet.vayora.booking.BookingService;
import com.dypcet.vayora.booking.BookingService.Booking;
import com.dypcet.vayora.booking.BookingStatus;
import com.dypcet.vayora.booking.TripService;
import com.dypcet.vayora.hazard.HazardScorer.Score;
import com.dypcet.vayora.hazard.HazardScoringService.Summary;
import com.dypcet.vayora.identity.IdentityService;
import com.dypcet.vayora.identity.TokenService;
import com.dypcet.vayora.identity.UserRole;
import com.dypcet.vayora.ride.RideService;
import com.dypcet.vayora.ride.RideService.PublishRide;
import com.dypcet.vayora.ride.RideService.StopInput;
import com.dypcet.vayora.vehicle.VehicleService;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.math.BigDecimal;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

/** The scoring job against a real database, with intel replaced by a stand-in. */
@AutoConfigureMockMvc
class HazardScoringIntegrationTest extends PostgresIntegrationTest {

    private static final List<StopInput> STOPS = List.of(
            new StopInput("Kolhapur", 16.7050, 74.2433, 0),
            new StopInput("Pune", 18.5204, 73.8567, 270));

    @MockitoBean
    private HazardScorer scorer;

    @Autowired
    private HazardScoringService scoring;

    @Autowired
    private IdentityService identity;

    @Autowired
    private VehicleService vehicles;

    @Autowired
    private RideService rides;

    @Autowired
    private BookingService bookings;

    @Autowired
    private TripService trips;

    @Autowired
    private TokenService tokens;

    @Autowired
    private JdbcTemplate jdbc;

    @Autowired
    private MockMvc mvc;

    @Autowired
    private ObjectMapper json;

    private long driverId;

    @BeforeEach
    void setUp() {
        // Other tests' bookings share this database and would be scored too.
        jdbc.update("UPDATE rides SET status = 'CANCELLED' WHERE status = 'SCHEDULED'");
        jdbc.update("TRUNCATE events");
        driverId = user(UserRole.DRIVER);
        when(scorer.score(any(), anyDouble(), anyDouble()))
                .thenReturn(Optional.of(new Score(0.82, "h1-cox", "f1",
                        java.util.Map.of("lead_hours", 0.4, "prior_cancel_share", -0.1))));
    }

    @Test
    void aRequestSnapshotsFeaturesThatCountOnlyThePassengersOwnAcceptedHistory() throws Exception {
        long passenger = user(UserRole.PASSENGER);
        // Far enough ahead that cancelling owes nothing, which would stop the next request.
        long first = ride(Duration.ofDays(3), true);
        long second = ride(Duration.ofDays(3), true);
        long third = ride(Duration.ofDays(4), false);

        Booking cancelled = bookings.request(passenger, first, 0, 1, 1, null);
        bookings.cancel(passenger, cancelled.id());           // accepted, then cancelled by them
        Booking withdrawn = bookings.request(passenger, second, 0, 1, 1, null);
        trips.cancel(driverId, second);                       // accepted, cancelled by the driver
        Booking neverAccepted = bookings.request(passenger, third, 0, 1, 1, null);
        bookings.cancel(passenger, neverAccepted.id());       // cancelled while still pending

        Booking latest = bookings.request(passenger, ride(Duration.ofDays(5), true), 0, 1, 2, null);

        JsonNode features = features(latest);
        assertThat(features.get("prior_accepted").asDouble()).isEqualTo(2.0);
        assertThat(features.get("prior_cancellations").asDouble()).isEqualTo(1.0);
        assertThat(features.get("prior_cancel_share").asDouble()).isEqualTo(0.5);
        assertThat(features.get("prior_completed").asDouble()).isZero();
        assertThat(features.get("seats").asDouble()).isEqualTo(2.0);
        assertThat(features.get("lead_hours").asDouble()).isBetween(119.0, 120.01);
        assertThat(features.get("desired_gap_hours").asDouble()).isZero();
        // Booked with no last-mile details sent: none is recorded as none.
        assertThat(features.get("last_mile_distance_m").asDouble()).isZero();
        assertThat(features.get("last_mile_mode_available").asDouble()).isZero();
        assertThat(features).hasSize(11);
        // The very first booking saw no history, not even itself.
        assertThat(features(cancelled).get("prior_accepted").asDouble()).isZero();
        assertThat(withdrawn.status()).isEqualTo(BookingStatus.CONFIRMED);
    }

    @Test
    void scoringAppendsOneEventPerConfirmedBookingAndIsSafeToRepeat() {
        Booking booking = bookings.request(user(UserRole.PASSENGER),
                ride(Duration.ofDays(2), true), 0, 1, 1, null);

        assertThat(scoring.scoreActiveBookings()).isEqualTo(new Summary(1, 0, 0, false));
        assertThat(scoring.scoreActiveBookings()).isEqualTo(new Summary(0, 1, 0, false));

        Map<String, Object> event = jdbc.queryForMap("""
                SELECT (payload->>'booking_id')::bigint AS booking_id,
                       (payload->>'survival_probability')::float8 AS survival,
                       (payload->>'elapsed_hours')::float8 AS elapsed,
                       (payload->>'horizon_hours')::float8 AS horizon,
                       payload->>'model_version' AS model, payload->>'feature_version' AS features,
                       run_id
                FROM events WHERE event_type = 'hazard_scored'""");
        assertThat(event.get("booking_id")).isEqualTo(booking.id());
        assertThat(event.get("survival")).isEqualTo(0.82);
        assertThat((Double) event.get("elapsed")).isBetween(0.0, 0.01);
        assertThat((Double) event.get("horizon")).isBetween(47.9, 48.01);
        assertThat(event.get("model")).isEqualTo("h1-cox");
        assertThat(event.get("features")).isEqualTo("f1");
        assertThat(event.get("run_id")).isNull();

        // The scorer was given the stored snapshot and times measured from acceptance.
        @SuppressWarnings("unchecked")
        ArgumentCaptor<Map<String, Double>> sent = ArgumentCaptor.forClass(Map.class);
        verify(scorer).score(sent.capture(), anyDouble(), anyDouble());
        assertThat(sent.getValue()).containsKeys("lead_hours", "prior_cancel_share", "last_mile_distance_m")
                .hasSize(11);
    }

    @Test
    void onlyConfirmedBookingsOnRidesThatHaveNotLeftAreScored() {
        long approvalRide = ride(Duration.ofDays(2), false);
        bookings.request(user(UserRole.PASSENGER), approvalRide, 0, 1, 1, null);          // pending
        long passenger = user(UserRole.PASSENGER);
        Booking gone = bookings.request(passenger, ride(Duration.ofDays(2), true), 0, 1, 1, null);
        bookings.cancel(passenger, gone.id());                                      // cancelled
        long leaving = ride(Duration.ofMinutes(30), true);
        bookings.request(user(UserRole.PASSENGER), leaving, 0, 1, 1, null);
        trips.start(driverId, leaving);                                             // on the road

        assertThat(scoring.scoreActiveBookings()).isEqualTo(new Summary(0, 0, 0, false));
        assertThat(count()).isZero();
    }

    @Test
    void aModelOutageScoresNothingAndChangesNoBooking() {
        when(scorer.score(any(), anyDouble(), anyDouble())).thenReturn(Optional.empty());
        long rideId = ride(Duration.ofDays(2), true);
        Booking booking = bookings.request(user(UserRole.PASSENGER), rideId, 0, 1, 1, null);

        assertThat(scoring.scoreActiveBookings()).isEqualTo(new Summary(0, 0, 1, false));

        assertThat(count()).isZero();
        assertThat(jdbc.queryForObject("SELECT status FROM bookings WHERE id = ?", String.class,
                booking.id())).isEqualTo("CONFIRMED");
        assertThat(jdbc.queryForObject(
                "SELECT seats_available FROM ride_segments WHERE ride_id = ?", Integer.class, rideId))
                .isEqualTo(2);

        // Once the model is back, the same booking is picked up.
        when(scorer.score(any(), anyDouble(), anyDouble()))
                .thenReturn(Optional.of(new Score(0.9, "h1-cox", "f1")));
        assertThat(scoring.scoreActiveBookings()).isEqualTo(new Summary(1, 0, 0, false));
    }

    @Test
    void scoresAreForAdministratorsOnly() throws Exception {
        bookings.request(user(UserRole.PASSENGER), ride(Duration.ofDays(2), true), 0, 1, 1, null);
        String driver = "Bearer " + tokens.issue(driverId, UserRole.DRIVER);
        String passenger = "Bearer " + tokens.issue(user(UserRole.PASSENGER), UserRole.PASSENGER);
        String admin = "Bearer " + json.readTree(mvc.perform(post("/api/v1/auth/login")
                .contentType("application/json")
                .content("""
                        {"email": "admin@example.test", "password": "admin-test-password"}"""))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString()).get("accessToken").asText();

        for (String outsider : List.of(driver, passenger)) {
            mvc.perform(post("/api/v1/admin/hazard/score").header("Authorization", outsider))
                    .andExpect(status().isForbidden());
            mvc.perform(get("/api/v1/admin/hazard/scores").header("Authorization", outsider))
                    .andExpect(status().isForbidden());
        }
        mvc.perform(post("/api/v1/admin/hazard/score")).andExpect(status().isUnauthorized());

        mvc.perform(post("/api/v1/admin/hazard/score").header("Authorization", admin))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.scored").value(1));
        mvc.perform(get("/api/v1/admin/hazard/scores").header("Authorization", admin))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].survivalProbability").value(0.82))
                .andExpect(jsonPath("$[0].contributions.lead_hours").value(0.4))
                .andExpect(jsonPath("$[0].contributions.prior_cancel_share").value(-0.1))
                .andExpect(jsonPath("$[0].modelVersion").value("h1-cox"))
                .andExpect(jsonPath("$[0].fromStop").value("Kolhapur"));
    }

    private JsonNode features(Booking booking) throws Exception {
        return json.readTree(jdbc.queryForObject(
                "SELECT hazard_features::text FROM bookings WHERE id = ?", String.class, booking.id()));
    }

    private int count() {
        return jdbc.queryForObject(
                "SELECT COUNT(*) FROM events WHERE event_type = 'hazard_scored'", Integer.class);
    }

    private long user(UserRole role) {
        return identity.register(UUID.randomUUID() + "@example.test", "correct-horse-battery",
                "Test " + role, role).id();
    }

    private long ride(Duration untilDeparture, boolean instantBooking) {
        long vehicleId = vehicles.create(driverId, "Maruti", "Ertiga", 2022, "Silver", 7).id();
        return rides.publish(driverId, new PublishRide(vehicleId, Instant.now().plus(untilDeparture),
                3, instantBooking, STOPS, List.of(new BigDecimal("520.00")))).id();
    }
}
