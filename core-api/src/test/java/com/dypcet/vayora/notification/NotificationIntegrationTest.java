package com.dypcet.vayora.notification;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
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
import com.dypcet.vayora.notification.NotificationService.Notification;
import com.dypcet.vayora.notification.NotificationService.Type;
import com.dypcet.vayora.ride.RideService;
import com.dypcet.vayora.ride.RideService.PublishRide;
import com.dypcet.vayora.ride.RideService.StopInput;
import com.dypcet.vayora.vehicle.VehicleService;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.bson.Document;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.dao.DataAccessResourceFailureException;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.server.ResponseStatusException;

@AutoConfigureMockMvc
class NotificationIntegrationTest extends PostgresIntegrationTest {

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
    private NotificationService notifications;

    @Autowired
    private TokenService tokens;

    @Autowired
    private PlatformTransactionManager transactionManager;

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
    void eachStepOfABookingTellsTheOtherParty() {
        long rideId = ride(Duration.ofMinutes(30), false);
        Booking booking = bookings.request(passengerId, rideId, 0, 1, 2, null);

        assertThat(messages(driverId)).containsExactly(
                "BOOKING_REQUESTED: Asha Patil asked for 2 seats, Kolhapur to Pune.");
        assertThat(messages(passengerId)).isEmpty();

        bookings.accept(driverId, booking.id());
        trips.start(driverId, rideId);
        trips.complete(driverId, rideId);

        assertThat(messages(passengerId)).containsExactly(
                "TRIP_COMPLETED: Your trip from Kolhapur to Pune is complete. "
                        + "Pay your driver Rs 1040.00, in cash or by UPI: see My bookings.",
                "BOOKING_CONFIRMED: The driver accepted your booking for 2 seats, Kolhapur to Pune.");
        assertThat(notifications.forUser(passengerId)).extracting(Notification::bookingId)
                .containsOnly(booking.id());
    }

    @Test
    void decliningCancellingAndWithdrawingEachSayWhatHappenedToTheMoney() {
        long declinedRide = ride(Duration.ofDays(2), false);
        Booking declined = bookings.request(passengerId, declinedRide, 0, 1, 1, null);
        bookings.reject(driverId, declined.id());

        long withdrawnRide = ride(Duration.ofDays(2), true);
        bookings.request(passengerId, withdrawnRide, 0, 1, 1, null);
        trips.cancel(driverId, withdrawnRide);

        long cancelledRide = ride(Duration.ofDays(3), true);
        Booking cancelled = bookings.request(passengerId, cancelledRide, 0, 1, 1, null);
        bookings.cancel(passengerId, cancelled.id());

        assertThat(messages(passengerId)).hasSize(2);
        // The withdrawal also names other rides that could take the passenger, which here
        // includes the first ride, still scheduled with a seat free.
        assertThat(messages(passengerId).get(0)).startsWith(
                "RIDE_CANCELLED: The driver cancelled the ride you booked for 1 seat, Kolhapur to Pune. "
                        + "You owe nothing. Other rides that could take you: ")
                .endsWith(" from Kolhapur with Ravi Jadhav. Search again to book one.");
        assertThat(messages(passengerId).get(1)).isEqualTo(
                "BOOKING_DECLINED: The driver did not accept your request for 1 seat, Kolhapur to Pune. "
                        + "You owe nothing.");
        assertThat(messages(driverId)).first().isEqualTo(
                "BOOKING_CANCELLED: Asha Patil cancelled 1 seat, Kolhapur to Pune.");
    }

    @Test
    void aDriverIsToldWhatALateCancellationOwesThem() {
        Booking late = bookings.request(passengerId, ride(Duration.ofHours(3), true), 0, 1, 1, null);

        bookings.cancel(passengerId, late.id());

        assertThat(messages(driverId)).first().isEqualTo(
                "BOOKING_CANCELLED: Asha Patil cancelled 1 seat, Kolhapur to Pune, late enough to owe you Rs 520.00.");
    }

