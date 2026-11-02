package com.dypcet.vayora.ride;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.dypcet.vayora.PostgresIntegrationTest;
import com.dypcet.vayora.account.AccountService;
import com.dypcet.vayora.account.AccountService.Gender;
import com.dypcet.vayora.account.AccountService.ProfileUpdate;
import com.dypcet.vayora.booking.BookingService;
import com.dypcet.vayora.booking.BookingStatus;
import com.dypcet.vayora.identity.IdentityService;
import com.dypcet.vayora.identity.TokenService;
import com.dypcet.vayora.identity.UserRole;
import com.dypcet.vayora.ride.RideService.Candidate;
import com.dypcet.vayora.ride.RideService.Filters;
import com.dypcet.vayora.ride.RideService.PublishRide;
import com.dypcet.vayora.ride.RideService.Sort;
import com.dypcet.vayora.ride.RideService.StopInput;
import com.dypcet.vayora.routing.RouteService.Point;
import com.dypcet.vayora.vehicle.VehicleService;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.ZoneId;
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
class WomenOnlyRideIntegrationTest extends PostgresIntegrationTest {

    private static final ZoneId ZONE = ZoneId.of("Asia/Kolkata");
    private static final Point KOLHAPUR = new Point(16.7050, 74.2433);
    private static final Point PUNE = new Point(18.5204, 73.8567);
    private static final List<StopInput> STOPS = List.of(
            new StopInput("Kolhapur", KOLHAPUR.lat(), KOLHAPUR.lon(), 0),
            new StopInput("Pune", PUNE.lat(), PUNE.lon(), 270));

    @Autowired
    private IdentityService identity;

    @Autowired
    private AccountService accounts;

    @Autowired
    private VehicleService vehicles;

    @Autowired
    private RideService rides;

    @Autowired
    private BookingService bookings;

    @Autowired
    private TokenService tokens;

    @Autowired
    private JdbcTemplate jdbc;

    @Autowired
    private MockMvc mvc;

    // A day of its own, so other tests' rides cannot appear in these searches.
    private LocalDate day;
    private long woman;
    private long man;
    private long unsaid;

    @BeforeEach
    void setUp() {
        day = LocalDate.now(ZONE).plusDays(5);
        jdbc.update("UPDATE rides SET status = 'CANCELLED' WHERE status = 'SCHEDULED'");
        woman = user(UserRole.PASSENGER, Gender.FEMALE);
        man = user(UserRole.PASSENGER, Gender.MALE);
        unsaid = user(UserRole.PASSENGER, null);
    }

