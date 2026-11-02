package com.dypcet.vayora.booking;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.dypcet.vayora.PostgresIntegrationTest;
import com.dypcet.vayora.booking.BookingService.Booking;
import com.dypcet.vayora.identity.IdentityService;
import com.dypcet.vayora.identity.UserRole;
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
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.server.ResponseStatusException;

/** The booking lifecycle through the real services into a real PostGIS. */
class BookingFlowIntegrationTest extends PostgresIntegrationTest {

    private static final Instant DEPARTURE = Instant.now().plus(Duration.ofDays(3));

    private static final Point KOLHAPUR = new Point(16.7050, 74.2433);
    private static final Point KARAD = new Point(17.2890, 74.1818);
    private static final Point SATARA = new Point(17.6805, 74.0183);
    private static final Point PUNE = new Point(18.5204, 73.8567);

    // Kolhapur, Karad, Satara, Pune: stops 0..3, so legs 0..2.
    private static final List<StopInput> CORRIDOR = List.of(
            new StopInput("Kolhapur", 16.7050, 74.2433, 0),
            new StopInput("Karad", 17.2890, 74.1818, 75),
            new StopInput("Satara", 17.6805, 74.0183, 130),
            new StopInput("Pune", 18.5204, 73.8567, 270));
    private static final List<BigDecimal> PRICES = List.of(
            new BigDecimal("150.00"), new BigDecimal("120.00"), new BigDecimal("250.00"));

    @Autowired
    private IdentityService identity;

    @Autowired
    private VehicleService vehicles;

    @Autowired
    private RideService rides;

    @Autowired
    private BookingService bookings;

    @Autowired
    private JdbcTemplate jdbc;

    private long driverId;

    @BeforeEach
    void setUp() {
        jdbc.update("TRUNCATE events");
        driverId = user(UserRole.DRIVER);
    }

    @Test
    void bookingsOnDifferentStretchesConsumeOnlyTheirOwnLegs() {
        long rideId = ride(2, true);

        bookings.request(user(UserRole.PASSENGER), rideId, 0, 2, 1, null); // Kolhapur to Satara
        bookings.request(user(UserRole.PASSENGER), rideId, 1, 3, 1, null); // Karad to Pune

        assertThat(seatsAvailable(rideId)).containsExactly(1, 0, 1);
    }

    @Test
    void theLastMileGapAndModeShownAreRecordedOnTheBookingAndItsFeatures() {
        long rideId = ride(2, true);

        Booking booking = bookings.request(user(UserRole.PASSENGER), rideId, 0, 2, 1,
                null, FlexTier.EXACT, null, 2300, "rickshaw");

        assertThat(jdbc.queryForObject(
                "SELECT last_mile_distance_m FROM bookings WHERE id = ?", Integer.class, booking.id()))
                .isEqualTo(2300);
        assertThat(jdbc.queryForObject(
                "SELECT last_mile_mode_shown FROM bookings WHERE id = ?", String.class, booking.id()))
                .isEqualTo("rickshaw");
        assertThat(jdbc.queryForObject(
                "SELECT hazard_features->>'last_mile_distance_m' FROM bookings WHERE id = ?",
                String.class, booking.id())).isEqualTo("2300.0");
        assertThat(jdbc.queryForObject(
                "SELECT hazard_features->>'last_mile_mode_available' FROM bookings WHERE id = ?",
                String.class, booking.id())).isEqualTo("1.0");
        assertThat(jdbc.queryForObject("""
                SELECT (payload->>'last_mile_distance_m')::int || ':' || (payload->>'last_mile_mode_available')
                FROM events WHERE event_type = 'booking_requested' AND (payload->>'booking_id')::bigint = ?""",
                String.class, booking.id())).isEqualTo("2300:true");
    }

    @Test
    void aBookingWithNoLastMileGapShownLeavesItUnset() {
        long rideId = ride(2, true);

        Booking booking = bookings.request(user(UserRole.PASSENGER), rideId, 0, 2, 1,
                null);

        assertThat(jdbc.queryForObject(
                "SELECT last_mile_distance_m IS NULL AND last_mile_mode_shown IS NULL FROM bookings WHERE id = ?",
                Boolean.class, booking.id())).isTrue();
        assertThat(jdbc.queryForObject(
                "SELECT hazard_features->>'last_mile_distance_m' FROM bookings WHERE id = ?",
                String.class, booking.id())).isEqualTo("0.0");
    }

    @Test
    void aFullMiddleLegBlocksEveryStretchThatCrossesIt() {
        long rideId = ride(1, true);
        bookings.request(user(UserRole.PASSENGER), rideId, 1, 2, 1, null); // Karad to Satara

        assertConflict(() -> bookings.request(user(UserRole.PASSENGER), rideId, 0, 3, 1, null));
        assertConflict(() -> bookings.request(user(UserRole.PASSENGER), rideId, 0, 2, 1, null));

        // The failed attempts must not have left a partial decrement behind.
        assertThat(seatsAvailable(rideId)).containsExactly(1, 0, 1);
        bookings.request(user(UserRole.PASSENGER), rideId, 0, 1, 1, null);
        bookings.request(user(UserRole.PASSENGER), rideId, 2, 3, 1, null);
        assertThat(seatsAvailable(rideId)).containsExactly(0, 0, 0);
    }

