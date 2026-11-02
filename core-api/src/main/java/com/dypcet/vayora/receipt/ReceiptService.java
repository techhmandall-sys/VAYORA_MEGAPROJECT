package com.dypcet.vayora.receipt;

import com.dypcet.vayora.payment.MockPaymentProvider;
import com.dypcet.vayora.receipt.TaxInvoices.CreditNote;
import com.dypcet.vayora.receipt.TaxInvoices.TaxInvoice;
import com.dypcet.vayora.payment.PaymentService;
import com.dypcet.vayora.payment.RazorpayPaymentProvider;
import java.awt.Font;
import java.awt.FontFormatException;
import java.awt.font.FontRenderContext;
import java.awt.font.GlyphVector;
import java.awt.geom.PathIterator;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDPageContentStream;
import org.apache.pdfbox.pdmodel.common.PDRectangle;
import org.apache.pdfbox.pdmodel.font.PDType1Font;
import org.apache.pdfbox.pdmodel.font.Standard14Fonts;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

/**
 * Receipts for a booking's payment or a pass: as PDF, and as the same facts for the app to
 * show in the member's own language (feature 50).
 *
 * <p>A receipt states what the records say, and nothing else. While the provider is the
 * mock, every receipt says plainly that no money moved. None is a tax invoice unless a GST
 * registration is configured and the money was real (TaxInvoices).
 *
 * <p>The PDF is in English. A name or stop in one of India's main scripts is drawn as shapes, so it
 * reads correctly but cannot be selected; any other script, Urdu's among them, is shown as "?". The
 * app's receipt has no such limit.
 */
@Service
public class ReceiptService {

    private static final ZoneId INDIA_ZONE = ZoneId.of("Asia/Kolkata");
    private static final DateTimeFormatter WHEN =
            DateTimeFormatter.ofPattern("d MMM yyyy, HH:mm 'IST'", Locale.ENGLISH).withZone(INDIA_ZONE);

    /**
     * What a booking's receipt says, as the records say it.
     *
     * @param refunded     0 when nothing came back
     * @param refundReason null when nothing came back
     * @param provider     MOCK means no money moved
     * @param taxInvoice   for the service fee; null when none is due
     * @param creditNote   reversing that invoice, once the fee has gone back; null otherwise
     */
    public record BookingReceipt(long bookingId, String passenger, String driver, String fromStop, String toStop,
            int seats, Instant boarding, String status, Instant paidAt, String method, BigDecimal fare,
            BigDecimal serviceFee, BigDecimal total, BigDecimal refunded, String refundReason, String provider,
            TaxInvoice taxInvoice, CreditNote creditNote) {
    }

    /**
     * What a pass's receipt says.
     *
     * @param paidAt when it was bought, or given if a reward
     * @param method null for a reward: nothing was paid
     * @param reward given free for an invitation
     * @param taxInvoice for the price; null when none is due
     */
    public record PassReceipt(long passId, String passenger, String kind, BigDecimal price, Instant startsAt,
            Instant endsAt, Instant paidAt, String method, String provider, boolean reward, TaxInvoice taxInvoice) {
    }

    private final JdbcTemplate jdbc;
    private final TaxInvoices invoices;

    public ReceiptService(JdbcTemplate jdbc, TaxInvoices invoices) {
        this.jdbc = jdbc;
        this.invoices = invoices;
    }

    /** The receipt for the payment on one of the passenger's bookings, as PDF. */
    public byte[] forBooking(long passengerId, long bookingId) {
        return pdf(lines(booking(passengerId, bookingId)));
    }

    /** The receipt for one of the passenger's passes, as PDF. */
    public byte[] forPass(long passengerId, long passId) {
        return pdf(lines(pass(passengerId, passId)));
    }