    @Test
    void aNoShowAndAnUnansweredRequestAreToldToThePassenger() {
        long rideId = ride(Duration.ofMinutes(30), false);
        Booking accepted = bookings.request(passengerId, rideId, 0, 1, 1, null);
        long ignored = identity.register(email(), "correct-horse-battery", "Ignored Rider", UserRole.PASSENGER).id();
        bookings.request(ignored, rideId, 0, 1, 1, null);
        bookings.accept(driverId, accepted.id());

        trips.start(driverId, rideId);
        trips.noShow(driverId, accepted.id());

        assertThat(messages(ignored)).containsExactly(
                "BOOKING_DECLINED: The driver did not accept your request for 1 seat, Kolhapur to Pune. "
                        + "You owe nothing.");
        assertThat(messages(passengerId)).first().asString().startsWith(
                "MARKED_NO_SHOW: The driver reported that you did not board");
    }

    @Test
    void nothingIsSentForABookingThatWasRolledBack() {
        new TransactionTemplate(transactionManager).executeWithoutResult(status -> {
            notifications.send(driverId, Type.BOOKING_REQUESTED, Text.of("never happened"), null);
            status.setRollbackOnly();
        });

        assertThat(notifications.forUser(driverId)).isEmpty();
    }

    @Test
    void readingIsPerMemberAndNobodyCanTouchAnotherMembersNotifications() throws Exception {
        long rideId = ride(Duration.ofDays(2), true);
        bookings.request(passengerId, rideId, 0, 1, 1, null);
        bookings.request(passengerId, rideId, 0, 1, 1, null);
        String driver = "Bearer " + tokens.issue(driverId, UserRole.DRIVER);
        String passenger = "Bearer " + tokens.issue(passengerId, UserRole.PASSENGER);
        String id = notifications.forUser(driverId).get(0).id();

        mvc.perform(get("/api/v1/notifications/unread-count").header("Authorization", driver))
                .andExpect(jsonPath("$.unread").value(2));
        mvc.perform(get("/api/v1/notifications").header("Authorization", passenger))
                .andExpect(jsonPath("$.length()").value(0));

        mvc.perform(post("/api/v1/notifications/" + id + "/read").header("Authorization", passenger))
                .andExpect(status().isNotFound());
        mvc.perform(post("/api/v1/notifications/not-an-id/read").header("Authorization", driver))
                .andExpect(status().isNotFound());
        assertThat(notifications.unreadCount(driverId)).isEqualTo(2);

        mvc.perform(post("/api/v1/notifications/" + id + "/read").header("Authorization", driver))
                .andExpect(status().isNoContent());
        mvc.perform(get("/api/v1/notifications").header("Authorization", driver))
                .andExpect(jsonPath("$[0].read").value(true))
                .andExpect(jsonPath("$[1].read").value(false))
                .andExpect(jsonPath("$[0].message").value("Asha Patil booked 1 seat, Kolhapur to Pune."));
        mvc.perform(post("/api/v1/notifications/read-all").header("Authorization", driver))
                .andExpect(status().isNoContent());
        assertThat(notifications.unreadCount(driverId)).isZero();
        mvc.perform(get("/api/v1/notifications")).andExpect(status().isUnauthorized());
    }

    @Test
    void aMongoOutageDoesNotFailTheCaller() {
        MongoTemplate broken = mock(MongoTemplate.class);
        when(broken.insert(any(Document.class), anyString()))
                .thenThrow(new DataAccessResourceFailureException("mongo is down"));
        NotificationService withBrokenStore = new NotificationService(broken, Clock.systemUTC(),
                mock(org.springframework.jdbc.core.JdbcTemplate.class),
                mock(com.dypcet.vayora.account.MessageSender.class), mock(com.dypcet.vayora.push.PushService.class));

        assertThatCode(() -> withBrokenStore.send(1L, Type.BOOKING_REQUESTED, Text.of("hello"), 7L))
                .doesNotThrowAnyException();
    }

    private List<String> messages(long userId) {
        return notifications.forUser(userId).stream()
                .map(n -> n.type() + ": " + n.message()).toList();
    }

    private long ride(Duration untilDeparture, boolean instantBooking) {
        long vehicleId = vehicles.create(driverId, "Maruti", "Ertiga", 2022, "Silver", 7).id();
        return rides.publish(driverId, new PublishRide(vehicleId, Instant.now().plus(untilDeparture),
                3, instantBooking, STOPS, List.of(new BigDecimal("520.00")))).id();
    }

    private static String email() {
        return UUID.randomUUID() + "@example.test";
    }
}
