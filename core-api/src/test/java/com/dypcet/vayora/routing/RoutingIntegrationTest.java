package com.dypcet.vayora.routing;

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
import com.dypcet.vayora.rating.RatingService;
import com.dypcet.vayora.ride.RideService;
import com.dypcet.vayora.ride.RideService.Candidate;
import com.dypcet.vayora.ride.RideService.Filters;
import com.dypcet.vayora.ride.RideService.PublishRide;
import com.dypcet.vayora.ride.RideService.Ride;
import com.dypcet.vayora.ride.RideService.Sort;
import com.dypcet.vayora.ride.RideService.StopInput;
import com.dypcet.vayora.routing.RouteService.Point;
import com.dypcet.vayora.vehicle.VehicleService;
import com.dypcet.vayora.vehicle.VehicleService.Comfort;
import com.dypcet.vayora.vehicle.VehicleService.Luggage;
import java.math.BigDecimal;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
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

/**
 * Routes on rides and search by location. No routing service runs here, so every route is
 * a straight line; what OSRM itself returns is covered by {@link RouteServiceTest}.
 */
@AutoConfigureMockMvc
class RoutingIntegrationTest extends PostgresIntegrationTest {

    private static final Point KOLHAPUR = new Point(16.7050, 74.2433);
    private static final Point KARAD = new Point(17.2890, 74.1818);
    private static final Point PUNE = new Point(18.5204, 73.8567);
    private static final ZoneId ZONE = ZoneId.of("Asia/Kolkata");

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
    private RedisRouteCache cache;

    @Autowired
    private TokenService tokens;

    @Autowired
    private JdbcTemplate jdbc;

    @Autowired
    private MockMvc mvc;

    private long passengerId;
    // A day of its own, so other tests' rides cannot appear in these searches.
    private LocalDate day;
    private Instant morning;

    @BeforeEach
    void setUp() {
        passengerId = user(UserRole.PASSENGER);
        day = LocalDate.now(ZONE).plusDays(3);
        jdbc.update("UPDATE rides SET status = 'CANCELLED' WHERE status = 'SCHEDULED'");
        morning = day.atTime(8, 0).atZone(ZONE).toInstant();
    }

    @Test
    void aPublishedRideCarriesItsRouteAndSaysWhereItCameFrom() {
        Ride ride = rides.get(ride(user(UserRole.DRIVER), morning, "500.00", KOLHAPUR, KARAD, PUNE));

        assertThat(ride.routeSource()).isEqualTo("STRAIGHT_LINE");
        assertThat(ride.distanceKm()).isBetween(200.0, 208.0);
        assertThat(ride.durationMinutes()).isBetween(240, 250); // at the 50 km/h fallback
        assertThat(ride.path()).hasSize(3);
        assertThat(ride.path().get(0)).containsExactly(KOLHAPUR.lat(), KOLHAPUR.lon());
        assertThat(jdbc.queryForObject(
                "SELECT ST_NPoints(route::geometry) FROM rides WHERE id = ?", Integer.class, ride.id()))
                .isEqualTo(3);
    }

    @Test
    void aPassengerNearAStopFindsTheRideAndOneTooFarDoesNot() {
        long rideId = ride(user(UserRole.DRIVER), morning, "500.00", KOLHAPUR, KARAD, PUNE);
        Point twoKmFromKarad = new Point(KARAD.lat() + 0.018, KARAD.lon());   // about 2.0 km north
        Point eightKmFromKarad = new Point(KARAD.lat() + 0.072, KARAD.lon()); // about 8.0 km north

        List<Candidate> near = rides.search(passengerId, twoKmFromKarad, PUNE, day, 1, Sort.TIME);
        List<Candidate> far = rides.search(passengerId, eightKmFromKarad, PUNE, day, 1, Sort.TIME);

        assertThat(near).singleElement().satisfies(candidate -> {
            assertThat(candidate.rideId()).isEqualTo(rideId);
            assertThat(candidate.fromStop()).isEqualTo("Stop 2");
            assertThat(candidate.fromSeq()).isEqualTo(1);
            assertThat(candidate.pickupDistanceM()).isBetween(1900L, 2100L);
            assertThat(candidate.dropoffDistanceM()).isZero();
        });
        assertThat(far).isEmpty(); // beyond the 5 km access limit: not ranked low, not returned
    }