    /** What the receipt for the payment on one of the passenger's bookings says. */
    public BookingReceipt booking(long passengerId, long bookingId) {
        List<BookingReceipt> found = jdbc.query("""
                SELECT b.id, u.full_name AS passenger, d.full_name AS driver,
                       s.name AS from_stop, t.name AS to_stop, b.seats, b.status,
                       r.departure_time + make_interval(mins => s.offset_minutes
                                                         + COALESCE(b.pickup_offset_minutes, 0)) AS boarding,
                       p.service_fee, p.method, p.provider,
                       -- Paid after the ride: what was owed, when it was paid.
                       CASE WHEN p.deferred THEN p.amount_due - p.service_fee ELSE p.fare END AS fare,
                       CASE WHEN p.deferred THEN p.amount_due ELSE p.amount END AS amount,
                       CASE WHEN p.deferred THEN p.settled_at ELSE p.created_at END AS created_at,
                       COALESCE(f.amount, 0) AS refunded, f.reason AS refund_reason
                FROM bookings b
                -- A pay-after-ride booking has a receipt once it is paid, and not before.
                JOIN payment_intents p ON p.booking_id = b.id AND (NOT p.deferred OR p.status = 'SETTLED')
                JOIN users u ON u.id = b.passenger_id
                JOIN rides r ON r.id = b.ride_id
                JOIN users d ON d.id = r.driver_id
                JOIN ride_stops s ON s.ride_id = b.ride_id AND s.seq = b.from_seq
                JOIN ride_stops t ON t.ride_id = b.ride_id AND t.seq = b.to_seq
                LEFT JOIN refunds f ON f.booking_id = b.id
                WHERE b.id = ? AND b.passenger_id = ?""",
                (rs, n) -> new BookingReceipt(rs.getLong("id"), rs.getString("passenger"), rs.getString("driver"),
                        rs.getString("from_stop"), rs.getString("to_stop"), rs.getInt("seats"),
                        rs.getObject("boarding", OffsetDateTime.class).toInstant(), rs.getString("status"),
                        rs.getObject("created_at", OffsetDateTime.class).toInstant(), rs.getString("method"),
                        rs.getBigDecimal("fare"), rs.getBigDecimal("service_fee"), rs.getBigDecimal("amount"),
                        rs.getBigDecimal("refunded"), rs.getString("refund_reason"), rs.getString("provider"), null, null),
                bookingId, passengerId);
        // A booking with no payment, or someone else's, looks the same as none at all.
        BookingReceipt r = found.stream().findFirst().orElseThrow(() -> new ResponseStatusException(
                HttpStatus.NOT_FOUND, "No receipt for that booking"));
        // A fee that went back before anyone asked was never earned, so there is nothing to invoice.
        // One kept when only the fare came back was earned, and is.
        boolean due = RazorpayPaymentProvider.NAME.equals(r.provider()) && r.refunded().compareTo(r.fare()) <= 0;
        return new BookingReceipt(r.bookingId(), r.passenger(), r.driver(), r.fromStop(), r.toStop(), r.seats(),
                r.boarding(), r.status(), r.paidAt(), r.method(), r.fare(), r.serviceFee(), r.total(), r.refunded(),
                r.refundReason(), r.provider(), invoices.forBooking(bookingId, r.serviceFee(), due).orElse(null),
                invoices.creditNote(bookingId).orElse(null));
    }

    /** What the receipt for one of the passenger's passes says. */
    public PassReceipt pass(long passengerId, long passId) {
        List<PassReceipt> found = jdbc.query("""
                SELECT p.id, u.full_name AS passenger, p.kind, p.price, p.starts_at, p.ends_at,
                       p.method, p.provider, p.created_at, p.reward_for_referee IS NOT NULL AS reward
                FROM passes p JOIN users u ON u.id = p.passenger_id
                WHERE p.id = ? AND p.passenger_id = ?""",
                (rs, n) -> new PassReceipt(rs.getLong("id"), rs.getString("passenger"), rs.getString("kind"),
                        rs.getBigDecimal("price"), rs.getObject("starts_at", OffsetDateTime.class).toInstant(),
                        rs.getObject("ends_at", OffsetDateTime.class).toInstant(),
                        rs.getObject("created_at", OffsetDateTime.class).toInstant(), rs.getString("method"),
                        rs.getString("provider"), rs.getBoolean("reward"), null),
                passId, passengerId);
        PassReceipt r = found.stream().findFirst().orElseThrow(() -> new ResponseStatusException(
                HttpStatus.NOT_FOUND, "No receipt for that pass"));
        boolean due = !r.reward() && RazorpayPaymentProvider.NAME.equals(r.provider());
        return new PassReceipt(r.passId(), r.passenger(), r.kind(), r.price(), r.startsAt(), r.endsAt(), r.paidAt(),
                r.method(), r.provider(), r.reward(), invoices.forPass(passId, r.price(), due).orElse(null));
    }

