package com.dypcet.vayora.payment;

import com.dypcet.vayora.pass.PassService;
import com.dypcet.vayora.receipt.TaxInvoices;
import com.dypcet.vayora.refund.RefundPolicy;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

/**
 * Holds a passenger's money when a booking is requested and settles it, exactly once,
 * when the booking ends.
 *
 * <p>A pay-after-ride booking holds nothing. It owes, when it ends, exactly what a booking
 * paid up front would have kept, and is settled when the passenger pays that in the app or
 * the driver says it was paid in cash.
 *
 * <p>Every method here is called from inside the booking's own transaction, so money and
 * booking state commit or roll back together. None opens a transaction of its own.
 *
 * <p>A booking with no intent (made before payments existed) is left alone.
 */
@Service
public class PaymentService {

    public enum RefundReason {
        NOT_ACCEPTED,
        DRIVER_CANCELLED,
        PASSENGER_CANCELLED
    }

    public enum SettlementReason {
        TRIP_COMPLETED,
        PASSENGER_NO_SHOW,
        LATE_CANCELLATION
    }

    /** Why a pay-after-ride booking owes something, and what the driver's share is paid as. */
    enum DueReason {
        TRIP_COMPLETED(SettlementReason.TRIP_COMPLETED),
        PASSENGER_NO_SHOW(SettlementReason.PASSENGER_NO_SHOW),
        PASSENGER_CANCELLED(SettlementReason.LATE_CANCELLATION);

        private final SettlementReason settlement;

        DueReason(SettlementReason settlement) {
            this.settlement = settlement;
        }
    }

    /** Takes the money for a pay-after-ride booking hand to hand; nothing is paid out. */
    public static final String CASH = "CASH";

    /**
     * One of a passenger's payments, with what came back.
     *
     * @param payAfterRide whether nothing was taken at booking
     * @param amountDue    what a pay-after-ride booking owed when it ended, paid or not;
     *                     null until then, and for one that owed nothing
     */
    public record Payment(long bookingId, String fromStop, String toStop, BigDecimal fare,
            BigDecimal serviceFee, BigDecimal amount, String method, String provider,
            String status, BigDecimal refunded, String refundReason, Instant createdAt,
            boolean payAfterRide, BigDecimal amountDue) {
    }

    /** One payout to a driver. */
    public record Settlement(long bookingId, String passengerName, String fromStop, String toStop,
            BigDecimal amount, String reason, String provider, Instant createdAt) {
    }

    private record Intent(long id, BigDecimal fare, BigDecimal serviceFee, BigDecimal amount,
            String providerRef, String status, boolean deferred, BigDecimal amountDue, String dueReason) {
    }

    private final JdbcTemplate jdbc;
    private final PaymentProvider provider;
    private final ServiceFee serviceFee;
    private final PassService passes;
    private final Clock clock;
    private final RefundPolicy refundPolicy;
    private final KeptRides keptRides;
    private final TaxInvoices invoices;

    public PaymentService(JdbcTemplate jdbc, PaymentProvider provider, ServiceFee serviceFee,
            RefundPolicy refundPolicy,
            PassService passes, Clock clock, KeptRides keptRides, TaxInvoices invoices) {
        this.keptRides = keptRides;
        this.invoices = invoices;
        this.passes = passes;
        this.clock = clock;
        this.jdbc = jdbc;
        this.provider = provider;
        this.serviceFee = serviceFee;
        this.refundPolicy = refundPolicy;
    }

