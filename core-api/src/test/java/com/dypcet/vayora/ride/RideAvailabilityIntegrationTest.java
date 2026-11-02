package com.dypcet.vayora.ride;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.dypcet.vayora.PostgresIntegrationTest;
import com.dypcet.vayora.booking.BookingService;
import com.dypcet.vayora.booking.TripService;
import com.dypcet.vayora.hold.SeatHolds;
import com.dypcet.vayora.identity.IdentityService;
import com.dypcet.vayora.identity.TokenService;
import com.dypcet.vayora.identity.UserRole;
import com.dypcet.vayora.ride.RideService.Availability;
import com.dypcet.vayora.ride.RideService.Candidate;
import com.dypcet.vayora.ride.RideService.PublishRide;
import com.dypcet.vayora.ride.RideService.Sort;
import com.dypcet.vayora.ride.RideService.StopInput;
import com.dypcet.vayora.ride.RideService.Stretch;
import com.dypcet.vayora.routing.RouteService.Point;
import com.dypcet.vayora.vehicle.VehicleService;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;

/** What a screen reads to keep its results current: a search's count, without being a search. */
@AutoConfigureMockMvc
class RideAvailabilityIntegrationTest extends PostgresIntegrationTest {

    private static final ZoneId ZONE = ZoneId.of("Asia/Kolkata");
    private static final Point KOLHAPUR = new Point(16.7050, 74.2433);
    private static final Point PUNE = new Point(18.5204, 73.8567);
    private static final List<StopInput> STOPS = List.of(
            new StopInput("Kolhapur", KOLHAPUR.lat(), KOLHAPUR.lon(), 0),
            new StopInput("Satara", 17.6805, 74.0183, 130),
            new StopInput("Pune", PUNE.lat(), PUNE.lon(), 270));

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
    private SeatHolds holds;

    @Autowired
    private TokenService tokens;

    @Autowired
    private JdbcTemplate jdbc;

    @Autowired
    private MockMvc mvc;

    private long driver;
    private long rideId;
    private long asha;
    private long ravi;
    private LocalDate day;

    @BeforeEach
    void setUp() {
        // A day of its own, so other tests' rides cannot appear in these searches.
        day = LocalDate.now(ZONE).plusDays(5);
        driver = user(UserRole.DRIVER);
        long vehicleId = vehicles.create(driver, "Maruti", "Ertiga", 2022, "Silver", 7).id();
        rideId = rides.publish(driver, new PublishRide(vehicleId, day.atTime(9, 0).atZone(ZONE).toInstant(), 3, true,
                STOPS, List.of(new BigDecimal("270.00"), new BigDecimal("230.00")))).id();
        asha = user(UserRole.PASSENGER);
        ravi = user(UserRole.PASSENGER);
    }

    @Test
    void itCountsWhatASearchCountsWithOthersHoldsTakenOffButNotOnesOwn() {
        holds.place(asha, rideId, 0, 1, 2, List.of(3));

        assertThat(seats(ravi, 0, 2)).isEqualTo(1);
        // The hold is on the first leg only.
        assertThat(seats(ravi, 1, 2)).isEqualTo(3);
        assertThat(seats(asha, 0, 2)).isEqualTo(3);

        Candidate searched = rides.search(ravi, KOLHAPUR, PUNE, day, 1, Sort.TIME).stream()
                .filter(c -> c.rideId() == rideId).findFirst().orElseThrow();
        assertThat(seats(ravi, 0, 2)).isEqualTo(searched.seatsAvailable());
    }

    @Test
    void itFollowsBookingsCancellationsAndTheRidesOwnStatus() {
        assertThat(seats(ravi, 0, 2)).isEqualTo(3);

        long booking = bookings.request(asha, rideId, 0, 2, 2, null).id();
        assertThat(seats(ravi, 0, 2)).isEqualTo(1);

        bookings.cancel(asha, booking);
        assertThat(seats(ravi, 0, 2)).isEqualTo(3);

        trips.cancel(driver, rideId);
        assertThat(rides.availability(ravi, List.of(new Stretch(rideId, 0, 2))))
                .singleElement().extracting(Availability::status).isEqualTo("CANCELLED");
    }

    @Test
    void readingItWritesNothingToTheEventLog() {
        long before = jdbc.queryForObject("SELECT COUNT(*) FROM events", Long.class);

        for (int reading = 0; reading < 5; reading++) {
            seats(ravi, 0, 2);
        }

        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM events", Long.class)).isEqualTo(before);
    }

    @Test
    void theEndpointAnswersForTheStretchesThatExistAndRefusesWhatIsNotOne() throws Exception {
        String reader = "Bearer " + tokens.issue(ravi, UserRole.PASSENGER);

        mvc.perform(get("/api/v1/rides/availability")
                        .param("stretch", rideId + ":0:2", "999999999:0:1")
                        .header("Authorization", reader))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].rideId").value(rideId))
                .andExpect(jsonPath("$[0].status").value("SCHEDULED"))
                .andExpect(jsonPath("$[0].seatsAvailable").value(3));

        mvc.perform(get("/api/v1/rides/availability").param("stretch", "not-a-stretch").header("Authorization", reader))
                .andExpect(status().isBadRequest());
        String[] tooMany = new String[31];
        java.util.Arrays.fill(tooMany, rideId + ":0:2");
        mvc.perform(get("/api/v1/rides/availability").param("stretch", tooMany).header("Authorization", reader))
                .andExpect(status().isBadRequest());
        mvc.perform(get("/api/v1/rides/availability").param("stretch", rideId + ":0:2"))
                .andExpect(status().isUnauthorized());
    }

    private int seats(long reader, int fromSeq, int toSeq) {
        return rides.availability(reader, List.of(new Stretch(rideId, fromSeq, toSeq))).get(0).seatsAvailable();
    }

    private long user(UserRole role) {
        return identity.register(UUID.randomUUID() + "@example.test", "correct-horse-battery", "Test " + role, role).id();
    }
}
