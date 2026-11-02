package com.dypcet.vayora.receipt;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.dypcet.vayora.PostgresIntegrationTest;
import com.dypcet.vayora.booking.BookingService;
import com.dypcet.vayora.booking.TripService;
import com.dypcet.vayora.identity.IdentityService;
import com.dypcet.vayora.identity.TokenService;
import com.dypcet.vayora.identity.UserRole;
import com.dypcet.vayora.payment.PaymentService.Method;
import com.dypcet.vayora.ride.RideService;
import com.dypcet.vayora.ride.RideService.PublishRide;
import com.dypcet.vayora.ride.RideService.StopInput;
import com.dypcet.vayora.vehicle.VehicleService;
import java.awt.image.BufferedImage;
import java.io.IOException;
import java.math.BigDecimal;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.rendering.PDFRenderer;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.text.PDFTextStripper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.http.HttpStatus;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.web.server.ResponseStatusException;

@AutoConfigureMockMvc
class ReceiptIntegrationTest extends PostgresIntegrationTest {

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
    private ReceiptService receipts;

    @Autowired
    private TokenService tokens;

    @Autowired
    private MockMvc mvc;

    private long driver;
    private long passenger;
    private long vehicleId;

    @BeforeEach
    void setUp() {
        driver = user(UserRole.DRIVER, "Ravi Jadhav");
        passenger = user(UserRole.PASSENGER, "Asha Patil");
        vehicleId = vehicles.create(driver, "Maruti", "Ertiga", 2022, "Silver", 7).id();
    }

    @Test
    void aReceiptSaysWhatWasPaidToTheDriverAndOnWhoseWord() throws IOException {
        long bookingId = paid(passenger, 2, Method.UPI);

        String text = text(receipts.forBooking(passenger, bookingId));

        assertThat(text).contains("Receipt for booking " + bookingId)
                .contains("Passenger: Asha Patil").contains("Driver: Ravi Jadhav")
                .contains("Trip: Kolhapur to Pune, 2 seats")
                .contains("by UPI").contains("For: the trip")
                .contains("Fare: Rs 900.00").contains("Paid to the driver: Rs 900.00")
                .contains("as the driver recorded it").contains("VAYORA took no part of it")
                .contains("This is not a tax invoice")
                .doesNotContain("Service fee");
    }

    @Test
    void aReceiptAfterALateCancellationShowsThePartPaid() throws IOException {
        // Thirty hours ahead: half the fare is owed.
        long bookingId = bookings.request(passenger, ride(Duration.ofHours(30)), 0, 1, 1, null).id();
        bookings.cancel(passenger, bookingId);
        bookings.paymentReceived(driver, bookingId, Method.CASH);

        assertThat(text(receipts.forBooking(passenger, bookingId)))
                .contains("Booking status: CANCELLED").contains("in cash").contains("For: cancelling late")
                .contains("Fare: Rs 450.00").contains("Paid to the driver: Rs 225.00");
    }

    @Test
    void thereIsNoReceiptUntilTheDriverSaysTheyWerePaid() {
        long rideId = ride(Duration.ofMinutes(30));
        long bookingId = bookings.request(passenger, rideId, 0, 1, 1, null).id();
        trips.start(driver, rideId);
        trips.complete(driver, rideId);

        assertThatThrownBy(() -> receipts.booking(passenger, bookingId))
                .isInstanceOfSatisfying(ResponseStatusException.class,
                        e -> assertThat(e.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND));
    }

    @Test
    void nobodyGetsAnotherPersonsReceipt() {
        long bookingId = paid(passenger, 1, Method.CASH);
        long stranger = user(UserRole.PASSENGER, "Stranger");

        for (Runnable attempt : List.<Runnable>of(() -> receipts.forBooking(stranger, bookingId),
                () -> receipts.forBooking(passenger, Long.MAX_VALUE))) {
            assertThatThrownBy(attempt::run).isInstanceOfSatisfying(ResponseStatusException.class,
                    e -> assertThat(e.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND));
        }
    }

    @Test
    void textTheFontsCannotDrawIsReplacedNotDropped() throws IOException {
        assertThat(ReceiptService.latin("आशा Patil ₹")).isEqualTo("??? Patil ?");
        assertThat(ReceiptService.runs("Passenger: आशा पाटील, Pune")).containsExactly(
                new ReceiptService.Run("Passenger: ", null),
                new ReceiptService.Run("आशा पाटील", "Devanagari"),
                new ReceiptService.Run(", Pune", null));
        // Really drawn: the same line has more on the page with a name in it than without.
        assertThat(ink(ReceiptService.pdf(List.of("Receipt", "Passenger: आशा पाटील"))))
                .isGreaterThan(ink(ReceiptService.pdf(List.of("Receipt", "Passenger: "))));
        // Really shaped: a repha joins the letter after it, and is not a letter of its own, as
        // three characters drawn one by one would be.
        assertThat(ReceiptService.shaped("Devanagari", "र्क", 11).getNumGlyphs()).isEqualTo(2);
        // Every main script of India has a font, found by the block its letters are in.
        Map.of("Devanagari", "आशा", "Bengali", "আশা", "Gurmukhi", "ਆਸ਼ਾ", "Gujarati", "આશા", "Oriya", "ଆଶା",
                "Tamil", "ஆஷா", "Telugu", "ఆశా", "Kannada", "ಆಶಾ", "Malayalam", "ആശ").forEach((script, name) -> {
            assertThat(ReceiptService.runs(name)).containsExactly(new ReceiptService.Run(name, script));
            assertThat(ReceiptService.shaped(script, name, 11).getNumGlyphs()).isPositive();
            try {
                assertThat(ink(ReceiptService.pdf(List.of("Receipt", "Passenger: " + name))))
                        .as(script).isGreaterThan(ink(ReceiptService.pdf(List.of("Receipt", "Passenger: "))));
            } catch (IOException e) {
                throw new java.io.UncheckedIOException(e);
            }
        });
    }

