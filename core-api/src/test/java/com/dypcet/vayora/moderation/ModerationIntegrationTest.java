package com.dypcet.vayora.moderation;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.dypcet.vayora.PostgresIntegrationTest;
import com.dypcet.vayora.audit.AuditService;
import com.dypcet.vayora.audit.AuditService.Entry;
import com.dypcet.vayora.booking.BookingService;
import com.dypcet.vayora.identity.IdentityService;
import com.dypcet.vayora.identity.TokenService;
import com.dypcet.vayora.identity.UserRole;
import com.dypcet.vayora.moderation.ModerationService.Outcome;
import com.dypcet.vayora.moderation.ModerationService.Reason;
import com.dypcet.vayora.moderation.ModerationService.Report;
import com.dypcet.vayora.notification.NotificationService;
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
class ModerationIntegrationTest extends PostgresIntegrationTest {

    private static final String PASSWORD = "correct-horse-battery";
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
    private ModerationService moderation;

    @Autowired
    private AuditService audit;

    @Autowired
    private NotificationService notifications;

    @Autowired
    private TokenService tokens;

    @Autowired
    private JdbcTemplate jdbc;

    @Autowired
    private MockMvc mvc;

    private long adminId;
    private long driverId;
    private String driverEmail;
    private long passengerId;
    private long bookingId;

    @BeforeEach
    void setUp() {
        adminId = identity.authenticate("admin@example.test", "admin-test-password").id();
        driverEmail = UUID.randomUUID() + "@example.test";
        driverId = identity.register(driverEmail, PASSWORD, "Ravi Jadhav", UserRole.DRIVER).id();
        passengerId = identity.register(UUID.randomUUID() + "@example.test", PASSWORD, "Asha Patil",
                UserRole.PASSENGER).id();
        long vehicleId = vehicles.create(driverId, "Maruti", "Ertiga", 2022, "Silver", 7).id();
        long rideId = rides.publish(driverId, new PublishRide(vehicleId,
                Instant.now().plus(Duration.ofDays(2)), 3, true, STOPS,
                List.of(new BigDecimal("520.00")))).id();
        bookingId = bookings.request(passengerId, rideId, 0, 1, 1, null).id();
    }

    @Test
    void someoneYouTravelledWithCanBeReportedOnceAtATime() {
        long reportId = moderation.file(passengerId, driverId, bookingId, Reason.UNSAFE_DRIVING,
                "  Overtook on a blind bend.  ");

        assertThat(moderation.withStatus("OPEN")).filteredOn(r -> r.id() == reportId)
                .singleElement().satisfies(report -> {
                    assertThat(report.reporterName()).isEqualTo("Asha Patil");
                    assertThat(report.reportedUserName()).isEqualTo("Ravi Jadhav");
                    assertThat(report.details()).isEqualTo("Overtook on a blind bend.");
                    assertThat(report.bookingId()).isEqualTo(bookingId);
                });
        assertStatus(HttpStatus.CONFLICT,
                () -> moderation.file(passengerId, driverId, null, Reason.OTHER, null));
        // The other direction is a different report.
        moderation.file(driverId, passengerId, null, Reason.NO_SHOW, null);
    }

    @Test
    void strangersYourselfAndSomeoneElsesBookingCannotBeUsedToReport() {
        long stranger = identity.register(UUID.randomUUID() + "@example.test", PASSWORD, "Stranger",
                UserRole.PASSENGER).id();

        assertStatus(HttpStatus.FORBIDDEN,
                () -> moderation.file(stranger, driverId, null, Reason.FRAUD, "never met"));
        assertStatus(HttpStatus.FORBIDDEN,
                () -> moderation.file(stranger, driverId, bookingId, Reason.FRAUD, "not my booking"));
        assertStatus(HttpStatus.BAD_REQUEST,
                () -> moderation.file(driverId, driverId, null, Reason.OTHER, null));
    }

    @Test
    void dismissingClosesTheReportAndTouchesNobody() {
        long reportId = moderation.file(passengerId, driverId, null, Reason.OTHER, null);

        Report closed = moderation.resolve(adminId, reportId, Outcome.DISMISS, "No evidence.");

        assertThat(closed.status()).isEqualTo("DISMISSED");
        assertThat(closed.outcome()).isEqualTo(Outcome.DISMISS);
        assertThat(closed.reportedUserStatus()).isEqualTo("ACTIVE");
        assertThat(notifications.forUser(driverId))
                .noneMatch(n -> n.type() == NotificationService.Type.ACCOUNT_NOTICE);
        assertStatus(HttpStatus.CONFLICT,
                () -> moderation.resolve(adminId, reportId, Outcome.SUSPEND, null));
        // Closed, so the passenger may report again.
        moderation.file(passengerId, driverId, null, Reason.OTHER, null);
    }

    @Test
    void aWarningTellsTheMemberAndLeavesTheAccountActive() {
        long reportId = moderation.file(passengerId, driverId, null, Reason.UNSAFE_DRIVING, null);

        moderation.resolve(adminId, reportId, Outcome.WARN, "Please keep to the speed limit.");

        assertThat(notifications.forUser(driverId)).first().satisfies(notice -> {
            assertThat(notice.type()).isEqualTo(NotificationService.Type.ACCOUNT_NOTICE);
            assertThat(notice.message()).isEqualTo(
                    "An administrator reviewed a report about you: Please keep to the speed limit.");
        });
        assertThat(identity.authenticate(driverEmail, PASSWORD).id()).isEqualTo(driverId);
    }

