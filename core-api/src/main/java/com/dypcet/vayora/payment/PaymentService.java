package com.dypcet.vayora.payment;

import com.dypcet.vayora.refund.RefundPolicy;
import java.math.BigDecimal;
import java.time.Duration;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

/**
 * What each booking owes its driver. A passenger pays the driver directly, in cash or by UPI,
 * after the ride. VAYORA takes nothing, holds nothing and charges nothing: all this records is
 * what was owed, and whether the driver says it was paid.
 *
 * <p>Every method here is called from inside the booking's own transaction, so what is owed and
 * the booking's state commit or roll back together. None opens a transaction of its own.
 *
 * <p>A booking with no intent (a free ride, or one made before payments existed) is left alone.
 */
@Service
public class PaymentService {

    /** How a passenger paid their driver, as the driver says. */
    public enum Method {
        CASH,
        UPI
    }

    /** Why a booking owes something. */
    public enum DueReason {
        TRIP_COMPLETED,
        PASSENGER_NO_SHOW,
        PASSENGER_CANCELLED
    }

    /**
     * One of a passenger's bookings, as what it costs and owes.
     *
     * @param status    {@code DEFERRED} while live, then {@code DUE}, {@code SETTLED} once paid,
     *                  or {@code VOID} if it owed nothing
     * @param amountDue what it owed when it ended, paid or not; null until then, and if nothing
     * @param method    how it was paid; null until then
     */
    public record Payment(long bookingId, String fromStop, String toStop, BigDecimal fare, String status,
            BigDecimal amountDue, String dueReason, String method, Instant createdAt, Instant paidAt) {
    }

    /**
     * What a passenger owes a driver, or has paid them.
     *
     * @param status {@code DUE}, or {@code SETTLED} once the driver said it was paid
     * @param method how it was paid; null while it is due
     * @param at     when the driver said it was paid; while it is due, when the booking was made
     */
    public record Earning(long bookingId, String passengerName, String fromStop, String toStop,
            BigDecimal amount, String reason, String status, String method, Instant at) {
    }

    private final JdbcTemplate jdbc;
    private final RefundPolicy refundPolicy;

    public PaymentService(JdbcTemplate jdbc, RefundPolicy refundPolicy) {
        this.jdbc = jdbc;
        this.refundPolicy = refundPolicy;
    }

    /** Records what a booking costs. Nothing is taken: what it owes is worked out when it ends. */
    public void open(long bookingId, long passengerId, BigDecimal fare) {
        if (fare.signum() == 0) {
            return; // a free ride: there will be nothing to pay
        }
        jdbc.update("INSERT INTO payment_intents (booking_id, passenger_id, fare, status) VALUES (?, ?, ?, 'DEFERRED')",
                bookingId, passengerId, fare);
    }

    /** Whether the passenger still owes a driver for a booking that has ended. */
    public boolean owes(long passengerId) {
        return Boolean.TRUE.equals(jdbc.queryForObject(
                "SELECT EXISTS (SELECT 1 FROM payment_intents WHERE passenger_id = ? AND status = 'DUE')",
                Boolean.class, passengerId));
    }

    /** What a booking owes now; empty if nothing, or if it was paid. */
    public Optional<BigDecimal> due(long bookingId) {
        return jdbc.queryForList(
                "SELECT amount_due FROM payment_intents WHERE booking_id = ? AND status = 'DUE'",
                BigDecimal.class, bookingId).stream().findFirst();
    }

    /** Records that the driver says they were paid what is due. */
    public void paid(long bookingId, Method method) {
        lockDue(bookingId);
        jdbc.update("UPDATE payment_intents SET status = 'SETTLED', settled_at = now(), method = ? WHERE booking_id = ?",
                method.name(), bookingId);
    }

    /** Lets a passenger off what is due, as staff have decided. */
    public void clear(long bookingId) {
        lockDue(bookingId);
        end(bookingId, BigDecimal.ZERO, null);
    }

    /** Ends a booking owing nothing: the driver declined, never answered, or withdrew. */
    public void oweNothing(long bookingId) {
        if (lockOpen(bookingId)) {
            end(bookingId, BigDecimal.ZERO, null);
        }
    }

    /**
     * Ends a booking the passenger cancelled. Before the driver accepted, nothing is owed. After,
     * the timing tiers say how much of the fare is.
     */
    public void settlePassengerCancellation(long bookingId, BigDecimal fare, boolean accepted, Instant boarding,
            Instant now) {
        if (lockOpen(bookingId)) {
            end(bookingId, accepted ? refundPolicy.owedOnCancelling(fare, Duration.between(now, boarding)) : BigDecimal.ZERO,
                    DueReason.PASSENGER_CANCELLED);
        }
    }

