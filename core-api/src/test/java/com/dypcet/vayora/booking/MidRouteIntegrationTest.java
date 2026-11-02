package com.dypcet.vayora.booking;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.dypcet.vayora.PostgresIntegrationTest;
import com.dypcet.vayora.booking.BookingService.Booking;
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
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.web.server.ResponseStatusException;

/**
 * Seats on a ride already under way: sold from a stop it is not yet near, only on a ride
 * that confirms instantly, and a seat left by a no-show sold again.
 */
@AutoConfigureMockMvc
class MidRouteIntegrationTest extends PostgresIntegrationTest {

    private static final Point KOLHAPUR = new Point(16.7050, 74.2433);
    private static final Point SATARA = new Point(17.6805, 74.0183);
    private static final Point PUNE = new Point(18.5204, 73.8567);
    // The ride leaves in half an hour and is due at Satara 130 minutes later: well clear
    // of the 30-minute margin once it is started. Kolhapur is inside it from the start.
    private static final List<StopInput> STOPS = List.of(
            new StopInput("Kolhapur", KOLHAPUR.lat(), KOLHAPUR.lon(), 0),
            new StopInput("Satara", SATARA.lat(), SATARA.lon(), 130),
            new StopInput("Pune", PUNE.lat(), PUNE.lon(), 270));
    private static final List<BigDecimal> PRICES = List.of(
            new BigDecimal("270.00"), new BigDecimal("250.00"));
    private static final String TOO_SOON = "This ride is on the road and due at that stop too soon to book";

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
    private TokenService tokens;

    @Autowired
    private JdbcTemplate jdbc;

    @Autowired
    private MockMvc mvc;

    private long driverId;

    @BeforeEach
    void setUp() {
        jdbc.update("TRUNCATE events");
        driverId = user(UserRole.DRIVER);
    }

    @Test
    void aRideOnTheRoadIsOfferedAndBookedFromAStopItIsNotYetNear() {
        long rideId = startedRide(3, true);
        long passenger = user(UserRole.PASSENGER);

        Candidate offered = found(passenger, SATARA, rideId).orElseThrow();
        assertThat(offered.underWay()).isTrue();
        assertThat(offered.fromStop()).isEqualTo("Satara");

        Booking booking = bookings.request(passenger, rideId, 1, 2, 1, null);

        assertThat(booking.status()).isEqualTo(BookingStatus.CONFIRMED);
        // Its trip has begun with the ride's, so its ending is counted like the others'.
        assertThat(eventsOf(booking)).containsExactly("booking_requested", "booking_accepted", "trip_started");
        trips.complete(driverId, rideId);
        assertThat(eventsOf(booking)).containsExactly(
                "booking_requested", "booking_accepted", "trip_started", "trip_completed");
        assertThat(count("trip_started")).isEqualTo(count("trip_completed") + count("trip_failed"));
    }