    @Test
    void theEndpointsServeAPdfToItsOwnerOnly() throws Exception {
        long bookingId = paid(passenger, 1, Method.CASH);
        String owner = "Bearer " + tokens.issue(passenger, UserRole.PASSENGER);

        byte[] body = mvc.perform(get("/api/v1/bookings/" + bookingId + "/receipt").header("Authorization", owner))
                .andExpect(status().isOk())
                .andExpect(header().string("Content-Type", "application/pdf"))
                .andExpect(header().string("Content-Disposition",
                        "attachment; filename=\"vayora-booking-" + bookingId + ".pdf\""))
                .andReturn().getResponse().getContentAsByteArray();
        assertThat(new String(body, 0, 5)).isEqualTo("%PDF-");

        mvc.perform(get("/api/v1/bookings/" + bookingId + "/receipt")
                        .header("Authorization", "Bearer " + tokens.issue(driver, UserRole.DRIVER)))
                .andExpect(status().isForbidden());
        mvc.perform(get("/api/v1/bookings/" + bookingId + "/receipt")).andExpect(status().isUnauthorized());
    }

    @Test
    void theAppsReceiptIsTheSameFactsInTheirOwnScriptForItsOwnerOnly() throws Exception {
        long devanagari = user(UserRole.PASSENGER, "आशा पाटील");
        long bookingId = paid(devanagari, 2, Method.UPI);

        mvc.perform(get("/api/v1/bookings/" + bookingId + "/receipt-data")
                        .header("Authorization", "Bearer " + tokens.issue(devanagari, UserRole.PASSENGER)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.bookingId").value(bookingId))
                // Kept as written.
                .andExpect(jsonPath("$.passenger").value("आशा पाटील"))
                .andExpect(jsonPath("$.driver").value("Ravi Jadhav"))
                .andExpect(jsonPath("$.fromStop").value("Kolhapur")).andExpect(jsonPath("$.toStop").value("Pune"))
                .andExpect(jsonPath("$.seats").value(2)).andExpect(jsonPath("$.status").value("COMPLETED"))
                .andExpect(jsonPath("$.method").value("UPI"))
                .andExpect(jsonPath("$.fare").value(900.0)).andExpect(jsonPath("$.paid").value(900.0))
                .andExpect(jsonPath("$.reason").value("TRIP_COMPLETED"));
        // Drawn as shapes, so not "???", and not text either.
        assertThat(text(receipts.forBooking(devanagari, bookingId))).contains("Passenger:").doesNotContain("???");
        // A script with no font here still prints, as "?", and does not fail.
        long urdu = user(UserRole.PASSENGER, "آشا Patil");
        long urduBooking = paid(urdu, 1, Method.CASH);
        assertThat(text(receipts.forBooking(urdu, urduBooking))).contains("Passenger: ??? Patil");

        mvc.perform(get("/api/v1/bookings/" + bookingId + "/receipt-data")
                        .header("Authorization", "Bearer " + tokens.issue(passenger, UserRole.PASSENGER)))
                .andExpect(status().isNotFound());
        mvc.perform(get("/api/v1/bookings/" + bookingId + "/receipt-data")
                        .header("Authorization", "Bearer " + tokens.issue(driver, UserRole.DRIVER)))
                .andExpect(status().isForbidden());
    }

    /** A trip that ran and the driver marked paid: its booking. */
    private long paid(long who, int seats, Method method) {
        long rideId = ride(Duration.ofMinutes(30));
        long bookingId = bookings.request(who, rideId, 0, 1, seats, null).id();
        trips.start(driver, rideId);
        trips.complete(driver, rideId);
        bookings.paymentReceived(driver, bookingId, method);
        return bookingId;
    }

    private long ride(Duration untilDeparture) {
        return rides.publish(driver, new PublishRide(vehicleId, Instant.now().plus(untilDeparture), 3, true,
                List.of(new StopInput("Kolhapur", 16.7050, 74.2433, 0),
                        new StopInput("Pune", 18.5204, 73.8567, 270)),
                List.of(new BigDecimal("450.00")))).id();
    }

    /** How many dark pixels the first page draws. */
    private static int ink(byte[] pdf) throws IOException {
        try (PDDocument document = Loader.loadPDF(pdf)) {
            BufferedImage page = new PDFRenderer(document).renderImageWithDPI(0, 72);
            int dark = 0;
            for (int x = 0; x < page.getWidth(); x++) {
                for (int y = 0; y < page.getHeight(); y++) {
                    if ((page.getRGB(x, y) & 0xFF) < 128) {
                        dark++;
                    }
                }
            }
            return dark;
        }
    }

    private static String text(byte[] pdf) throws IOException {
        try (PDDocument document = Loader.loadPDF(pdf)) {
            return new PDFTextStripper().getText(document);
        }
    }

    private long user(UserRole role, String name) {
        return identity.register(UUID.randomUUID() + "@example.test", "correct-horse-battery", name, role).id();
    }
}
