package com.dypcet.vayora.moderation;

import com.dypcet.vayora.audit.AuditService;
import com.dypcet.vayora.notification.NotificationService.Type;
import com.dypcet.vayora.notification.NotificationService;
import com.dypcet.vayora.notification.Text;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

/** Members reporting one another, and administrators deciding what to do about it. */
@Service
public class ModerationService {

    public enum Reason {
        UNSAFE_DRIVING,
        HARASSMENT,
        NO_SHOW,
        FRAUD,
        OTHER
    }

    public enum Outcome {
        /** Nothing in it. */
        DISMISS,
        /** The member is told, and may carry on. */
        WARN,
        /** The member can no longer sign in or act. */
        SUSPEND
    }

    public record Report(long id, long reporterId, String reporterName, long reportedUserId,
            String reportedUserName, String reportedUserStatus, Long bookingId, Reason reason,
            String details, String status, Outcome outcome, String resolutionNote,
            Instant createdAt, Instant resolvedAt) {
    }

    private static final String SELECT_REPORT = """
            SELECT p.*, a.full_name AS reporter_name, b.full_name AS reported_name,
                   b.status AS reported_status
            FROM reports p
            JOIN users a ON a.id = p.reporter_id
            JOIN users b ON b.id = p.reported_user_id
            """;

    private static final RowMapper<Report> MAPPER = (rs, n) -> new Report(
            rs.getLong("id"), rs.getLong("reporter_id"), rs.getString("reporter_name"),
            rs.getLong("reported_user_id"), rs.getString("reported_name"),
            rs.getString("reported_status"), (Long) rs.getObject("booking_id"),
            Reason.valueOf(rs.getString("reason")), rs.getString("details"), rs.getString("status"),
            rs.getString("outcome") == null ? null : Outcome.valueOf(rs.getString("outcome")),
            rs.getString("resolution_note"),
            rs.getObject("created_at", OffsetDateTime.class).toInstant(),
            rs.getObject("resolved_at", OffsetDateTime.class) == null ? null
                    : rs.getObject("resolved_at", OffsetDateTime.class).toInstant());

    private final JdbcTemplate jdbc;
    private final AuditService audit;
    private final NotificationService notifications;

    public ModerationService(JdbcTemplate jdbc, AuditService audit,
            NotificationService notifications) {
        this.jdbc = jdbc;
        this.audit = audit;
        this.notifications = notifications;
    }

    /**
     * Files a report. Only someone who has shared a booking with the member may report
     * them: it keeps strangers from filing against people they have never met.
     */
    public long file(long reporterId, long reportedUserId, Long bookingId, Reason reason,
            String details) {
        if (reporterId == reportedUserId) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "You cannot report yourself");
        }
        Integer shared = jdbc.queryForObject("""
                SELECT COUNT(*) FROM bookings b JOIN rides r ON r.id = b.ride_id
                WHERE ((b.passenger_id = ? AND r.driver_id = ?)
                    OR (b.passenger_id = ? AND r.driver_id = ?))
                  AND (CAST(? AS bigint) IS NULL OR b.id = ?)""",
                Integer.class, reporterId, reportedUserId, reportedUserId, reporterId,
                bookingId, bookingId);
        if (shared == 0) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                    "You can only report someone you have booked or driven with");
        }
        String text = details == null || details.isBlank() ? null : details.strip();
        try {
            return jdbc.queryForObject("""
                    INSERT INTO reports (reporter_id, reported_user_id, booking_id, reason, details)
                    VALUES (?, ?, ?, ?, ?) RETURNING id""",
                    Long.class, reporterId, reportedUserId, bookingId, reason.name(), text);
        } catch (DuplicateKeyException e) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "You already have an open report about this member");
        }
    }

    /** Reports in one status, oldest first: the queue is worked from the front. */
    public List<Report> withStatus(String status) {
        return jdbc.query(SELECT_REPORT + "WHERE p.status = ? ORDER BY p.id", MAPPER, status);
    }

    @Transactional
    public Report resolve(long adminId, long reportId, Outcome outcome, String note) {
        List<Report> found = jdbc.query(
                SELECT_REPORT + "WHERE p.id = ? FOR UPDATE OF p", MAPPER, reportId);
        if (found.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Report not found");
        }
        Report report = found.get(0);
        if (!"OPEN".equals(report.status())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "This report is already closed");
        }
        String text = note == null || note.isBlank() ? null : note.strip();
        jdbc.update("""
                UPDATE reports SET status = ?, outcome = ?, resolution_note = ?, resolved_by = ?,
                                   resolved_at = now()
                WHERE id = ?""",
                outcome == Outcome.DISMISS ? "DISMISSED" : "RESOLVED", outcome.name(), text, adminId,
                reportId);

        if (outcome == Outcome.SUSPEND) {
            setStatus(report.reportedUserId(), "SUSPENDED");
        } else if (outcome == Outcome.WARN) {
            notifications.send(report.reportedUserId(), Type.ACCOUNT_NOTICE,
                    text == null ? Text.of("An administrator reviewed a report about you.")
                            : Text.of("An administrator reviewed a report about you: {note}", "note", text), null);
        }
        audit.record(adminId, "REPORT_" + outcome.name(), "report", reportId,
                Map.of("reported_user_id", report.reportedUserId(), "reason", report.reason().name()));
        return jdbc.queryForObject(SELECT_REPORT + "WHERE p.id = ?", MAPPER, reportId);
    }

    @Transactional
    public void reinstate(long adminId, long userId) {
        setStatus(userId, "ACTIVE");
        audit.record(adminId, "USER_REINSTATED", "user", userId, Map.of());
    }

    /** Administrators are not suspended or reinstated from here, and a deleted account stays deleted. */
    private void setStatus(long userId, String status) {
        int changed = jdbc.update(
                "UPDATE users SET status = ? WHERE id = ? AND role <> 'ADMIN' AND status <> 'DELETED'", status, userId);
        if (changed == 0) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Member not found");
        }
    }
}
