package com.dypcet.vayora.rating;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.dypcet.vayora.PostgresIntegrationTest;
import com.dypcet.vayora.booking.BookingService;
import com.dypcet.vayora.booking.BookingService.Booking;
import com.dypcet.vayora.booking.TripService;
import com.dypcet.vayora.identity.IdentityService;
import com.dypcet.vayora.identity.TokenService;
import com.dypcet.vayora.identity.UserRole;
import com.dypcet.vayora.rating.RatingService.Profile;
import com.dypcet.vayora.rating.RatingService.Unrated;
import com.dypcet.vayora.ride.RideService;
import com.dypcet.vayora.ride.RideService.Candidate;
import com.dypcet.vayora.ride.RideService.PublishRide;
import com.dypcet.vayora.ride.RideService.Sort;
import com.dypcet.vayora.ride.RideService.StopInput;
import com.dypcet.vayora.routing.RouteService.Point;
import com.dypcet.vayora.vehicle.VehicleService;
import java.math.BigDecimal;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.http.HttpStatus;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.web.server.ResponseStatusException;

@AutoConfigureMockMvc
class RatingFlowIntegrationTest extends PostgresIntegrationTest {

    private static final List<StopInput> STOPS = List.of(
            new StopInput("Kolhapur", 16.7050, 74.2433, 0),
            new StopInput("Pune", 18.5204, 73.8567, 270));

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
    private TokenService tokens;

    @Autowired
    private MockMvc mvc;

    private long driverId;
    private long passengerId;

    @BeforeEach
    void setUp() {
        driverId = identity.register(email(), "correct-horse-battery", "Ravi Jadhav", UserRole.DRIVER).id();
        passengerId = identity.register(email(), "correct-horse-battery", "Asha Patil", UserRole.PASSENGER).id();
    }

    @Test
    void afterACompletedTripEachSideRatesTheOtherOnce() {
        Booking booking = completedTrip(passengerId);

        ratings.rate(passengerId, booking.id(), 5, "  Smooth drive, left on time.  ");
        ratings.rate(driverId, booking.id(), 4, null);

        Profile driver = ratings.profile(driverId);
        assertThat(driver.averageStars()).isEqualTo(5.0);
        assertThat(driver.ratingCount()).isEqualTo(1);
        assertThat(driver.completedTrips()).isEqualTo(1);
        assertThat(driver.reviews()).singleElement().satisfies(review -> {
            assertThat(review.comment()).isEqualTo("Smooth drive, left on time.");
            assertThat(review.reviewerName()).isEqualTo("Asha"); // first name only
            assertThat(review.stars()).isEqualTo(5);
        });
        Profile passenger = ratings.profile(passengerId);
        assertThat(passenger.averageStars()).isEqualTo(4.0);
        assertThat(passenger.reviews()).isEmpty(); // a rating without a comment is not a review

        assertStatus(HttpStatus.CONFLICT, () -> ratings.rate(passengerId, booking.id(), 1, "changed my mind"));
        assertThat(ratings.profile(driverId).averageStars()).isEqualTo(5.0);
    }

    @Test
    void onlyThePeopleOnTheBookingMayRateItAndOnlyOnceItIsCompleted() {
        long rideId = ride(Duration.ofMinutes(30));
        Booking booking = bookings.request(passengerId, rideId, 0, 1, 1, null);
        long stranger = identity.register(email(), "correct-horse-battery", "Nosy Parker", UserRole.PASSENGER).id();

        assertStatus(HttpStatus.CONFLICT, () -> ratings.rate(passengerId, booking.id(), 5, null));
        trips.start(driverId, rideId);
        assertStatus(HttpStatus.CONFLICT, () -> ratings.rate(driverId, booking.id(), 5, null));
        trips.complete(driverId, rideId);

        assertStatus(HttpStatus.NOT_FOUND, () -> ratings.rate(stranger, booking.id(), 1, "never met them"));
        assertStatus(HttpStatus.NOT_FOUND, () -> ratings.rate(passengerId, Long.MAX_VALUE, 5, null));
        ratings.rate(passengerId, booking.id(), 5, null);
    }

    @Test
    void aNoShowOrCancelledBookingCannotBeRated() {
        long rideId = ride(Duration.ofMinutes(30));
        Booking absent = bookings.request(passengerId, rideId, 0, 1, 1, null);
        trips.start(driverId, rideId);
        trips.noShow(driverId, absent.id());
        trips.complete(driverId, rideId);

        assertStatus(HttpStatus.CONFLICT, () -> ratings.rate(driverId, absent.id(), 1, "did not show"));
        assertThat(ratings.profile(passengerId).completedTrips()).isZero();
    }

    @Test
    void theAverageIsOverEveryRatingReceivedAndNobodyIsRatedUntilSomeoneRatesThem() {
        assertThat(ratings.profile(driverId).averageStars()).isNull();
        assertThat(ratings.profile(driverId).ratingCount()).isZero();

        for (int stars : new int[] {5, 4, 2}) {
            long passenger = identity.register(email(), "correct-horse-battery", "Rider", UserRole.PASSENGER).id();
            ratings.rate(passenger, completedTrip(passenger).id(), stars, null);
        }

        Profile driver = ratings.profile(driverId);
        assertThat(driver.averageStars()).isCloseTo(11.0 / 3, org.assertj.core.api.Assertions.within(1e-9));
        assertThat(driver.ratingCount()).isEqualTo(3);
        assertThat(driver.completedTrips()).isEqualTo(3);
    }

