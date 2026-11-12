package com.dypcet.vayora.admin;

import com.dypcet.vayora.audit.AuditService;
import com.dypcet.vayora.audit.AuditService.Entry;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** Read-only views for administrators. Every figure is counted from the database. */
@RestController
@RequestMapping("/api/v1/admin")
@PreAuthorize("hasRole('ADMIN')")
public class AdminController {

    /**
     * @param users    members by role
     * @param rides    rides by status
     * @param bookings bookings by status
     */
    public record Overview(Map<String, Long> users, Map<String, Long> rides,
            Map<String, Long> bookings, long suspendedMembers, long openReports, long disputedTrips) {
    }

    public record Member(long id, String fullName, String email, String role, String status,
            Instant memberSince) {
    }

    private static final int LISTED = 100;

    private final JdbcTemplate jdbc;
    private final AuditService audit;

    public AdminController(JdbcTemplate jdbc, AuditService audit) {
        this.jdbc = jdbc;
        this.audit = audit;
    }

    @GetMapping("/overview")
    public Overview overview() {
        return new Overview(
                counts("SELECT role, COUNT(*) FROM users WHERE status <> 'DELETED' GROUP BY role ORDER BY role"),
                counts("SELECT status, COUNT(*) FROM rides GROUP BY status ORDER BY status"),
                counts("SELECT status, COUNT(*) FROM bookings GROUP BY status ORDER BY status"),
                jdbc.queryForObject("SELECT COUNT(*) FROM users WHERE status = 'SUSPENDED'", Long.class),
                jdbc.queryForObject("SELECT COUNT(*) FROM reports WHERE status = 'OPEN'", Long.class),
                jdbc.queryForObject("SELECT COUNT(*) FROM bookings WHERE passenger_confirmed IS FALSE", Long.class));
    }

    /** Members whose name, email or phone contains {@code q}, newest first. Deleted accounts are not members. */
    @GetMapping("/users")
    public List<Member> users(@RequestParam(defaultValue = "") String q) {
        // The pattern is a bound parameter; % and _ in the search text are matched literally.
        String pattern = "%" + q.strip().replace("\\", "\\\\").replace("%", "\\%")
                .replace("_", "\\_") + "%";
        return jdbc.query("""
                SELECT id, full_name, email, role, status, created_at FROM users
                WHERE status <> 'DELETED' AND (full_name ILIKE ? OR email ILIKE ? OR phone ILIKE ?)
                ORDER BY id DESC LIMIT ?""",
                (rs, n) -> new Member(rs.getLong("id"), rs.getString("full_name"),
                        rs.getString("email"), rs.getString("role"), rs.getString("status"),
                        rs.getObject("created_at", OffsetDateTime.class).toInstant()),
                pattern, pattern, pattern, LISTED);
    }

    /** One ride as the back office lists it. */
    public record RideRow(long id, String driverName, long driverId, Instant departureTime, String status,
            int seatsOffered, int bookings, String fromStop, String toStop) {
    }

    /**
     * One booking as the back office lists it.
     *
     * @param paymentStatus where what it owes stands; null on a free ride
     * @param amountDue     what it owes the driver; null until it ended owing something
     */
    public record BookingRow(long id, long rideId, String passengerName, long passengerId, String driverName,
            String fromStop, String toStop, int seats, String status, Instant createdAt, String paymentStatus,
            BigDecimal amountDue) {
    }

    /** The newest rides, optionally of one status. */
    @GetMapping("/rides")
    public List<RideRow> rides(@RequestParam(required = false)
            @jakarta.validation.constraints.Pattern(regexp = "SCHEDULED|IN_PROGRESS|COMPLETED|CANCELLED") String status) {
        return jdbc.query("""
                SELECT r.id, u.full_name, r.driver_id, r.departure_time, r.status, r.seats_offered,
                       (SELECT COUNT(*) FROM bookings b WHERE b.ride_id = r.id) AS bookings,
                       (SELECT name FROM ride_stops WHERE ride_id = r.id ORDER BY seq LIMIT 1) AS from_stop,
                       (SELECT name FROM ride_stops WHERE ride_id = r.id ORDER BY seq DESC LIMIT 1) AS to_stop
                FROM rides r JOIN users u ON u.id = r.driver_id
                WHERE ?::text IS NULL OR r.status = ?
                ORDER BY r.id DESC LIMIT ?""",
                (rs, n) -> new RideRow(rs.getLong("id"), rs.getString("full_name"), rs.getLong("driver_id"),
                        rs.getObject("departure_time", OffsetDateTime.class).toInstant(), rs.getString("status"),
                        rs.getInt("seats_offered"), rs.getInt("bookings"), rs.getString("from_stop"),
                        rs.getString("to_stop")),
                status, status, LISTED);
    }

    /** The newest bookings, optionally of one status, or only those still owing a driver. */
    @GetMapping("/bookings")
    public List<BookingRow> bookings(@RequestParam(required = false)
            @jakarta.validation.constraints.Pattern(regexp = "PENDING|CONFIRMED|REJECTED|CANCELLED|COMPLETED|NO_SHOW")
            String status, @RequestParam(defaultValue = "false") boolean owing) {
        return jdbc.query("""
                SELECT b.id, b.ride_id, p.full_name AS passenger, b.passenger_id, d.full_name AS driver,
                       s.name AS from_stop, t.name AS to_stop, b.seats, b.status, b.created_at,
                       i.status AS payment_status, i.amount_due
                FROM bookings b
                JOIN users p ON p.id = b.passenger_id
                JOIN rides r ON r.id = b.ride_id
                JOIN users d ON d.id = r.driver_id
                JOIN ride_stops s ON s.ride_id = b.ride_id AND s.seq = b.from_seq
                JOIN ride_stops t ON t.ride_id = b.ride_id AND t.seq = b.to_seq
                LEFT JOIN payment_intents i ON i.booking_id = b.id
                WHERE (?::text IS NULL OR b.status = ?) AND (NOT ? OR i.status = 'DUE')
                ORDER BY b.id DESC LIMIT ?""",
                (rs, n) -> new BookingRow(rs.getLong("id"), rs.getLong("ride_id"), rs.getString("passenger"),
                        rs.getLong("passenger_id"), rs.getString("driver"), rs.getString("from_stop"),
                        rs.getString("to_stop"), rs.getInt("seats"), rs.getString("status"),
                        rs.getObject("created_at", OffsetDateTime.class).toInstant(),
                        rs.getString("payment_status"), rs.getBigDecimal("amount_due")),
                status, status, owing, LISTED);
    }

    @GetMapping("/audit")
    public List<Entry> audit() {
        return audit.latest();
    }

    private Map<String, Long> counts(String sql) {
        Map<String, Long> counts = new LinkedHashMap<>();
        jdbc.query(sql, rs -> {
            counts.put(rs.getString(1), rs.getLong(2));
        });
        return counts;
    }
}
