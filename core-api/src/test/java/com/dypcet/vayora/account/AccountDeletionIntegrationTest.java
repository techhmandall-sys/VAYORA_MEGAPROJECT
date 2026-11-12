package com.dypcet.vayora.account;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.not;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.dypcet.vayora.PostgresIntegrationTest;
import com.dypcet.vayora.account.AccountService.Chattiness;
import com.dypcet.vayora.account.AccountService.Gender;
import com.dypcet.vayora.account.AccountService.IdDocument;
import com.dypcet.vayora.account.AccountService.ProfileUpdate;
import com.dypcet.vayora.account.MessageSender.Channel;
import com.dypcet.vayora.booking.BookingService;
import com.dypcet.vayora.check.DocumentCheckService;
import com.dypcet.vayora.check.DocumentCheckService.Kind;
import com.dypcet.vayora.check.DocumentCheckService.Outcome;
import com.dypcet.vayora.identity.IdentityService;
import com.dypcet.vayora.identity.TokenService;
import com.dypcet.vayora.identity.UserRole;
import com.dypcet.vayora.moderation.ModerationService;
import com.dypcet.vayora.notification.NotificationService;
import com.dypcet.vayora.notification.NotificationService.Type;
import com.dypcet.vayora.notification.Text;
import com.dypcet.vayora.ride.RideService;
import com.dypcet.vayora.ride.RideService.PublishRide;
import com.dypcet.vayora.ride.RideService.StopInput;
import com.dypcet.vayora.vehicle.VehicleService;
import java.math.BigDecimal;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Map;
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
 * A member's copy of what is kept about them, and deleting their account: what goes, what stays,
 * that every session ends, and when it is refused.
 */
@AutoConfigureMockMvc
class AccountDeletionIntegrationTest extends PostgresIntegrationTest {

    private static final String PASSWORD = "correct-horse-battery";
    private static final String STILL_TO_COME =
            "Cancel your rides and bookings still to come, or let them finish, before deleting your account";
    private static final String SESSION_ENDED = "Your session has ended. Sign in again.";
    private static final List<StopInput> STOPS = List.of(
            new StopInput("Kolhapur", 16.7050, 74.2433, 0),
            new StopInput("Pune", 18.5204, 73.8567, 270));

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
    private DocumentCheckService checks;

    @Autowired
    private ModerationService moderation;

    @Autowired
    private NotificationService notifications;

    @Autowired
    private TokenService tokens;

    @Autowired
    private JdbcTemplate jdbc;

    @Autowired
    private MockMvc mvc;

    private long adminId;
    private String email;
    private long passengerId;

    @BeforeEach
    void setUp() {
        adminId = identity.authenticate("admin@example.test", "admin-test-password").id();
        email = UUID.randomUUID() + "@example.test";
        passengerId = identity.register(email, PASSWORD, "Asha Patil", UserRole.PASSENGER).id();
    }