    @Test
    void theLastSeatGoesToExactlyOneOfManyConcurrentRequests() throws Exception {
        long rideId = ride(1, true);
        int contenders = 8;
        List<Long> passengers = new ArrayList<>();
        for (int i = 0; i < contenders; i++) {
            passengers.add(user(UserRole.PASSENGER));
        }

        ExecutorService pool = Executors.newFixedThreadPool(contenders);
        CountDownLatch go = new CountDownLatch(1);
        List<Future<Boolean>> attempts = new ArrayList<>();
        for (long passenger : passengers) {
            attempts.add(pool.submit(() -> {
                go.await();
                try {
                    bookings.request(passenger, rideId, 0, 3, 1, null);
                    return true;
                } catch (ResponseStatusException e) {
                    assertThat(e.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
                    return false;
                }
            }));
        }
        go.countDown();
        int won = 0;
        for (Future<Boolean> attempt : attempts) {
            if (attempt.get(30, TimeUnit.SECONDS)) {
                won++;
            }
        }
        pool.shutdown();

        assertThat(won).isEqualTo(1);
        assertThat(seatsAvailable(rideId)).containsExactly(0, 0, 0);
        assertThat(jdbc.queryForObject(
                "SELECT COUNT(*) FROM bookings WHERE ride_id = ?", Integer.class, rideId))
                .isEqualTo(1);
    }

    @Test
    void instantBookingConfirmsAtOnceAndLogsRequestAndAcceptance() {
        long rideId = ride(3, true);
        long passenger = user(UserRole.PASSENGER);

        Booking booking = bookings.request(passenger, rideId, 0, 3, 2, null);

        assertThat(booking.status()).isEqualTo(BookingStatus.CONFIRMED);
        assertThat(booking.price()).isEqualByComparingTo("1040.00"); // (150 + 120 + 250) x 2
        // The passenger is told who will drive and in what, so they know whom to meet.
        assertThat(booking.driverName()).startsWith("Test");
        assertThat(booking.vehicle()).isNotBlank();
        assertThat(eventTypes()).containsExactly("booking_requested", "booking_accepted");
        assertThat(jdbc.queryForObject("""
                SELECT actor_type || ':' || actor_id FROM events
                WHERE event_type = 'booking_requested'""", String.class))
                .isEqualTo("passenger:" + passenger);
    }

    @Test
    void approvalRideHoldsSeatsUntilTheDriverDecides() {
        long rideId = ride(1, false);

        Booking pending = bookings.request(user(UserRole.PASSENGER), rideId, 0, 3, 1, null);
        assertThat(pending.status()).isEqualTo(BookingStatus.PENDING);
        assertThat(seatsAvailable(rideId)).containsExactly(0, 0, 0);

        assertThat(bookings.accept(driverId, pending.id()).status())
                .isEqualTo(BookingStatus.CONFIRMED);
        assertThat(seatsAvailable(rideId)).containsExactly(0, 0, 0);
        assertThat(eventTypes()).containsExactly("booking_requested", "booking_accepted");
    }

    @Test
    void rejectionReturnsTheSeatsAndIsFinal() {
        long rideId = ride(1, false);
        Booking pending = bookings.request(user(UserRole.PASSENGER), rideId, 0, 3, 1, null);

        assertThat(bookings.reject(driverId, pending.id()).status())
                .isEqualTo(BookingStatus.REJECTED);

        assertThat(seatsAvailable(rideId)).containsExactly(1, 1, 1);
        assertThat(eventTypes()).containsExactly("booking_requested", "booking_rejected");
        assertConflict(() -> bookings.accept(driverId, pending.id()));
    }

    @Test
    void cancellationReturnsTheSeatsOnceAndLogsTheBoardingTime() {
        long rideId = ride(2, true);
        long passenger = user(UserRole.PASSENGER);
        Booking booking = bookings.request(passenger, rideId, 1, 3, 2, null); // boards at Karad

        assertThat(bookings.cancel(passenger, booking.id()).status())
                .isEqualTo(BookingStatus.CANCELLED);
        assertThat(seatsAvailable(rideId)).containsExactly(2, 2, 2);

        // A second cancel must not release the seats again.
        assertConflict(() -> bookings.cancel(passenger, booking.id()));
        assertThat(seatsAvailable(rideId)).containsExactly(2, 2, 2);

        Instant logged = jdbc.queryForObject("""
                SELECT CAST(payload->>'departure_time' AS timestamptz) FROM events
                WHERE event_type = 'booking_cancelled'""", OffsetDateTime.class).toInstant();
        assertThat(logged).isCloseTo(DEPARTURE.plus(Duration.ofMinutes(75)),
                org.assertj.core.api.Assertions.within(1, java.time.temporal.ChronoUnit.MILLIS));
    }

    @Test
    void aBookingCanOnlyBeCancelledByItsPassengerAndDecidedByItsDriver() {
        long rideId = ride(1, false);
        Booking booking = bookings.request(user(UserRole.PASSENGER), rideId, 0, 3, 1, null);

        assertNotFound(() -> bookings.cancel(user(UserRole.PASSENGER), booking.id()));
        assertNotFound(() -> bookings.accept(user(UserRole.DRIVER), booking.id()));
        assertNotFound(() -> bookings.forRide(user(UserRole.DRIVER), rideId));
        assertThat(bookings.forRide(driverId, rideId)).hasSize(1);
        assertThat(seatsAvailable(rideId)).containsExactly(0, 0, 0);
    }

    @Test
    void requestsForStopsNotOnTheRideAreRefused() {
        long rideId = ride(1, true);
        long passenger = user(UserRole.PASSENGER);

        assertStatus(HttpStatus.BAD_REQUEST, () -> bookings.request(passenger, rideId, 2, 4, 1, null));
        assertStatus(HttpStatus.BAD_REQUEST, () -> bookings.request(passenger, rideId, 2, 1, 1, null));
        assertNotFound(() -> bookings.request(passenger, Long.MAX_VALUE, 0, 1, 1, null));
    }

    @Test
    void searchFindsARideByAnyOrderedPairOfItsStopsAndRespectsSeats() {
        long rideId = ride(2, true);
        long passenger = user(UserRole.PASSENGER);
        LocalDate day = DEPARTURE.atZone(ZoneId.of("Asia/Kolkata")).toLocalDate();
        LocalDate karadDay = DEPARTURE.plus(Duration.ofMinutes(75))
                .atZone(ZoneId.of("Asia/Kolkata")).toLocalDate();

        List<Candidate> found = mine(rides.search(passenger, KARAD, PUNE, karadDay, 2, Sort.TIME), rideId);
        assertThat(found).hasSize(1);
        assertThat(found.get(0).fromSeq()).isEqualTo(1);
        assertThat(found.get(0).toSeq()).isEqualTo(3);
        assertThat(found.get(0).pricePerSeat()).isEqualByComparingTo("370.00");
        assertThat(found.get(0).seatsAvailable()).isEqualTo(2);

        // Wrong direction, and more seats than are left.
        assertThat(mine(rides.search(passenger, PUNE, KOLHAPUR, day, 1, Sort.TIME), rideId)).isEmpty();
        bookings.request(passenger, rideId, 2, 3, 1, null);
        assertThat(mine(rides.search(passenger, KARAD, PUNE, karadDay, 2, Sort.TIME), rideId)).isEmpty();
        assertThat(mine(rides.search(passenger, KOLHAPUR, SATARA, day, 2, Sort.TIME), rideId)).hasSize(1);

        assertThat(jdbc.queryForObject(
                "SELECT COUNT(*) FROM events WHERE event_type = 'search_issued'", Integer.class))
                .isEqualTo(4);
        assertThat(jdbc.queryForObject(
                "SELECT COUNT(*) FROM events WHERE event_type = 'candidates_returned'",
                Integer.class)).isEqualTo(4);
    }

    @Test
    void aDriverCannotPublishWithSomeoneElsesVehicleOrMoreSeatsThanItHas() {
        long otherDriver = user(UserRole.DRIVER);
        long othersVehicle = vehicles.create(otherDriver, "Tata", "Nexon", 2023, "Blue", 5).id();
        long ownVehicle = vehicles.create(driverId, "Maruti", "Swift", 2021, "White", 5).id();

        assertStatus(HttpStatus.BAD_REQUEST, () -> rides.publish(driverId,
                new PublishRide(othersVehicle, DEPARTURE, 2, true, CORRIDOR, PRICES)));
        assertStatus(HttpStatus.BAD_REQUEST, () -> rides.publish(driverId,
                new PublishRide(ownVehicle, DEPARTURE, 5, true, CORRIDOR, PRICES)));
    }

    private long user(UserRole role) {
        return identity.register(UUID.randomUUID() + "@example.test", "correct-horse-battery",
                "Test " + role, role).id();
    }

    private long ride(int seats, boolean instantBooking) {
        long vehicleId = vehicles.create(driverId, "Maruti", "Ertiga", 2022, "Silver", 7).id();
        return rides.publish(driverId,
                new PublishRide(vehicleId, DEPARTURE, seats, instantBooking, CORRIDOR, PRICES)).id();
    }

    private List<Integer> seatsAvailable(long rideId) {
        return jdbc.queryForList(
                "SELECT seats_available FROM ride_segments WHERE ride_id = ? ORDER BY seq",
                Integer.class, rideId);
    }

    private List<String> eventTypes() {
        return jdbc.queryForList("SELECT event_type FROM events ORDER BY id", String.class);
    }

    /** Other tests' rides share the database; keep only this test's ride. */
    private static List<Candidate> mine(List<Candidate> candidates, long rideId) {
        return candidates.stream().filter(c -> c.rideId() == rideId).toList();
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