    private static List<String> lines(BookingReceipt receipt) {
        List<String> lines = new ArrayList<>(List.of(
                "Receipt for booking " + receipt.bookingId(),
                "",
                "Passenger: " + receipt.passenger(),
                "Driver: " + receipt.driver(),
                "Trip: " + receipt.fromStop() + " to " + receipt.toStop()
                        + ", " + receipt.seats() + (receipt.seats() == 1 ? " seat" : " seats"),
                "Boarding: " + when(receipt.boarding()),
                "Booking status: " + receipt.status(),
                "",
                "Paid: " + when(receipt.paidAt()) + " by " + receipt.method(),
                "Fare: " + rupees(receipt.fare()),
                "Service fee: " + rupees(receipt.serviceFee()),
                "Total: " + rupees(receipt.total())));
        if (receipt.refunded().signum() > 0) {
            lines.add("Refunded: " + rupees(receipt.refunded())
                    + " (" + receipt.refundReason().toLowerCase(Locale.ROOT).replace('_', ' ') + ")");
        }
        if (receipt.taxInvoice() != null) {
            lines.addAll(invoiceLines(receipt.taxInvoice(), "VAYORA service fee"));
            lines.add("The fare is collected for the driver and is not part of this tax invoice.");
        }
        if (receipt.creditNote() != null) {
            lines.addAll(creditNoteLines(receipt.creditNote()));
        }
        lines.addAll(footer(receipt.provider(), receipt.taxInvoice() != null));
        return lines;
    }

    private static List<String> lines(PassReceipt receipt) {
        List<String> lines = new ArrayList<>(List.of(
                "Receipt for travel pass " + receipt.passId(),
                "",
                "Passenger: " + receipt.passenger(),
                "Pass: " + receipt.kind().toLowerCase(Locale.ROOT),
                "Runs from " + when(receipt.startsAt()) + " to " + when(receipt.endsAt()),
                "No service fee is charged on bookings requested while it runs.",
                ""));
        if (receipt.reward()) {
            // Nothing was paid, so there is no provider to name.
            lines.addAll(List.of(
                    "Given free on " + when(receipt.paidAt()) + " as a reward for an invitation. Nothing was paid.",
                    "Total: " + rupees(receipt.price()),
                    "",
                    "This is not a tax invoice.",
                    "VAYORA, shared rides between cities"));
            return lines;
        }
        lines.addAll(List.of(
                "Paid: " + when(receipt.paidAt()) + " by " + receipt.method(),
                "Total: " + rupees(receipt.price())));
        if (receipt.taxInvoice() != null) {
            lines.addAll(invoiceLines(receipt.taxInvoice(), "VAYORA travel pass"));
        }
        lines.addAll(footer(receipt.provider(), receipt.taxInvoice() != null));
        return lines;
    }

    private static List<String> invoiceLines(TaxInvoice invoice, String service) {
        List<String> lines = new ArrayList<>(List.of(
                "",
                "Tax invoice " + invoice.number(),
                "Issued " + when(invoice.issuedAt()) + " by " + invoice.legalName() + ", " + invoice.address(),
                "GSTIN: " + invoice.gstin(),
                "For: " + service + " (SAC " + invoice.sacCode() + ")",
                "Value before tax: " + rupees(invoice.taxableValue())));
        if (invoice.igst().signum() > 0) {
            lines.add("IGST at " + invoice.ratePercent().toPlainString() + "%: " + rupees(invoice.igst()));
        } else {
            String half = invoice.ratePercent().divide(BigDecimal.TWO).stripTrailingZeros().toPlainString();
            lines.add("CGST at " + half + "%: " + rupees(invoice.cgst()));
            lines.add("SGST at " + half + "%: " + rupees(invoice.sgst()));
        }
        return lines;
    }

