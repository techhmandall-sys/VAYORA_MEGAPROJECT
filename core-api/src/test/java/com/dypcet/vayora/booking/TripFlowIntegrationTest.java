package com.dypcet.vayora.booking;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.dypcet.vayora.PostgresIntegrationTest;
import com.dypcet.vayora.booking.BookingService.Booking;
import com.dypcet.vayora.identity.IdentityService;
import com.dypcet.vayora.identity.UserRole;
import com.dypcet.vayora.ride.RideService;
import com.dypcet.vayora.ride.RideService.PublishRide;
import com.dypcet.vayora.ride.RideService.Sort;
import com.dypcet.vayora.ride.RideService.StopInput;
import com.dypcet.vayora.routing.RouteService.Point;
import com.dypcet.vayora.vehicle.VehicleService;
import java.math.BigDecimal;
import java.time.Duration;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.server.ResponseStatusException;

/** Starting, completing and withdrawing a ride, and the trip events that follow. */
class TripFlowIntegrationTest extends PostgresIntegrationTest {

    private static final List<StopInput> STOPS = List.of(
            new StopInput("Kolhapur", 16.7050, 74.2433, 0),
            new StopInput("Satara", 17.6805, 74.0183, 130),
            new StopInput("Pune", 18.5204, 73.8567, 270));
    private static final List<BigDecimal> PRICES = List.of(
            new BigDecimal("270.00"), new BigDecimal("250.00"));

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
    private JdbcTemplate jdbc;

    private long driverId;

    @BeforeEach
    void setUp() {
        jdbc.update("TRUNCATE events");
        driverId = user(UserRole.DRIVER);
    }

    @Test
    void everyStartedTripEndsAsExactlyOneCompletionOrFailure() {
        long rideId = rideLeavingIn(Duration.ofMinutes(30), true);
        Booking rides1 = bookings.request(user(UserRole.PASSENGER), rideId, 0, 2, 1, null);
        Booking rides2 = bookings.request(user(UserRole.PASSENGER), rideId, 0, 1, 1, null);
        Booking absent = bookings.request(user(UserRole.PASSENGER), rideId, 1, 2, 1, null);
        jdbc.update("TRUNCATE events");

        assertThat(trips.start(driverId, rideId).status()).isEqualTo("IN_PROGRESS");
        assertThat(count("trip_started")).isEqualTo(3);

        assertThat(trips.noShow(driverId, absent.id()).status()).isEqualTo(BookingStatus.NO_SHOW);
        assertThat(trips.complete(driverId, rideId).status()).isEqualTo("COMPLETED");

        assertThat(count("trip_completed")).isEqualTo(2);
        assertThat(count("trip_failed")).isEqualTo(1);
        assertThat(jdbc.queryForObject(
                "SELECT payload->>'reason' FROM events WHERE event_type = 'trip_failed'",
                String.class)).isEqualTo("passenger_no_show");
        assertThat(statusOf(rides1)).isEqualTo("COMPLETED");
        assertThat(statusOf(rides2)).isEqualTo("COMPLETED");
        assertThat(statusOf(absent)).isEqualTo("NO_SHOW");
        assertThat(jdbc.queryForList("""
                SELECT (payload->>'booking_id')::bigint FROM events
                WHERE event_type = 'trip_completed' ORDER BY id""", Long.class))
                .containsExactly(rides1.id(), rides2.id());
    }

    @Test
    void startingRejectsUnansweredRequestsAndFreesTheirSeats() {
        long rideId = rideLeavingIn(Duration.ofMinutes(30), false);
        Booking accepted = bookings.request(user(UserRole.PASSENGER), rideId, 0, 2, 1, null);
        Booking unanswered = bookings.request(user(UserRole.PASSENGER), rideId, 0, 2, 1, null);
        bookings.accept(driverId, accepted.id());
        jdbc.update("TRUNCATE events");

        trips.start(driverId, rideId);

        assertThat(statusOf(unanswered)).isEqualTo("REJECTED");
        assertThat(seatsAvailable(rideId)).containsExactly(2, 2);
        assertThat(count("booking_rejected")).isEqualTo(1);
        assertThat(count("trip_started")).isEqualTo(1);
    }

    @Test
    void aStartedRideTakesNoCancellationsAndNoBookingsFromAStopItIsNear() {
        long rideId = rideLeavingIn(Duration.ofMinutes(30), true);
        long passenger = user(UserRole.PASSENGER);
        Booking booking = bookings.request(passenger, rideId, 0, 2, 1, null);
        trips.start(driverId, rideId);

        assertConflict(() -> bookings.cancel(passenger, booking.id()));
        // Kolhapur is where it is leaving from. Later stops: MidRouteIntegrationTest.
        assertConflict(() -> bookings.request(user(UserRole.PASSENGER), rideId, 0, 1, 1, null));
        assertThat(rides.search(passenger, new Point(16.7050, 74.2433), new Point(18.5204, 73.8567), today(), 1,
                Sort.TIME))
                .noneMatch(c -> c.rideId() == rideId);
    }

