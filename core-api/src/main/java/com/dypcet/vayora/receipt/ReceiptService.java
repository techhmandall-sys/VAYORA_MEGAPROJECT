package com.dypcet.vayora.receipt;

import java.awt.Color;
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
 * Receipts for what a passenger paid their driver: as PDF, and as the same facts for the app to
 * show in the member's own language (feature 50).
 *
 * <p>A receipt states what the records say, and nothing else. The money went directly from the
 * passenger to the driver, so every receipt says that it rests on the driver's word and that
 * VAYORA took no part of it. None is a tax invoice.
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
     * @param method {@code CASH} or {@code UPI}
     * @param paid   what the passenger paid the driver: the fare, or part of it after a late cancellation
     * @param reason why it was owed, as in {@code PaymentService.DueReason}
     */
    public record BookingReceipt(long bookingId, String passenger, String driver, String fromStop, String toStop,
            int seats, Instant boarding, String status, Instant paidAt, String method, BigDecimal fare,
            BigDecimal paid, String reason) {
    }

    private final JdbcTemplate jdbc;

    public ReceiptService(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /** The receipt for what was paid on one of the passenger's bookings, as PDF. */
    public byte[] forBooking(long passengerId, long bookingId) {
        return pdf(booking(passengerId, bookingId));
    }

    /** What the receipt for what was paid on one of the passenger's bookings says. */
    public BookingReceipt booking(long passengerId, long bookingId) {
        List<BookingReceipt> found = jdbc.query("""
                SELECT b.id, u.full_name AS passenger, d.full_name AS driver,
                       s.name AS from_stop, t.name AS to_stop, b.seats, b.status,
                       r.departure_time + make_interval(mins => s.offset_minutes
                                                         + COALESCE(b.pickup_offset_minutes, 0)) AS boarding,
                       p.settled_at, p.method, p.fare, p.amount_due, p.due_reason
                FROM bookings b
                -- There is a receipt once the driver says they were paid, and not before.
                JOIN payment_intents p ON p.booking_id = b.id AND p.status = 'SETTLED'
                JOIN users u ON u.id = b.passenger_id
                JOIN rides r ON r.id = b.ride_id
                JOIN users d ON d.id = r.driver_id
                JOIN ride_stops s ON s.ride_id = b.ride_id AND s.seq = b.from_seq
                JOIN ride_stops t ON t.ride_id = b.ride_id AND t.seq = b.to_seq
                WHERE b.id = ? AND b.passenger_id = ?""",
                (rs, n) -> new BookingReceipt(rs.getLong("id"), rs.getString("passenger"), rs.getString("driver"),
                        rs.getString("from_stop"), rs.getString("to_stop"), rs.getInt("seats"),
                        rs.getObject("boarding", OffsetDateTime.class).toInstant(), rs.getString("status"),
                        rs.getObject("settled_at", OffsetDateTime.class).toInstant(), rs.getString("method"),
                        rs.getBigDecimal("fare"), rs.getBigDecimal("amount_due"), rs.getString("due_reason")),
                bookingId, passengerId);
        // A booking with nothing paid, or someone else's, looks the same as none at all.
        return found.stream().findFirst().orElseThrow(() -> new ResponseStatusException(
                HttpStatus.NOT_FOUND, "No receipt for that booking"));
    }

    // The app's colours, so a printed receipt looks like the rest of VAYORA.
    private static final Color NAVY = new Color(0x10213A);
    private static final Color GREEN = new Color(0x16865A);
    private static final Color SOFT_GREEN = new Color(0xE6F4EC);
    private static final Color PALE_GREEN = new Color(0xA0D6BA);
    private static final Color INK = new Color(0x25364A);
    private static final Color MUTED = new Color(0x5F6E84);
    private static final Color HEADER_MUTED = new Color(0xCBD3DE);
    private static final Color LINE = new Color(0xE2E7EE);
    private static final Color PANEL = new Color(0xF8FAFC);
    private static final Color TABLE_HEAD = new Color(0xEEF2F6);
    private static final Color NOTE_FILL = new Color(0xFFF8E6);
    private static final Color NOTE_LINE = new Color(0xFDDC96);
    private static final Color NOTE_INK = new Color(0x783806);
    private static final float MARGIN = 48;

    /**
     * The receipt laid out as a bill: VAYORA's header, who paid whom, the trip, what was paid and
     * how, and the note that says on whose word it rests. Every fact is the record's; only the layout
     * is the bill's.
     */
    static byte[] pdf(BookingReceipt receipt) {
        try (PDDocument document = new PDDocument(); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            PDPage page = new PDPage(PDRectangle.A4);
            document.addPage(page);
            PDType1Font regular = new PDType1Font(Standard14Fonts.FontName.HELVETICA);
            PDType1Font bold = new PDType1Font(Standard14Fonts.FontName.HELVETICA_BOLD);
            float pageWidth = PDRectangle.A4.getWidth();
            float top = PDRectangle.A4.getHeight();
            float left = MARGIN;
            float right = pageWidth - MARGIN;
            float width = right - left;
            String title = "Receipt for booking " + receipt.bookingId();
            String seats = receipt.seats() + (receipt.seats() == 1 ? " seat" : " seats");
            boolean cash = receipt.method().equals("CASH");
            try (PDPageContentStream c = new PDPageContentStream(document, page)) {
                // The header: VAYORA on the left, what this is on the right.
                c.setNonStrokingColor(NAVY);
                c.addRect(0, top - 118, pageWidth, 118);
                c.fill();
                logo(c, left, top - 86);
                tracked(c, "VAYORA", bold, 22, Color.WHITE, 1.2f, left + 54, top - 63);
                text(c, "Shared rides between cities", regular, 9.5f, PALE_GREEN, left + 54, top - 79);
                tracked(c, "RECEIPT", bold, 20, Color.WHITE, 3, right - trackedWidth("RECEIPT", bold, 20, 3), top - 61);
                textRight(c, title, regular, 10, HEADER_MUTED, right, top - 79);

                // Paid, and how; where the booking stands.
                String badge = cash ? "PAID IN CASH" : "PAID BY UPI";
                float badgeWidth = trackedWidth(badge, bold, 9, 0.6f) + 26;
                c.setNonStrokingColor(GREEN);
                roundRect(c, left, top - 158, badgeWidth, 22, 11);
                c.fill();
                tracked(c, badge, bold, 9, Color.WHITE, 0.6f, left + 13, top - 150);
                text(c, "Booking status: " + statusText(receipt.status()), regular, 10, MUTED, left + badgeWidth + 12, top - 150);

                // Who paid, and whom.
                float partiesTop = top - 176;
                float cardWidth = (width - 14) / 2;
                party(c, regular, bold, "PASSENGER", receipt.passenger(), "Paid for " + seats, left, partiesTop, cardWidth);
                party(c, regular, bold, "DRIVER", receipt.driver(), "Received the payment directly",
                        left + cardWidth + 14, partiesTop, cardWidth);

                // The trip, stop to stop.
                tracked(c, "TRIP", bold, 8, MUTED, 1, left, partiesTop - 64 - 24);
                float tripTop = partiesTop - 64 - 32;
                c.setNonStrokingColor(SOFT_GREEN);
                roundRect(c, left, tripTop - 86, width, 86, 10);
                c.fill();
                float nameRoom = width / 2 - 28;
                text(c, receipt.fromStop(), bold, fit(receipt.fromStop(), bold, 14, nameRoom), INK, left + 16, tripTop - 28);
                textRight(c, receipt.toStop(), bold, fit(receipt.toStop(), bold, 14, nameRoom), INK, right - 16, tripTop - 28);
                float routeY = tripTop - 44;
                c.setStrokingColor(GREEN);
                c.setLineWidth(1.6f);
                c.setLineDashPattern(new float[] {4, 4}, 0);
                c.moveTo(left + 30, routeY);
                c.lineTo(right - 30, routeY);
                c.stroke();
                c.setLineDashPattern(new float[] {}, 0);
                dot(c, left + 22, routeY, 5, GREEN, null);
                dot(c, right - 22, routeY, 5, Color.WHITE, GREEN);
                text(c, "Boarding: " + when(receipt.boarding()), regular, 9.5f, INK, left + 16, tripTop - 68);
                textRight(c, seats, regular, 9.5f, INK, right - 16, tripTop - 68);

                // What was paid for.
                float tableTop = tripTop - 86 - 22;
                float fareX = right - 120;
                float paidX = right - 12;
                c.setNonStrokingColor(TABLE_HEAD);
                roundRect(c, left, tableTop - 24, width, 24, 6);
                c.fill();
                tracked(c, "DESCRIPTION", bold, 8, MUTED, 0.6f, left + 12, tableTop - 15);
                tracked(c, "FARE", bold, 8, MUTED, 0.6f, fareX - trackedWidth("FARE", bold, 8, 0.6f), tableTop - 15);
                tracked(c, "PAID", bold, 8, MUTED, 0.6f, paidX - trackedWidth("PAID", bold, 8, 0.6f), tableTop - 15);
                float rowY = tableTop - 44;
                String item = itemName(receipt.reason()) + ", " + receipt.fromStop() + " to " + receipt.toStop() + ", " + seats;
                // Long stop names take a second line rather than running into the fare.
                float itemRoom = fareX - 80 - (left + 12);
                List<String> itemLines = wrap(item, regular, 10.5f, itemRoom);
                if (itemLines.size() > 2) {
                    itemLines = List.of(item);
                }
                for (int i = 0; i < itemLines.size(); i++) {
                    String part = itemLines.get(i);
                    text(c, part, regular, fit(part, regular, 10.5f, itemRoom), INK, left + 12, rowY - i * 13);
                }
                float rowBottom = rowY - (itemLines.size() - 1) * 13;
                text(c, itemNote(receipt.reason()), regular, 8.5f, MUTED, left + 12, rowBottom - 13);
                textRight(c, rupees(receipt.fare()), regular, 10.5f, INK, fareX, rowY);
                textRight(c, rupees(receipt.paid()), bold, 10.5f, INK, paidX, rowY);
                rule(c, left, rowBottom - 24, right);
                text(c, "Charged by VAYORA", regular, 10, MUTED, right - 230, rowBottom - 44);
                textRight(c, rupees(BigDecimal.ZERO), regular, 10, INK, paidX, rowBottom - 44);

                // The total.
                float totalTop = rowBottom - 58;
                c.setNonStrokingColor(NAVY);
                roundRect(c, left, totalTop - 44, width, 44, 8);
                c.fill();
                text(c, "Total paid to the driver", bold, 11.5f, Color.WHITE, left + 16, totalTop - 27);
                textRight(c, rupees(receipt.paid()), bold, 18, Color.WHITE, right - 16, totalTop - 27);

                // How it was paid.
                float paymentTop = totalTop - 44 - 30;
                tracked(c, "PAYMENT", bold, 8, MUTED, 1, left, paymentTop);
                String[][] details = {
                    {"Method", cash ? "Cash, handed to the driver" : "UPI, sent to the driver"},
                    {"Paid", when(receipt.paidAt()) + (cash ? " in cash" : " by UPI")},
                    {"Recorded by", "The driver"},
                };
                for (int i = 0; i < details.length; i++) {
                    float y = paymentTop - 20 - i * 17;
                    text(c, details[i][0], regular, 9.5f, MUTED, left, y);
                    text(c, details[i][1], regular, 9.5f, INK, left + 110, y);
                }

                // On whose word it rests.
                List<String> note = wrap("Paid directly to the driver, as the driver recorded it. VAYORA took no part of it"
                        + " and charged nothing.", regular, 9, width - 32);
                float noteTop = paymentTop - 20 - details.length * 17 - 4;
                float noteHeight = 22 + 13 * note.size() + 4;
                c.setNonStrokingColor(NOTE_FILL);
                c.setStrokingColor(NOTE_LINE);
                c.setLineWidth(0.8f);
                roundRect(c, left, noteTop - noteHeight, width, noteHeight, 8);
                c.fillAndStroke();
                for (int i = 0; i < note.size(); i++) {
                    text(c, note.get(i), regular, 9, NOTE_INK, left + 16, noteTop - 17 - i * 13);
                }
                text(c, "This is not a tax invoice.", bold, 9, NOTE_INK, left + 16, noteTop - 17 - note.size() * 13);

                // Footer.
                rule(c, left, MARGIN + 14, right);
                text(c, "VAYORA, shared rides between cities", regular, 8, MUTED, left, MARGIN);
                textRight(c, "Times are India Standard Time", regular, 8, MUTED, right, MARGIN);
            }
            document.getDocumentInformation().setTitle(latin(title));
            document.save(out);
            return out.toByteArray();
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    private static String statusText(String status) {
        return switch (status) {
            case "COMPLETED" -> "Completed";
            case "CANCELLED" -> "Cancelled by the passenger";
            case "DRIVER_CANCELLED" -> "Cancelled by the driver";
            case "NO_SHOW", "PASSENGER_NO_SHOW" -> "Passenger did not board";
            default -> status.charAt(0) + status.substring(1).toLowerCase(Locale.ROOT).replace('_', ' ');
        };
    }

    private static String itemName(String reason) {
        return switch (reason) {
            case "PASSENGER_NO_SHOW" -> "Seat not taken up";
            case "PASSENGER_CANCELLED" -> "Late cancellation";
            default -> "Shared ride";
        };
    }

    private static String itemNote(String reason) {
        return switch (reason) {
            case "PASSENGER_NO_SHOW" -> "Owed because the seat was held and not taken up";
            case "PASSENGER_CANCELLED" -> "Owed for cancelling late, under the cancellation rule";
            default -> "Paid after the ride";
        };
    }

    /** A card naming one side of the payment: a label, the name, and a line under it. */
    private static void party(PDPageContentStream c, PDType1Font regular, PDType1Font bold, String label, String name,
            String under, float x, float top, float width) throws IOException {
        c.setNonStrokingColor(PANEL);
        c.setStrokingColor(LINE);
        c.setLineWidth(0.8f);
        roundRect(c, x, top - 64, width, 64, 8);
        c.fillAndStroke();
        tracked(c, label, bold, 8, GREEN, 1, x + 16, top - 20);
        text(c, name, bold, fit(name, bold, 13, width - 32), INK, x + 16, top - 39);
        text(c, under, regular, 9, MUTED, x + 16, top - 54);
    }

    /** VAYORA's mark: a route between two points, white on green. {@code y} is its bottom edge. */
    private static void logo(PDPageContentStream c, float x, float y) throws IOException {
        c.setNonStrokingColor(GREEN);
        roundRect(c, x, y, 40, 40, 10);
        c.fill();
        c.setStrokingColor(Color.WHITE);
        c.setLineWidth(3.4f);
        c.setLineCapStyle(1);
        c.moveTo(x + 11, y + 10.5f);
        c.curveTo(x + 20, y + 10.5f, x + 21, y + 27.4f, x + 30, y + 29.5f);
        c.stroke();
        c.setLineCapStyle(0);
        dot(c, x + 11, y + 10.5f, 2.8f, Color.WHITE, null);
        dot(c, x + 30, y + 29.5f, 2.8f, Color.WHITE, null);
    }

    private static void roundRect(PDPageContentStream c, float x, float y, float w, float h, float r) throws IOException {
        float k = 0.5523f * r;
        c.moveTo(x + r, y);
        c.lineTo(x + w - r, y);
        c.curveTo(x + w - r + k, y, x + w, y + r - k, x + w, y + r);
        c.lineTo(x + w, y + h - r);
        c.curveTo(x + w, y + h - r + k, x + w - r + k, y + h, x + w - r, y + h);
        c.lineTo(x + r, y + h);
        c.curveTo(x + r - k, y + h, x, y + h - r + k, x, y + h - r);
        c.lineTo(x, y + r);
        c.curveTo(x, y + r - k, x + r - k, y, x + r, y);
        c.closePath();
    }

    /** A filled circle, ringed when {@code ring} is given. */
    private static void dot(PDPageContentStream c, float cx, float cy, float r, Color fill, Color ring) throws IOException {
        float k = 0.5523f * r;
        c.setNonStrokingColor(fill);
        c.moveTo(cx + r, cy);
        c.curveTo(cx + r, cy + k, cx + k, cy + r, cx, cy + r);
        c.curveTo(cx - k, cy + r, cx - r, cy + k, cx - r, cy);
        c.curveTo(cx - r, cy - k, cx - k, cy - r, cx, cy - r);
        c.curveTo(cx + k, cy - r, cx + r, cy - k, cx + r, cy);
        c.closePath();
        if (ring == null) {
            c.fill();
        } else {
            c.setStrokingColor(ring);
            c.setLineWidth(2.2f);
            c.fillAndStroke();
        }
    }

    private static void rule(PDPageContentStream c, float from, float y, float to) throws IOException {
        c.setStrokingColor(LINE);
        c.setLineWidth(0.8f);
        c.moveTo(from, y);
        c.lineTo(to, y);
        c.stroke();
    }

    /**
     * Text in any of the receipt's scripts: Latin in the built-in font, India's main scripts drawn
     * as shaped outlines. Gives the width taken.
     */
    private static float text(PDPageContentStream c, String text, PDType1Font font, float size, Color color, float x,
            float y) throws IOException {
        c.setNonStrokingColor(color);
        float dx = 0;
        for (Run run : runs(text)) {
            dx += canShape(run) ? drawShaped(c, run, size, x + dx, y) : write(c, font, size, latin(run.text()), x + dx, y);
        }
        return dx;
    }

    private static void textRight(PDPageContentStream c, String text, PDType1Font font, float size, Color color,
            float right, float y) throws IOException {
        text(c, text, font, size, color, right - width(text, font, size), y);
    }

    static float width(String text, PDType1Font font, float size) throws IOException {
        float total = 0;
        for (Run run : runs(text)) {
            total += canShape(run)
                    ? (float) shaped(run.script(), run.text(), size).getLogicalBounds().getWidth()
                    : font.getStringWidth(latin(run.text())) / 1000 * size;
        }
        return total;
    }

    /** The largest size up to {@code size}, and no smaller than 8, at which the text fits. */
    private static float fit(String text, PDType1Font font, float size, float room) throws IOException {
        float fitted = size;
        while (fitted > 8 && width(text, font, fitted) > room) {
            fitted -= 0.5f;
        }
        return fitted;
    }

    /** Words laid into lines no wider than {@code room}. */
    private static List<String> wrap(String text, PDType1Font font, float size, float room) throws IOException {
        List<String> lines = new ArrayList<>();
        StringBuilder line = new StringBuilder();
        for (String word : text.split(" ")) {
            String tried = line.isEmpty() ? word : line + " " + word;
            if (!line.isEmpty() && width(tried, font, size) > room) {
                lines.add(line.toString());
                line.setLength(0);
                line.append(word);
            } else {
                line.setLength(0);
                line.append(tried);
            }
        }
        if (!line.isEmpty()) {
            lines.add(line.toString());
        }
        return lines;
    }

    /** Latin capitals with space between the letters, for labels. */
    private static void tracked(PDPageContentStream c, String text, PDType1Font font, float size, Color color,
            float tracking, float x, float y) throws IOException {
        c.setNonStrokingColor(color);
        c.beginText();
        c.setFont(font, size);
        c.setCharacterSpacing(tracking);
        c.newLineAtOffset(x, y);
        c.showText(text);
        c.setCharacterSpacing(0);
        c.endText();
    }

    private static float trackedWidth(String text, PDType1Font font, float size, float tracking) throws IOException {
        return font.getStringWidth(text) / 1000 * size + tracking * (text.length() - 1);
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
