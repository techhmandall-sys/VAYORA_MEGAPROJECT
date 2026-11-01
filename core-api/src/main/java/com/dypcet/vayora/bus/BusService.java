package com.dypcet.vayora.bus;

import com.dypcet.vayora.audit.AuditService;
import java.math.BigDecimal;
import java.time.LocalTime;
import java.util.List;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

/**
 * Bus services, entered by administrators, offered to a passenger when no
 * ride will do.
 *
 * <p>The platform ships with none. Times and fares are whatever an administrator enters;
 * nothing here checks them against the operator's timetable, and a passenger is told so.
 */
@Service
public class BusService {

    /** @param departs local time of day it leaves from {@code fromStop} */
    public record Bus(long id, String operator, String fromStop, String toStop, LocalTime departs,
            int durationMinutes, BigDecimal fare, String notes) {
    }

    public record NewBus(String operator, String fromStop, String toStop, LocalTime departs,
            int durationMinutes, BigDecimal fare, String notes) {
    }

    private final JdbcTemplate jdbc;
    private final AuditService audit;

    public BusService(JdbcTemplate jdbc, AuditService audit) {
        this.jdbc = jdbc;
        this.audit = audit;
    }

    public List<Bus> all() {
        return jdbc.query("SELECT * FROM bus_services ORDER BY from_stop, departs", (rs, n) -> bus(rs));
    }

    /**
     * Buses from one town to another leaving at or after a time of day, earliest first.
     * Town names are compared without regard to case.
     */
    public List<Bus> between(String fromStop, String toStop, LocalTime notBefore, int most) {
        return jdbc.query("""
                SELECT * FROM bus_services
                WHERE lower(from_stop) = lower(?) AND lower(to_stop) = lower(?) AND departs >= ?
                ORDER BY departs LIMIT ?""",
                (rs, n) -> bus(rs), fromStop.strip(), toStop.strip(), notBefore, most);
    }

    @Transactional
    public Bus add(long adminId, NewBus bus) {
        if (bus.fromStop().strip().equalsIgnoreCase(bus.toStop().strip())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "A bus must go somewhere else");
        }
        Long id = jdbc.queryForObject("""
                INSERT INTO bus_services (operator, from_stop, to_stop, departs, duration_minutes, fare, notes,
                                          created_by)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING id""",
                Long.class, bus.operator().strip(), bus.fromStop().strip(), bus.toStop().strip(), bus.departs(),
                bus.durationMinutes(), bus.fare(), bus.notes() == null || bus.notes().isBlank() ? null : bus.notes().strip(),
                adminId);
        audit.record(adminId, "BUS_SERVICE_ADDED", "bus_service", id,
                Map.of("from", bus.fromStop(), "to", bus.toStop(), "departs", bus.departs().toString()));
        return jdbc.queryForObject("SELECT * FROM bus_services WHERE id = ?", (rs, n) -> bus(rs), id);
    }

    @Transactional
    public void remove(long adminId, long id) {
        if (jdbc.update("DELETE FROM bus_services WHERE id = ?", id) == 0) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "No such bus service");
        }
        audit.record(adminId, "BUS_SERVICE_REMOVED", "bus_service", id, Map.of());
    }

    private static Bus bus(java.sql.ResultSet rs) throws java.sql.SQLException {
        return new Bus(rs.getLong("id"), rs.getString("operator"), rs.getString("from_stop"),
                rs.getString("to_stop"), rs.getObject("departs", LocalTime.class), rs.getInt("duration_minutes"),
                rs.getBigDecimal("fare"), rs.getString("notes"));
    }
}