    @Test
    void aRideMovesOnlyForwardAndOnlyNearItsDeparture() {
        long farOff = rideLeavingIn(Duration.ofDays(3), true);
        assertConflict(() -> trips.start(driverId, farOff));
        assertConflict(() -> trips.complete(driverId, farOff));
        // The ride says when it may start, so the app need not guess: an hour ahead, as configured.
        RideService.Ride far = rides.get(farOff);
        assertThat(far.startsFrom()).isEqualTo(far.departureTime().minus(Duration.ofHours(1)));

        long rideId = rideLeavingIn(Duration.ofMinutes(30), true);
        Booking booking = bookings.request(user(UserRole.PASSENGER), rideId, 0, 2, 1, null);
        assertConflict(() -> trips.noShow(driverId, booking.id()));
        trips.start(driverId, rideId);
        assertConflict(() -> trips.start(driverId, rideId));
        assertConflict(() -> trips.cancel(driverId, rideId));
        trips.complete(driverId, rideId);
        assertConflict(() -> trips.complete(driverId, rideId));
        assertConflict(() -> trips.noShow(driverId, booking.id()));
    }

    @Test
    void onlyTheRidesOwnDriverMayRunIt() {
        long rideId = rideLeavingIn(Duration.ofMinutes(30), true);
        Booking booking = bookings.request(user(UserRole.PASSENGER), rideId, 0, 2, 1, null);
        long intruder = user(UserRole.DRIVER);

        assertNotFound(() -> trips.start(intruder, rideId));
        assertNotFound(() -> trips.cancel(intruder, rideId));
        trips.start(driverId, rideId);
        assertNotFound(() -> trips.noShow(intruder, booking.id()));
        assertNotFound(() -> trips.complete(intruder, rideId));
        assertThat(statusOf(booking)).isEqualTo("CONFIRMED");
    }

    @Test
    void aDriverWithdrawingARideCancelsEveryLiveBookingAndSaysWhoDidIt() {
        Duration untilDeparture = Duration.ofDays(2);
        Instant departure = Instant.now().plus(untilDeparture);
        long rideId = rideLeavingAt(departure, false);
        long passenger = user(UserRole.PASSENGER);
        Booking confirmed = bookings.request(passenger, rideId, 0, 2, 1, null);
        Booking pending = bookings.request(user(UserRole.PASSENGER), rideId, 1, 2, 1, null);
        Booking alreadyGone = bookings.request(user(UserRole.PASSENGER), rideId, 0, 1, 1, null);
        bookings.accept(driverId, confirmed.id());
        bookings.reject(driverId, alreadyGone.id());
        jdbc.update("TRUNCATE events");

        assertThat(trips.cancel(driverId, rideId).status()).isEqualTo("CANCELLED");

        assertThat(statusOf(confirmed)).isEqualTo("CANCELLED");
        assertThat(statusOf(pending)).isEqualTo("CANCELLED");
        assertThat(statusOf(alreadyGone)).isEqualTo("REJECTED");
        assertThat(count("booking_cancelled")).isEqualTo(2);
        assertThat(jdbc.queryForList("""
                SELECT DISTINCT actor_type || ':' || actor_id || ':' || (payload->>'cancelled_by')
                FROM events WHERE event_type = 'booking_cancelled'""", String.class))
                .containsExactly("driver:" + driverId + ":driver");
        // The pending booking boards at Satara, 130 minutes after departure.
        assertThat(jdbc.queryForObject("""
                SELECT CAST(payload->>'departure_time' AS timestamptz) FROM events
                WHERE event_type = 'booking_cancelled' AND (payload->>'booking_id')::bigint = ?""",
                OffsetDateTime.class, pending.id()).toInstant())
                .isCloseTo(departure.plus(Duration.ofMinutes(130)),
                        org.assertj.core.api.Assertions.within(1, ChronoUnit.MILLIS));
        assertConflict(() -> bookings.request(passenger, rideId, 0, 2, 1, null));
        assertConflict(() -> trips.start(driverId, rideId));
    }

    private long user(UserRole role) {
        return identity.register(UUID.randomUUID() + "@example.test", "correct-horse-battery",
                "Test " + role, role).id();
    }

    private long rideLeavingIn(Duration untilDeparture, boolean instantBooking) {
        return rideLeavingAt(Instant.now().plus(untilDeparture), instantBooking);
    }

    private long rideLeavingAt(Instant departure, boolean instantBooking) {
        long vehicleId = vehicles.create(driverId, "Maruti", "Ertiga", 2022, "Silver", 7).id();
        return rides.publish(driverId,
                new PublishRide(vehicleId, departure, 3, instantBooking, STOPS, PRICES)).id();
    }

    private static java.time.LocalDate today() {
        return Instant.now().plus(Duration.ofMinutes(30)).atZone(ZoneId.of("Asia/Kolkata"))
                .toLocalDate();
    }

    private int count(String eventType) {
        return jdbc.queryForObject(
                "SELECT COUNT(*) FROM events WHERE event_type = ?", Integer.class, eventType);
    }

    private String statusOf(Booking booking) {
        return jdbc.queryForObject(
                "SELECT status FROM bookings WHERE id = ?", String.class, booking.id());
    }

    private List<Integer> seatsAvailable(long rideId) {
        return jdbc.queryForList(
                "SELECT seats_available FROM ride_segments WHERE ride_id = ? ORDER BY seq",
                Integer.class, rideId);
    }

    private static void assertConflict(Runnable action) {
        assertStatus(HttpStatus.CONFLICT, action);
    }

    private static void assertNotFound(Runnable action) {
        assertStatus(HttpStatus.NOT_FOUND, action);
    }

    private static void assertStatus(HttpStatus expected, Runnable action) {
        assertThatThrownBy(action::run)
                .isInstanceOfSatisfying(ResponseStatusException.class,
                        e -> assertThat(e.getStatusCode()).isEqualTo(expected));
    }
}