    /** Ends a booking owing the whole fare: the trip ran, or the passenger did not show. */
    public void oweInFull(long bookingId, DueReason reason) {
        if (lockOpen(bookingId)) {
            jdbc.update("""
                    UPDATE payment_intents SET status = 'DUE', amount_due = fare, due_reason = ?
                    WHERE booking_id = ?""",
                    reason.name(), bookingId);
        }
    }

    public List<Payment> forPassenger(long passengerId) {
        return jdbc.query("""
                SELECT p.booking_id, s.name AS from_stop, t.name AS to_stop, p.fare, p.status, p.amount_due,
                       p.due_reason, p.method, p.created_at, p.settled_at
                FROM payment_intents p
                JOIN bookings b ON b.id = p.booking_id
                JOIN ride_stops s ON s.ride_id = b.ride_id AND s.seq = b.from_seq
                JOIN ride_stops t ON t.ride_id = b.ride_id AND t.seq = b.to_seq
                WHERE p.passenger_id = ? ORDER BY p.id DESC""",
                (rs, n) -> {
                    OffsetDateTime paidAt = "SETTLED".equals(rs.getString("status"))
                            ? rs.getObject("settled_at", OffsetDateTime.class) : null;
                    return new Payment(rs.getLong("booking_id"), rs.getString("from_stop"), rs.getString("to_stop"),
                            rs.getBigDecimal("fare"), rs.getString("status"), rs.getBigDecimal("amount_due"),
                            rs.getString("due_reason"), rs.getString("method"),
                            rs.getObject("created_at", OffsetDateTime.class).toInstant(),
                            paidAt == null ? null : paidAt.toInstant());
                },
                passengerId);
    }

    /** What passengers owe this driver, and what they have paid, newest first. */
    public List<Earning> forDriver(long driverId) {
        return jdbc.query("""
                SELECT p.booking_id, u.full_name, s.name AS from_stop, t.name AS to_stop, p.amount_due,
                       p.due_reason, p.status, p.method, COALESCE(p.settled_at, p.created_at) AS at
                FROM payment_intents p
                JOIN bookings b ON b.id = p.booking_id
                JOIN rides r ON r.id = b.ride_id
                JOIN users u ON u.id = b.passenger_id
                JOIN ride_stops s ON s.ride_id = b.ride_id AND s.seq = b.from_seq
                JOIN ride_stops t ON t.ride_id = b.ride_id AND t.seq = b.to_seq
                WHERE r.driver_id = ? AND p.status IN ('DUE', 'SETTLED') ORDER BY p.id DESC""",
                (rs, n) -> new Earning(rs.getLong("booking_id"), rs.getString("full_name"),
                        rs.getString("from_stop"), rs.getString("to_stop"), rs.getBigDecimal("amount_due"),
                        rs.getString("due_reason"), rs.getString("status"), rs.getString("method"),
                        rs.getObject("at", OffsetDateTime.class).toInstant()),
                driverId);
    }

    /** Ends a live booking: due with what it owes and why, or void if nothing. */
    private void end(long bookingId, BigDecimal owed, DueReason reason) {
        if (owed.signum() > 0) {
            jdbc.update("UPDATE payment_intents SET status = 'DUE', amount_due = ?, due_reason = ? WHERE booking_id = ?",
                    owed, reason.name(), bookingId);
        } else {
            jdbc.update("""
                    UPDATE payment_intents SET status = 'VOID', amount_due = NULL, due_reason = NULL, settled_at = now()
                    WHERE booking_id = ?""",
                    bookingId);
        }
    }

    /**
     * Locks the booking's intent while the booking is live. False if it has none. One already
     * ended is a bug in the caller: a booking ends once.
     */
    private boolean lockOpen(long bookingId) {
        Optional<String> status = lock(bookingId);
        if (status.isPresent() && !"DEFERRED".equals(status.get())) {
            throw new IllegalStateException("Payment for booking " + bookingId + " has already ended");
        }
        return status.isPresent();
    }

    /** Locks the intent of a booking that owes something and is not yet paid. */
    private void lockDue(long bookingId) {
        lock(bookingId).filter("DUE"::equals)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.CONFLICT, "Nothing is due on this booking"));
    }

    private Optional<String> lock(long bookingId) {
        return jdbc.queryForList("SELECT status FROM payment_intents WHERE booking_id = ? FOR UPDATE", String.class, bookingId)
                .stream().findFirst();
    }
}
