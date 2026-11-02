package com.dypcet.vayora.receipt;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.dypcet.vayora.PostgresIntegrationTest;
import com.dypcet.vayora.booking.BookingService;
import com.dypcet.vayora.booking.TripService;
import com.dypcet.vayora.identity.IdentityService;
import com.dypcet.vayora.identity.UserRole;
import com.dypcet.vayora.payment.PaymentChoice;
import com.dypcet.vayora.pass.PassService;
import com.dypcet.vayora.pass.PassProperties.Kind;
import com.dypcet.vayora.receipt.ReceiptService.BookingReceipt;
import com.dypcet.vayora.receipt.TaxInvoices.TaxInvoice;
import com.dypcet.vayora.ride.RideService;
import com.dypcet.vayora.ride.RideService.PublishRide;
import com.dypcet.vayora.ride.RideService.StopInput;
import com.dypcet.vayora.vehicle.VehicleService;
import java.io.IOException;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.Callable;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.text.PDFTextStripper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.TestPropertySource;

/**
 * Feature 50 with a GST registration configured. A made-up GSTIN in the right form, for a
 * business in Maharashtra: nothing here has been to a tax authority.
 */
@TestPropertySource(properties = {
    "vayora.invoice.gstin=27AAAAA0000A1Z5",
    "vayora.invoice.legal-name=Vayora Test Mobility LLP",
    "vayora.invoice.address=Kolhapur 416006, Maharashtra",
})
class TaxInvoiceIntegrationTest extends PostgresIntegrationTest {

    private static final BigDecimal RATE = new BigDecimal("0.18");

    @Autowired
    private ReceiptService receipts;

    @Autowired
    private TaxInvoices invoices;

    @Autowired
    private BookingService bookings;

    @Autowired
    private TripService trips;

    @Autowired
    private PassService passes;

    @Autowired
    private RideService rides;

    @Autowired
    private VehicleService vehicles;

    @Autowired
    private IdentityService identity;

    @Autowired
    private JdbcTemplate jdbc;

    @Autowired
    private Clock clock;

    private long driver;
    private long passenger;
    private long rideId;

    @BeforeEach
    void setUp() {
        driver = user(UserRole.DRIVER);
        passenger = user(UserRole.PASSENGER);
        long vehicle = vehicles.create(driver, "Maruti", "Ertiga", 2022, "Silver", 7).id();
        rideId = rides.publish(driver, new PublishRide(vehicle, Instant.now().plus(Duration.ofDays(3)), 3, true,
                List.of(new StopInput("Kolhapur", 16.7050, 74.2433, 0), new StopInput("Pune", 18.5204, 73.8567, 270)),
                List.of(new BigDecimal("450.00")))).id();
    }

    @Test
    void aRealPaymentGetsAnInvoiceForTheFeeWithTheTaxTakenOutOfItAndTheSameNumberEachTime() throws IOException {
        long booking = paidBooking(2);

        BookingReceipt receipt = receipts.booking(passenger, booking);

        TaxInvoice invoice = receipt.taxInvoice();
        // The fee is Rs 90.00 and stays that: 90 / 1.18 = 76.27, leaving 13.73 of tax.
        assertThat(receipt.serviceFee()).isEqualByComparingTo("90.00");
        assertThat(receipt.total()).isEqualByComparingTo("990.00");
        assertThat(invoice.taxableValue()).isEqualByComparingTo("76.27");
        assertThat(invoice.cgst()).isEqualByComparingTo("6.87");
        assertThat(invoice.sgst()).isEqualByComparingTo("6.86");
        assertThat(invoice.igst()).isEqualByComparingTo("0");
        assertThat(invoice.taxableValue().add(invoice.cgst()).add(invoice.sgst())).isEqualByComparingTo("90.00");
        assertThat(invoice.ratePercent()).isEqualByComparingTo("18");
        assertThat(invoice.gstin()).isEqualTo("27AAAAA0000A1Z5");
        assertThat(invoice.number()).matches("VAY/\\d{4}-\\d{2}/\\d{6}");

        assertThat(receipts.booking(passenger, booking).taxInvoice().number()).isEqualTo(invoice.number());
        assertThat(pdf(receipts.forBooking(passenger, booking)))
                .contains("Tax invoice " + invoice.number())
                .contains("Vayora Test Mobility LLP").contains("GSTIN: 27AAAAA0000A1Z5")
                .contains("Value before tax: Rs 76.27").contains("CGST at 9%: Rs 6.87").contains("SGST at 9%: Rs 6.86")
                .contains("The fare is collected for the driver and is not part of this tax invoice")
                .doesNotContain("This is not a tax invoice");
    }

