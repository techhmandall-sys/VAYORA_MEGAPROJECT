package com.dypcet.vayora.rating;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.dypcet.vayora.PostgresIntegrationTest;
import com.dypcet.vayora.booking.BookingService;
import com.dypcet.vayora.booking.TripService;
import com.dypcet.vayora.identity.IdentityService;
import com.dypcet.vayora.identity.TokenService;
import com.dypcet.vayora.identity.UserRole;
import com.dypcet.vayora.rating.RatingService.Reliability;
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
class LevelIntegrationTest extends PostgresIntegrationTest {

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
    private RatingService ratings;

    @Autowired
    private LevelProperties levels;

    @Autowired
    private TokenService tokens;

    @Autowired
    private MockMvc mvc;

    private long driver;

    @BeforeEach
    void setUp() {
        driver = identity.register(UUID.randomUUID() + "@example.test", "correct-horse-battery",
                "Ravi Jadhav", UserRole.DRIVER).id();
    }

    @Test
    void theHighestLevelWhoseEveryConditionIsMetIsTheOneHeld() {
        assertThat(levels.levelFor(0, null, 0, false, false)).isEqualTo("NEWCOMER");
        assertThat(levels.levelFor(3, null, 0, false, false)).isEqualTo("NEWCOMER"); // email not confirmed
        assertThat(levels.levelFor(3, null, 0, true, false)).isEqualTo("INTERMEDIATE");
        assertThat(levels.levelFor(12, 4.2, 5, true, false)).isEqualTo("EXPERIENCED");
        assertThat(levels.levelFor(12, 3.9, 5, true, false)).isEqualTo("INTERMEDIATE"); // rated too low
        assertThat(levels.levelFor(30, 4.5, 12, true, false)).isEqualTo("EXPERIENCED"); // no phone
        assertThat(levels.levelFor(30, 4.5, 12, true, true)).isEqualTo("EXPERT");
        assertThat(levels.levelFor(60, 4.7, 30, true, true)).isEqualTo("AMBASSADOR");
    }

    @Test
    void aProfileCarriesItsLevel() {
        assertThat(ratings.profile(driver).level()).isEqualTo("NEWCOMER");
    }

    @Test
    void aDriverSeesTheirOwnRecord() throws Exception {
        long vehicleId = vehicles.create(driver, "Maruti", "Ertiga", 2022, "Silver", 7).id();
        long completed = ride(vehicleId, Duration.ofMinutes(30));
        long passenger = passenger();
        bookings.request(passenger, completed, 0, 1, 1, null);
        long noShow = bookings.request(passenger(), completed, 0, 1, 1, null).id();
        trips.start(driver, completed);
        trips.noShow(driver, noShow);
        trips.complete(driver, completed);
        long withdrawn = ride(vehicleId, Duration.ofDays(2));
        bookings.request(passenger(), withdrawn, 0, 1, 1, null);
        trips.cancel(driver, withdrawn);

        Reliability record = ratings.reliability(driver);

        assertThat(record.ridesCompleted()).isEqualTo(1);
        assertThat(record.ridesWithdrawn()).isEqualTo(1);
        assertThat(record.passengersCarried()).isEqualTo(1);
        assertThat(record.passengersCancelled()).isEqualTo(1);
        assertThat(record.noShowsMarked()).isEqualTo(1);
        assertThat(record.level()).isEqualTo("NEWCOMER");

        mvc.perform(get("/api/v1/me/reliability").header("Authorization", "Bearer " + tokens.issue(driver, UserRole.DRIVER)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.ridesCompleted").value(1));
        mvc.perform(get("/api/v1/me/reliability").header("Authorization", "Bearer " + tokens.issue(passenger, UserRole.PASSENGER)))
                .andExpect(status().isForbidden());
    }

    private long ride(long vehicleId, Duration untilDeparture) {
        return rides.publish(driver, new PublishRide(vehicleId, Instant.now().plus(untilDeparture), 3, true,
                List.of(new StopInput("Kolhapur", 16.7050, 74.2433, 0),
                        new StopInput("Pune", 18.5204, 73.8567, 270)),
                List.of(new BigDecimal("450.00")))).id();
    }

    private long passenger() {
        return identity.register(UUID.randomUUID() + "@example.test", "correct-horse-battery", "Test passenger",
                UserRole.PASSENGER).id();
    }
}
