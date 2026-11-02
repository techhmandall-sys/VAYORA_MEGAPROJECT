package com.dypcet.vayora.admin;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.dypcet.vayora.PostgresIntegrationTest;
import com.dypcet.vayora.booking.BookingService;
import com.dypcet.vayora.booking.TripService;
import com.dypcet.vayora.identity.IdentityService;
import com.dypcet.vayora.identity.TokenService;
import com.dypcet.vayora.identity.UserRole;
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
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.web.server.ResponseStatusException;

@AutoConfigureMockMvc
class BackOfficeBrowserIntegrationTest extends PostgresIntegrationTest {

    private static final List<StopInput> STOPS = List.of(
            new StopInput("Kolhapur", 16.7050, 74.2433, 0), new StopInput("Pune", 18.5204, 73.8567, 270));

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

    private long driver;
    private long vehicleId;

    @BeforeEach
    void setUp() {
        driver = user(UserRole.DRIVER, "Ravi Jadhav");
        vehicleId = vehicles.create(driver, "Maruti", "Ertiga", 2022, "Silver", 7).id();
    }

    @Test
    void aWholeSeriesStillToRunIsWithdrawnAndNoPassengerOwesAnything() {
        long first = rides.publish(driver, new PublishRide(vehicleId, Instant.now().plus(Duration.ofDays(2)), 3, true,
                STOPS, List.of(new BigDecimal("400.00")), null, false, null, 2)).id();
        long passenger = user(UserRole.PASSENGER, "Asha Patil");
        long booking = bookings.request(passenger, first, 0, 1, 1, null).id();

        assertThat(trips.cancelSeries(driver, first)).isEqualTo(3);

        assertThat(jdbc.queryForList("SELECT status FROM rides WHERE series_id = (SELECT series_id FROM rides WHERE id = ?)",
                String.class, first)).containsOnly("CANCELLED");
        assertThat(jdbc.queryForObject("SELECT status FROM payment_intents WHERE booking_id = ?", String.class, booking))
                .isEqualTo("VOID");
        // Nothing left to withdraw.
        assertThatThrownBy(() -> trips.cancelSeries(driver, first)).isInstanceOfSatisfying(ResponseStatusException.class,
                e -> assertThat(e.getStatusCode()).isEqualTo(HttpStatus.CONFLICT));
    }

    @Test
    void aRideOnItsOwnHasNoSeriesAndAnotherDriversSeriesCannotBeTouched() {
        long alone = rides.publish(driver, new PublishRide(vehicleId, Instant.now().plus(Duration.ofDays(2)), 3, true,
                STOPS, List.of(new BigDecimal("400.00")))).id();
        assertThatThrownBy(() -> trips.cancelSeries(driver, alone)).isInstanceOf(ResponseStatusException.class);

        long other = user(UserRole.DRIVER, "Other");
        assertThatThrownBy(() -> trips.cancelSeries(other, alone)).isInstanceOfSatisfying(ResponseStatusException.class,
                e -> assertThat(e.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND));
    }

    @Test
    void administratorsBrowseRidesAndBookingsByStatus() throws Exception {
        long rideId = rides.publish(driver, new PublishRide(vehicleId, Instant.now().plus(Duration.ofDays(2)), 3, true,
                STOPS, List.of(new BigDecimal("400.00")))).id();
        long bookingId = bookings.request(user(UserRole.PASSENGER, "Asha Patil"), rideId, 0, 1, 1,
                null).id();
        long admin = identity.authenticate("admin@example.test", "admin-test-password").id();
        String token = "Bearer " + tokens.issue(admin, UserRole.ADMIN);

        mvc.perform(get("/api/v1/admin/rides").param("status", "SCHEDULED").header("Authorization", token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").value(rideId))
                .andExpect(jsonPath("$[0].driverName").value("Ravi Jadhav"))
                .andExpect(jsonPath("$[0].bookings").value(1))
                .andExpect(jsonPath("$[0].fromStop").value("Kolhapur"));
        mvc.perform(get("/api/v1/admin/bookings").param("status", "CONFIRMED").header("Authorization", token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").value(bookingId))
                .andExpect(jsonPath("$[0].passengerName").value("Asha Patil"));
        mvc.perform(get("/api/v1/admin/bookings").param("status", "EVERYTHING").header("Authorization", token))
                .andExpect(status().isBadRequest());
        mvc.perform(get("/api/v1/admin/rides").header("Authorization", "Bearer " + tokens.issue(driver, UserRole.DRIVER)))
                .andExpect(status().isForbidden());
        mvc.perform(post("/api/v1/rides/" + rideId + "/cancel-series")
                        .header("Authorization", "Bearer " + tokens.issue(driver, UserRole.DRIVER)))
                .andExpect(status().isConflict());
    }

    private long user(UserRole role, String name) {
        return identity.register(UUID.randomUUID() + "@example.test", "correct-horse-battery", name, role).id();
    }
}
