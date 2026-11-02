package com.dypcet.vayora.booking;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.dypcet.vayora.PostgresIntegrationTest;
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
import org.springframework.test.web.servlet.MockMvc;

@AutoConfigureMockMvc
class BoardingIntegrationTest extends PostgresIntegrationTest {

    @Autowired
    private IdentityService identity;

    @Autowired
    private VehicleService vehicles;

    @Autowired
    private RideService rides;

    @Autowired
    private BookingService bookings;

    @Autowired
    private BoardingService boarding;

    @Autowired
    private TokenService tokens;

    @Autowired
    private MockMvc mvc;

    private long driver;
    private long passenger;
    private long rideId;

    @BeforeEach
    void setUp() {
        driver = user(UserRole.DRIVER);
        passenger = user(UserRole.PASSENGER);
        long vehicleId = vehicles.create(driver, "Maruti", "Ertiga", 2022, "Silver", 7).id();
        rideId = rides.publish(driver, new PublishRide(vehicleId, Instant.now().plus(Duration.ofDays(2)), 3, true,
                List.of(new StopInput("Kolhapur", 16.7050, 74.2433, 0),
                        new StopInput("Pune", 18.5204, 73.8567, 270)),
                List.of(new BigDecimal("450.00")))).id();
    }

    @Test
    void thePassengerSeesTheirCodeAndTheDriverCanOnlyCheckIt() throws Exception {
        long bookingId = bookings.request(passenger, rideId, 0, 1, 1, null).id();
        String passengerToken = "Bearer " + tokens.issue(passenger, UserRole.PASSENGER);
        String driverToken = "Bearer " + tokens.issue(driver, UserRole.DRIVER);

        String code = boarding.pass(passenger, bookingId).code();
        assertThat(code).matches("[0-9]{4}");
        mvc.perform(get("/api/v1/bookings/" + bookingId + "/boarding-pass").header("Authorization", passengerToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.reference").value(BoardingService.reference(bookingId)))
                .andExpect(jsonPath("$.code").value(code));

        // The driver never receives the code, in the pass or with the booking.
        mvc.perform(get("/api/v1/bookings/" + bookingId + "/boarding-pass").header("Authorization", driverToken))
                .andExpect(status().isForbidden());
        String driversView = mvc.perform(get("/api/v1/rides/" + rideId + "/bookings").header("Authorization", driverToken))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        assertThat(driversView).doesNotContain("boardingCode").doesNotContain("\"code\"").doesNotContain("\"" + code + "\"");

        String wrong = code.equals("0000") ? "0001" : "0000";
        mvc.perform(post("/api/v1/bookings/" + bookingId + "/check-code").header("Authorization", driverToken)
                        .contentType("application/json").content("{\"code\": \"" + code + "\"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.matches").value(true));
        mvc.perform(post("/api/v1/bookings/" + bookingId + "/check-code").header("Authorization", driverToken)
                        .contentType("application/json").content("{\"code\": \"" + wrong + "\"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.matches").value(false));
        mvc.perform(post("/api/v1/bookings/" + bookingId + "/check-code").header("Authorization", driverToken)
                        .contentType("application/json").content("{\"code\": \"12\"}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void nobodyElseGetsThePassOrTheCheck() throws Exception {
        long bookingId = bookings.request(passenger, rideId, 0, 1, 1, null).id();
        long otherDriver = user(UserRole.DRIVER);
        long otherPassenger = user(UserRole.PASSENGER);

        mvc.perform(get("/api/v1/bookings/" + bookingId + "/boarding-pass")
                        .header("Authorization", "Bearer " + tokens.issue(otherPassenger, UserRole.PASSENGER)))
                .andExpect(status().isNotFound());
        mvc.perform(post("/api/v1/bookings/" + bookingId + "/check-code")
                        .header("Authorization", "Bearer " + tokens.issue(otherDriver, UserRole.DRIVER))
                        .contentType("application/json").content("{\"code\": \"1234\"}"))
                .andExpect(status().isNotFound());
    }

    @Test
    void aCancelledBookingHasNoPass() throws Exception {
        long bookingId = bookings.request(passenger, rideId, 0, 1, 1, null).id();
        bookings.cancel(passenger, bookingId);

        mvc.perform(get("/api/v1/bookings/" + bookingId + "/boarding-pass")
                        .header("Authorization", "Bearer " + tokens.issue(passenger, UserRole.PASSENGER)))
                .andExpect(status().isNotFound());
    }

    @Test
    void codesAreFourDigitsAndVary() {
        java.util.Set<String> seen = new java.util.HashSet<>();
        for (int i = 0; i < 200; i++) {
            String code = boarding.newCode();
            assertThat(code).matches("[0-9]{4}");
            seen.add(code);
        }
        assertThat(seen).hasSizeGreaterThan(150);
    }

    private long user(UserRole role) {
        return identity.register(UUID.randomUUID() + "@example.test", "correct-horse-battery",
                "Test " + role, role).id();
    }
}