    @Test
    void aMemberDownloadsWhatIsKeptAboutThemWithoutTheirPassword() throws Exception {
        long driverId = driver();
        long vehicleId = vehicles.create(driverId, "Maruti", "Ertiga", 2022, "Silver", 7).id();
        long rideId = publish(driverId, vehicleId);
        bookings.request(passengerId, rideId, 0, 1, 1, null);
        accounts.addContact(passengerId, "Meera Patil", phone(), "Mother");
        notifications.send(passengerId, Type.ACCOUNT_NOTICE, Text.of("Welcome to VAYORA."), null);

        mvc.perform(get("/api/v1/me/export").header("Authorization", bearer(passengerId, UserRole.PASSENGER)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.account.email").value(email))
                .andExpect(jsonPath("$.account.full_name").value("Asha Patil"))
                .andExpect(jsonPath("$.account.password_hash").doesNotExist())
                .andExpect(jsonPath("$.profile.email").value(email))
                .andExpect(jsonPath("$.emergencyContacts[0].name").value("Meera Patil"))
                .andExpect(jsonPath("$.bookings[0].ride_id").value(rideId))
                .andExpect(jsonPath("$.bookings[0].from_stop").value("Kolhapur"))
                .andExpect(jsonPath("$.bookings[0].to_stop").value("Pune"))
                .andExpect(jsonPath("$.bookings[0].seats").value(1))
                .andExpect(jsonPath("$.ridesOffered").isEmpty())
                .andExpect(jsonPath("$.notifications[*].message", hasItem("Welcome to VAYORA.")));

        mvc.perform(get("/api/v1/me/export").header("Authorization", bearer(driverId, UserRole.DRIVER)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.vehicles[0].make").value("Maruti"))
                .andExpect(jsonPath("$.vehicles[0].colour").value("Silver"))
                .andExpect(jsonPath("$.vehicles[0].seats").value(7))
                .andExpect(jsonPath("$.ridesOffered[0].id").value(rideId))
                .andExpect(jsonPath("$.ridesOffered[0].from_stop").value("Kolhapur"))
                .andExpect(jsonPath("$.ridesOffered[0].to_stop").value("Pune"))
                .andExpect(jsonPath("$.bookings").isEmpty());
    }

    @Test
    void deletingRemovesWhatIdentifiesTheMemberAndFreesTheirAddress() {
        String phone = phone();
        accounts.update(passengerId, new ProfileUpdate(phone, "Teacher from Kolhapur.", 1998, Gender.FEMALE,
                false, true, null, Chattiness.QUIET));
        accounts.addContact(passengerId, "Meera Patil", phone(), "Mother");
        accounts.requestCode(passengerId, Channel.EMAIL);
        jdbc.update("UPDATE users SET google_sub = ?, referral_code = ? WHERE id = ?",
                "google-" + passengerId, "R" + passengerId, passengerId);
        jdbc.update("INSERT INTO user_photos (user_id, jpeg) VALUES (?, ?)", passengerId, new byte[] {1, 2, 3});
        jdbc.update("INSERT INTO notification_preferences (user_id, email, sms) VALUES (?, true, false)", passengerId);
        notifications.send(passengerId, Type.ACCOUNT_NOTICE, Text.of("Welcome to VAYORA."), null);

        accounts.delete(passengerId);

        Map<String, Object> row = jdbc.queryForMap("""
                SELECT full_name, email, email_verified_at, phone, phone_verified_at, password_hash, google_sub,
                       referral_code, id_document, status, deleted_at
                FROM users WHERE id = ?""", passengerId);
        assertThat(row).containsEntry("full_name", "Deleted member").containsEntry("status", "DELETED")
                .containsEntry("email", null).containsEntry("phone", null).containsEntry("google_sub", null)
                .containsEntry("referral_code", null).containsEntry("password_hash", "!");
        assertThat(row.get("deleted_at")).isNotNull();
        for (String table : List.of("profiles", "emergency_contacts", "verification_codes", "user_photos",
                "notification_preferences")) {
            assertThat(jdbc.queryForObject("SELECT count(*) FROM " + table + " WHERE user_id = ?", Integer.class,
                    passengerId)).as(table).isZero();
        }
        assertThat(notifications.forUser(passengerId)).isEmpty();

        // Nobody can sign in as the deleted member, and the address and number are free for a new account.
        assertStatus(HttpStatus.UNAUTHORIZED, () -> identity.authenticate(email, PASSWORD));
        long again = identity.register(email, PASSWORD, "Asha Patil", UserRole.PASSENGER).id();
        assertThat(again).isNotEqualTo(passengerId);
        assertThat(accounts.update(again, new ProfileUpdate(phone, null, null, null, null, null, null, null)).phone())
                .isEqualTo(phone);
    }

    @Test
    void everySessionOfADeletedAccountEndsAndTheAccountCannotBeReinstated() throws Exception {
        String asking = bearer(passengerId, UserRole.PASSENGER);
        mvc.perform(delete("/api/v1/me").header("Authorization", asking))
                .andExpect(status().isNoContent());
        mvc.perform(get("/api/v1/me/profile").header("Authorization", asking))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.detail").value(SESSION_ENDED));

        // A session on another device was never revoked; the account's standing alone ends it.
        long other = identity.register(UUID.randomUUID() + "@example.test", PASSWORD, "Sneha More",
                UserRole.PASSENGER).id();
        String elsewhere = bearer(other, UserRole.PASSENGER);
        accounts.delete(other);
        mvc.perform(get("/api/v1/me/profile").header("Authorization", elsewhere))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.detail").value(SESSION_ENDED));

        // Not a member any more: not reinstated, not listed, not counted.
        assertStatus(HttpStatus.NOT_FOUND, () -> moderation.reinstate(adminId, passengerId));
        mvc.perform(get("/api/v1/admin/users").param("q", "Deleted member")
                        .header("Authorization", bearer(adminId, UserRole.ADMIN)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[*].id", not(hasItem((int) passengerId))));
        assertThat(jdbc.queryForObject("SELECT status FROM users WHERE id = ?", String.class, passengerId))
                .isEqualTo("DELETED");
    }

    @Test
    void anAccountWithARideOrBookingStillToComeIsNotDeleted() {
        long driverId = driver();
        long vehicleId = vehicles.create(driverId, "Maruti", "Ertiga", 2022, "Silver", 7).id();
        long rideId = publish(driverId, vehicleId);
        long bookingId = bookings.request(passengerId, rideId, 0, 1, 1, null).id();

        for (long member : List.of(passengerId, driverId)) {
            assertThatThrownBy(() -> accounts.delete(member))
                    .isInstanceOfSatisfying(ResponseStatusException.class, e -> {
                        assertThat(e.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
                        assertThat(e.getReason()).isEqualTo(STILL_TO_COME);
                    });
        }
        assertThat(jdbc.queryForObject("SELECT email FROM users WHERE id = ?", String.class, passengerId))
                .isEqualTo(email);

        // With the booking cancelled the passenger may go; the driver still has the ride.
        bookings.cancel(passengerId, bookingId);
        accounts.delete(passengerId);
        assertStatus(HttpStatus.CONFLICT, () -> accounts.delete(driverId));
    }

    @Test
    void aDriversDeletionWithdrawsTheirChecksAndTakesTheirPhotosAndPaymentDetails() {
        long driverId = driver();
        long vehicleId = vehicles.create(driverId, "Maruti", "Ertiga", 2022, "Silver", 7).id();
        accounts.declareId(driverId, IdDocument.DRIVING_LICENCE);
        long checkId = checks.request(driverId, Kind.IDENTITY, null).id();
        checks.decide(adminId, checkId, Outcome.CHECKED, null);
        jdbc.update("INSERT INTO vehicle_photos (vehicle_id, jpeg) VALUES (?, ?)", vehicleId, new byte[] {1, 2, 3});
        jdbc.update("INSERT INTO driver_payment_details (user_id, upi_id) VALUES (?, ?)", driverId, "ravi@upi");

        accounts.delete(driverId);

        assertThat(jdbc.queryForMap("SELECT status, decided_at FROM document_checks WHERE id = ?", checkId))
                .containsEntry("status", "WITHDRAWN").containsEntry("decided_at", null);
        assertThat(jdbc.queryForObject("SELECT count(*) FROM vehicle_photos WHERE vehicle_id = ?", Integer.class,
                vehicleId)).isZero();
        assertThat(jdbc.queryForObject("SELECT count(*) FROM driver_payment_details WHERE user_id = ?", Integer.class,
                driverId)).isZero();
        assertThat(jdbc.queryForObject("SELECT id_document FROM users WHERE id = ?", String.class, driverId)).isNull();
        // The car stays, because past rides refer to it.
        assertThat(jdbc.queryForObject("SELECT count(*) FROM vehicles WHERE id = ?", Integer.class, vehicleId))
                .isOne();
    }

    @Test
    void anAdministratorIsNotDeletedThroughTheApp() throws Exception {
        mvc.perform(delete("/api/v1/me").header("Authorization", bearer(adminId, UserRole.ADMIN)))
                .andExpect(status().isForbidden());
        assertThat(jdbc.queryForObject("SELECT status FROM users WHERE id = ?", String.class, adminId))
                .isEqualTo("ACTIVE");
    }

    private long driver() {
        return identity.register(UUID.randomUUID() + "@example.test", PASSWORD, "Ravi Jadhav", UserRole.DRIVER).id();
    }

    private long publish(long driverId, long vehicleId) {
        return rides.publish(driverId, new PublishRide(vehicleId, Instant.now().plus(Duration.ofDays(2)), 3, true,
                STOPS, List.of(new BigDecimal("520.00")))).id();
    }

    private String bearer(long userId, UserRole role) {
        return "Bearer " + tokens.issue(userId, role);
    }

    /** Unique per test: phone numbers belong to one account. */
    private static String phone() {
        return "+91" + String.format("%010d", Math.floorMod(UUID.randomUUID().getMostSignificantBits(),
                10_000_000_000L));
    }

    private static void assertStatus(HttpStatus expected, Runnable action) {
        assertThatThrownBy(action::run)
                .isInstanceOfSatisfying(ResponseStatusException.class,
                        e -> assertThat(e.getStatusCode()).isEqualTo(expected));
    }
}