    @Test
    void numbersRunOnWithoutAGapEvenWhenTheSameInvoiceIsAskedForTwiceAtOnce() throws Exception {
        long booking = paidBooking(1);
        int before = lastSerial();

        List<Callable<String>> viewers = new ArrayList<>();
        for (int i = 0; i < 6; i++) {
            viewers.add(() -> receipts.booking(passenger, booking).taxInvoice().number());
        }
        ExecutorService pool = Executors.newFixedThreadPool(6);
        List<String> numbers = new ArrayList<>();
        for (Future<String> viewer : pool.invokeAll(viewers)) {
            numbers.add(viewer.get());
        }
        pool.shutdown();

        assertThat(numbers).containsOnly(numbers.get(0));
        assertThat(lastSerial()).isEqualTo(before + 1);

        long other = user(UserRole.PASSENGER);
        receipts.booking(other, paidBooking(1, other));
        assertThat(lastSerial()).isEqualTo(before + 2);
    }

    @Test
    void noInvoiceWithoutRealMoneyOrOnceTheFeeHasGoneBack() throws IOException {
        // Simulated: no money moved, so nothing was supplied for a price.
        long simulated = bookings.request(passenger, rideId, 0, 1, 1, PaymentChoice.card(), null).id();
        assertThat(receipts.booking(passenger, simulated).taxInvoice()).isNull();
        assertThat(pdf(receipts.forBooking(passenger, simulated))).contains("This is not a tax invoice");

        // Test mode moves nothing either.
        jdbc.update("UPDATE payment_intents SET provider = 'RAZORPAY_TEST' WHERE booking_id = ?", simulated);
        assertThat(receipts.booking(passenger, simulated).taxInvoice()).isNull();

        // Everything came back before anyone asked: the fee was not earned, so nothing to invoice.
        long other = user(UserRole.PASSENGER);
        long refunded = bookings.request(other, rideId, 0, 1, 1, PaymentChoice.card(), null).id();
        trips.cancel(driver, rideId);
        jdbc.update("UPDATE payment_intents SET provider = 'RAZORPAY' WHERE booking_id = ?", refunded);
        BookingReceipt receipt = receipts.booking(other, refunded);
        assertThat(receipt.taxInvoice()).isNull();
        assertThat(receipt.creditNote()).isNull();
    }

    @Test
    void aFeeKeptWhenOnlyTheFareCameBackIsStillInvoicedAndNeedsNoCreditNote() {
        long booking = bookings.request(passenger, rideId, 0, 1, 1, PaymentChoice.card(), null).id();
        bookings.cancel(passenger, booking);
        jdbc.update("UPDATE payment_intents SET provider = 'RAZORPAY' WHERE booking_id = ?", booking);

        BookingReceipt receipt = receipts.booking(passenger, booking);

        assertThat(receipt.refunded()).isEqualByComparingTo("450.00");
        assertThat(receipt.taxInvoice()).isNotNull();
        assertThat(receipt.creditNote()).isNull();
    }

    @Test
    void aFeeReturnedAfterItWasInvoicedIsReversedByACreditNoteWithItsOwnNumbers() throws IOException {
        long booking = paidBooking(1);
        TaxInvoice invoice = receipts.booking(passenger, booking).taxInvoice();
        long other = user(UserRole.PASSENGER);
        long second = paidBooking(1, other);
        receipts.booking(other, second);
        int notesBefore = lastNote();
        // Simulated for the refund, so it goes nowhere near Razorpay.
        jdbc.update("UPDATE payment_intents SET provider = 'MOCK' WHERE booking_id IN (?, ?)", booking, second);

        trips.cancel(driver, rideId); // the driver withdraws: everything comes back, the fee too

        BookingReceipt receipt = receipts.booking(passenger, booking);
        assertThat(receipt.taxInvoice().number()).isEqualTo(invoice.number()); // it stands, reversed
        TaxInvoices.CreditNote note = receipt.creditNote();
        assertThat(note.invoiceNumber()).isEqualTo(invoice.number());
        assertThat(note.number()).startsWith("VAY-CN/");
        assertThat(note.taxableValue()).isEqualByComparingTo(invoice.taxableValue());
        assertThat(note.cgst()).isEqualByComparingTo(invoice.cgst());
        assertThat(note.sgst()).isEqualByComparingTo(invoice.sgst());
        assertThat(note.igst()).isEqualByComparingTo(invoice.igst());
        // Without a gap: the two notes took the next two numbers, whichever went first.
        assertThat(lastNote()).isEqualTo(notesBefore + 2);
        assertThat(receipts.booking(other, second).creditNote().number()).isNotEqualTo(note.number());
        assertThat(pdf(receipts.forBooking(passenger, booking)))
                .contains("Credit note " + note.number()).contains("Against tax invoice " + invoice.number());

        assertThatThrownBy(() -> jdbc.update("UPDATE tax_credit_notes SET cgst = 0 WHERE number = ?", note.number()))
                .hasMessageContaining("cannot be changed once issued");
        assertThatThrownBy(() -> jdbc.update("DELETE FROM tax_credit_notes WHERE number = ?", note.number()))
                .hasMessageContaining("cannot be changed once issued");
    }

