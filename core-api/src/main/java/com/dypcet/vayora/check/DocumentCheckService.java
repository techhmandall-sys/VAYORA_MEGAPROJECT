package com.dypcet.vayora.check;

import com.dypcet.vayora.audit.AuditService;
import com.dypcet.vayora.notification.NotificationService;
import com.dypcet.vayora.notification.NotificationService.Type;
import com.dypcet.vayora.notification.Text;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Map;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

/**
 * A person's check of what a driver declared (features 7, 8, 35 and 58). No identity provider
 * or insurer is connected, so the driver shows the original to an administrator, in person or
 * on a video call, and the administrator records the outcome. Only that is kept: no number and
 * no copy of any document. It says a person saw a document, not that its issuer stands behind
 * it, and every place it is shown says so.
 *
 * <p>A check belongs to what was declared when it was asked for, so changing the declaration
 * withdraws it.
 */
@Service
public class DocumentCheckService {

    private static final ZoneId INDIA_ZONE = ZoneId.of("Asia/Kolkata");

    public enum Kind {
        IDENTITY,
        INSURANCE
    }

    public enum Status {
        WAITING,
        CHECKED,
        REFUSED,
        WITHDRAWN
    }

    public enum Outcome {
        CHECKED,
        REFUSED
    }

    /** @param vehicleId the car, for insurance; null for identity */
    public record Check(long id, Kind kind, Long vehicleId, Status status, Instant requestedAt,
            Instant decidedAt, String note) {
    }

    /**
     * What an administrator needs in front of them: what to ask to see, and from whom.
     *
     * @param document the kind of identity document declared; null for insurance
     * @param vehicle  make and model, as the driver entered them; null for identity
     */
    public record Waiting(long id, Kind kind, long driverId, String driverName, Instant requestedAt,
            String document, Long vehicleId, String vehicle, String insurer, LocalDate insuredUntil) {
    }

    private final JdbcTemplate jdbc;
    private final AuditService audit;
    private final NotificationService notifications;
    private final Clock clock;

    public DocumentCheckService(JdbcTemplate jdbc, AuditService audit, NotificationService notifications,
            Clock clock) {
        this.jdbc = jdbc;
        this.audit = audit;
        this.notifications = notifications;
        this.clock = clock;
    }

    /** Puts what the driver declared in front of an administrator. */
    @Transactional
    public Check request(long driverId, Kind kind, Long vehicleId) {
        if (kind == Kind.IDENTITY) {
            requireIdentityDeclared(driverId);
        } else {
            requireInsuranceDeclared(driverId, vehicleId);
        }
        Long car = kind == Kind.INSURANCE ? vehicleId : null;
        List<String> live = jdbc.queryForList("""
                SELECT status FROM document_checks
                WHERE driver_id = ? AND kind = ? AND vehicle_id IS NOT DISTINCT FROM ?
                  AND status IN ('WAITING', 'CHECKED')""",
                String.class, driverId, kind.name(), car);
        if (!live.isEmpty()) {
            throw alreadyLive(live.get(0));
        }
        Instant now = clock.instant();
        try {
            long id = jdbc.queryForObject("""
                    INSERT INTO document_checks (kind, driver_id, vehicle_id, requested_at)
                    VALUES (?, ?, ?, ?) RETURNING id""",
                    Long.class, kind.name(), driverId, car, utc(now));
            return new Check(id, kind, car, Status.WAITING, now, null, null);
        } catch (DuplicateKeyException e) {
            // Two requests at once: the other one is the check.
            throw alreadyLive("WAITING");
        }
    }

    /** The current check of each thing the driver has declared. */
    public List<Check> of(long driverId) {
        return jdbc.query("""
                SELECT DISTINCT ON (kind, vehicle_id) id, kind, vehicle_id, status, requested_at, decided_at, note
                FROM document_checks
                WHERE driver_id = ? AND status <> 'WITHDRAWN'
                ORDER BY kind, vehicle_id, id DESC""",
                (rs, n) -> new Check(rs.getLong("id"), Kind.valueOf(rs.getString("kind")),
                        (Long) rs.getObject("vehicle_id"), Status.valueOf(rs.getString("status")),
                        rs.getObject("requested_at", OffsetDateTime.class).toInstant(),
                        decidedAt(rs.getObject("decided_at", OffsetDateTime.class)), rs.getString("note")),
                driverId);
    }