    @Test
    void aRideGoingTheOtherWayIsNotOffered() {
        ride(user(UserRole.DRIVER), morning, "500.00", KOLHAPUR, KARAD, PUNE);

        assertThat(rides.search(passengerId, PUNE, KOLHAPUR, day, 1, Sort.TIME)).isEmpty();
        assertThat(rides.search(passengerId, KARAD, KARAD, day, 1, Sort.TIME)).isEmpty();
    }

    @Test
    void resultsCanBeOrderedByTimePriceRatingOrPickupDistance() {
        long rated = user(UserRole.DRIVER);
        long unrated = user(UserRole.DRIVER);
        // The early ride is dear, starts 3 km from the centre, and its driver has no rating.
        Point threeKmOut = new Point(KOLHAPUR.lat() + 0.027, KOLHAPUR.lon());
        long earlyDear = ride(unrated, morning, "900.00", threeKmOut, PUNE);
        long lateCheap = ride(rated, morning.plus(4, ChronoUnit.HOURS), "400.00", KOLHAPUR, PUNE);
        rate(rated, 5);

        assertThat(order(Sort.TIME)).containsExactly(earlyDear, lateCheap);
        assertThat(order(Sort.PRICE)).containsExactly(lateCheap, earlyDear);
        assertThat(order(Sort.PROXIMITY)).containsExactly(lateCheap, earlyDear);
        // A driver nobody has rated sorts after one who has been, not before.
        assertThat(order(Sort.RATING)).containsExactly(lateCheap, earlyDear);
    }

    @Test
    void theSearchLogKeepsOnlyACoarsePosition() {
        rides.search(passengerId, new Point(16.70512345, 74.24331234), PUNE, day, 1, Sort.TIME);

        assertThat(jdbc.queryForObject("""
                SELECT payload->>'origin_lat' || ',' || (payload->>'origin_lon') FROM events
                WHERE event_type = 'search_issued' AND actor_id = ? ORDER BY id DESC LIMIT 1""",
                String.class, passengerId)).isEqualTo("16.705,74.243");
    }

