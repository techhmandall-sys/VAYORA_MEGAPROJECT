package com.dypcet.vayora.payment;

import com.dypcet.vayora.photo.PhotoService;
import java.util.List;
import java.util.Locale;
import java.util.regex.Pattern;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

/**
 * Where a driver takes UPI: an ID, a QR code, or both, from their own account. A passenger pays
 * into these from their own UPI app, so VAYORA neither sees the money nor can confirm it arrived.
 *
 * <p>A passenger is shown them only for their own booking, once it is confirmed or while it owes
 * something: a stranger searching for rides has no need of where a driver is paid.
 */
@Service
public class DriverPaymentDetails {

    /** @param upiId null if the driver has given none */
    public record Details(String upiId, boolean hasQr) {
    }

    /** What a passenger needs to pay a driver. With neither, the driver takes cash. */
    public record HowToPay(String driverName, String upiId, boolean hasQr) {
    }

    /** As name@handle. No dot in the handle, so an email address pasted by mistake is refused. */
    private static final Pattern UPI_ID = Pattern.compile("[a-z0-9._-]{2,256}@[a-z0-9-]{2,64}");

    private final JdbcTemplate jdbc;
    private final PhotoService photos;
    private final int qrMaxSidePixels;

    public DriverPaymentDetails(JdbcTemplate jdbc, PhotoService photos,
            @Value("${vayora.payment.qr-max-side-pixels}") int qrMaxSidePixels) {
        this.jdbc = jdbc;
        this.photos = photos;
        this.qrMaxSidePixels = qrMaxSidePixels;
    }

    public Details of(long driverId) {
        return jdbc.query("SELECT upi_id, qr_png IS NOT NULL AS has_qr FROM driver_payment_details WHERE user_id = ?",
                (rs, n) -> new Details(rs.getString("upi_id"), rs.getBoolean("has_qr")), driverId)
                .stream().findFirst().orElse(new Details(null, false));
    }

    /** @param upiId null or blank removes it */
    @Transactional
    public Details setUpiId(long driverId, String upiId) {
        String id = upiId == null || upiId.isBlank() ? null : upiId.strip().toLowerCase(Locale.ROOT);
        if (id != null && !UPI_ID.matcher(id).matches()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "That does not look like a UPI ID. It looks like name@bank, as your UPI app shows it");
        }
        jdbc.update("""
                INSERT INTO driver_payment_details (user_id, upi_id) VALUES (?, ?)
                ON CONFLICT (user_id) DO UPDATE SET upi_id = EXCLUDED.upi_id, updated_at = now()""",
                driverId, id);
        return of(driverId);
    }

    /** Stored as a fresh PNG, so nothing but the picture is kept and it stays sharp enough to scan. */
    @Transactional
    public void setQr(long driverId, byte[] upload) {
        jdbc.update("""
                INSERT INTO driver_payment_details (user_id, qr_png) VALUES (?, ?)
                ON CONFLICT (user_id) DO UPDATE SET qr_png = EXCLUDED.qr_png, updated_at = now()""",
                driverId, photos.cleanPng(upload, qrMaxSidePixels));
    }

    @Transactional
    public void removeQr(long driverId) {
        jdbc.update("UPDATE driver_payment_details SET qr_png = NULL, updated_at = now() WHERE user_id = ?", driverId);
    }

    /** The driver's QR code, or null if there is none. */
    public byte[] qr(long driverId) {
        List<byte[]> found = jdbc.query("SELECT qr_png FROM driver_payment_details WHERE user_id = ?",
                (rs, n) -> rs.getBytes("qr_png"), driverId);
        return found.isEmpty() ? null : found.get(0);
    }

    /** How to pay the driver of one of the passenger's bookings. */
    public HowToPay forPassenger(long passengerId, long bookingId) {
        long driverId = driverToPay(passengerId, bookingId);
        Details details = of(driverId);
        String name = jdbc.queryForObject("SELECT full_name FROM users WHERE id = ?", String.class, driverId);
        return new HowToPay(name, details.upiId(), details.hasQr());
    }

    /** The QR code of the driver of one of the passenger's bookings, or null if there is none. */
    public byte[] qrForPassenger(long passengerId, long bookingId) {
        return qr(driverToPay(passengerId, bookingId));
    }

    /** Someone else's booking, or one not yet confirmed, looks the same as one that does not exist. */
    private long driverToPay(long passengerId, long bookingId) {
        List<Long> found = jdbc.queryForList("""
                SELECT r.driver_id
                FROM bookings b
                JOIN rides r ON r.id = b.ride_id
                LEFT JOIN payment_intents p ON p.booking_id = b.id
                WHERE b.id = ? AND b.passenger_id = ? AND (b.status = 'CONFIRMED' OR p.status = 'DUE')""",
                Long.class, bookingId, passengerId);
        if (found.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Booking not found");
        }
        return found.get(0);
    }
}