    /**
     * Reserves the fare plus the service fee, or the fare alone if a pass of the passenger's
     * is running. The fee is the lower one if the ride's driver keeps their rides. If the
     * provider declines, throws 402 and the caller's transaction rolls back, so no booking
     * and no seat is left behind.
     */
    public void hold(long bookingId, long passengerId, long driverId, BigDecimal fare, PaymentChoice choice) {
        BigDecimal fee = feeFor(passengerId, driverId, fare);
        BigDecimal amount = fare.add(fee);
        if (amount.signum() == 0) {
            return; // a free ride: there is nothing to hold
        }
        PaymentProvider.Hold hold = provider.hold(amount, choice).orElseThrow(
                () -> new ResponseStatusException(HttpStatus.PAYMENT_REQUIRED,
                        "The payment was declined. Nothing was booked."));
        Long intentId = jdbc.queryForObject("""
                INSERT INTO payment_intents (booking_id, passenger_id, fare, service_fee, amount,
                                             method, provider, provider_ref, status)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'HELD') RETURNING id""",
                Long.class, bookingId, passengerId, fare, fee, amount, hold.method().name(),
                provider.name(), hold.reference());
        entry(intentId, "HOLD", amount);
    }

    /**
     * Records what a pay-after-ride booking costs, at the fee {@link #hold} would charge
     * now, and takes nothing. What it owes is worked out when it ends.
     */
    public void defer(long bookingId, long passengerId, long driverId, BigDecimal fare) {
        BigDecimal fee = feeFor(passengerId, driverId, fare);
        BigDecimal amount = fare.add(fee);
        if (amount.signum() == 0) {
            return; // a free ride: there will be nothing to pay
        }
        jdbc.update("""
                INSERT INTO payment_intents (booking_id, passenger_id, fare, service_fee, amount,
                                             status, deferred)
                VALUES (?, ?, ?, ?, ?, 'DEFERRED', true)""",
                bookingId, passengerId, fare, fee, amount);
    }

    /** Whether the passenger owes anything on a pay-after-ride booking that has ended. */
    public boolean owes(long passengerId) {
        return Boolean.TRUE.equals(jdbc.queryForObject(
                "SELECT EXISTS (SELECT 1 FROM payment_intents WHERE passenger_id = ? AND status = 'DUE')",
                Boolean.class, passengerId));
    }

    /** What a pay-after-ride booking owes now; empty if nothing, or if it was paid. */
    public Optional<BigDecimal> due(long bookingId) {
        return jdbc.queryForList(
                "SELECT amount_due FROM payment_intents WHERE booking_id = ? AND status = 'DUE'",
                BigDecimal.class, bookingId).stream().findFirst();
    }

    /** What one of this passenger's bookings owes now, for a checkout; someone else's is not found. */
    public BigDecimal dueFrom(long passengerId, long bookingId) {
        List<String> status = jdbc.queryForList(
                "SELECT status FROM payment_intents WHERE booking_id = ? AND passenger_id = ?",
                String.class, bookingId, passengerId);
        if (status.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Booking not found");
        }
        return due(bookingId).orElseThrow(
                () -> new ResponseStatusException(HttpStatus.CONFLICT, "Nothing is due on this booking"));
    }

    /**
     * Pays what a pay-after-ride booking owes, in the app: the provider takes it at once,
     * and the driver is paid their part as for a booking paid up front. If the provider
     * declines, throws 402 and nothing changes.
     */
    public void payDue(long bookingId, long driverId, PaymentChoice choice) {
        Intent intent = lockDue(bookingId);
        PaymentProvider.Hold hold = provider.hold(intent.amountDue(), choice).orElseThrow(
                () -> new ResponseStatusException(HttpStatus.PAYMENT_REQUIRED,
                        "The payment was declined. Nothing was paid."));
        paid(intent, hold.method().name(), provider.name(), hold.reference());
        provider.capture(hold.reference(), intent.amountDue());
        entry(intent.id(), "CAPTURE", intent.amountDue());
        BigDecimal toDriver = intent.amountDue().subtract(intent.serviceFee());
        if (toDriver.signum() > 0) {
            String payoutReference = provider.payout(driverId, toDriver);
            entry(intent.id(), "PAYOUT", toDriver);
            settlement(bookingId, driverId, toDriver, intent, provider.name(), payoutReference);
        }
    }