    @Test
    void notFromAStopTheRideIsDueAtWithinTheMargin() {
        long rideId = startedRide(3, true);
        long passenger = user(UserRole.PASSENGER);

        assertThat(found(passenger, KOLHAPUR, rideId)).isEmpty();
        assertThatThrownBy(() -> bookings.request(passenger, rideId, 0, 2, 1, null))
                .isInstanceOfSatisfying(ResponseStatusException.class, e -> {
                    assertThat(e.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
                    assertThat(e.getReason()).isEqualTo(TOO_SOON);
                });
        assertThat(count("trip_started")).isZero();
    }

    // Found in a browser: a ride started early was still sold from the stop it had left,
    // because its timetable said that stop was more than the margin away.
    @Test
    void aRideStartedEarlyIsJudgedFromItsStartNotItsTimetable() {
        Point shiroli = new Point(16.7525, 74.2720);
        long vehicleId = vehicles.create(driverId, "Maruti", "Ertiga", 2022, "Silver", 7).id();
        // Due at Shiroli 20 minutes after leaving: 50 minutes away by the timetable, but 20
        // from its start half an hour early, which is inside the margin.
        long rideId = rides.publish(driverId, new PublishRide(vehicleId,
                Instant.now().plus(Duration.ofMinutes(30)), 3, true, List.of(
                        new StopInput("Kolhapur", KOLHAPUR.lat(), KOLHAPUR.lon(), 0),
                        new StopInput("Shiroli", shiroli.lat(), shiroli.lon(), 20),
                        new StopInput("Pune", PUNE.lat(), PUNE.lon(), 270)), PRICES)).id();
        trips.start(driverId, rideId);
        long passenger = user(UserRole.PASSENGER);

        assertThat(jdbc.queryForObject("SELECT started_at IS NOT NULL FROM rides WHERE id = ?",
                Boolean.class, rideId)).isTrue();
        assertThat(found(passenger, shiroli, rideId)).isEmpty();
        assertThatThrownBy(() -> bookings.request(passenger, rideId, 1, 2, 1, null))
                .isInstanceOfSatisfying(ResponseStatusException.class,
                        e -> assertThat(e.getReason()).isEqualTo(TOO_SOON));
    }

    @Test
    void aRideWhoseDriverApprovesEachRequestIsNotSoldOnTheRoad() {
        long rideId = startedRide(3, false);
        long passenger = user(UserRole.PASSENGER);

        assertThat(found(passenger, SATARA, rideId)).isEmpty();
        assertThatThrownBy(() -> bookings.request(passenger, rideId, 1, 2, 1, null))
                .isInstanceOfSatisfying(ResponseStatusException.class, e -> assertThat(e.getReason())
                        .isEqualTo("This ride is already on the road, and its driver approves each request"));
    }

    @Test
    void aSeatLeftByANoShowIsSoldAgainFromALaterStop() {
        long rideId = rideLeavingIn(Duration.ofMinutes(30), 2, true);
        Booking stays = bookings.request(user(UserRole.PASSENGER), rideId, 0, 2, 1, null);
        Booking absent = bookings.request(user(UserRole.PASSENGER), rideId, 0, 2, 1, null);
        trips.start(driverId, rideId);
        long late = user(UserRole.PASSENGER);
        assertThat(found(late, SATARA, rideId)).isEmpty(); // full

        trips.noShow(driverId, absent.id());

        assertThat(seatsAvailable(rideId)).containsExactly(1, 1);
        assertThat(found(late, SATARA, rideId)).hasValueSatisfying(c -> assertThat(c.seatsAvailable()).isEqualTo(1));
        Booking refill = bookings.request(late, rideId, 1, 2, 1, null);
        assertThat(refill.status()).isEqualTo(BookingStatus.CONFIRMED);
        assertThat(seatsAvailable(rideId)).containsExactly(1, 0);

        trips.complete(driverId, rideId);
        assertThat(statusOf(stays)).isEqualTo("COMPLETED");
        assertThat(statusOf(absent)).isEqualTo("NO_SHOW");
        assertThat(statusOf(refill)).isEqualTo("COMPLETED");
        assertThat(count("trip_started")).isEqualTo(3);
        assertThat(count("trip_completed")).isEqualTo(2);
        assertThat(count("trip_failed")).isEqualTo(1);
    }

    @Test
    void aSeatOnARideOnTheRoadCanBeHeldOnlyWhereItCouldBeBooked() throws Exception {
        long rideId = startedRide(3, true);
        String passenger = "Bearer " + tokens.issue(user(UserRole.PASSENGER), UserRole.PASSENGER);
        String body = "{\"rideId\": %d, \"fromSeq\": %d, \"toSeq\": 2, \"seats\": 1}";

        mvc.perform(post("/api/v1/holds").header("Authorization", passenger)
                        .contentType("application/json").content(String.format(body, rideId, 0)))
                .andExpect(status().isNotFound());
        mvc.perform(post("/api/v1/holds").header("Authorization", passenger)
                        .contentType("application/json").content(String.format(body, rideId, 1)))
                .andExpect(status().isCreated());
    }

    private long startedRide(int seats, boolean instantBooking) {
        long rideId = rideLeavingIn(Duration.ofMinutes(30), seats, instantBooking);
        trips.start(driverId, rideId);
        return rideId;
    }

    private long rideLeavingIn(Duration untilDeparture, int seats, boolean instantBooking) {
        long vehicleId = vehicles.create(driverId, "Maruti", "Ertiga", 2022, "Silver", 7).id();
        return rides.publish(driverId, new PublishRide(vehicleId, Instant.now().plus(untilDeparture),
                seats, instantBooking, STOPS, PRICES)).id();
    }

    /** This ride, if a search from {@code from} to Pune on the day it is due there offers it. */
    private Optional<Candidate> found(long passenger, Point from, long rideId) {
        LocalDate day = Instant.now().plus(Duration.ofMinutes(160)).atZone(ZoneId.of("Asia/Kolkata")).toLocalDate();
        return rides.search(passenger, from, PUNE, day, 1, Sort.TIME).stream()
                .filter(c -> c.rideId() == rideId).findFirst();
    }

    private List<String> eventsOf(Booking booking) {
        return jdbc.queryForList("""
                SELECT event_type FROM events WHERE (payload->>'booking_id')::bigint = ?
                ORDER BY id""", String.class, booking.id());
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

    private long user(UserRole role) {
        return identity.register(UUID.randomUUID() + "@example.test", "correct-horse-battery",
                "Test " + role, role).id();
    }
}
