package com.dypcet.vayora.ride;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.dypcet.vayora.PostgresIntegrationTest;
import com.dypcet.vayora.booking.BookingService;
import com.dypcet.vayora.booking.BookingService.Booking;
import com.dypcet.vayora.booking.FlexTier;
import com.dypcet.vayora.booking.TripService;
import com.dypcet.vayora.identity.IdentityService;
import com.dypcet.vayora.identity.UserRole;
import com.dypcet.vayora.notification.NotificationService;
import com.dypcet.vayora.notification.NotificationService.Type;
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
import java.time.ZoneId;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

/**
 * Feature 28: a driver who offers detours picks a passenger up at the passenger's own point.
 * The tests have no routing service, so roads are straight lines driven at 50 km/h.
 */
class DetourIntegrationTest extends PostgresIntegrationTest {

    private static final ZoneId ZONE = ZoneId.of("Asia/Kolkata");
    private static final Point KOLHAPUR = new Point(16.7050, 74.2433);
    private static final Point SATARA = new Point(17.6805, 74.0183);
    private static final Point PUNE = new Point(18.5204, 73.8567);
    // About 2 km off the line from Kolhapur to Satara, and more than 5 km from every stop.
    private static final Point NEAR_KARAD = new Point(17.2890, 74.1300);
    // Far from any part of the ride's road.
    private static final Point RATNAGIRI = new Point(16.9902, 73.3120);

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
    private NotificationService notifications;

    private LocalDate day;
    private Instant departure;

    @BeforeEach
    void setUp() {
        // A day of its own, so other tests' rides cannot appear in these searches.
        day = LocalDate.now(ZONE).plusDays(8);
        departure = day.atTime(7, 0).atZone(ZONE).toInstant();
    }

    @Test
    void aPassengerOffTheStopsIsOfferedAPickupWhereTheRoadPassesAndBooksIt() {
        long rideId = ride(15);
        long passenger = user(UserRole.PASSENGER);

        Candidate offered = found(passenger, NEAR_KARAD, rideId).orElseThrow();

        assertThat(offered.fromSeq()).isZero();
        assertThat(offered.detourMinutes()).isEqualTo(1);
        assertThat(offered.pickupDistanceM()).isZero();
        // Kolhapur to the pickup is about 66 km: 80 minutes at 50 km/h, rounded up.
        assertThat(offered.boardingTime()).isEqualTo(departure.plus(Duration.ofMinutes(80)));

        Booking booking = book(passenger, rideId, NEAR_KARAD);
        assertThat(booking.pickupLat()).isCloseTo(NEAR_KARAD.lat(), org.assertj.core.api.Assertions.within(1e-6));
        assertThat(booking.pickupLon()).isCloseTo(NEAR_KARAD.lon(), org.assertj.core.api.Assertions.within(1e-6));
        assertThat(booking.detourMinutes()).isEqualTo(1);
        assertThat(booking.boardingTime()).isEqualTo(departure.plus(Duration.ofMinutes(80)));
    }

    @Test
    void aRideThatOffersNoDetourIsNotFoundAwayFromItsStopsNorBookedThere() {
        long rideId = ride(0);
        long passenger = user(UserRole.PASSENGER);

        assertThat(found(passenger, NEAR_KARAD, rideId)).isEmpty();
        assertConflict("This ride picks up only at its stops", () -> book(passenger, rideId, NEAR_KARAD));
    }

    @Test
    void aPointTooFarFromTheRoadIsNeverOffered() {
        long rideId = ride(30);

        assertThat(found(user(UserRole.PASSENGER), RATNAGIRI, rideId)).isEmpty();
    }

    @Test
    void theAllowanceIsSharedAcrossBookingsAndNeverOverspent() {
        long rideId = ride(1);
        long first = user(UserRole.PASSENGER);
        long second = user(UserRole.PASSENGER);
        Booking taken = book(first, rideId, NEAR_KARAD);

        assertThat(found(second, NEAR_KARAD, rideId)).isEmpty();
        assertConflict("That pickup would take the driver further out of their way than they offered",
                () -> book(second, rideId, NEAR_KARAD));

        // A cancelled booking gives its minutes back.
        bookings.cancel(first, taken.id());
        assertThat(found(second, NEAR_KARAD, rideId)).isPresent();
        assertThat(book(second, rideId, NEAR_KARAD).detourMinutes()).isEqualTo(1);
    }