    /**
     * Records that the driver was paid what is due in cash. The money went hand to hand, so
     * nothing is paid out: the driver already holds their part, and the platform's fee with it.
     */
    public void paidInCash(long bookingId, long driverId) {
        Intent intent = lockDue(bookingId);
        String reference = "cash_" + UUID.randomUUID();
        paid(intent, CASH, CASH, reference);
        entry(intent.id(), "CAPTURE", intent.amountDue());
        BigDecimal toDriver = intent.amountDue().subtract(intent.serviceFee());
        if (toDriver.signum() > 0) {
            settlement(bookingId, driverId, toDriver, intent, CASH, reference);
        }
    }

    /** The platform's fees inside what the driver has taken in cash, which the driver holds for it. */
    public BigDecimal cashFeesHeld(long driverId) {
        return jdbc.queryForObject("""
                SELECT COALESCE(SUM(p.service_fee), 0)
                FROM payment_intents p
                JOIN bookings b ON b.id = p.booking_id
                JOIN rides r ON r.id = b.ride_id
                WHERE r.driver_id = ? AND p.method = 'CASH'""",
                BigDecimal.class, driverId);
    }

    /**
     * What booking these seats would take now: the fare for the stretch and this passenger's
     * fee, as {@link #hold} works it out. What a checkout is opened for.
     */
    public BigDecimal amountDue(long passengerId, long rideId, int fromSeq, int toSeq, int seats) {
        List<Object[]> found = jdbc.query("""
                SELECT r.driver_id, SUM(s.price) * ? AS fare, COUNT(*) AS legs
                FROM rides r JOIN ride_segments s ON s.ride_id = r.id AND s.seq >= ? AND s.seq < ?
                WHERE r.id = ? AND r.status = 'SCHEDULED'
                GROUP BY r.driver_id""",
                (rs, n) -> new Object[] {rs.getLong("driver_id"), rs.getBigDecimal("fare"), rs.getInt("legs")},
                seats, fromSeq, toSeq, rideId);
        if (found.isEmpty() || toSeq <= fromSeq || (int) found.get(0)[2] != toSeq - fromSeq) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "No ride open for booking has those stops");
        }
        BigDecimal fare = (BigDecimal) found.get(0)[1];
        return fare.add(feeFor(passengerId, (long) found.get(0)[0], fare));
    }

    /** Whether the passenger must be there to pay: then nothing can be booked in their absence. */
    public boolean needsThePassengerToPay() {
        return provider.needsThePassengerToPay();
    }

    /**
     * The service fee this passenger would pay on this fare, on this driver's ride, now:
     * none while a pass runs, the lower one if the driver keeps their rides.
     */
    public BigDecimal feeFor(long passengerId, long driverId, BigDecimal fare) {
        return passes.covers(passengerId, clock.instant()) ? BigDecimal.ZERO.setScale(2)
                : serviceFee.on(fare, keptRides.by(driverId));
    }

    /**
     * Returns everything, fee included: the driver declined, never answered, or withdrew.
     * A pay-after-ride booking then owes nothing.
     */
    public void releaseInFull(long bookingId, RefundReason reason) {
        lockOpen(bookingId).ifPresent(intent -> {
            if (intent.deferred()) {
                owe(intent, BigDecimal.ZERO, null);
            } else {
                settle(bookingId, intent, intent.amount(), reason, null, null);
            }
        });
    }

    /**
     * Settles a passenger's own cancellation. Before the driver accepted, everything comes
     * back. After, the fare comes back by the timing tiers, the service fee is kept, and
     * the part of the fare not refunded goes to the driver. A pay-after-ride booking owes
     * what would have been kept.
     */
    public void settlePassengerCancellation(long bookingId, long driverId, boolean accepted,
            Instant boarding, Instant now) {
        lockOpen(bookingId).ifPresent(intent -> {
            BigDecimal refund = accepted
                    ? refundPolicy.fareRefund(intent.fare(), Duration.between(now, boarding))
                    : intent.amount();
            if (intent.deferred()) {
                owe(intent, intent.amount().subtract(refund), DueReason.PASSENGER_CANCELLED);
                return;
            }
            RefundReason reason = accepted ? RefundReason.PASSENGER_CANCELLED : RefundReason.NOT_ACCEPTED;
            settle(bookingId, intent, refund, reason, driverId, SettlementReason.LATE_CANCELLATION);
        });
    }

    /**
     * Keeps everything and pays the fare to the driver: the trip ran, or the passenger did not
     * show. A pay-after-ride booking owes all of it.
     */
    public void captureInFull(long bookingId, long driverId, SettlementReason reason) {
        lockOpen(bookingId).ifPresent(intent -> {
            if (intent.deferred()) {
                owe(intent, intent.amount(), reason == SettlementReason.PASSENGER_NO_SHOW
                        ? DueReason.PASSENGER_NO_SHOW : DueReason.TRIP_COMPLETED);
            } else {
                settle(bookingId, intent, BigDecimal.ZERO, null, driverId, reason);
            }
        });
    }

    public List<Payment> forPassenger(long passengerId) {
        return jdbc.query("""
                SELECT p.booking_id, s.name AS from_stop, t.name AS to_stop, p.fare, p.service_fee,
                       p.amount, p.method, p.provider, p.status, p.created_at, p.deferred, p.amount_due,
                       COALESCE(f.amount, 0) AS refunded, f.reason AS refund_reason
                FROM payment_intents p
                JOIN bookings b ON b.id = p.booking_id
                JOIN ride_stops s ON s.ride_id = b.ride_id AND s.seq = b.from_seq
                JOIN ride_stops t ON t.ride_id = b.ride_id AND t.seq = b.to_seq
                LEFT JOIN refunds f ON f.booking_id = p.booking_id
                WHERE p.passenger_id = ? ORDER BY p.id DESC""",
                (rs, n) -> new Payment(rs.getLong("booking_id"), rs.getString("from_stop"),
                        rs.getString("to_stop"), rs.getBigDecimal("fare"),
                        rs.getBigDecimal("service_fee"), rs.getBigDecimal("amount"),
                        rs.getString("method"), rs.getString("provider"), rs.getString("status"),
                        rs.getBigDecimal("refunded"), rs.getString("refund_reason"),
                        rs.getObject("created_at", OffsetDateTime.class).toInstant(),
                        rs.getBoolean("deferred"), rs.getBigDecimal("amount_due")),
                passengerId);
    }

    public List<Settlement> forDriver(long driverId) {
        return jdbc.query("""
                SELECT x.booking_id, u.full_name, s.name AS from_stop, t.name AS to_stop,
                       x.amount, x.reason, x.provider, x.created_at
                FROM settlements x
                JOIN bookings b ON b.id = x.booking_id
                JOIN users u ON u.id = b.passenger_id
                JOIN ride_stops s ON s.ride_id = b.ride_id AND s.seq = b.from_seq
                JOIN ride_stops t ON t.ride_id = b.ride_id AND t.seq = b.to_seq
                WHERE x.driver_id = ? ORDER BY x.id DESC""",
                (rs, n) -> new Settlement(rs.getLong("booking_id"), rs.getString("full_name"),
                        rs.getString("from_stop"), rs.getString("to_stop"),
                        rs.getBigDecimal("amount"), rs.getString("reason"),
                        rs.getString("provider"),
                        rs.getObject("created_at", OffsetDateTime.class).toInstant()),
                driverId);
    }

    /**
     * Splits the hold into what goes back to the passenger and what is kept, and pays the
     * driver their part of what is kept. The platform keeps the service fee out of any
     * capture; the driver gets the rest.
     */
    private void settle(long bookingId, Intent intent, BigDecimal refund, RefundReason refundReason,
            Long driverId, SettlementReason settlementReason) {
        BigDecimal captured = intent.amount().subtract(refund);
        if (refund.signum() > 0) {
            provider.release(intent.providerRef(), refund);
            entry(intent.id(), "RELEASE", refund);
            jdbc.update("""
                    INSERT INTO refunds (booking_id, intent_id, amount, reason)
                    VALUES (?, ?, ?, ?)""",
                    bookingId, intent.id(), refund, refundReason.name());
            // More than the fare came back, so the service fee did too: it was not earned.
            if (refund.compareTo(intent.fare()) > 0) {
                invoices.creditBooking(bookingId);
            }
        }
        if (captured.signum() > 0) {
            provider.capture(intent.providerRef(), captured);
            entry(intent.id(), "CAPTURE", captured);
            BigDecimal toDriver = captured.subtract(intent.serviceFee());
            if (toDriver.signum() > 0) {
                String payoutReference = provider.payout(driverId, toDriver);
                entry(intent.id(), "PAYOUT", toDriver);
                jdbc.update("""
                        INSERT INTO settlements (booking_id, driver_id, amount, reason, provider,
                                                 provider_ref)
                        VALUES (?, ?, ?, ?, ?, ?)""",
                        bookingId, driverId, toDriver, settlementReason.name(), provider.name(),
                        payoutReference);
            }
        }
        jdbc.update("UPDATE payment_intents SET status = 'SETTLED', settled_at = now() WHERE id = ?",
                intent.id());
    }

    /** Ends a pay-after-ride booking: due with what it owes and why, or void if nothing. */
    private void owe(Intent intent, BigDecimal owed, DueReason reason) {
        if (owed.signum() > 0) {
            jdbc.update("UPDATE payment_intents SET status = 'DUE', amount_due = ?, due_reason = ? WHERE id = ?",
                    owed, reason.name(), intent.id());
        } else {
            jdbc.update("UPDATE payment_intents SET status = 'VOID', settled_at = now() WHERE id = ?", intent.id());
        }
    }

    /** Settles a due intent as paid, by whom and how; the money is held, the caller keeps it. */
    private void paid(Intent intent, String method, String providerName, String reference) {
        jdbc.update("""
                UPDATE payment_intents SET status = 'SETTLED', settled_at = now(),
                                           method = ?, provider = ?, provider_ref = ?
                WHERE id = ?""",
                method, providerName, reference, intent.id());
        entry(intent.id(), "HOLD", intent.amountDue());
    }

    private void settlement(long bookingId, long driverId, BigDecimal amount, Intent intent,
            String providerName, String reference) {
        jdbc.update("""
                INSERT INTO settlements (booking_id, driver_id, amount, reason, provider, provider_ref)
                VALUES (?, ?, ?, ?, ?, ?)""",
                bookingId, driverId, amount, DueReason.valueOf(intent.dueReason()).settlement.name(),
                providerName, reference);
    }

    /**
     * Locks the booking's intent while the booking is live: held, or a pay-after-ride one
     * still waiting. Empty if the booking has none. One already ended is a bug in the
     * caller: a booking ends once.
     */
    private Optional<Intent> lockOpen(long bookingId) {
        Optional<Intent> found = lock(bookingId);
        if (found.isPresent() && !List.of("HELD", "DEFERRED").contains(found.get().status())) {
            throw new IllegalStateException("Payment for booking " + bookingId + " is already settled");
        }
        return found;
    }

    /** Locks the intent of a pay-after-ride booking that owes something and is not yet paid. */
    private Intent lockDue(long bookingId) {
        return lock(bookingId).filter(intent -> "DUE".equals(intent.status()))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.CONFLICT, "Nothing is due on this booking"));
    }

    private Optional<Intent> lock(long bookingId) {
        return jdbc.query("""
                SELECT id, fare, service_fee, amount, provider_ref, status, deferred, amount_due, due_reason
                FROM payment_intents WHERE booking_id = ? FOR UPDATE""",
                (rs, n) -> new Intent(rs.getLong("id"), rs.getBigDecimal("fare"),
                        rs.getBigDecimal("service_fee"), rs.getBigDecimal("amount"),
                        rs.getString("provider_ref"), rs.getString("status"), rs.getBoolean("deferred"),
                        rs.getBigDecimal("amount_due"), rs.getString("due_reason")),
                bookingId).stream().findFirst();
    }

    private void entry(long intentId, String kind, BigDecimal amount) {
        jdbc.update("INSERT INTO ledger_entries (intent_id, kind, amount) VALUES (?, ?, ?)",
                intentId, kind, amount);
    }
}