    @Test
    void aRoutePreviewSuggestsAPricePerLegFromItsDistance() throws Exception {
        String driver = "Bearer " + tokens.issue(user(UserRole.DRIVER), UserRole.DRIVER);
        String body = """
                {"stops": [{"lat": 16.7050, "lon": 74.2433}, {"lat": 17.2890, "lon": 74.1818},
                           {"lat": 18.5204, "lon": 73.8567}]}""";

        mvc.perform(post("/api/v1/rides/route-preview").header("Authorization", driver)
                        .contentType("application/json").content(body))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.source").value("STRAIGHT_LINE"))
                .andExpect(jsonPath("$.legs.length()").value(2))
                // Kolhapur to Karad is about 65 km in a straight line: 65 x 2.0, to the nearest ten.
                .andExpect(jsonPath("$.legs[0].suggestedPrice").value(130))
                .andExpect(jsonPath("$.path.length()").value(3));

        String passenger = "Bearer " + tokens.issue(passengerId, UserRole.PASSENGER);
        mvc.perform(post("/api/v1/rides/route-preview").header("Authorization", passenger)
                        .contentType("application/json").content(body))
                .andExpect(status().isForbidden());
        mvc.perform(post("/api/v1/rides/route-preview").header("Authorization", driver)
                        .contentType("application/json").content("{\"stops\": [{\"lat\": 16.7, \"lon\": 74.2}]}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void theRedisCacheKeepsWhatItIsGiven() {
        String key = "test-" + UUID.randomUUID();

        assertThat(cache.get(key)).isEmpty();
        cache.put(key, "{\"distanceMetres\": 1}");

        assertThat(cache.get(key)).contains("{\"distanceMetres\": 1}");
    }

    @Test
    void filtersNarrowASearchAndNeverWidenIt() {
        long plain = user(UserRole.DRIVER);
        long careful = user(UserRole.DRIVER);
        long early = ride(plain, day.atTime(8, 0).atZone(ZONE).toInstant(), "500.00", KOLHAPUR, PUNE);
        long midday = ride(careful, day.atTime(14, 0).atZone(ZONE).toInstant(), "300.00", KOLHAPUR, PUNE);
        long evening = ride(plain, day.atTime(20, 0).atZone(ZONE).toInstant(), "700.00", KOLHAPUR, PUNE);
        jdbc.update("UPDATE rides SET instant_booking = (id = ?) WHERE id IN (?, ?, ?)",
                midday, early, midday, evening);
        jdbc.update("UPDATE users SET phone_verified_at = now() WHERE id = ?", careful);
        jdbc.update("INSERT INTO profiles (user_id, smoking, pets) VALUES (?, FALSE, TRUE)", careful);
        // Said something, but not about smoking or pets.
        jdbc.update("INSERT INTO profiles (user_id, bio) VALUES (?, 'Hello')", plain);

        assertThat(found(Filters.NONE)).containsExactly(early, midday, evening);
        assertThat(found(hours(12, 18))).containsExactly(midday);
        assertThat(found(hours(9, null))).containsExactly(midday, evening);
        assertThat(found(hours(null, 9))).containsExactly(early);
        // The hour a ride leaves in is inside "from that hour" and outside "before that hour".
        assertThat(found(hours(14, null))).containsExactly(midday, evening);
        assertThat(found(hours(null, 14))).containsExactly(early);
        assertThat(found(new Filters(null, null, new BigDecimal("500.00"), false, false, false, false)))
                .containsExactly(early, midday);
        assertThat(found(new Filters(null, null, null, true, false, false, false))).containsExactly(midday);
        assertThat(found(new Filters(null, null, null, false, true, false, false))).containsExactly(midday);
        // A driver who has not said is not assumed to keep a smoke-free car or welcome pets.
        assertThat(found(new Filters(null, null, null, false, false, true, false))).containsExactly(midday);
        assertThat(found(new Filters(null, null, null, false, false, false, true))).containsExactly(midday);
        assertThat(found(new Filters(15, null, new BigDecimal("400"), false, false, false, false))).isEmpty();

        assertThat(rides.search(passengerId, KOLHAPUR, PUNE, day, 1, Sort.TIME))
                .extracting(Candidate::driverConfirmed).containsExactly(false, true, false);
        assertThatThrownBy(() -> hours(10, 10))
                .isInstanceOfSatisfying(ResponseStatusException.class,
                        e -> assertThat(e.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST));
    }

    @Test
    void theRemainingFiltersNarrowByPriceFloorDriverPreferencesAndTheCar() throws Exception {
        long plain = user(UserRole.DRIVER);
        long fussy = user(UserRole.DRIVER);
        long cheap = ride(plain, day.atTime(8, 0).atZone(ZONE).toInstant(), "250.00", KOLHAPUR, PUNE);
        long dear = ride(fussy, day.atTime(9, 0).atZone(ZONE).toInstant(), "600.00", KOLHAPUR, PUNE);
        jdbc.update("INSERT INTO profiles (user_id, music, chattiness) VALUES (?, TRUE, 'QUIET')", fussy);
        jdbc.update("UPDATE vehicles SET comfort = 'COMFORT', luggage = 'MEDIUM' WHERE owner_id = ?", fussy);

        assertThat(found(withExtras(new BigDecimal("300"), false, false, null, null))).containsExactly(dear);
        assertThat(found(withExtras(null, true, false, null, null))).containsExactly(dear);
        assertThat(found(withExtras(null, false, true, null, null))).containsExactly(dear);
        assertThat(found(withExtras(null, false, false, Comfort.BASIC, null))).containsExactly(dear);
        assertThat(found(withExtras(null, false, false, Comfort.COMFORT, null))).containsExactly(dear);
        assertThat(found(withExtras(null, false, false, Comfort.PREMIUM, null))).isEmpty();
        assertThat(found(withExtras(null, false, false, null, Luggage.MEDIUM))).containsExactly(dear);
        assertThat(found(withExtras(null, false, false, null, Luggage.LARGE))).isEmpty();
        // The driver who said nothing about the car never meets a minimum.
        assertThat(found(withExtras(null, false, false, null, Luggage.NONE))).containsExactly(dear);
        assertThat(found(Filters.NONE)).containsExactly(cheap, dear);

        String passenger = "Bearer " + tokens.issue(passengerId, UserRole.PASSENGER);
        String base = "/api/v1/rides/search?originLat=16.7050&originLon=74.2433&destLat=18.5204"
                + "&destLon=73.8567&date=" + day;
        mvc.perform(get(base + "&minPrice=300&comfortAtLeast=COMFORT&luggageAtLeast=SMALL&musicWelcome=true"
                        + "&quietRide=true").header("Authorization", passenger))
                .andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(1));
        for (String bad : List.of("&minPrice=500&maxPrice=400", "&comfortAtLeast=LUXURY", "&minPrice=-1")) {
            mvc.perform(get(base + bad).header("Authorization", passenger)).andExpect(status().isBadRequest());
        }
    }

    private static Filters withExtras(BigDecimal minPrice, boolean music, boolean quiet, Comfort comfort,
            Luggage luggage) {
        return new Filters(null, null, null, false, false, false, false, false, false, minPrice, music, quiet,
                comfort, luggage);
    }

    @Test
    void theSearchEndpointTakesFiltersAndRefusesImpossibleOnes() throws Exception {
        long rideId = ride(user(UserRole.DRIVER), day.atTime(14, 0).atZone(ZONE).toInstant(), "300.00",
                KOLHAPUR, PUNE);
        String passenger = "Bearer " + tokens.issue(passengerId, UserRole.PASSENGER);
        String base = "/api/v1/rides/search?originLat=16.7050&originLon=74.2433&destLat=18.5204"
                + "&destLon=73.8567&date=" + day;

        mvc.perform(get(base + "&earliestHour=12&latestHour=18&maxPrice=300").header("Authorization", passenger))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].rideId").value(rideId))
                .andExpect(jsonPath("$[0].driverConfirmed").value(false));
        mvc.perform(get(base + "&maxPrice=299.99").header("Authorization", passenger))
                .andExpect(jsonPath("$.length()").value(0));
        mvc.perform(get(base + "&confirmedDriver=true").header("Authorization", passenger))
                .andExpect(jsonPath("$.length()").value(0));
        for (String bad : List.of("&earliestHour=24", "&latestHour=0", "&maxPrice=-1",
                "&earliestHour=18&latestHour=12", "&instantOnly=perhaps")) {
            mvc.perform(get(base + bad).header("Authorization", passenger))
                    .andExpect(status().isBadRequest());
        }
    }