    @Test
    void moreThanTheMostARideMayOfferIsRefused() {
        assertThatThrownBy(() -> ride(31)).isInstanceOfSatisfying(ResponseStatusException.class, e -> {
            assertThat(e.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
            assertThat(e.getReason()).isEqualTo("That is more detour than a ride may offer");
        });
    }

    @Test
    void aPassengerNearAStopStillBoardsThereWithNoDetour() {
        long rideId = ride(15);

        Candidate offered = found(user(UserRole.PASSENGER), SATARA, rideId).orElseThrow();

        assertThat(offered.fromSeq()).isEqualTo(1);
        assertThat(offered.detourMinutes()).isNull();
    }

    // Found reviewing the detour work: a flexible passenger picked up near Karad was rebooked
    // from the Kolhapur stop, the stop before their pickup, 66 km from where they were.
    @Test
    void aFlexiblePassengerPickedUpAwayIsRebookedFromTheirOwnPointWhenTheDriverWithdraws() {
        onADayOfItsOwn(12);
        long withdrawing = user(UserRole.DRIVER);
        long first = rideBy(withdrawing, departure, 15);
        long passenger = user(UserRole.PASSENGER);
        bookings.request(passenger, first, 0, 2, 1, null, FlexTier.FLEXIBLE, NEAR_KARAD);
        // Leaves from Kolhapur 20 minutes before the other: closer in time from the stop, but
        // the passenger is not at the stop.
        rideBy(user(UserRole.DRIVER), departure.plus(Duration.ofMinutes(40)), 0);
        long comesToKarad = rideBy(user(UserRole.DRIVER), departure.plus(Duration.ofMinutes(60)), 15);

        trips.cancel(withdrawing, first);

        Booking rebooked = bookings.forPassenger(passenger).stream()
                .filter(b -> b.rideId() != first).findFirst().orElseThrow();
        assertThat(rebooked.rideId()).isEqualTo(comesToKarad);
        assertThat(rebooked.pickupLat()).isCloseTo(NEAR_KARAD.lat(), org.assertj.core.api.Assertions.within(1e-6));
        assertThat(rebooked.boardingTime()).isEqualTo(departure.plus(Duration.ofMinutes(60 + 80)));
    }

    // Found with the one above: the rides suggested to a passenger whose driver withdrew were
    // looked for from that same stop.
    @Test
    void aPassengerPickedUpAwayIsToldOfRidesThatCanReachTheirOwnPoint() {
        onADayOfItsOwn(13);
        long withdrawing = user(UserRole.DRIVER);
        long first = rideBy(withdrawing, departure, 15);
        long passenger = user(UserRole.PASSENGER);
        book(passenger, first, NEAR_KARAD);
        rideBy(user(UserRole.DRIVER, "Stops Only"), departure.plus(Duration.ofMinutes(40)), 0);
        rideBy(user(UserRole.DRIVER, "Comes To Karad"), departure.plus(Duration.ofMinutes(60)), 15);

        trips.cancel(withdrawing, first);

        String notice = notifications.forUser(passenger).stream()
                .filter(n -> n.type() == Type.RIDE_CANCELLED).findFirst().orElseThrow().message();
        // Leaves Kolhapur at 08:00 and reaches the pickup 80 minutes later.
        assertThat(notice).contains(
                "Other rides that could take you: 09:20 with Comes To Karad, picking you up at your own point.")
                .doesNotContain("Stops Only");
    }

    /**
     * For a test that looks for every ride that fits: the other tests here leave rides at
     * 07:00 on the shared day, closer in time than any the test sets up.
     */
    private void onADayOfItsOwn(int daysAhead) {
        day = LocalDate.now(ZONE).plusDays(daysAhead);
        departure = day.atTime(7, 0).atZone(ZONE).toInstant();
    }

    private long ride(int maxDetourMinutes) {
        return rideBy(user(UserRole.DRIVER), departure, maxDetourMinutes);
    }

    private long rideBy(long driver, Instant leaves, int maxDetourMinutes) {
        long vehicleId = vehicles.create(driver, "Maruti", "Ertiga", 2022, "Silver", 7).id();
        return rides.publish(driver, new PublishRide(vehicleId, leaves, 3, true,
                List.of(new StopInput("Kolhapur", KOLHAPUR.lat(), KOLHAPUR.lon(), 0),
                        new StopInput("Satara", SATARA.lat(), SATARA.lon(), 130),
                        new StopInput("Pune", PUNE.lat(), PUNE.lon(), 270)),
                List.of(new BigDecimal("270.00"), new BigDecimal("250.00")),
                null, false, null, 0, false, maxDetourMinutes)).id();
    }

    private Optional<Candidate> found(long passenger, Point from, long rideId) {
        return rides.search(passenger, from, PUNE, day, 1, Sort.TIME).stream()
                .filter(c -> c.rideId() == rideId).findFirst();
    }

    private Booking book(long passenger, long rideId, Point pickup) {
        return bookings.request(passenger, rideId, 0, 2, 1, null, FlexTier.EXACT, pickup);
    }

    private long user(UserRole role) {
        return user(role, "Test " + role);
    }

    private long user(UserRole role, String name) {
        return identity.register(UUID.randomUUID() + "@example.test", "correct-horse-battery", name, role).id();
    }

    private static void assertConflict(String reason, Runnable action) {
        assertThatThrownBy(action::run).isInstanceOfSatisfying(ResponseStatusException.class, e -> {
            assertThat(e.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
            assertThat(e.getReason()).isEqualTo(reason);
        });
    }
}
