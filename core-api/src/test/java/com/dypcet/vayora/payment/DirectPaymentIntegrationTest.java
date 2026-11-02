package com.dypcet.vayora.payment;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.dypcet.vayora.PostgresIntegrationTest;
import com.dypcet.vayora.booking.BookingService;
import com.dypcet.vayora.booking.BookingService.Booking;
import com.dypcet.vayora.booking.BookingStatus;
import com.dypcet.vayora.booking.FlexTier;
import com.dypcet.vayora.booking.TripService;
import com.dypcet.vayora.identity.IdentityService;
import com.dypcet.vayora.identity.TokenService;
import com.dypcet.vayora.identity.UserRole;
import com.dypcet.vayora.payment.DriverPaymentDetails.HowToPay;
import com.dypcet.vayora.payment.PaymentService.Earning;
import com.dypcet.vayora.payment.PaymentService.Method;
import com.dypcet.vayora.ride.RideService;
import com.dypcet.vayora.ride.RideService.PublishRide;
import com.dypcet.vayora.ride.RideService.StopInput;
import com.dypcet.vayora.vehicle.VehicleService;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.math.BigDecimal;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import javax.imageio.ImageIO;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.web.server.ResponseStatusException;

/**
 * Passengers paying their driver directly, against a real database. Nothing is taken at booking,
 * and a booking owes the driver 520.00 for one seat Kolhapur to Pune when the trip runs, or the
 * part of that the timing tiers say when it is cancelled.
 */
@AutoConfigureMockMvc
class DirectPaymentIntegrationTest extends PostgresIntegrationTest {

    private static final List<StopInput> STOPS = List.of(
            new StopInput("Kolhapur", 16.7050, 74.2433, 0),
            new StopInput("Pune", 18.5204, 73.8567, 270));
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
    private PaymentService payments;

    @Autowired
    private DriverPaymentDetails details;

    @Autowired
    private TokenService tokens;

    @Autowired
    private JdbcTemplate jdbc;

    @Autowired
    private MockMvc mvc;

    @Autowired
    private ObjectMapper json;

    private long driverId;
    private long passengerId;

    @BeforeEach
    void setUp() {
        driverId = user(UserRole.DRIVER);
        passengerId = user(UserRole.PASSENGER);
    }

    @Test
    void bookingTakesNothingAndOwesNothingYet() {
        Booking booking = book(passengerId, ride(Duration.ofDays(3), true));

        assertThat(booking.paymentStatus()).isEqualTo("DEFERRED");
        assertThat(booking.price()).isEqualByComparingTo("520.00");
        assertThat(booking.amountDue()).isNull();
        assertThat(booking.paymentMethod()).isNull();
        assertThat(payments.owes(passengerId)).isFalse();
        assertThat(payments.forDriver(driverId)).isEmpty();
    }

    @Test
    void aCompletedTripOwesTheFareAndNothingElseIsBookedUntilTheDriverMarksItPaid() {
        long rideId = ride(Duration.ofMinutes(30), true);
        Booking booking = book(passengerId, rideId);
        trips.start(driverId, rideId);
        trips.complete(driverId, rideId);

        Booking ended = bookings.forPassenger(passengerId).get(0);
        assertThat(ended.paymentStatus()).isEqualTo("DUE");
        assertThat(ended.amountDue()).isEqualByComparingTo("520.00");
        assertThat(intent(booking)).containsEntry("due_reason", "TRIP_COMPLETED");
        assertThat(payments.forDriver(driverId)).singleElement().satisfies((Earning earning) -> {
            assertThat(earning.status()).isEqualTo("DUE");
            assertThat(earning.method()).isNull();
            assertThat(earning.amount()).isEqualByComparingTo("520.00");
        });
        long next = ride(Duration.ofDays(2), true);
        assertThatThrownBy(() -> bookings.request(passengerId, next, 0, 1, 1, null))
                .isInstanceOfSatisfying(ResponseStatusException.class, e -> assertThat(e.getReason()).isEqualTo(
                        "You still owe a driver for an earlier booking. You can book again once they mark it paid: see My bookings."));

        Booking paid = bookings.paymentReceived(driverId, booking.id(), Method.UPI);

        assertThat(paid.paymentStatus()).isEqualTo("SETTLED");
        assertThat(paid.paymentMethod()).isEqualTo("UPI");
        assertThat(payments.forDriver(driverId)).singleElement().satisfies((Earning earning) -> {
            assertThat(earning.status()).isEqualTo("SETTLED");
            assertThat(earning.method()).isEqualTo("UPI");
            assertThat(earning.reason()).isEqualTo("TRIP_COMPLETED");
        });
        assertThat(bookings.request(passengerId, next, 0, 1, 1, null).status()).isEqualTo(BookingStatus.CONFIRMED);
    }