    @Test
    void aRideItsReturnAndTheirWeeklyRepeatsArePublishedTogether() {
        long driverId = user(UserRole.DRIVER);
        Instant back = day.atTime(18, 0).atZone(ZONE).toInstant();

        Ride first = rides.publish(driverId, series(driverId, morning, "  Two small bags each, please.  ",
                true, back, 2));

        assertThat(first.seriesSize()).isEqualTo(6);
        assertThat(first.notes()).isEqualTo("Two small bags each, please.");
        assertThat(first.maxTwoInBack()).isTrue();
        List<Ride> all = jdbc.queryForList(
                        "SELECT id FROM rides WHERE driver_id = ? ORDER BY departure_time", Long.class, driverId)
                .stream().map(rides::get).toList();
        assertThat(all).extracting(Ride::departureTime).containsExactly(
                morning, back,
                morning.plus(Duration.ofDays(7)), back.plus(Duration.ofDays(7)),
                morning.plus(Duration.ofDays(14)), back.plus(Duration.ofDays(14)));
        assertThat(all).allSatisfy(ride -> {
            assertThat(ride.seriesSize()).isEqualTo(6);
            assertThat(ride.status()).isEqualTo("SCHEDULED");
            assertThat(ride.maxTwoInBack()).isTrue();
        });

        // The way out is as given. The way back is the same stops in reverse, each
        // interval and each price belonging to the same stretch of road.
        Ride out = all.get(0);
        Ride home = all.get(1);
        assertThat(out.stops()).extracting(s -> s.name()).containsExactly("Stop 1", "Stop 2", "Stop 3");
        assertThat(out.segments()).extracting(s -> s.price().intValue()).containsExactly(200, 300);
        assertThat(home.stops()).extracting(s -> s.name()).containsExactly("Stop 3", "Stop 2", "Stop 1");
        assertThat(home.stops()).extracting(s -> s.departureTime()).containsExactly(
                back, back.plus(Duration.ofMinutes(150)), back.plus(Duration.ofMinutes(240)));
        assertThat(home.segments()).extracting(s -> s.price().intValue()).containsExactly(300, 200);
        assertThat(home.stops().get(0).lat()).isEqualTo(PUNE.lat());

        // Each is a ride of its own: withdrawing one leaves the others.
        long passenger = user(UserRole.PASSENGER);
        assertThat(rides.search(passenger, PUNE, KOLHAPUR, day, 1, Sort.TIME))
                .extracting(Candidate::rideId).containsExactly(home.id());
        assertThat(rides.search(passenger, KOLHAPUR, PUNE, day.plusDays(7), 1, Sort.TIME)).hasSize(1);
    }

