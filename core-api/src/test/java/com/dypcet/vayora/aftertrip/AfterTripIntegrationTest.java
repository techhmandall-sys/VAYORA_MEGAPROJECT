package com.dypcet.vayora.aftertrip;

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
import com.dypcet.vayora.notification.NotificationService;
import com.dypcet.vayora.notification.NotificationService.Type;
import com.dypcet.vayora.payment.PaymentService.Method;
import com.dypcet.vayora.rating.RatingService;
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
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.web.server.ResponseStatusException;

@AutoConfigureMockMvc
class AfterTripIntegrationTest extends PostgresIntegrationTest {

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
    private AfterTripService afterTrip;

    @Autowired
    private NotificationService notifications;

    @Autowired
    private TokenService tokens;

    @Autowired
    private JdbcTemplate jdbc;

    @Autowired
    private MockMvc mvc;

    private long adminId;
    private long driver;
    private long passenger;

    @BeforeEach
    void setUp() {
        adminId = identity.authenticate("admin@example.test", "admin-test-password").id();
        driver = user(UserRole.DRIVER, "Ravi Jadhav");
        passenger = user(UserRole.PASSENGER, "Asha Patil");
    }

    @Test
    void aPassengerConfirmsATripOnceAndADenialReachesTheAdministrators() throws Exception {
        long travelled = completedTrip();
        long denied = completedTrip();

        afterTrip.confirm(passenger, travelled, true);
        assertStatus(HttpStatus.CONFLICT, () -> afterTrip.confirm(passenger, travelled, false));

        afterTrip.confirm(passenger, denied, false);
        assertThat(afterTrip.disputes()).filteredOn(d -> d.bookingId() == denied).singleElement()
                .satisfies(d -> {
                    assertThat(d.passengerName()).isEqualTo("Asha Patil");
                    assertThat(d.driverName()).isEqualTo("Ravi Jadhav");
                });
        assertThat(afterTrip.disputes()).noneMatch(d -> d.bookingId() == travelled);
        assertThat(notifications.forUser(adminId)).first()
                .satisfies(n -> assertThat(n.type()).isEqualTo(Type.TRIP_DISPUTED));

        String admin = "Bearer " + tokens.issue(adminId, UserRole.ADMIN);
        mvc.perform(get("/api/v1/admin/disputed-trips").header("Authorization", admin))
                .andExpect(status().isOk());
        mvc.perform(get("/api/v1/admin/overview").header("Authorization", admin))
                .andExpect(jsonPath("$.disputedTrips").isNumber());
    }

    @Test
    void onlyTheTripsOwnPassengerCanAnswerAndOnlyOnceItIsCompleted() throws Exception {
        long completed = completedTrip();
        long stranger = user(UserRole.PASSENGER, "Stranger");
        long upcoming = bookings.request(passenger, ride(Duration.ofDays(2)), 0, 1, 1, null).id();

        assertStatus(HttpStatus.NOT_FOUND, () -> afterTrip.confirm(stranger, completed, false));
        assertStatus(HttpStatus.CONFLICT, () -> afterTrip.confirm(passenger, upcoming, true));

        String own = "Bearer " + tokens.issue(passenger, UserRole.PASSENGER);
        mvc.perform(post("/api/v1/bookings/" + completed + "/trip-confirmation").header("Authorization", own)
                        .contentType("application/json").content("{}"))
                .andExpect(status().isBadRequest());
        mvc.perform(post("/api/v1/bookings/" + completed + "/trip-confirmation").header("Authorization", own)
                        .contentType("application/json").content("{\"travelled\": true}"))
                .andExpect(status().isNoContent());
        mvc.perform(get("/api/v1/admin/disputed-trips").header("Authorization", own))
                .andExpect(status().isForbidden());
    }

    @Test
    void eachSideThatHasNotRatedGetsOneReminderADayLater() {
        long booking = completedTrip();
        ratings.rate(passenger, booking, 5, null);

        // Not yet a day old.
        afterTrip.remindToRate();
        assertThat(reminders(driver)).isZero();

        jdbc.update("UPDATE bookings SET updated_at = now() - interval '25 hours' WHERE id = ?", booking);
        afterTrip.remindToRate();
        afterTrip.remindToRate();

        assertThat(reminders(driver)).isEqualTo(1); // once, however often the job runs
        assertThat(reminders(passenger)).isZero();   // she had rated already
    }

    private long reminders(long userId) {
        return notifications.forUser(userId).stream().filter(n -> n.type() == Type.RATING_REMINDER).count();
    }

    private long completedTrip() {
        long rideId = ride(Duration.ofMinutes(30));
        long bookingId = bookings.request(passenger, rideId, 0, 1, 1, null).id();
        trips.start(driver, rideId);
        trips.complete(driver, rideId);
        // Or the passenger could not book the next one.
        bookings.paymentReceived(driver, bookingId, Method.CASH);
        return bookingId;
    }

    private long ride(Duration untilDeparture) {
        long vehicleId = vehicles.create(driver, "Maruti", "Ertiga", 2022, "Silver", 7).id();
        return rides.publish(driver, new PublishRide(vehicleId, Instant.now().plus(untilDeparture), 3, true,
                List.of(new StopInput("Kolhapur", 16.7050, 74.2433, 0),
                        new StopInput("Pune", 18.5204, 73.8567, 270)),
                List.of(new BigDecimal("450.00")))).id();
    }

    private long user(UserRole role, String name) {
        return identity.register(UUID.randomUUID() + "@example.test", "correct-horse-battery", name, role).id();
    }

    private static void assertStatus(HttpStatus expected, Runnable action) {
        assertThatThrownBy(action::run).isInstanceOfSatisfying(ResponseStatusException.class,
                e -> assertThat(e.getStatusCode()).isEqualTo(expected));
    }
}
