package com.dypcet.vayora.booking;

import static org.assertj.core.api.Assertions.assertThat;

import com.dypcet.vayora.PostgresIntegrationTest;
import com.dypcet.vayora.identity.IdentityService;
import com.dypcet.vayora.identity.UserRole;
import com.dypcet.vayora.notification.NotificationService;
import com.dypcet.vayora.notification.NotificationService.Type;
import com.dypcet.vayora.ride.RideService;
import com.dypcet.vayora.ride.RideService.PublishRide;
import com.dypcet.vayora.ride.RideService.StopInput;
import com.dypcet.vayora.vehicle.VehicleService;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;

class CascadeRecoveryIntegrationTest extends PostgresIntegrationTest {

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
    private NotificationService notifications;

    @Autowired
    private JdbcTemplate jdbc;

    private LocalDate day;
    private long passenger;

    @BeforeEach
    void setUp() {
        // A day of its own, so other tests' rides are not offered as alternatives.
        day = LocalDate.now(ZONE).plusDays(8);
        passenger = user(UserRole.PASSENGER, "Asha Patil");
    }

    @Test
    void aWithdrawnRideNamesOtherRidesNearTheSameTimeWithSeatsForTheParty() {
        long withdrawing = user(UserRole.DRIVER, "Ravi Jadhav");
        long withdrawn = ride(withdrawing, 9, 0, 3);
        bookings.request(passenger, withdrawn, 0, 1, 2, null);
        ride(user(UserRole.DRIVER, "Sunil Pawar"), 10, 30, 3);    // fits
        ride(user(UserRole.DRIVER, "Meera Kulkarni"), 7, 15, 3);  // fits
        ride(user(UserRole.DRIVER, "Too Late"), 13, 0, 3);        // more than 3 hours after
        ride(user(UserRole.DRIVER, "Too Small"), 9, 30, 1);       // one seat; the party is two

        trips.cancel(withdrawing, withdrawn);

        String notice = notifications.forUser(passenger).stream()
                .filter(n -> n.type() == Type.RIDE_CANCELLED).findFirst().orElseThrow().message();
        assertThat(notice).contains("You owe nothing.")
                .contains("Other rides that could take you: 07:15 from Kolhapur with Meera Kulkarni; "
                        + "10:30 from Kolhapur with Sunil Pawar.")
                .doesNotContain("Too Late").doesNotContain("Too Small").doesNotContain("Ravi Jadhav");
        // A suggestion is not a search the passenger made.
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM events WHERE run_id IS NULL AND event_type = 'search_issued'"
                + " AND actor_id = ?", Integer.class, passenger)).isZero();
    }

    @Test
    void withNothingElseThePassengerIsToldSo() {
        long driver = user(UserRole.DRIVER, "Ravi Jadhav");
        long withdrawn = ride(driver, 18, 0, 3);
        bookings.request(passenger, withdrawn, 0, 1, 1, null);

        trips.cancel(driver, withdrawn);

        assertThat(notifications.forUser(passenger)).first()
                .satisfies(n -> assertThat(n.message()).endsWith("No other ride with seats leaves near that time."));
    }

    private long ride(long driver, int hour, int minute, int seats) {
        long vehicleId = vehicles.create(driver, "Maruti", "Ertiga", 2022, "Silver", 7).id();
        return rides.publish(driver, new PublishRide(vehicleId, day.atTime(hour, minute).atZone(ZONE).toInstant(),
                seats, true, List.of(new StopInput("Kolhapur", 16.7050, 74.2433, 0),
                        new StopInput("Pune", 18.5204, 73.8567, 270)),
                List.of(new BigDecimal("450.00")))).id();
    }

    private long user(UserRole role, String name) {
        return identity.register(UUID.randomUUID() + "@example.test", "correct-horse-battery", name, role).id();
    }
}