    @Test
    void suspensionStopsSignInAndATokenIssuedBeforeItUntilReinstated() throws Exception {
        String driver = "Bearer " + tokens.issue(driverId, UserRole.DRIVER);
        mvc.perform(get("/api/v1/rides/mine").header("Authorization", driver)).andExpect(status().isOk());
        long reportId = moderation.file(passengerId, driverId, null, Reason.HARASSMENT, null);

        Report closed = moderation.resolve(adminId, reportId, Outcome.SUSPEND, "Repeated abuse.");

        assertThat(closed.reportedUserStatus()).isEqualTo("SUSPENDED");
        mvc.perform(get("/api/v1/rides/mine").header("Authorization", driver))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.detail").value("This account is suspended"));
        mvc.perform(post("/api/v1/auth/login").contentType("application/json")
                        .content("{\"email\": \"" + driverEmail + "\", \"password\": \"" + PASSWORD + "\"}"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.detail").value("This account is suspended"));
        // A wrong password still says nothing about the account's standing.
        mvc.perform(post("/api/v1/auth/login").contentType("application/json")
                        .content("{\"email\": \"" + driverEmail + "\", \"password\": \"wrong-password\"}"))
                .andExpect(status().isUnauthorized());

        moderation.reinstate(adminId, driverId);

        mvc.perform(get("/api/v1/rides/mine").header("Authorization", driver)).andExpect(status().isOk());
    }

    @Test
    void everyAdministrativeActionIsAuditedAndTheAuditCannotBeRewritten() {
        long reportId = moderation.file(passengerId, driverId, null, Reason.FRAUD, null);
        moderation.resolve(adminId, reportId, Outcome.SUSPEND, null);
        moderation.reinstate(adminId, driverId);

        List<Entry> entries = audit.latest();
        assertThat(entries.get(0).action()).isEqualTo("USER_REINSTATED");
        assertThat(entries.get(0).targetId()).isEqualTo(driverId);
        assertThat(entries.get(1).action()).isEqualTo("REPORT_SUSPEND");
        assertThat(entries.get(1).targetId()).isEqualTo(reportId);
        assertThat(entries.get(1).actorId()).isEqualTo(adminId);
        assertThat(entries.get(1).detail()).contains("\"reason\": \"FRAUD\"");

        assertThatThrownBy(() -> jdbc.update("DELETE FROM audit_log"))
                .hasMessageContaining("append-only");
        assertThatThrownBy(() -> jdbc.update("UPDATE audit_log SET action = 'NOTHING'"))
                .hasMessageContaining("append-only");
    }

    @Test
    void anAdministratorCannotBeSuspendedThroughAReport() {
        assertStatus(HttpStatus.NOT_FOUND, () -> moderation.reinstate(adminId, adminId));
        assertStatus(HttpStatus.NOT_FOUND, () -> moderation.reinstate(adminId, Long.MAX_VALUE));
    }

    @Test
    void theBackOfficeIsForAdministratorsAndReportsForMembers() throws Exception {
        String admin = "Bearer " + tokens.issue(adminId, UserRole.ADMIN);
        String passenger = "Bearer " + tokens.issue(passengerId, UserRole.PASSENGER);

        for (String path : List.of("/admin/overview", "/admin/users", "/admin/reports", "/admin/audit")) {
            mvc.perform(get("/api/v1" + path).header("Authorization", passenger))
                    .andExpect(status().isForbidden());
            mvc.perform(get("/api/v1" + path)).andExpect(status().isUnauthorized());
            mvc.perform(get("/api/v1" + path).header("Authorization", admin)).andExpect(status().isOk());
        }
        mvc.perform(post("/api/v1/admin/users/" + driverId + "/reinstate").header("Authorization", passenger))
                .andExpect(status().isForbidden());

        String report = "{\"reportedUserId\": " + driverId + ", \"reason\": \"UNSAFE_DRIVING\"}";
        mvc.perform(post("/api/v1/reports").header("Authorization", admin)
                        .contentType("application/json").content(report))
                .andExpect(status().isForbidden());
        mvc.perform(post("/api/v1/reports").header("Authorization", passenger)
                        .contentType("application/json").content("{\"reportedUserId\": " + driverId + "}"))
                .andExpect(status().isBadRequest());
        mvc.perform(post("/api/v1/reports").header("Authorization", passenger)
                        .contentType("application/json").content(report))
                .andExpect(status().isCreated());

        mvc.perform(get("/api/v1/admin/overview").header("Authorization", admin))
                .andExpect(jsonPath("$.users.DRIVER").isNumber())
                .andExpect(jsonPath("$.bookings.CONFIRMED").isNumber())
                .andExpect(jsonPath("$.openReports").isNumber());
        mvc.perform(get("/api/v1/admin/users").param("q", driverEmail).header("Authorization", admin))
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].fullName").value("Ravi Jadhav"))
                .andExpect(jsonPath("$[0].status").value("ACTIVE"))
                .andExpect(jsonPath("$[0].passwordHash").doesNotExist());
        // A wildcard typed into the search box is text, not a pattern.
        mvc.perform(get("/api/v1/admin/users").param("q", "%").header("Authorization", admin))
                .andExpect(jsonPath("$.length()").value(0));
        mvc.perform(get("/api/v1/admin/reports").param("status", "EVERYTHING").header("Authorization", admin))
                .andExpect(status().isBadRequest());
    }

    private static void assertStatus(HttpStatus expected, Runnable action) {
        assertThatThrownBy(action::run)
                .isInstanceOfSatisfying(ResponseStatusException.class,
                        e -> assertThat(e.getStatusCode()).isEqualTo(expected));
    }
}