    @Test
    void onlyThatDriverCanMarkItPaidAndOnlyOnce() {
        long rideId = ride(Duration.ofMinutes(30), true);
        Booking booking = book(passengerId, rideId);

        // Nothing is due while it is still live.
        assertThatThrownBy(() -> bookings.paymentReceived(driverId, booking.id(), Method.CASH))
                .isInstanceOfSatisfying(ResponseStatusException.class,
                        e -> assertThat(e.getReason()).isEqualTo("Nothing is due on this booking"));
        trips.start(driverId, rideId);
        trips.complete(driverId, rideId);

        assertThatThrownBy(() -> bookings.paymentReceived(user(UserRole.DRIVER), booking.id(), Method.CASH))
                .isInstanceOfSatisfying(ResponseStatusException.class,
                        e -> assertThat(e.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND));
        bookings.paymentReceived(driverId, booking.id(), Method.CASH);

        assertThat(intent(booking)).containsEntry("status", "SETTLED").containsEntry("method", "CASH");
        assertThatThrownBy(() -> bookings.paymentReceived(driverId, booking.id(), Method.UPI))
                .isInstanceOfSatisfying(ResponseStatusException.class,
                        e -> assertThat(e.getReason()).isEqualTo("Nothing is due on this booking"));
        assertThat(intent(booking)).containsEntry("method", "CASH");
    }

    @Test
    void cancellingOwesTheDriverByTheTimingTiersAndEarlyCostsNothing() {
        // Accepted: the part of the fare the tiers do not let the passenger off.
        assertThat(cancelled(Duration.ofDays(3), true)).isEqualTo("VOID");
        assertThat(cancelled(Duration.ofHours(30), true)).isEqualTo("DUE 260.00 PASSENGER_CANCELLED");
        assertThat(cancelled(Duration.ofHours(2), true)).isEqualTo("DUE 520.00 PASSENGER_CANCELLED");
        // Never accepted: nothing, however late.
        assertThat(cancelled(Duration.ofHours(2), false)).isEqualTo("VOID");
    }

    @Test
    void aDriverDecliningOrWithdrawingLeavesNothingOwed() {
        Booking declined = book(passengerId, ride(Duration.ofDays(3), false));
        bookings.reject(driverId, declined.id());
        long withdrawn = ride(Duration.ofHours(2), true);
        Booking cancelled = book(passengerId, withdrawn);
        trips.cancel(driverId, withdrawn);

        assertThat(intent(declined)).containsEntry("status", "VOID").containsEntry("amount_due", null);
        assertThat(intent(cancelled)).containsEntry("status", "VOID");
        assertThat(payments.owes(passengerId)).isFalse();
        assertThat(payments.forPassenger(passengerId)).allSatisfy(
                payment -> assertThat(payment.status()).isEqualTo("VOID"));
    }

    @Test
    void aNoShowOwesTheWholeFare() {
        long rideId = ride(Duration.ofMinutes(30), true);
        Booking booking = book(passengerId, rideId);
        trips.start(driverId, rideId);

        trips.noShow(driverId, booking.id());

        assertThat(intent(booking)).containsEntry("status", "DUE").containsEntry("due_reason", "PASSENGER_NO_SHOW");
        assertThat(payments.due(booking.id())).hasValueSatisfying(due -> assertThat(due).isEqualByComparingTo("520.00"));
    }

    @Test
    void aRequestTheDriverNeverAnsweredOwesNothingWhenTheRideStarts() {
        long rideId = ride(Duration.ofMinutes(30), false);
        Booking booking = book(passengerId, rideId);

        trips.start(driverId, rideId);

        assertThat(intent(booking)).containsEntry("status", "VOID");
    }

