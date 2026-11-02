package com.dypcet.vayora.bus;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.dypcet.vayora.PostgresIntegrationTest;
import com.dypcet.vayora.booking.BookingService;
import com.dypcet.vayora.booking.TripService;
import com.dypcet.vayora.bus.BusService.NewBus;
import com.dypcet.vayora.identity.IdentityService;
import com.dypcet.vayora.identity.TokenService;
import com.dypcet.vayora.identity.UserRole;
import com.dypcet.vayora.notification.NotificationService;
import com.dypcet.vayora.notification.NotificationService.Type;
import com.dypcet.vayora.ride.RideService;
import com.dypcet.vayora.ride.RideService.PublishRide;
import com.dypcet.vayora.ride.RideService.StopInput;
import com.dypcet.vayora.vehicle.VehicleService;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.test.web.servlet.MockMvc;

@AutoConfigureMockMvc
class BusIntegrationTest extends PostgresIntegrationTest {

    private static final ZoneId ZONE = ZoneId.of("Asia/Kolkata");

    @Autowired
    private IdentityService identity;

    @Autowired
    private TokenService tokens;

    @Autowired
    private BusService buses;

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
    private MockMvc mvc;

    @Test
    void onlyAnAdministratorEntersBusesAndAnyoneSignedInCanLookThemUp() throws Exception {
        // Town names of this test's own, so buses other tests enter are not found.
        String from = "Town " + UUID.randomUUID();
        String to = "City " + UUID.randomUUID();
        String admin = "Bearer " + tokens.issue(admin(), UserRole.ADMIN);
        String passenger = "Bearer " + tokens.issue(user(UserRole.PASSENGER, "Asha Patil"), UserRole.PASSENGER);
        String body = "{\"operator\": \"Test Operator\", \"fromStop\": \"" + from + "\", \"toStop\": \"" + to
                + "\", \"departs\": \"%s\", \"durationMinutes\": 300, \"fare\": 350}";

        mvc.perform(post("/api/v1/admin/bus-services").header("Authorization", passenger)
                        .contentType("application/json").content(body.formatted("07:00")))
                .andExpect(status().isForbidden());
        String created = mvc.perform(post("/api/v1/admin/bus-services").header("Authorization", admin)
                        .contentType("application/json").content(body.formatted("07:00")))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        mvc.perform(post("/api/v1/admin/bus-services").header("Authorization", admin)
                        .contentType("application/json").content(body.formatted("15:30")))
                .andExpect(status().isCreated());

        mvc.perform(get("/api/v1/bus-alternatives").header("Authorization", passenger)
                        .param("from", from.toUpperCase()).param("to", to).param("after", "08:00"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].departs").value("15:30:00"));

        long id = Long.parseLong(created.replaceAll(".*\"id\":(\\d+).*", "$1"));
        mvc.perform(delete("/api/v1/admin/bus-services/" + id).header("Authorization", admin))
                .andExpect(status().isNoContent());
        mvc.perform(delete("/api/v1/admin/bus-services/" + id).header("Authorization", admin))
                .andExpect(status().isNotFound());
        assertThat(buses.between(from, to, LocalTime.MIN, 5)).hasSize(1);
    }

    @Test
    void aBusMustGoSomewhereElse() throws Exception {
        String admin = "Bearer " + tokens.issue(admin(), UserRole.ADMIN);
        mvc.perform(post("/api/v1/admin/bus-services").header("Authorization", admin).contentType("application/json")
                        .content("{\"operator\": \"X\", \"fromStop\": \"Pune\", \"toStop\": \"pune \", \"departs\": \"07:00\","
                                + " \"durationMinutes\": 300, \"fare\": 350}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void whenNoOtherRideWillDoTheWithdrawalNoticeNamesBusesAndSaysTheyAreUnchecked() {
        String from = "Town " + UUID.randomUUID();
        String to = "City " + UUID.randomUUID();
        long admin = admin();
        buses.add(admin, new NewBus("Test Operator", from, to, LocalTime.of(10, 0), 300, new BigDecimal("350.00"), null));
        buses.add(admin, new NewBus("Test Operator", from, to, LocalTime.of(7, 0), 300, new BigDecimal("350.00"), null));
        long driver = user(UserRole.DRIVER, "Ravi Jadhav");
        long passenger = user(UserRole.PASSENGER, "Asha Patil");
        long vehicleId = vehicles.create(driver, "Maruti", "Ertiga", 2022, "Silver", 7).id();
        LocalDate day = LocalDate.now(ZONE).plusDays(9);
        long rideId = rides.publish(driver, new PublishRide(vehicleId, day.atTime(9, 0).atZone(ZONE).toInstant(), 3, true,
                List.of(new StopInput(from, 16.7050, 74.2433, 0), new StopInput(to, 18.5204, 73.8567, 270)),
                List.of(new BigDecimal("450.00")))).id();
        bookings.request(passenger, rideId, 0, 1, 1, null);

        trips.cancel(driver, rideId);

        String notice = notifications.forUser(passenger).stream()
                .filter(n -> n.type() == Type.RIDE_CANCELLED).findFirst().orElseThrow().message();
        // 07:00 is more than an hour before boarding at 09:00, so only the 10:00 bus is named.
        assertThat(notice).contains("No other ride with seats leaves near that time.")
                .endsWith(" Buses listed by VAYORA staff (check with the operator before travelling): "
                        + "10:00 Test Operator, Rs 350.00.");
    }

    private long admin() {
        return identity.authenticate("admin@example.test", "admin-test-password").id();
    }

    private long user(UserRole role, String name) {
        return identity.register(UUID.randomUUID() + "@example.test", "correct-horse-battery", name, role).id();
    }
}
