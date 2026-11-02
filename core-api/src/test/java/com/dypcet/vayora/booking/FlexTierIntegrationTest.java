package com.dypcet.vayora.booking;

import static org.assertj.core.api.Assertions.assertThat;

import com.dypcet.vayora.PostgresIntegrationTest;
import com.dypcet.vayora.booking.BookingService.Booking;
import com.dypcet.vayora.identity.IdentityService;
import com.dypcet.vayora.identity.UserRole;
import com.dypcet.vayora.notification.NotificationService;
import com.dypcet.vayora.ride.RideService;
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
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;

class FlexTierIntegrationTest extends PostgresIntegrationTest {

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

    @Test
    void aFlexiblePassengerIsBookedOnTheClosestRideWithinTheWindowAndAnExactOneIsNot() {
        LocalDate day = LocalDate.now(ZONE).plusDays(14);
        long withdrawing = user(UserRole.DRIVER, "Ravi Jadhav");
        long withdrawn = ride(withdrawing, day, 9, 0);
        long closest = ride(user(UserRole.DRIVER, "Sunil Pawar"), day, 10, 30);
        ride(user(UserRole.DRIVER, "Later Driver"), day, 10, 45);
        long flexible = user(UserRole.PASSENGER, "Asha Patil");
        long exact = user(UserRole.PASSENGER, "Meera Kulkarni");
        bookings.request(flexible, withdrawn, 0, 1, 1, null, FlexTier.FLEXIBLE);
        bookings.request(exact, withdrawn, 0, 1, 1, null);

        trips.cancel(withdrawing, withdrawn);

        List<Booking> rebooked = live(flexible);
        assertThat(rebooked).singleElement().satisfies(b -> {
            assertThat(b.rideId()).isEqualTo(closest);
            assertThat(b.status()).isEqualTo(BookingStatus.CONFIRMED);
            assertThat(b.flexTier()).isEqualTo(FlexTier.FLEXIBLE);
        });
        assertThat(notifications.forUser(flexible)).anySatisfy(n -> assertThat(n.message())
                .isEqualTo("As you chose a flexible booking, you are booked on the 10:30 ride from Kolhapur with Sunil Pawar."));
        assertThat(live(exact)).isEmpty();
        assertThat(jdbc.queryForObject("""
                SELECT COUNT(*) FROM events WHERE run_id IS NULL AND event_type = 'tier_selected'
                  AND actor_id = ? AND payload->>'tier' = 'flexible'""", Integer.class, flexible)).isEqualTo(2);
    }

    @Test
    void outsideTheWindowAFlexiblePassengerIsToldAndAnAnyTimeOneIsBookedLaterThatDay() {
        LocalDate day = LocalDate.now(ZONE).plusDays(15);
        long withdrawing = user(UserRole.DRIVER, "Ravi Jadhav");
        long withdrawn = ride(withdrawing, day, 9, 0);
        long evening = ride(user(UserRole.DRIVER, "Sunil Pawar"), day, 18, 0);
        long flexible = user(UserRole.PASSENGER, "Asha Patil");
        long anyTime = user(UserRole.PASSENGER, "Neha Joshi");
        bookings.request(flexible, withdrawn, 0, 1, 1, null, FlexTier.FLEXIBLE);
        bookings.request(anyTime, withdrawn, 0, 1, 1, null, FlexTier.ANY_TIME);

        trips.cancel(withdrawing, withdrawn);

        assertThat(live(flexible)).isEmpty();
        assertThat(notifications.forUser(flexible)).anySatisfy(n -> assertThat(n.message())
                .startsWith("You chose a flexible booking, but no other ride with seats fits it."));
        assertThat(live(anyTime)).singleElement().satisfies(b -> assertThat(b.rideId()).isEqualTo(evening));
    }

    @Test
    void flexibleIsSuggestedOnTheRideOfADriverWhoHasWithdrawnRides() {
        long driver = user(UserRole.DRIVER, "Ravi Jadhav");
        long done = ride(driver, LocalDate.now(ZONE), 0, 0, Instant.now().plus(Duration.ofMinutes(30)));
        trips.start(driver, done);
        trips.complete(driver, done);
        trips.cancel(driver, ride(driver, LocalDate.now(ZONE).plusDays(1), 9, 0));
        LocalDate day = LocalDate.now(ZONE).plusDays(16);
        long offered = ride(driver, day, 9, 0);
        long steady = ride(user(UserRole.DRIVER, "New Driver"), day, 9, 30);

        var found = rides.search(user(UserRole.PASSENGER, "Asha"), new Point(16.7050, 74.2433),
                new Point(18.5204, 73.8567), day, 1, Sort.TIME);

        // One completed, one withdrawn: half, below the configured share.
        assertThat(found).filteredOn(c -> c.rideId() == offered).singleElement()
                .satisfies(c -> assertThat(c.suggestFlexible()).isTrue());
        // No record yet is not a weak record.
        assertThat(found).filteredOn(c -> c.rideId() == steady).singleElement()
                .satisfies(c -> assertThat(c.suggestFlexible()).isFalse());
    }

    private List<Booking> live(long passenger) {
        return bookings.forPassenger(passenger).stream()
                .filter(b -> b.status() == BookingStatus.CONFIRMED || b.status() == BookingStatus.PENDING).toList();
    }

    private long ride(long driver, LocalDate day, int hour, int minute) {
        return ride(driver, day, hour, minute, day.atTime(hour, minute).atZone(ZONE).toInstant());
    }

    private long ride(long driver, LocalDate day, int hour, int minute, Instant at) {
        long vehicleId = vehicles.create(driver, "Maruti", "Ertiga", 2022, "Silver", 7).id();
        return rides.publish(driver, new PublishRide(vehicleId, at, 3, true,
                List.of(new StopInput("Kolhapur", 16.7050, 74.2433, 0), new StopInput("Pune", 18.5204, 73.8567, 270)),
                List.of(new BigDecimal("450.00")))).id();
    }

    private long user(UserRole role, String name) {
        return identity.register(UUID.randomUUID() + "@example.test", "correct-horse-battery", name, role).id();
    }
}