    @Test
    void onlyADriverWhoSaysSheIsAWomanCanOfferOne() {
        long driver = user(UserRole.DRIVER, null);

        assertThatThrownBy(() -> rides.publish(driver, ride(driver, 9, true)))
                .isInstanceOfSatisfying(ResponseStatusException.class, e -> {
                    assertThat(e.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
                    assertThat(e.getReason()).contains("profile says she is a woman");
                });

        accounts.update(driver, new ProfileUpdate(null, null, null, Gender.FEMALE, null, null, null, null));
        assertThat(rides.publish(driver, ride(driver, 9, true)).womenOnly()).isTrue();
        // Any driver can offer a ride open to everyone.
        long other = user(UserRole.DRIVER, Gender.MALE);
        assertThat(rides.publish(other, ride(other, 10, false)).womenOnly()).isFalse();
    }

    @Test
    void aWomenOnlyRideIsShownOnlyToWomenAndCanBeAskedForAlone() {
        long driver = user(UserRole.DRIVER, Gender.FEMALE);
        long womenOnly = rides.publish(driver, ride(driver, 9, true)).id();
        long open = rides.publish(driver, ride(driver, 10, false)).id();

        assertThat(found(woman, Filters.NONE)).containsExactly(womenOnly, open);
        assertThat(found(man, Filters.NONE)).containsExactly(open);
        assertThat(found(unsaid, Filters.NONE)).containsExactly(open);
        assertThat(found(woman, new Filters(null, null, null, false, false, false, false, false, true)))
                .containsExactly(womenOnly);
        // Asking for women-only rides does not get round the rule.
        assertThat(found(man, new Filters(null, null, null, false, false, false, false, false, true)))
                .isEmpty();
        assertThat(rides.search(woman, KOLHAPUR, PUNE, day, 1, Sort.TIME))
                .extracting(Candidate::womenOnly).containsExactly(true, false);
    }

    @Test
    void onlyAWomanCanBookOrHoldSeatsOnOne() throws Exception {
        long driver = user(UserRole.DRIVER, Gender.FEMALE);
        long womenOnly = rides.publish(driver, ride(driver, 9, true)).id();

        for (long passenger : List.of(man, unsaid)) {
            assertThatThrownBy(() -> bookings.request(passenger, womenOnly, 0, 1, 1, null))
                    .isInstanceOfSatisfying(ResponseStatusException.class, e -> {
                        assertThat(e.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
                        assertThat(e.getReason()).isEqualTo("This ride is for women only");
                    });
        }
        assertThat(jdbc.queryForObject("SELECT seats_available FROM ride_segments WHERE ride_id = ?",
                Integer.class, womenOnly)).isEqualTo(3);
        assertThat(bookings.request(woman, womenOnly, 0, 1, 1, null).status())
                .isEqualTo(BookingStatus.CONFIRMED);

        String hold = "{\"rideId\": " + womenOnly + ", \"fromSeq\": 0, \"toSeq\": 1, \"seats\": 1}";
        mvc.perform(post("/api/v1/holds").header("Authorization", bearer(man, UserRole.PASSENGER))
                        .contentType("application/json").content(hold))
                .andExpect(status().isNotFound());
        mvc.perform(post("/api/v1/holds").header("Authorization", bearer(woman, UserRole.PASSENGER))
                        .contentType("application/json").content(hold))
                .andExpect(status().isCreated());
    }

    @Test
    void theRuleFollowsWhatTheProfileSaysNow() {
        long driver = user(UserRole.DRIVER, Gender.FEMALE);
        long womenOnly = rides.publish(driver, ride(driver, 9, true)).id();

        accounts.update(unsaid, new ProfileUpdate(null, null, null, Gender.FEMALE, null, null, null, null));

        assertThat(found(unsaid, Filters.NONE)).containsExactly(womenOnly);
    }

    @Test
    void theEndpointTakesTheChoice() throws Exception {
        long driver = user(UserRole.DRIVER, Gender.FEMALE);
        long vehicleId = vehicles.create(driver, "Maruti", "Ertiga", 2022, "Silver", 7).id();
        String body = "{\"vehicleId\": " + vehicleId + ", \"departureTime\": \""
                + day.atTime(9, 0).atZone(ZONE).toInstant() + "\", \"seatsOffered\": 3, \"instantBooking\": true,"
                + " \"segmentPrices\": [400], \"womenOnly\": true, \"stops\": ["
                + "{\"name\": \"Kolhapur\", \"lat\": 16.705, \"lon\": 74.2433, \"offsetMinutes\": 0},"
                + " {\"name\": \"Pune\", \"lat\": 18.5204, \"lon\": 73.8567, \"offsetMinutes\": 270}]}";

        mvc.perform(post("/api/v1/rides").header("Authorization", bearer(driver, UserRole.DRIVER))
                        .contentType("application/json").content(body))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.womenOnly").value(true));
    }

    private List<Long> found(long passenger, Filters filters) {
        return rides.search(passenger, KOLHAPUR, PUNE, day, 1, Sort.TIME, filters).stream()
                .map(Candidate::rideId).toList();
    }

    private PublishRide ride(long driver, int hour, boolean womenOnly) {
        long vehicleId = vehicles.create(driver, "Maruti", "Ertiga", 2022, "Silver", 7).id();
        return new PublishRide(vehicleId, day.atTime(hour, 0).atZone(ZONE).toInstant(), 3, true, STOPS,
                List.of(new BigDecimal("400.00")), null, false, null, 0, womenOnly);
    }

    private String bearer(long userId, UserRole role) {
        return "Bearer " + tokens.issue(userId, role);
    }

    private long user(UserRole role, Gender gender) {
        long id = identity.register(UUID.randomUUID() + "@example.test", "correct-horse-battery",
                "Test " + role, role).id();
        if (gender != null) {
            accounts.update(id, new ProfileUpdate(null, null, null, gender, null, null, null, null));
        }
        return id;
    }
}