    @Test
    void aSeriesThatCannotBeDrivenPublishesNothing() {
        long driverId = user(UserRole.DRIVER);
        // 240 minutes out: a return at 11:59 leaves before the car has arrived.
        Instant tooSoon = morning.plus(Duration.ofMinutes(239));

        assertThatThrownBy(() -> rides.publish(driverId, series(driverId, morning, null, false, tooSoon, 0)))
                .isInstanceOfSatisfying(ResponseStatusException.class,
                        e -> assertThat(e.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST));
        assertThatThrownBy(() -> rides.publish(driverId, series(driverId, morning, null, false, null, 9)))
                .isInstanceOfSatisfying(ResponseStatusException.class,
                        e -> assertThat(e.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST));
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM rides WHERE driver_id = ?", Integer.class,
                driverId)).isZero();

        // Alone, a ride belongs to no series and says nothing about itself.
        Ride alone = rides.publish(driverId, series(driverId, morning, " ", false, null, 0));
        assertThat(alone.seriesSize()).isEqualTo(1);
        assertThat(alone.notes()).isNull();
        assertThat(alone.maxTwoInBack()).isFalse();
    }

    @Test
    void theBackSeatPromiseIsShownAndCanBeSearchedFor() throws Exception {
        long driverId = user(UserRole.DRIVER);
        long roomy = rides.publish(driverId, series(driverId, morning, null, true, null, 0)).id();
        long full = ride(user(UserRole.DRIVER), morning.plus(Duration.ofHours(1)), "250.00", KOLHAPUR, PUNE);

        assertThat(found(Filters.NONE)).containsExactly(roomy, full);
        assertThat(found(new Filters(null, null, null, false, false, false, false, true)))
                .containsExactly(roomy);
        assertThat(rides.search(passengerId, KOLHAPUR, PUNE, day, 1, Sort.TIME))
                .extracting(Candidate::maxTwoInBack).containsExactly(true, false);

        String driver = "Bearer " + tokens.issue(driverId, UserRole.DRIVER);
        long vehicleId = vehicles.create(driverId, "Maruti", "Ertiga", 2022, "Silver", 7).id();
        String body = "{\"vehicleId\": " + vehicleId + ", \"departureTime\": \"" + morning.plus(Duration.ofDays(1))
                + "\", \"seatsOffered\": 3, \"instantBooking\": true, \"segmentPrices\": [400],"
                + " \"stops\": [{\"name\": \"Kolhapur\", \"lat\": 16.705, \"lon\": 74.2433, \"offsetMinutes\": 0},"
                + " {\"name\": \"Pune\", \"lat\": 18.5204, \"lon\": 73.8567, \"offsetMinutes\": 270}]%s}";
        mvc.perform(post("/api/v1/rides").header("Authorization", driver).contentType("application/json")
                        .content(String.format(body, ", \"repeatWeeks\": 1, \"notes\": \"No luggage on the roof.\"")))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.seriesSize").value(2))
                .andExpect(jsonPath("$.notes").value("No luggage on the roof."))
                .andExpect(jsonPath("$.maxTwoInBack").value(false));
        for (String bad : List.of(", \"repeatWeeks\": 9", ", \"repeatWeeks\": -1",
                ", \"notes\": \"" + "x".repeat(501) + "\"")) {
            mvc.perform(post("/api/v1/rides").header("Authorization", driver).contentType("application/json")
                            .content(String.format(body, bad)))
                    .andExpect(status().isBadRequest());
        }
        mvc.perform(get("/api/v1/rides/search?originLat=16.7050&originLon=74.2433&destLat=18.5204"
                        + "&destLon=73.8567&date=" + day + "&maxTwoInBack=true")
                        .header("Authorization", "Bearer " + tokens.issue(passengerId, UserRole.PASSENGER)))
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].maxTwoInBack").value(true));
    }

    /** Kolhapur, Karad, Pune at 0, 90 and 240 minutes, for 200 and then 300 a seat. */
    private PublishRide series(long driverId, Instant departure, String notes, boolean maxTwoInBack,
            Instant returnDeparture, int repeatWeeks) {
        long vehicleId = vehicles.create(driverId, "Maruti", "Ertiga", 2022, "Silver", 7).id();
        return new PublishRide(vehicleId, departure, 3, true,
                List.of(new StopInput("Stop 1", KOLHAPUR.lat(), KOLHAPUR.lon(), 0),
                        new StopInput("Stop 2", KARAD.lat(), KARAD.lon(), 90),
                        new StopInput("Stop 3", PUNE.lat(), PUNE.lon(), 240)),
                List.of(new BigDecimal("200.00"), new BigDecimal("300.00")),
                notes, maxTwoInBack, returnDeparture, repeatWeeks);
    }

    private List<Long> found(Filters filters) {
        return rides.search(passengerId, KOLHAPUR, PUNE, day, 1, Sort.TIME, filters).stream()
                .map(Candidate::rideId).toList();
    }

    private static Filters hours(Integer earliest, Integer latest) {
        return new Filters(earliest, latest, null, false, false, false, false);
    }

    private List<Long> order(Sort sort) {
        return rides.search(passengerId, KOLHAPUR, PUNE, day, 1, sort).stream()
                .map(Candidate::rideId).toList();
    }

    /** Gives the driver one rating by running a short trip to completion. */
    private void rate(long driverId, int stars) {
        long rideId = ride(driverId, Instant.now().plus(Duration.ofMinutes(30)), "100.00", KOLHAPUR, PUNE);
        long rater = user(UserRole.PASSENGER);
        long bookingId = bookings.request(rater, rideId, 0, 1, 1, null).id();
        trips.start(driverId, rideId);
        trips.complete(driverId, rideId);
        ratings.rate(rater, bookingId, stars, null);
    }

    private long ride(long driverId, Instant departure, String pricePerLeg, Point... stops) {
        long vehicleId = vehicles.create(driverId, "Maruti", "Ertiga", 2022, "Silver", 7).id();
        List<StopInput> inputs = new java.util.ArrayList<>();
        for (int i = 0; i < stops.length; i++) {
            inputs.add(new StopInput("Stop " + (i + 1), stops[i].lat(), stops[i].lon(), i * 120));
        }
        List<BigDecimal> prices = java.util.Collections.nCopies(stops.length - 1, new BigDecimal(pricePerLeg));
        return rides.publish(driverId, new PublishRide(vehicleId, departure, 3, true, inputs, prices)).id();
    }

    private long user(UserRole role) {
        return identity.register(UUID.randomUUID() + "@example.test", "correct-horse-battery",
                "Test " + role, role).id();
    }
}
