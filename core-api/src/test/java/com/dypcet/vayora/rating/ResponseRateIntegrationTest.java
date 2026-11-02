package com.dypcet.vayora.rating;

import static org.assertj.core.api.Assertions.assertThat;

import com.dypcet.vayora.PostgresIntegrationTest;
import com.dypcet.vayora.booking.BookingService;
import com.dypcet.vayora.booking.TripService;
import com.dypcet.vayora.identity.IdentityService;
import com.dypcet.vayora.identity.UserRole;
import com.dypcet.vayora.rating.RatingService.Profile;
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
import org.springframework.jdbc.core.JdbcTemplate;

class ResponseRateIntegrationTest extends PostgresIntegrationTest {

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
    private JdbcTemplate jdbc;

    private long driver;

    @BeforeEach
    void setUp() {
        driver = user(UserRole.DRIVER);
    }

    @Test
    void aDriversRateCountsTheirOwnAnswersAndTheTimeIsTheMedian() {
        long rideId = ride(Duration.ofDays(3), false);
        long accepted = request(rideId);
        long declined = request(rideId);
        long lapsed = request(rideId);
        long withdrawn = request(rideId);

        made(accepted, Duration.ofMinutes(60));
        bookings.accept(driver, accepted);
        made(declined, Duration.ofMinutes(30));
        bookings.reject(driver, declined);
        // Not enough settled requests yet to say anything.
        assertThat(ratings.profile(driver).responseRate()).isNull();

        made(lapsed, Duration.ofHours(13));
        assertThat(bookings.expire(lapsed)).isTrue();
        // The passenger gave up while waiting: neither answered nor unanswered.
        bookings.cancel(passengerOf(withdrawn), withdrawn);

        Profile profile = ratings.profile(driver);
        assertThat(profile.responseRate()).isCloseTo(2.0 / 3, org.assertj.core.data.Offset.offset(1e-9));
        assertThat(profile.responseMinutes()).isBetween(44, 46); // median of 60 and 30
    }

    @Test
    void requestsLeftUnansweredWhenTheRideStartsAreNotTheDriversAnswers() {
        long rideId = ride(Duration.ofMinutes(30), false);
        for (int i = 0; i < 3; i++) {
            request(rideId);
        }

        trips.start(driver, rideId);

        assertThat(ratings.profile(driver).responseRate()).isZero();
        assertThat(ratings.profile(driver).responseMinutes()).isNull();
    }

    @Test
    void instantRidesAndPassengersHaveNoResponseRate() {
        long rideId = ride(Duration.ofDays(3), true);
        long passenger = 0;
        for (int i = 0; i < 3; i++) {
            passenger = passengerOf(request(rideId));
        }

        assertThat(ratings.profile(driver).responseRate()).isNull();
        assertThat(ratings.profile(passenger).responseRate()).isNull();
        assertThat(ratings.profile(passenger).responseMinutes()).isNull();
    }

    private long request(long rideId) {
        return bookings.request(user(UserRole.PASSENGER), rideId, 0, 1, 1, null).id();
    }

    private long passengerOf(long bookingId) {
        return jdbc.queryForObject("SELECT passenger_id FROM bookings WHERE id = ?", Long.class, bookingId);
    }

    /** Makes the request look as if it was made this long ago. */
    private void made(long bookingId, Duration ago) {
        jdbc.update("UPDATE bookings SET created_at = now() - make_interval(secs => ?) WHERE id = ?",
                (double) ago.toSeconds(), bookingId);
    }

    private long ride(Duration untilDeparture, boolean instantBooking) {
        long vehicleId = vehicles.create(driver, "Maruti", "Ertiga", 2022, "Silver", 7).id();
        return rides.publish(driver, new PublishRide(vehicleId, Instant.now().plus(untilDeparture), 6,
                instantBooking, List.of(new StopInput("Kolhapur", 16.7050, 74.2433, 0),
                        new StopInput("Pune", 18.5204, 73.8567, 270)),
                List.of(new BigDecimal("400.00")))).id();
    }

    private long user(UserRole role) {
        return identity.register(UUID.randomUUID() + "@example.test", "correct-horse-battery",
                "Test " + role, role).id();
    }
}