    private static List<String> creditNoteLines(CreditNote note) {
        List<String> lines = new ArrayList<>(List.of(
                "",
                "Credit note " + note.number(),
                "Issued " + when(note.issuedAt()),
                "Against tax invoice " + note.invoiceNumber() + ": the service fee was returned.",
                "Value before tax returned: " + rupees(note.taxableValue())));
        if (note.igst().signum() > 0) {
            lines.add("IGST returned: " + rupees(note.igst()));
        } else {
            lines.add("CGST returned: " + rupees(note.cgst()));
            lines.add("SGST returned: " + rupees(note.sgst()));
        }
        return lines;
    }

    private static List<String> footer(String provider, boolean invoiced) {
        List<String> lines = new ArrayList<>(List.of("", "Payment provider: " + provider));
        if (MockPaymentProvider.NAME.equals(provider)) {
            lines.add("SIMULATED PAYMENT: no money was taken or paid. This is a student project.");
        } else if (RazorpayPaymentProvider.TEST_NAME.equals(provider)) {
            lines.add("TEST MODE: paid in Razorpay's test mode, where no real money moves. This is a student project.");
        } else if (PaymentService.CASH.equals(provider)) {
            lines.add("PAID IN CASH to the driver after the ride, as the driver recorded it.");
        }
        if (!invoiced) {
            lines.add("This is not a tax invoice.");
        }
        lines.add("VAYORA, shared rides between cities");
        return lines;
    }