    @Test
    void anInvoiceAlreadyIssuedStaysWhateverHappensAfterAndCannotBeRewritten() {
        long booking = paidBooking(1);
        String number = receipts.booking(passenger, booking).taxInvoice().number();

        // Simulated for the cancelling, so the refund goes nowhere near Razorpay.
        jdbc.update("UPDATE payment_intents SET provider = 'MOCK' WHERE booking_id = ?", booking);
        bookings.cancel(passenger, booking);
        assertThat(receipts.booking(passenger, booking).taxInvoice().number()).isEqualTo(number);

        assertThatThrownBy(() -> jdbc.update("UPDATE tax_invoices SET cgst = 0 WHERE number = ?", number))
                .hasMessageContaining("cannot be changed once issued");
        assertThatThrownBy(() -> jdbc.update("DELETE FROM tax_invoices WHERE number = ?", number))
                .hasMessageContaining("cannot be changed once issued");
    }

    @Test
    void aPassIsInvoicedForItsWholePriceUnlessItWasAReward() {
        long passId = passes.buy(passenger, Kind.MONTHLY, PaymentChoice.card()).id();
        jdbc.update("UPDATE passes SET provider = 'RAZORPAY' WHERE id = ?", passId);
        BigDecimal price = jdbc.queryForObject("SELECT price FROM passes WHERE id = ?", BigDecimal.class, passId);

        TaxInvoice invoice = receipts.pass(passenger, passId).taxInvoice();

        assertThat(invoice.taxableValue().add(invoice.cgst()).add(invoice.sgst())).isEqualByComparingTo(price);
        // A pass waives the fee, so the bookings under it have nothing to invoice.
        long waived = paidBooking(1);
        assertThat(jdbc.queryForObject("SELECT service_fee FROM payment_intents WHERE booking_id = ?", BigDecimal.class, waived))
                .isEqualByComparingTo("0");
        assertThat(receipts.booking(passenger, waived).taxInvoice()).isNull();
    }

    @Test
    void anotherStatesRegistrationChargesIgstAndHalfASettingRefusesToStart() {
        TaxInvoices karnataka = new TaxInvoices(jdbc, clock, "29AAAAA0000A1Z5", "Elsewhere LLP", "Belagavi", RATE, "9985");
        long booking = paidBooking(1);

        TaxInvoice invoice = karnataka.forBooking(booking, new BigDecimal("45.00"), true).orElseThrow();

        assertThat(invoice.igst()).isEqualByComparingTo("6.86");
        assertThat(invoice.cgst()).isEqualByComparingTo("0");
        assertThat(invoice.sgst()).isEqualByComparingTo("0");

        assertThatThrownBy(() -> new TaxInvoices(jdbc, clock, "27AAAAA0000A1Z5", "", "", RATE, "9985"))
                .isInstanceOf(IllegalStateException.class).hasMessageContaining("or none");
        assertThatThrownBy(() -> new TaxInvoices(jdbc, clock, "NOT-A-GSTIN", "Name", "Address", RATE, "9985"))
                .isInstanceOf(IllegalStateException.class).hasMessageContaining("form of a GSTIN");
    }

    @Test
    void withNothingConfiguredNoInvoiceIsIssued() {
        TaxInvoices off = new TaxInvoices(jdbc, clock, "", "", "", RATE, "9985");
        long booking = paidBooking(1);

        assertThat(off.configured()).isFalse();
        assertThat(off.forBooking(booking, new BigDecimal("45.00"), true)).isEmpty();
    }

    @Test
    void theFinancialYearRunsFromApril() {
        assertThat(TaxInvoices.financialYear(LocalDate.of(2026, 3, 31))).isEqualTo("2025-26");
        assertThat(TaxInvoices.financialYear(LocalDate.of(2026, 4, 1))).isEqualTo("2026-27");
        assertThat(TaxInvoices.financialYear(LocalDate.of(2099, 12, 31))).isEqualTo("2099-00");
    }

    private long paidBooking(int seats) {
        return paidBooking(seats, passenger);
    }

    /** A booking as if paid through Razorpay's live mode, which no test may reach. */
    private long paidBooking(int seats, long who) {
        long booking = bookings.request(who, rideId, 0, 1, seats, PaymentChoice.card(), null).id();
        jdbc.update("UPDATE payment_intents SET provider = 'RAZORPAY' WHERE booking_id = ?", booking);
        return booking;
    }

    private int lastNote() {
        String year = TaxInvoices.financialYear(java.time.LocalDate.now(clock.withZone(java.time.ZoneId.of("Asia/Kolkata"))));
        return jdbc.query("SELECT last_serial FROM tax_credit_note_series WHERE financial_year = ?",
                (rs, n) -> rs.getInt(1), year).stream().findFirst().orElse(0);
    }

    private int lastSerial() {
        return jdbc.queryForObject("SELECT COALESCE(MAX(last_serial), 0) FROM tax_invoice_series", Integer.class);
    }

    private long user(UserRole role) {
        return identity.register(UUID.randomUUID() + "@example.test", "correct-horse-battery", "Test " + role, role).id();
    }

    private static String pdf(byte[] bytes) throws IOException {
        try (PDDocument document = Loader.loadPDF(bytes)) {
            return new PDFTextStripper().getText(document);
        }
    }
}
