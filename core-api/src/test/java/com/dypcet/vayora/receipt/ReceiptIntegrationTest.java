package com.dypcet.vayora.receipt;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.dypcet.vayora.PostgresIntegrationTest;
import com.dypcet.vayora.booking.BookingService;
import com.dypcet.vayora.identity.IdentityService;
import com.dypcet.vayora.identity.TokenService;
import com.dypcet.vayora.identity.UserRole;
import com.dypcet.vayora.pass.PassProperties.Kind;
import com.dypcet.vayora.pass.PassService;
import com.dypcet.vayora.payment.PaymentChoice;
import com.dypcet.vayora.receipt.ReceiptService.PassReceipt;
import com.dypcet.vayora.referral.ReferralService;
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
    private PassService passes;

    @Autowired
    private ReceiptService receipts;

    @Autowired
    private ReferralService referrals;

    @Autowired
    private TokenService tokens;

    @Autowired
    private MockMvc mvc;

    private long driver;
    private long passenger;
    private long rideId;

    @BeforeEach
    void setUp() {
        driver = user(UserRole.DRIVER, "Ravi Jadhav");
        passenger = user(UserRole.PASSENGER, "Asha Patil");
        long vehicleId = vehicles.create(driver, "Maruti", "Ertiga", 2022, "Silver", 7).id();
        rideId = rides.publish(driver, new PublishRide(vehicleId, Instant.now().plus(Duration.ofDays(3)), 3, true,
                List.of(new StopInput("Kolhapur", 16.7050, 74.2433, 0),
                        new StopInput("Pune", 18.5204, 73.8567, 270)),
                List.of(new BigDecimal("450.00")))).id();
    }

    @Test
    void aBookingReceiptSaysWhatWasPaidAndThatNoMoneyMoved() throws IOException {
        long bookingId = bookings.request(passenger, rideId, 0, 1, 2, PaymentChoice.card(), null).id();

        String text = text(receipts.forBooking(passenger, bookingId));

        assertThat(text).contains("Receipt for booking " + bookingId)
                .contains("Passenger: Asha Patil").contains("Driver: Ravi Jadhav")
                .contains("Trip: Kolhapur to Pune, 2 seats")
                .contains("Fare: Rs 900.00").contains("Service fee: Rs 90.00").contains("Total: Rs 990.00")
                .contains("by CARD").contains("Payment provider: MOCK")
                .contains("SIMULATED PAYMENT: no money was taken or paid")
                .contains("This is not a tax invoice")
                .doesNotContain("Refunded");
    }

    @Test
    void aReceiptAfterACancellationShowsWhatCameBack() throws IOException {
        long bookingId = bookings.request(passenger, rideId, 0, 1, 1, PaymentChoice.card(), null).id();
        bookings.cancel(passenger, bookingId);

        // Three days ahead: the whole fare comes back, the fee does not.
        assertThat(text(receipts.forBooking(passenger, bookingId)))
                .contains("Booking status: CANCELLED").contains("Refunded: Rs 450.00 (passenger cancelled)");
    }

    @Test
    void aPassReceiptSaysWhatThePassCovers() throws IOException {
        long passId = passes.buy(passenger, Kind.MONTHLY, PaymentChoice.card()).id();

        assertThat(text(receipts.forPass(passenger, passId)))
                .contains("Receipt for travel pass " + passId).contains("Pass: monthly")
                .contains("Total: Rs 299.00").contains("No service fee is charged")
                .contains("SIMULATED PAYMENT");
    }

    @Test
    void nobodyGetsAnotherPersonsReceipt() {
        long bookingId = bookings.request(passenger, rideId, 0, 1, 1, PaymentChoice.card(), null).id();
        long passId = passes.buy(passenger, Kind.WEEKLY, PaymentChoice.card()).id();
        long stranger = user(UserRole.PASSENGER, "Stranger");

        for (Runnable attempt : List.<Runnable>of(() -> receipts.forBooking(stranger, bookingId),
                () -> receipts.forPass(stranger, passId), () -> receipts.forBooking(passenger, Long.MAX_VALUE))) {
            assertThatThrownBy(attempt::run).isInstanceOfSatisfying(ResponseStatusException.class,
                    e -> assertThat(e.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND));
        }
    }

    @Test
    void textTheFontsCannotDrawIsReplacedNotDropped() throws IOException {
        assertThat(ReceiptService.latin("आशा Patil ₹")).isEqualTo("??? Patil ?");
        assertThat(ReceiptService.runs("Passenger: आशा पाटील, Pune")).containsExactly(
                new ReceiptService.Run("Passenger: ", false),
                new ReceiptService.Run("आशा पाटील", true),
                new ReceiptService.Run(", Pune", false));
        // Really drawn: the same line has more on the page with a name in it than without.
        assertThat(ink(ReceiptService.pdf(List.of("Receipt", "Passenger: आशा पाटील"))))
                .isGreaterThan(ink(ReceiptService.pdf(List.of("Receipt", "Passenger: "))));
        // Really shaped: a repha joins the letter after it, and is not a letter of its own, as
        // three characters drawn one by one would be.
        assertThat(ReceiptService.shaped("र्क", 11).getNumGlyphs()).isEqualTo(2);
    }

    @Test
    void theEndpointsServeAPdfToItsOwnerOnly() throws Exception {
        long bookingId = bookings.request(passenger, rideId, 0, 1, 1, PaymentChoice.card(), null).id();
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
        long bookingId = bookings.request(devanagari, rideId, 0, 1, 2, PaymentChoice.card(), null).id();
        bookings.cancel(devanagari, bookingId);

        mvc.perform(get("/api/v1/bookings/" + bookingId + "/receipt-data")
                        .header("Authorization", "Bearer " + tokens.issue(devanagari, UserRole.PASSENGER)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.bookingId").value(bookingId))
                // Kept as written.
                .andExpect(jsonPath("$.passenger").value("आशा पाटील"))
                .andExpect(jsonPath("$.driver").value("Ravi Jadhav"))
                .andExpect(jsonPath("$.fromStop").value("Kolhapur")).andExpect(jsonPath("$.toStop").value("Pune"))
                .andExpect(jsonPath("$.seats").value(2)).andExpect(jsonPath("$.status").value("CANCELLED"))
                .andExpect(jsonPath("$.method").value("CARD")).andExpect(jsonPath("$.provider").value("MOCK"))
                .andExpect(jsonPath("$.fare").value(900.0)).andExpect(jsonPath("$.serviceFee").value(90.0))
                .andExpect(jsonPath("$.total").value(990.0))
                .andExpect(jsonPath("$.refunded").value(900.0))
                .andExpect(jsonPath("$.refundReason").value("PASSENGER_CANCELLED"));
        // Drawn as shapes, so not "???", and not text either.
        assertThat(text(receipts.forBooking(devanagari, bookingId))).contains("Passenger:").doesNotContain("???");
        // A script with no font here still prints, as "?", and does not fail.
        long tamil = user(UserRole.PASSENGER, "ஆஷா Patil");
        long tamilBooking = bookings.request(tamil, rideId, 0, 1, 1, PaymentChoice.card(), null).id();
        assertThat(text(receipts.forBooking(tamil, tamilBooking))).contains("Passenger: ??? Patil");

        mvc.perform(get("/api/v1/bookings/" + bookingId + "/receipt-data")
                        .header("Authorization", "Bearer " + tokens.issue(passenger, UserRole.PASSENGER)))
                .andExpect(status().isNotFound());
        mvc.perform(get("/api/v1/bookings/" + bookingId + "/receipt-data")
                        .header("Authorization", "Bearer " + tokens.issue(driver, UserRole.DRIVER)))
                .andExpect(status().isForbidden());
    }

    @Test
    void aPassReceiptSaysWhatWasPaidOrThatItWasAReward() throws Exception {
        long bought = passes.buy(passenger, Kind.MONTHLY, PaymentChoice.card()).id();
        long invited = user(UserRole.PASSENGER, "Invited");
        referrals.recordSignUp(passenger, invited);
        passes.reward(passenger, Kind.WEEKLY, invited);
        long reward = passes.of(passenger).stream().filter(p -> p.reward()).findFirst().orElseThrow().id();

        mvc.perform(get("/api/v1/passes/" + bought + "/receipt-data")
                        .header("Authorization", "Bearer " + tokens.issue(passenger, UserRole.PASSENGER)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.passId").value(bought)).andExpect(jsonPath("$.passenger").value("Asha Patil"))
                .andExpect(jsonPath("$.kind").value("MONTHLY")).andExpect(jsonPath("$.price").value(299.0))
                .andExpect(jsonPath("$.method").value("CARD")).andExpect(jsonPath("$.provider").value("MOCK"))
                .andExpect(jsonPath("$.reward").value(false));

        PassReceipt free = receipts.pass(passenger, reward);
        assertThat(free.reward()).isTrue();
        assertThat(free.method()).isNull();
        assertThat(free.price()).isEqualByComparingTo("0");
        // It starts when the bought one ends.
        assertThat(free.startsAt()).isEqualTo(receipts.pass(passenger, bought).endsAt());
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