    @Test
    void aCompletedTripWaitsForEachSidesRatingUntilTheyGiveIt() {
        Booking booking = completedTrip(passengerId);

        assertThat(ratings.unratedBy(passengerId)).singleElement().satisfies((Unrated waiting) -> {
            assertThat(waiting.bookingId()).isEqualTo(booking.id());
            assertThat(waiting.otherPartyName()).isEqualTo("Ravi Jadhav");
            assertThat(waiting.otherPartyId()).isEqualTo(driverId);
        });
        assertThat(ratings.unratedBy(driverId)).singleElement()
                .satisfies(waiting -> assertThat(waiting.otherPartyName()).isEqualTo("Asha Patil"));

        ratings.rate(passengerId, booking.id(), 5, null);

        assertThat(ratings.unratedBy(passengerId)).isEmpty();
        assertThat(ratings.unratedBy(driverId)).hasSize(1);
    }

    @Test
    void searchResultsCarryTheDriversRatingAndBookingsSayWhoHasRated() {
        Booking booking = completedTrip(passengerId);
        ratings.rate(passengerId, booking.id(), 4, null);
        long nextRide = ride(Duration.ofDays(2));
        Instant departure = rides.get(nextRide).departureTime();

        Candidate candidate = rides.search(passengerId, new Point(16.7050, 74.2433),
                        new Point(18.5204, 73.8567),
                        departure.atZone(ZoneId.of("Asia/Kolkata")).toLocalDate(), 1, Sort.TIME)
                .stream().filter(c -> c.rideId() == nextRide).findFirst().orElseThrow();

        assertThat(candidate.driverId()).isEqualTo(driverId);
        assertThat(candidate.driverRating()).isEqualTo(4.0);
        assertThat(candidate.driverRatingCount()).isEqualTo(1);

        Booking seen = bookings.forPassenger(passengerId).get(0);
        assertThat(seen.passengerRated()).isTrue();
        assertThat(seen.driverRated()).isFalse();
    }

    @Test
    void aProfileShowsNoContactDetailsAndAdministratorsHaveNone() throws Exception {
        String passenger = "Bearer " + tokens.issue(passengerId, UserRole.PASSENGER);

        mvc.perform(get("/api/v1/users/" + driverId + "/profile").header("Authorization", passenger))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.fullName").value("Ravi Jadhav"))
                .andExpect(jsonPath("$.role").value("DRIVER"))
                .andExpect(jsonPath("$.memberSince").exists())
                .andExpect(jsonPath("$.averageStars").doesNotExist())
                .andExpect(jsonPath("$.email").doesNotExist());
        mvc.perform(get("/api/v1/users/" + driverId + "/profile")).andExpect(status().isUnauthorized());

        long adminId = identity.authenticate("admin@example.test", "admin-test-password").id();
        mvc.perform(get("/api/v1/users/" + adminId + "/profile").header("Authorization", passenger))
                .andExpect(status().isNotFound());
    }

    @Test
    void theHttpApiValidatesStarsAndCommentLength() throws Exception {
        Booking booking = completedTrip(passengerId);
        String passenger = "Bearer " + tokens.issue(passengerId, UserRole.PASSENGER);
        String url = "/api/v1/bookings/" + booking.id() + "/rating";

        for (String bad : List.of("{\"stars\": 0}", "{\"stars\": 6}",
                "{\"stars\": 5, \"comment\": \"" + "x".repeat(1001) + "\"}")) {
            mvc.perform(post(url).header("Authorization", passenger)
                    .contentType("application/json").content(bad))
                    .andExpect(status().isBadRequest());
        }
        mvc.perform(post(url).header("Authorization", passenger)
                        .contentType("application/json")
                        .content("{\"stars\": 5, \"comment\": \"<script>alert(1)</script>\"}"))
                .andExpect(status().isCreated());
        // Stored and returned as text; the client must render it as text.
        mvc.perform(get("/api/v1/users/" + driverId + "/profile").header("Authorization", passenger))
                .andExpect(jsonPath("$.reviews[0].comment").value("<script>alert(1)</script>"));
        mvc.perform(get("/api/v1/ratings/pending").header("Authorization", passenger))
                .andExpect(jsonPath("$.length()").value(0));
    }

    private Booking completedTrip(long passenger) {
        long rideId = ride(Duration.ofMinutes(30));
        Booking booking = bookings.request(passenger, rideId, 0, 1, 1, null);
        trips.start(driverId, rideId);
        trips.complete(driverId, rideId);
        return booking;
    }

    private long ride(Duration untilDeparture) {
        long vehicleId = vehicles.create(driverId, "Maruti", "Ertiga", 2022, "Silver", 7).id();
        return rides.publish(driverId, new PublishRide(vehicleId, Instant.now().plus(untilDeparture),
                3, true, STOPS, List.of(new BigDecimal("520.00")))).id();
    }

    private static String email() {
        return UUID.randomUUID() + "@example.test";
    }

    private static void assertStatus(HttpStatus expected, Runnable action) {
        assertThatThrownBy(action::run)
                .isInstanceOfSatisfying(ResponseStatusException.class,
                        e -> assertThat(e.getStatusCode()).isEqualTo(expected));
    }
}