    @Test
    void aRepeatedRequestWithTheSameKeyBooksOnce() {
        long rideId = ride(Duration.ofDays(3), true);
        String key = UUID.randomUUID().toString();

        Booking first = bookings.request(passengerId, rideId, 0, 1, 1, key);
        Booking again = bookings.request(passengerId, rideId, 0, 1, 1, key);

        assertThat(again.id()).isEqualTo(first.id());
        assertThat(jdbc.queryForObject("SELECT seats_available FROM ride_segments WHERE ride_id = ?", Integer.class, rideId))
                .isEqualTo(2);
        assertThat(bookings.forPassenger(passengerId)).hasSize(1);

        // The same key for something else is a mistake, not a repeat.
        assertThatThrownBy(() -> bookings.request(passengerId, rideId, 0, 1, 2, key))
                .isInstanceOfSatisfying(ResponseStatusException.class,
                        e -> assertThat(e.getStatusCode()).isEqualTo(HttpStatus.CONFLICT));
        // Another passenger may use the same key.
        assertThat(bookings.request(user(UserRole.PASSENGER), rideId, 0, 1, 1, key).id()).isNotEqualTo(first.id());
    }

    @Test
    void eachPersonSeesOnlyTheirOwnMoney() {
        Booking booking = book(passengerId, ride(Duration.ofHours(30), true));
        bookings.cancel(passengerId, booking.id());

        assertThat(payments.forPassenger(passengerId)).singleElement().satisfies(payment -> {
            assertThat(payment.bookingId()).isEqualTo(booking.id());
            assertThat(payment.fare()).isEqualByComparingTo("520.00");
            assertThat(payment.amountDue()).isEqualByComparingTo("260.00");
            assertThat(payment.dueReason()).isEqualTo("PASSENGER_CANCELLED");
            assertThat(payment.status()).isEqualTo("DUE");
            assertThat(payment.fromStop()).isEqualTo("Kolhapur");
        });
        assertThat(payments.forPassenger(user(UserRole.PASSENGER))).isEmpty();
        assertThat(payments.forDriver(user(UserRole.DRIVER))).isEmpty();
    }

