package com.dypcet.vayora.hold;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.dypcet.vayora.PostgresIntegrationTest;
import com.dypcet.vayora.booking.BookingService;
import com.dypcet.vayora.hold.SeatHolds.Hold;
import com.dypcet.vayora.identity.IdentityService;
import com.dypcet.vayora.identity.TokenService;
import com.dypcet.vayora.identity.UserRole;
import com.dypcet.vayora.ride.RideService;
import com.dypcet.vayora.ride.RideService.Candidate;
import com.dypcet.vayora.ride.RideService.PublishRide;
import com.dypcet.vayora.ride.RideService.Sort;
import com.dypcet.vayora.ride.RideService.StopInput;
import com.dypcet.vayora.routing.RouteService.Point;
import com.dypcet.vayora.vehicle.VehicleService;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.data.redis.connection.lettuce.LettuceConnectionFactory;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.web.server.ResponseStatusException;

@AutoConfigureMockMvc
class SeatHoldIntegrationTest extends PostgresIntegrationTest {

    private static final ZoneId ZONE = ZoneId.of("Asia/Kolkata");
    private static final Point KOLHAPUR = new Point(16.7050, 74.2433);
    private static final Point PUNE = new Point(18.5204, 73.8567);
    private static final List<StopInput> STOPS = List.of(
            new StopInput("Kolhapur", KOLHAPUR.lat(), KOLHAPUR.lon(), 0),
            new StopInput("Karad", 17.2890, 74.1818, 75),
            new StopInput("Satara", 17.6805, 74.0183, 130),
            new StopInput("Pune", PUNE.lat(), PUNE.lon(), 270));

    /** A clock a test can move, so a hold can lapse without anyone waiting. */
    private static final class MovableClock extends Clock {
        private Instant now = Instant.now().truncatedTo(java.time.temporal.ChronoUnit.MILLIS);

        void advance(Duration by) {
            now = now.plus(by);
        }

        @Override
        public Instant instant() {
            return now;
        }

        @Override
        public ZoneId getZone() {
            return ZoneOffset.UTC;
        }

        @Override
        public Clock withZone(ZoneId zone) {
            return this;
        }
    }

    @Autowired
    private IdentityService identity;

    @Autowired
    private VehicleService vehicles;

    @Autowired
    private RideService rides;

    @Autowired
    private BookingService bookings;

    @Autowired
    private SeatHolds holds;

    @Autowired
    private StringRedisTemplate redis;

    @Autowired
    private TokenService tokens;

    @Autowired
    private JdbcTemplate jdbc;

    @Autowired
    private MockMvc mvc;

    private long rideId;
    private long asha;
    private long ravi;
    // A day of its own, so other tests' rides cannot appear in these searches.
    private LocalDate day;

    @BeforeEach
    void setUp() {
        day = LocalDate.now(ZONE).plusDays(6);
        rideId = ride(2);
        asha = user(UserRole.PASSENGER);
        ravi = user(UserRole.PASSENGER);
    }