    static byte[] pdf(List<String> lines) {
        try (PDDocument document = new PDDocument(); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            PDPage page = new PDPage(PDRectangle.A4);
            document.addPage(page);
            PDType1Font regular = new PDType1Font(Standard14Fonts.FontName.HELVETICA);
            PDType1Font bold = new PDType1Font(Standard14Fonts.FontName.HELVETICA_BOLD);
            try (PDPageContentStream content = new PDPageContentStream(document, page)) {
                float y = PDRectangle.A4.getHeight() - 72;
                for (int i = 0; i < lines.size(); i++) {
                    PDType1Font latin = i == 0 ? bold : regular;
                    float size = i == 0 ? 16 : 11;
                    float x = 56;
                    for (Run run : runs(lines.get(i))) {
                        x += canShape(run)
                                ? drawShaped(content, run, size, x, y)
                                : write(content, latin, size, latin(run.text()), x, y);
                    }
                    y -= 18;
                }
            }
            document.getDocumentInformation().setTitle(latin(lines.get(0)));
            document.save(out);
            return out.toByteArray();
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    private static float write(PDPageContentStream content, PDType1Font font, float size, String text, float x, float y)
            throws IOException {
        content.beginText();
        content.setFont(font, size);
        content.newLineAtOffset(x, y);
        content.showText(text);
        content.endText();
        return font.getStringWidth(text) / 1000 * size;
    }

    /** Each script's font, loaded when a receipt first needs it. Empty if this machine cannot load it. */
    private static final Map<String, Optional<Font>> FONTS = new ConcurrentHashMap<>();

    /**
     * A script's font; if there is none, a name in it prints as "?" rather than the receipt failing.
     * Shaped by Java's own text layout, not PDFBox's, which misplaces a vowel sign beside a repha
     * and would print "कार्तिक" as "कातर्कि": a wrong name on a receipt is worse than none.
     */
    private static Optional<Font> fontFor(String script) {
        return FONTS.computeIfAbsent(script, name -> {
            try (InputStream font = ReceiptService.class.getResourceAsStream("/fonts/NotoSans" + name + "-Regular.ttf")) {
                return Optional.of(Font.createFont(Font.TRUETYPE_FONT, font));
            } catch (IOException | FontFormatException | LinkageError e) {
                return Optional.empty();
            }
        });
    }

    private static boolean canShape(Run run) {
        return run.script() != null
                && fontFor(run.script()).filter(font -> font.canDisplayUpTo(run.text()) == -1).isPresent();
    }

    /** The letters of some text in a script, joined and reordered as the script requires. */
    static GlyphVector shaped(String script, String text, float size) {
        char[] chars = text.toCharArray();
        return fontFor(script).orElseThrow().deriveFont(size).layoutGlyphVector(new FontRenderContext(null, true, true),
                chars, 0, chars.length, Font.LAYOUT_LEFT_TO_RIGHT);
    }

    /** Fills the outline of the shaped letters, turned the way a PDF's page runs. Gives the width taken. */
    private static float drawShaped(PDPageContentStream content, Run run, float size, float x, float y)
            throws IOException {
        GlyphVector glyphs = shaped(run.script(), run.text(), size);
        float[] at = new float[6];
        float lastX = 0;
        float lastY = 0;
        for (PathIterator path = glyphs.getOutline().getPathIterator(null); !path.isDone(); path.next()) {
            int segment = path.currentSegment(at);
            switch (segment) {
                case PathIterator.SEG_MOVETO -> {
                    content.moveTo(x + at[0], y - at[1]);
                    lastX = at[0];
                    lastY = at[1];
                }
                case PathIterator.SEG_LINETO -> {
                    content.lineTo(x + at[0], y - at[1]);
                    lastX = at[0];
                    lastY = at[1];
                }
                case PathIterator.SEG_QUADTO -> {
                    // A PDF has no quadratic curves: the same curve, as a cubic.
                    content.curveTo(x + lastX + 2 * (at[0] - lastX) / 3, y - (lastY + 2 * (at[1] - lastY) / 3),
                            x + at[2] + 2 * (at[0] - at[2]) / 3, y - (at[3] + 2 * (at[1] - at[3]) / 3),
                            x + at[2], y - at[3]);
                    lastX = at[2];
                    lastY = at[3];
                }
                case PathIterator.SEG_CUBICTO -> {
                    content.curveTo(x + at[0], y - at[1], x + at[2], y - at[3], x + at[4], y - at[5]);
                    lastX = at[4];
                    lastY = at[5];
                }
                default -> content.closePath();
            }
        }
        content.fill();
        return (float) glyphs.getLogicalBounds().getWidth();
    }

    /** A stretch of a line drawn one way: in the built-in fonts when {@code script} is null. */
    record Run(String text, String script) {
    }

    /**
     * A line split by how each part is drawn. A space, or a joiner that decides how letters
     * combine, stays with the stretch it falls in.
     */
    static List<Run> runs(String line) {
        List<Run> runs = new ArrayList<>();
        StringBuilder current = new StringBuilder();
        String inScript = null;
        for (int c : line.codePoints().toArray()) {
            String script = c == ' ' || c == 0x200C || c == 0x200D ? inScript : scriptOf(c);
            if (!Objects.equals(script, inScript)) {
                if (current.length() > 0) {
                    runs.add(new Run(current.toString(), inScript));
                    current.setLength(0);
                }
                inScript = script;
            }
            current.appendCodePoint(c);
        }
        if (current.length() > 0) {
            runs.add(new Run(current.toString(), inScript));
        }
        return runs;
    }

    /** Which of India's main scripts a character is in, by its Unicode block; null for any other. */
    private static String scriptOf(int c) {
        if (c < 0x0900 || c > 0x0D7F) {
            return null;
        }
        String[] blocks = {"Devanagari", "Bengali", "Gurmukhi", "Gujarati", "Oriya", "Tamil", "Telugu", "Kannada", "Malayalam"};
        return blocks[(c - 0x0900) / 0x80];
    }

    /** What the built-in fonts can draw: printable ASCII. Anything else becomes "?". */
    static String latin(String text) {
        StringBuilder out = new StringBuilder(text.length());
        text.codePoints().forEach(c -> out.append(c >= 0x20 && c < 0x7F ? (char) c : '?'));
        return out.toString();
    }

    private static String rupees(BigDecimal amount) {
        return "Rs " + amount.setScale(2, java.math.RoundingMode.HALF_UP).toPlainString();
    }

    private static String when(Instant time) {
        return WHEN.format(time);
    }
}