    @Test
    void aFreeRideOwesNothingEvenWhenItRuns() {
        long vehicleId = vehicles.create(driverId, "Maruti", "Ertiga", 2022, "Silver", 7).id();
        long rideId = rides.publish(driverId, new PublishRide(vehicleId, Instant.now().plus(Duration.ofMinutes(30)), 3, true,
                STOPS, List.of(BigDecimal.ZERO))).id();
        Booking booking = book(passengerId, rideId);
        trips.start(driverId, rideId);
        trips.complete(driverId, rideId);

        assertThat(bookings.forPassenger(passengerId).get(0).paymentStatus()).isNull();
        assertThat(payments.owes(passengerId)).isFalse();
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM payment_intents WHERE booking_id = ?", Integer.class,
                booking.id())).isZero();
    }

    @Test
    void aFlexibleBookingIsRebookedOnAnotherRideAndPaidAfterThatOne() {
        LocalDate day = LocalDate.now(ZONE).plusDays(23);
        long withdrawn = ride(driverId, day.atTime(7, 0).atZone(ZONE).toInstant(), true);
        long other = ride(user(UserRole.DRIVER), day.atTime(8, 10).atZone(ZONE).toInstant(), true);
        bookings.request(passengerId, withdrawn, 0, 1, 1, null, FlexTier.FLEXIBLE);

        trips.cancel(driverId, withdrawn);

        assertThat(bookings.forPassenger(passengerId)).filteredOn(b -> b.status() == BookingStatus.CONFIRMED)
                .singleElement().satisfies(b -> {
                    assertThat(b.rideId()).isEqualTo(other);
                    assertThat(b.paymentStatus()).isEqualTo("DEFERRED");
                });
    }

    @Test
    void staffCanClearWhatADriverWillNotMarkPaidAndTheAuditLogSaysWhy() throws Exception {
        long rideId = ride(Duration.ofMinutes(30), true);
        Booking booking = book(passengerId, rideId);
        trips.start(driverId, rideId);
        trips.complete(driverId, rideId);
        long admin = user(UserRole.PASSENGER); // Administrators cannot register: the token says who they are
        String path = "/api/v1/admin/bookings/" + booking.id() + "/clear-due";
        String reason = json.writeValueAsString(Map.of("reason", "Passenger showed the UPI payment"));

        mvc.perform(post(path).header("Authorization", bearer(driverId, UserRole.DRIVER))
                        .contentType("application/json").content(reason))
                .andExpect(status().isForbidden());
        mvc.perform(post(path).header("Authorization", bearer(admin, UserRole.ADMIN))
                        .contentType("application/json").content("{\"reason\": \" \"}"))
                .andExpect(status().isBadRequest());
        mvc.perform(post(path).header("Authorization", bearer(admin, UserRole.ADMIN))
                        .contentType("application/json").content(reason))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.paymentStatus").value("VOID"));

        assertThat(payments.owes(passengerId)).isFalse();
        assertThat(jdbc.queryForMap("""
                SELECT action, detail->>'reason' AS reason, detail->>'amount' AS amount FROM audit_log
                WHERE target_type = 'booking' AND target_id = ?""", booking.id()))
                .containsEntry("action", "PAYMENT_DUE_CLEARED")
                .containsEntry("reason", "Passenger showed the UPI payment")
                .containsEntry("amount", "520.00");
        assertThatThrownBy(() -> bookings.clearDue(admin, booking.id(), "again"))
                .isInstanceOfSatisfying(ResponseStatusException.class,
                        e -> assertThat(e.getReason()).isEqualTo("Nothing is due on this booking"));
    }

    @Test
    void aUpiIdIsCheckedTidiedAndCanBeRemoved() {
        assertThat(details.of(driverId).upiId()).isNull();

        assertThat(details.setUpiId(driverId, "  Ravi.Jadhav-1@OkAxis ").upiId()).isEqualTo("ravi.jadhav-1@okaxis");
        assertThat(details.setUpiId(driverId, "9876543210@ybl").upiId()).isEqualTo("9876543210@ybl");

        // An email address is the mistake most worth catching: money would go nowhere.
        for (String wrong : List.of("ravi", "@ybl", "ravi@", "ravi@gmail.com", "ra vi@ybl", "a@b@ybl")) {
            assertThatThrownBy(() -> details.setUpiId(driverId, wrong)).as(wrong)
                    .isInstanceOfSatisfying(ResponseStatusException.class,
                            e -> assertThat(e.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST));
        }
        assertThat(details.of(driverId).upiId()).isEqualTo("9876543210@ybl");
        assertThat(details.setUpiId(driverId, " ").upiId()).isNull();
    }

    @Test
    void aPassengerSeesWhereToPayOnlyForTheirOwnConfirmedOrOwingBooking() {
        details.setUpiId(driverId, "ravi@okaxis");
        Booking requested = book(passengerId, ride(Duration.ofDays(3), false));
        assertThatThrownBy(() -> details.forPassenger(passengerId, requested.id()))
                .isInstanceOfSatisfying(ResponseStatusException.class,
                        e -> assertThat(e.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND));

        bookings.accept(driverId, requested.id());

        HowToPay how = details.forPassenger(passengerId, requested.id());
        assertThat(how.upiId()).isEqualTo("ravi@okaxis");
        assertThat(how.hasQr()).isFalse();
        assertThat(how.driverName()).isEqualTo("Test DRIVER");
        long stranger = user(UserRole.PASSENGER);
        assertThatThrownBy(() -> details.forPassenger(stranger, requested.id()))
                .isInstanceOfSatisfying(ResponseStatusException.class,
                        e -> assertThat(e.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND));

        // Three days ahead cancelling is free: nothing owed, so nothing more to see.
        bookings.cancel(passengerId, requested.id());
        assertThatThrownBy(() -> details.forPassenger(passengerId, requested.id()))
                .isInstanceOf(ResponseStatusException.class);

        // Cancelled late it is owed, and they must be able to find where to pay.
        Booking late = book(passengerId, ride(Duration.ofHours(2), true));
        bookings.cancel(passengerId, late.id());
        assertThat(details.forPassenger(passengerId, late.id()).upiId()).isEqualTo("ravi@okaxis");

        // Once marked paid, it is gone again.
        bookings.paymentReceived(driverId, late.id(), Method.UPI);
        assertThatThrownBy(() -> details.forPassenger(passengerId, late.id()))
                .isInstanceOf(ResponseStatusException.class);
    }

    @Test
    void aQrCodeIsKeptAsAFreshPngAndServedOnlyToThoseWhoMaySeeIt() throws Exception {
        String driver = bearer(driverId, UserRole.DRIVER);
        String passenger = bearer(passengerId, UserRole.PASSENGER);
        Booking booking = book(passengerId, ride(Duration.ofDays(3), true));
        String qrPath = "/api/v1/bookings/" + booking.id() + "/pay-driver/qr";

        mvc.perform(get(qrPath).header("Authorization", passenger)).andExpect(status().isNotFound());
        mvc.perform(put("/api/v1/me/payment-details/qr").header("Authorization", driver).content("not a picture"))
                .andExpect(status().isBadRequest());
        mvc.perform(put("/api/v1/me/payment-details/qr").header("Authorization", passenger).content(picture(40, 40)))
                .andExpect(status().isForbidden());
        mvc.perform(put("/api/v1/me/payment-details/qr").header("Authorization", driver).content(picture(40, 40)))
                .andExpect(status().isNoContent());
        mvc.perform(get("/api/v1/me/payment-details").header("Authorization", driver))
                .andExpect(status().isOk()).andExpect(jsonPath("$.hasQr").value(true));
        mvc.perform(get("/api/v1/bookings/" + booking.id() + "/pay-driver").header("Authorization", passenger))
                .andExpect(status().isOk()).andExpect(jsonPath("$.hasQr").value(true));

        byte[] served = mvc.perform(get(qrPath).header("Authorization", passenger))
                .andExpect(status().isOk())
                .andExpect(header().string("Content-Type", "image/png"))
                .andExpect(header().string("Cache-Control", "no-store"))
                .andReturn().getResponse().getContentAsByteArray();
        BufferedImage image = ImageIO.read(new ByteArrayInputStream(served));
        assertThat(image.getWidth()).isEqualTo(40);
        // Black stays black and white stays white: nothing has blurred the code.
        assertThat(image.getRGB(0, 0) & 0xFFFFFF).isZero();
        assertThat(image.getRGB(1, 0) & 0xFFFFFF).isEqualTo(0xFFFFFF);

        mvc.perform(get(qrPath).header("Authorization", bearer(user(UserRole.PASSENGER), UserRole.PASSENGER)))
                .andExpect(status().isNotFound());
        mvc.perform(get(qrPath).header("Authorization", driver)).andExpect(status().isForbidden());
        mvc.perform(get(qrPath)).andExpect(status().isUnauthorized());

        mvc.perform(delete("/api/v1/me/payment-details/qr").header("Authorization", driver))
                .andExpect(status().isNoContent());
        mvc.perform(get(qrPath).header("Authorization", passenger)).andExpect(status().isNotFound());
    }

    @Test
    void aBigQrCodeIsScaledDownToTheConfiguredSide() throws Exception {
        details.setQr(driverId, picture(2000, 1000));

        BufferedImage stored = ImageIO.read(new ByteArrayInputStream(details.qr(driverId)));

        assertThat(stored.getWidth()).isEqualTo(1200);
        assertThat(stored.getHeight()).isEqualTo(600);
    }

    @Test
    void theHttpApiBooksAndLetsOnlyTheDriverSayItWasPaid() throws Exception {
        long rideId = ride(Duration.ofMinutes(30), true);
        String passenger = bearer(passengerId, UserRole.PASSENGER);
        String driver = bearer(driverId, UserRole.DRIVER);

        String body = json.writeValueAsString(Map.of("rideId", rideId, "fromSeq", 0, "toSeq", 1, "seats", 1));
        String key = UUID.randomUUID().toString();
        String created = mvc.perform(post("/api/v1/bookings").header("Authorization", passenger)
                        .header("Idempotency-Key", key).contentType("application/json").content(body))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.paymentStatus").value("DEFERRED"))
                .andReturn().getResponse().getContentAsString();
        long bookingId = json.readTree(created).get("id").asLong();
        mvc.perform(post("/api/v1/bookings").header("Authorization", passenger)
                        .header("Idempotency-Key", key).contentType("application/json").content(body))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").value(bookingId));
        mvc.perform(post("/api/v1/bookings").header("Authorization", passenger)
                        .header("Idempotency-Key", "x".repeat(101)).contentType("application/json").content(body))
                .andExpect(status().isBadRequest());
        trips.start(driverId, rideId);
        trips.complete(driverId, rideId);
        String path = "/api/v1/bookings/" + bookingId + "/payment-received";

        mvc.perform(post(path).header("Authorization", passenger)
                        .contentType("application/json").content("{\"method\": \"CASH\"}"))
                .andExpect(status().isForbidden());
        mvc.perform(post(path).header("Authorization", driver).contentType("application/json").content("{}"))
                .andExpect(status().isBadRequest());
        mvc.perform(post(path).header("Authorization", driver)
                        .contentType("application/json").content("{\"method\": \"CARD\"}"))
                .andExpect(status().isBadRequest());
        mvc.perform(post(path).header("Authorization", driver)
                        .contentType("application/json").content("{\"method\": \"CASH\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.paymentStatus").value("SETTLED"))
                .andExpect(jsonPath("$.paymentMethod").value("CASH"))
                .andExpect(jsonPath("$.amountDue").value(520.0));

        mvc.perform(get("/api/v1/earnings").header("Authorization", driver))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].status").value("SETTLED"))
                .andExpect(jsonPath("$[0].amount").value(520.0));
        mvc.perform(get("/api/v1/payments").header("Authorization", passenger))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].method").value("CASH"))
                .andExpect(jsonPath("$[0].paidAt").isNotEmpty());
    }

    @Test
    void theTermsSayHowMuchOfTheFareIsOwed() throws Exception {
        mvc.perform(get("/api/v1/payment-terms").header("Authorization", bearer(passengerId, UserRole.PASSENGER)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.cancellationTiers[0].atLeastHoursBefore").value(48))
                .andExpect(jsonPath("$.cancellationTiers[0].owedShare").value(0.0))
                .andExpect(jsonPath("$.cancellationTiers[1].atLeastHoursBefore").value(24))
                .andExpect(jsonPath("$.cancellationTiers[1].owedShare").value(0.5));
    }

    /** What a booking owes after its passenger cancels this long before boarding. */
    private String cancelled(Duration untilDeparture, boolean instantBooking) {
        long passenger = user(UserRole.PASSENGER);
        Booking booking = book(passenger, ride(untilDeparture, instantBooking));
        bookings.cancel(passenger, booking.id());
        Map<String, Object> intent = intent(booking);
        return intent.get("amount_due") == null ? (String) intent.get("status")
                : intent.get("status") + " " + intent.get("amount_due") + " " + intent.get("due_reason");
    }

    private Booking book(long passenger, long rideId) {
        return bookings.request(passenger, rideId, 0, 1, 1, null);
    }

    private Map<String, Object> intent(Booking booking) {
        return jdbc.queryForMap("SELECT status, method, amount_due, due_reason FROM payment_intents WHERE booking_id = ?",
                booking.id());
    }

    private String bearer(long userId, UserRole role) {
        return "Bearer " + tokens.issue(userId, role);
    }

    /** Alternating black and white pixels, as sharp as a picture can be. */
    private static byte[] picture(int width, int height) throws IOException {
        BufferedImage image = new BufferedImage(width, height, BufferedImage.TYPE_INT_RGB);
        for (int x = 0; x < width; x++) {
            for (int y = 0; y < height; y++) {
                image.setRGB(x, y, (x + y) % 2 == 0 ? 0x000000 : 0xFFFFFF);
            }
        }
        ByteArrayOutputStream bytes = new ByteArrayOutputStream();
        ImageIO.write(image, "png", bytes);
        return bytes.toByteArray();
    }

    private long user(UserRole role) {
        return identity.register(UUID.randomUUID() + "@example.test", "correct-horse-battery",
                "Test " + role, role).id();
    }

    private long ride(Duration untilDeparture, boolean instantBooking) {
        return ride(driverId, Instant.now().plus(untilDeparture), instantBooking);
    }

    private long ride(long driver, Instant departure, boolean instantBooking) {
        long vehicleId = vehicles.create(driver, "Maruti", "Ertiga", 2022, "Silver", 7).id();
        return rides.publish(driver, new PublishRide(vehicleId, departure, 3, instantBooking, STOPS,
                List.of(new BigDecimal("520.00")))).id();
    }
}
