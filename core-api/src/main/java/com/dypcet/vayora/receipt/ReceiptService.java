package com.dypcet.vayora.receipt;

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
        return pdf(lines(booking(passengerId, bookingId)));
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

    private static List<String> lines(BookingReceipt receipt) {
        return List.of(
                "Receipt for booking " + receipt.bookingId(),
                "",
                "Passenger: " + receipt.passenger(),
                "Driver: " + receipt.driver(),
                "Trip: " + receipt.fromStop() + " to " + receipt.toStop()
                        + ", " + receipt.seats() + (receipt.seats() == 1 ? " seat" : " seats"),
                "Boarding: " + when(receipt.boarding()),
                "Booking status: " + receipt.status(),
                "",
                "Paid: " + when(receipt.paidAt()) + (receipt.method().equals("CASH") ? " in cash" : " by UPI"),
                "For: " + switch (receipt.reason()) {
                    case "PASSENGER_NO_SHOW" -> "a seat not taken up";
                    case "PASSENGER_CANCELLED" -> "cancelling late";
                    default -> "the trip";
                },
                "Fare: " + rupees(receipt.fare()),
                "Paid to the driver: " + rupees(receipt.paid()),
                "",
                "Paid directly to the driver, as the driver recorded it. VAYORA took no part of it and charged nothing.",
                "This is not a tax invoice.",
                "VAYORA, shared rides between cities");
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