    /** The administrators' queue, oldest first. */
    public List<Waiting> waiting() {
        return jdbc.query("""
                SELECT c.id, c.kind, c.driver_id, u.full_name, c.requested_at, u.id_document,
                       c.vehicle_id, v.make || ' ' || v.model AS vehicle, v.insurer, v.insured_until
                FROM document_checks c
                JOIN users u ON u.id = c.driver_id
                LEFT JOIN vehicles v ON v.id = c.vehicle_id
                WHERE c.status = 'WAITING'
                ORDER BY c.requested_at, c.id""",
                (rs, n) -> {
                    Kind kind = Kind.valueOf(rs.getString("kind"));
                    return new Waiting(rs.getLong("id"), kind, rs.getLong("driver_id"), rs.getString("full_name"),
                            rs.getObject("requested_at", OffsetDateTime.class).toInstant(),
                            kind == Kind.IDENTITY ? rs.getString("id_document") : null,
                            (Long) rs.getObject("vehicle_id"), rs.getString("vehicle"), rs.getString("insurer"),
                            rs.getObject("insured_until", LocalDate.class));
                });
    }

    /** Records what the administrator saw, audits it and tells the driver. */
    @Transactional
    public Check decide(long adminId, long checkId, Outcome outcome, String note) {
        String said = note == null || note.isBlank() ? null : note.strip();
        if (outcome == Outcome.REFUSED && said == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Say why it could not be confirmed");
        }
        Instant now = clock.instant();
        int decided = jdbc.update("""
                UPDATE document_checks SET status = ?, decided_at = ?, decided_by = ?, note = ?
                WHERE id = ? AND status = 'WAITING'""",
                outcome.name(), utc(now), adminId, said, checkId);
        if (decided == 0) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "No check is waiting with that id");
        }
        long driverId = jdbc.queryForObject("SELECT driver_id FROM document_checks WHERE id = ?", Long.class, checkId);
        Check check = of(driverId).stream().filter(mine -> mine.id() == checkId).findFirst().orElseThrow();
        audit.record(adminId, "DOCUMENT_" + outcome.name(), "document_check", checkId,
                Map.of("kind", check.kind().name(), "driver", driverId));
        notifications.send(driverId, Type.ACCOUNT_NOTICE, told(check, outcome, said), null);
        return check;
    }

    /** The driver's declared document changed or went: whatever was seen no longer applies. */
    public void withdrawIdentity(long driverId) {
        jdbc.update("""
                UPDATE document_checks SET status = 'WITHDRAWN', decided_at = NULL
                WHERE driver_id = ? AND kind = 'IDENTITY' AND status <> 'WITHDRAWN'""", driverId);
    }

    /** The car's declared insurance changed or went: whatever was seen no longer applies. */
    public void withdrawInsurance(long vehicleId) {
        jdbc.update("""
                UPDATE document_checks SET status = 'WITHDRAWN', decided_at = NULL
                WHERE vehicle_id = ? AND status <> 'WITHDRAWN'""", vehicleId);
    }

    private Text told(Check check, Outcome outcome, String note) {
        if (check.kind() == Kind.IDENTITY) {
            return outcome == Outcome.CHECKED
                    ? Text.of("VAYORA staff have checked your identity document.")
                    : Text.of("VAYORA staff could not confirm your identity document: {note}", "note", note);
        }
        String vehicle = jdbc.queryForObject("SELECT make || ' ' || model FROM vehicles WHERE id = ?", String.class,
                check.vehicleId());
        return outcome == Outcome.CHECKED
                ? Text.of("VAYORA staff have checked the insurance for {vehicle}.", "vehicle", vehicle)
                : Text.of("VAYORA staff could not confirm the insurance for {vehicle}: {note}",
                        "vehicle", vehicle, "note", note);
    }

    private void requireIdentityDeclared(long driverId) {
        String declared = jdbc.queryForObject("SELECT id_document FROM users WHERE id = ?", String.class, driverId);
        if (declared == null) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Declare an identity document first");
        }
    }

    private void requireInsuranceDeclared(long driverId, Long vehicleId) {
        if (vehicleId == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Say which car the insurance is for");
        }
        List<LocalDate> until = jdbc.query("SELECT insured_until FROM vehicles WHERE id = ? AND owner_id = ?",
                (rs, n) -> rs.getObject("insured_until", LocalDate.class), vehicleId, driverId);
        if (until.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Vehicle not found");
        }
        if (until.get(0) == null) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Declare this car's insurance first");
        }
        if (until.get(0).isBefore(LocalDate.now(clock.withZone(INDIA_ZONE)))) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "That insurance has already ended");
        }
    }

    private static ResponseStatusException alreadyLive(String status) {
        return new ResponseStatusException(HttpStatus.CONFLICT, "CHECKED".equals(status)
                ? "VAYORA staff have already checked this"
                : "This is already waiting for VAYORA staff");
    }

    private static Instant decidedAt(OffsetDateTime at) {
        return at == null ? null : at.toInstant();
    }

    private static OffsetDateTime utc(Instant instant) {
        return instant.atOffset(ZoneOffset.UTC);
    }
}