    @Test
    void heldSeatsAreLeftAloneByOthersOnTheLegsHeldAndNowhereElse() {
        assertThat(holds.place(asha, rideId, 0, 2, 2, List.of(2, 2))).isPresent();

        // Kolhapur to Satara is spoken for; Satara to Pune is not.
        assertThatThrownBy(() -> bookings.request(ravi, rideId, 0, 3, 1, null))
                .isInstanceOfSatisfying(ResponseStatusException.class, e -> {
                    assertThat(e.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
                    assertThat(e.getReason()).contains("held for another passenger");
                });
        assertThat(seatsAvailable()).containsExactly(2, 2, 2); // a hold takes nothing from PostgreSQL
        bookings.request(ravi, rideId, 2, 3, 1, null);

        // The holder books what they held, and the hold has then done its job.
        bookings.request(asha, rideId, 0, 2, 2, null);
        assertThat(seatsAvailable()).containsExactly(0, 0, 1);
        assertThat(holds.of(asha)).isEmpty();
        assertThat(holds.heldByOthers(rideId, ravi)).isEmpty();
    }

    @Test
    void aHoldIsRefusedWhenOtherHoldsLeaveTooFewSeatsAndASecondOneReplacesTheFirst() {
        holds.place(asha, rideId, 0, 3, 2, List.of(2, 2, 2));

        assertThat(holds.place(ravi, rideId, 1, 2, 1, List.of(2))).isEmpty();
        assertThat(holds.of(ravi)).isEmpty();

        // Asha changes her mind to one seat on a shorter stretch: replaced, not added.
        Hold smaller = holds.place(asha, rideId, 0, 2, 1, List.of(2, 2)).orElseThrow();
        assertThat(holds.of(asha)).contains(smaller);
        assertThat(holds.heldByOthers(rideId, ravi)).containsOnly(
                java.util.Map.entry(0, 1), java.util.Map.entry(1, 1));
        assertThat(holds.heldByOthers(rideId, asha)).isEmpty(); // her own hold is not in her way
        assertThat(holds.place(ravi, rideId, 1, 3, 1, List.of(2, 2))).isPresent();
        // What PostgreSQL has free is the ceiling, with or without holds.
        assertThat(holds.place(user(UserRole.PASSENGER), rideId, 2, 3, 2, List.of(1))).isEmpty();
    }

    @Test
    void aPassengerHoldsSeatsOnOneRideAtATime() {
        long other = ride(2);
        holds.place(asha, rideId, 0, 3, 2, List.of(2, 2, 2));

        Hold moved = holds.place(asha, other, 0, 3, 1, List.of(2, 2, 2)).orElseThrow();

        assertThat(holds.of(asha)).contains(moved);
        assertThat(holds.heldByOthers(rideId, ravi)).isEmpty();
        assertThat(holds.heldByOthers(other, ravi)).hasSize(3);

        // A refused hold leaves the one she had.
        long full = ride(1);
        assertThat(holds.place(asha, full, 0, 3, 2, List.of(1, 1, 1))).isEmpty();
        assertThat(holds.of(asha)).contains(moved);

        holds.release(asha);
        assertThat(holds.of(asha)).isEmpty();
        assertThat(holds.heldByOthers(other, ravi)).isEmpty();
        holds.release(asha); // releasing nothing is not an error
    }

    @Test
    void aHoldLapsesOnItsOwn() {
        MovableClock clock = new MovableClock();
        SeatHolds timed = new SeatHolds(redis, clock, Duration.ofMinutes(5));
        Hold hold = timed.place(asha, rideId, 0, 3, 2, List.of(2, 2, 2)).orElseThrow();
        assertThat(hold.expiresAt()).isEqualTo(clock.instant().plus(Duration.ofMinutes(5)));

        clock.advance(Duration.ofMinutes(4).plusSeconds(59));
        assertThat(timed.heldByOthers(rideId, ravi)).hasSize(3);
        assertThat(timed.place(ravi, rideId, 0, 3, 1, List.of(2, 2, 2))).isEmpty();

        clock.advance(Duration.ofSeconds(1));
        assertThat(timed.heldByOthers(rideId, ravi)).isEmpty();
        assertThat(timed.of(asha)).isEmpty();
        assertThat(timed.place(ravi, rideId, 0, 3, 2, List.of(2, 2, 2))).isPresent();
    }

    @Test
    void theLastSeatIsHeldForExactlyOneOfManyAskingAtOnce() throws Exception {
        long single = ride(1);
        int contenders = 8;
        List<Long> passengers = new ArrayList<>();
        for (int i = 0; i < contenders; i++) {
            passengers.add(user(UserRole.PASSENGER));
        }
        CountDownLatch start = new CountDownLatch(1);
        ExecutorService pool = Executors.newFixedThreadPool(contenders);
        List<Future<Optional<Hold>>> results = new ArrayList<>();
        for (long passenger : passengers) {
            results.add(pool.submit(() -> {
                start.await();
                return holds.place(passenger, single, 0, 3, 1, List.of(1, 1, 1));
            }));
        }
        start.countDown();

        int placed = 0;
        for (Future<Optional<Hold>> result : results) {
            placed += result.get().isPresent() ? 1 : 0;
        }
        pool.shutdown();

        assertThat(placed).isEqualTo(1);
    }

    @Test
    void aSearchOffersOthersOnlyWhatIsNotHeld() {
        jdbc.update("UPDATE rides SET status = 'CANCELLED' WHERE status = 'SCHEDULED' AND id <> ?", rideId);
        holds.place(asha, rideId, 0, 2, 1, List.of(2, 2));

        // Ravi sees one seat where the hold reaches and both where it does not.
        assertThat(found(ravi, KOLHAPUR, 1)).extracting(Candidate::seatsAvailable).containsExactly(1);
        assertThat(found(ravi, KOLHAPUR, 2)).isEmpty();
        assertThat(found(ravi, new Point(17.6805, 74.0183), 2))
                .extracting(Candidate::seatsAvailable).containsExactly(2);
        // Asha's own hold hides nothing from her.
        assertThat(found(asha, KOLHAPUR, 2)).extracting(Candidate::seatsAvailable).containsExactly(2);
    }

    @Test
    void withoutRedisNothingIsHeldAndNothingIsBlocked() {
        LettuceConnectionFactory nowhere = new LettuceConnectionFactory("localhost", 1);
        nowhere.afterPropertiesSet();
        SeatHolds broken = new SeatHolds(new StringRedisTemplate(nowhere), Clock.systemUTC(),
                Duration.ofMinutes(5));
        try {
            assertThat(broken.heldByOthers(rideId, ravi)).isEmpty();
            assertThat(broken.of(asha)).isEmpty();
            broken.release(asha);
            assertThatThrownBy(() -> broken.place(asha, rideId, 0, 3, 1, List.of(2, 2, 2)))
                    .isInstanceOf(SeatHolds.Unavailable.class);
        } finally {
            nowhere.destroy();
        }
    }

    @Test
    void theEndpointsHoldShowAndReleaseForPassengersOnly() throws Exception {
        String passenger = "Bearer " + tokens.issue(asha, UserRole.PASSENGER);
        String other = "Bearer " + tokens.issue(ravi, UserRole.PASSENGER);
        String driver = "Bearer " + tokens.issue(user(UserRole.DRIVER), UserRole.DRIVER);
        String body = "{\"rideId\": %d, \"fromSeq\": %d, \"toSeq\": %d, \"seats\": %d}";

        mvc.perform(get("/api/v1/holds/mine").header("Authorization", passenger))
                .andExpect(status().isNoContent());
        mvc.perform(post("/api/v1/holds").header("Authorization", passenger)
                        .contentType("application/json").content(String.format(body, rideId, 0, 3, 2)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.rideId").value(rideId))
                .andExpect(jsonPath("$.seats").value(2))
                .andExpect(jsonPath("$.expiresAt").isString());
        mvc.perform(get("/api/v1/holds/mine").header("Authorization", passenger))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.toSeq").value(3));

        mvc.perform(post("/api/v1/holds").header("Authorization", other)
                        .contentType("application/json").content(String.format(body, rideId, 1, 2, 1)))
                .andExpect(status().isConflict());
        mvc.perform(post("/api/v1/holds").header("Authorization", passenger)
                        .contentType("application/json").content(String.format(body, rideId, 0, 3, 3)))
                .andExpect(status().isConflict()); // more than the ride has
        mvc.perform(post("/api/v1/holds").header("Authorization", passenger)
                        .contentType("application/json").content(String.format(body, rideId, 2, 2, 1)))
                .andExpect(status().isBadRequest());
        mvc.perform(post("/api/v1/holds").header("Authorization", passenger)
                        .contentType("application/json").content(String.format(body, rideId, 0, 9, 1)))
                .andExpect(status().isNotFound());
        mvc.perform(post("/api/v1/holds").header("Authorization", passenger)
                        .contentType("application/json").content(String.format(body, Long.MAX_VALUE, 0, 1, 1)))
                .andExpect(status().isNotFound());
        mvc.perform(post("/api/v1/holds").header("Authorization", driver)
                        .contentType("application/json").content(String.format(body, rideId, 0, 3, 1)))
                .andExpect(status().isForbidden());
        mvc.perform(post("/api/v1/holds").contentType("application/json")
                        .content(String.format(body, rideId, 0, 3, 1)))
                .andExpect(status().isUnauthorized());

        mvc.perform(delete("/api/v1/holds/mine").header("Authorization", passenger))
                .andExpect(status().isNoContent());
        mvc.perform(post("/api/v1/holds").header("Authorization", other)
                        .contentType("application/json").content(String.format(body, rideId, 1, 2, 1)))
                .andExpect(status().isCreated());
    }

    private List<Candidate> found(long passenger, Point from, int seats) {
        return rides.search(passenger, from, PUNE, day, seats, Sort.TIME);
    }

    private List<Integer> seatsAvailable() {
        return jdbc.queryForList(
                "SELECT seats_available FROM ride_segments WHERE ride_id = ? ORDER BY seq", Integer.class, rideId);
    }

    private long ride(int seats) {
        long driverId = user(UserRole.DRIVER);
        long vehicleId = vehicles.create(driverId, "Maruti", "Ertiga", 2022, "Silver", 7).id();
        return rides.publish(driverId, new PublishRide(vehicleId,
                day.atTime(9, 0).atZone(ZONE).toInstant(), seats, true, STOPS,
                List.of(new BigDecimal("150.00"), new BigDecimal("100.00"), new BigDecimal("250.00")))).id();
    }

    private long user(UserRole role) {
        return identity.register(UUID.randomUUID() + "@example.test", "correct-horse-battery",
                "Test " + role, role).id();
    }
}
