package com.dypcet.vayora.referral;

import static org.assertj.core.api.Assertions.assertThat;
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
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;

@AutoConfigureMockMvc
class ReferralIntegrationTest extends PostgresIntegrationTest {

    @Autowired
    private IdentityService identity;

    @Autowired
    private ReferralService referrals;

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

    @Test
    void aCodeIsMadeOnceAndASignUpWithItCountsThenQualifiesOnAFirstTrip() throws Exception {
        long inviter = user(UserRole.PASSENGER);
        String code = referrals.codeFor(inviter);
        assertThat(code).matches("[A-HJ-NP-Z2-9]{6}");
        assertThat(referrals.codeFor(inviter)).isEqualTo(code);

        String email = UUID.randomUUID() + "@example.test";
        String body = mvc.perform(post("/api/v1/auth/register").contentType("application/json")
                        .content("{\"email\": \"" + email + "\", \"password\": \"correct-horse-battery\","
                                + " \"fullName\": \"Meera Kulkarni\", \"role\": \"PASSENGER\", \"referralCode\": \""
                                + code.toLowerCase() + "\"}"))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        long invited = jdbc.queryForObject("SELECT id FROM users WHERE email = ?", Long.class, email);
        assertThat(body).contains("Meera Kulkarni");
        assertThat(referrals.summary(inviter)).isEqualTo(new ReferralService.Summary(code, 1, 0));

        long driver = user(UserRole.DRIVER);
        long vehicleId = vehicles.create(driver, "Maruti", "Ertiga", 2022, "Silver", 7).id();
        long rideId = rides.publish(driver, new PublishRide(vehicleId, Instant.now().plus(Duration.ofMinutes(30)),
                3, true, List.of(new StopInput("Kolhapur", 16.7050, 74.2433, 0),
                        new StopInput("Pune", 18.5204, 73.8567, 270)),
                List.of(new BigDecimal("450.00")))).id();
        bookings.request(invited, rideId, 0, 1, 1, null);
        trips.start(driver, rideId);
        trips.complete(driver, rideId);

        assertThat(referrals.summary(inviter)).isEqualTo(new ReferralService.Summary(code, 1, 1));
        mvc.perform(get("/api/v1/me/referral").header("Authorization", "Bearer " + tokens.issue(inviter, UserRole.PASSENGER)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(code))
                .andExpect(jsonPath("$.qualified").value(1));
    }

    @Test
    void aWrongCodeCreatesNoAccount() throws Exception {
        String email = UUID.randomUUID() + "@example.test";
        mvc.perform(post("/api/v1/auth/register").contentType("application/json")
                        .content("{\"email\": \"" + email + "\", \"password\": \"correct-horse-battery\","
                                + " \"fullName\": \"Nobody\", \"role\": \"PASSENGER\", \"referralCode\": \"ZZZZZZ\"}"))
                .andExpect(status().isBadRequest());
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM users WHERE email = ?", Integer.class, email)).isZero();
    }

    private long user(UserRole role) {
        return identity.register(UUID.randomUUID() + "@example.test", "correct-horse-battery", "Test " + role, role).id();
    }
}
