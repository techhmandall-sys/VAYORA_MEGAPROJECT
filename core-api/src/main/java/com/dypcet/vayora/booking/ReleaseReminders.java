package com.dypcet.vayora.booking;

import com.dypcet.vayora.eventlog.EventLogService;
import com.fasterxml.jackson.annotation.JsonInclude;
import com.dypcet.vayora.eventlog.EventType;
import com.dypcet.vayora.eventlog.HasActor;
import com.dypcet.vayora.hazard.HazardScoringService;
import com.dypcet.vayora.hazard.HazardScoringService.LatestScore;
import com.dypcet.vayora.hazard.IntelContactScheduler;
import com.dypcet.vayora.hazard.IntelContactScheduler.Candidate;
import com.dypcet.vayora.hazard.IntelContactScheduler.Limits;
import com.dypcet.vayora.notification.NotificationService;
import com.dypcet.vayora.notification.NotificationService.Type;
import com.dypcet.vayora.notification.Text;
import com.dypcet.vayora.refund.RefundPolicy;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * Asks passengers with a confirmed seat, once, shortly before boarding, to release it if
 * their plans have changed (feature 79): a seat released while someone can still take it is
 * the project's whole idea. Nothing is ever cancelled or priced for anyone, and the message
 * says nothing about any model.
 *
 * <p>Whom it asks is {@link ReminderTargeting}. Targeted, as chosen on 2026-10-20: only
 * bookings the durability model last rated below the threshold, and when they are more than
 * the budget allows, those intel's contact scheduler chooses (feature 80), as the
 * simulator's B5. A booking not chosen stays due for the next run; an unscored booking is
 * not asked, nor anyone while the scheduler cannot be reached. Untargeted: everyone alike.
 * In the simulator neither added completed rides, so no gain is claimed.
 */
@Service
@EnableConfigurationProperties(ReminderTargeting.class)
public class ReleaseReminders {

    private static final Logger log = LoggerFactory.getLogger(ReleaseReminders.class);
    private static final ZoneId INDIA_ZONE = ZoneId.of("Asia/Kolkata");

    /**
     * Logged as the simulator logs a request.
     *
     * @param survivalProbability the score the choice rested on; null when everyone is asked
     * @param chosenBy            "everyone" or "scheduler"
     */
    @JsonInclude(JsonInclude.Include.NON_NULL)
    record Issued(long bookingId, long passengerId, String action, Double survivalProbability, String chosenBy)
            implements HasActor {
        @Override
        public String actorType() {
            return "platform";
        }

        @Override
        public Long actorId() {
            return null;
        }
    }

    record Due(long bookingId, long passengerId, long rideId, int seats, BigDecimal fare, String fromStop,
            String toStop, Instant boarding, Double survival) {

        Due scored(double survival) {
            return new Due(bookingId, passengerId, rideId, seats, fare, fromStop, toStop, boarding, survival);
        }
    }

    private static final String DUE = """
            SELECT b.id, b.passenger_id, b.ride_id, b.seats, b.price, f.name AS from_stop, t.name AS to_stop, boarding
            FROM bookings b
            JOIN rides r ON r.id = b.ride_id
            JOIN ride_stops f ON f.ride_id = r.id AND f.seq = b.from_seq
            JOIN ride_stops t ON t.ride_id = r.id AND t.seq = b.to_seq
            CROSS JOIN LATERAL (SELECT r.departure_time + make_interval(mins => f.offset_minutes) AS boarding) s
            WHERE b.status = 'CONFIRMED' AND r.status = 'SCHEDULED' AND b.release_reminded_at IS NULL
              AND boarding > ? AND boarding <= ?
              AND b.created_at < boarding - make_interval(secs => ?)""";

    private final JdbcTemplate jdbc;
    private final NotificationService notifications;
    private final EventLogService events;
    private final RefundPolicy refunds;
    private final HazardScoringService scores;
    private final IntelContactScheduler scheduler;
    private final ReminderTargeting targeting;
    private final TransactionTemplate transaction;
    private final Clock clock;
    private final Duration before;

    public ReleaseReminders(JdbcTemplate jdbc, NotificationService notifications, EventLogService events,
            RefundPolicy refunds, HazardScoringService scores, IntelContactScheduler scheduler,
            ReminderTargeting targeting, PlatformTransactionManager transactions, Clock clock,
            @Value("${vayora.reminders.release-before}") Duration before) {
        this.jdbc = jdbc;
        this.notifications = notifications;
        this.events = events;
        this.refunds = refunds;
        this.scores = scores;
        this.scheduler = scheduler;
        this.targeting = targeting;
        this.transaction = new TransactionTemplate(transactions);
        this.clock = clock;
        this.before = before;
    }

    /**
     * Reminds the bookings now within the reminder window that have not been reminded, or,
     * targeted, those of them chosen. A booking made inside the window is never reminded: it
     * was just made. Whom to ask is worked out before anything is locked, as the scheduler
     * may take seconds; the chosen are then locked and checked again.
     *
     * @return how many passengers were reminded
     */
    public int remindDue() {
        Instant now = clock.instant();
        List<Due> due = jdbc.query(DUE + " ORDER BY b.id", (rs, n) -> due(rs), window(now));
        List<Due> chosen = targeting.enabled() ? chosen(due, now) : due;
        if (chosen.isEmpty()) {
            return 0;
        }
        Map<Long, Due> byId = chosen.stream().collect(Collectors.toMap(Due::bookingId, d -> d));
        Integer reminded = transaction.execute(status -> {
            String ids = String.join(", ", java.util.Collections.nCopies(byId.size(), "?"));
            List<Long> stillDue = jdbc.query(DUE + " AND b.id IN (" + ids + ") ORDER BY b.id FOR UPDATE OF b SKIP LOCKED",
                    (rs, n) -> rs.getLong("id"), append(window(now), byId.keySet().toArray()));
            for (Long id : stillDue) {
                remind(byId.get(id), now);
            }
            return stillDue.size();
        });
        return reminded == null ? 0 : reminded;
    }

    /** The due bookings the model rates below the threshold, as the scheduler chooses among them. */
    private List<Due> chosen(List<Due> due, Instant now) {
        if (due.isEmpty()) {
            return due;
        }
        Map<Long, Double> latest = scores.latestScores().stream()
                .collect(Collectors.toMap(LatestScore::bookingId, LatestScore::survivalProbability));
        List<Due> risky = due.stream()
                .filter(d -> latest.containsKey(d.bookingId()) && latest.get(d.bookingId()) < targeting.survivalThreshold())
                .map(d -> d.scored(latest.get(d.bookingId())))
                .toList();
        if (risky.isEmpty()) {
            return risky;
        }
        Optional<List<Long>> plan = scheduler.plan(
                risky.stream().map(d -> new Candidate(d.bookingId(), d.rideId(),
                        d.boarding().atZone(INDIA_ZONE).toLocalDate().toEpochDay(), d.seats(), d.survival(),
                        Duration.between(now, d.boarding()).toMinutes() / 60.0)).toList(),
                new Limits(targeting.contactsPerRound(), targeting.contactsPerRide(), targeting.seatsPerDepartureDay(),
                        targeting.refillHorizonHours(), targeting.solverTimeLimitSeconds()));
        if (plan.isEmpty()) {
            log.warn("No release reminders this run: the contact scheduler did not answer. {} stay due.", risky.size());
            return List.of();
        }
        Set<Long> picked = Set.copyOf(plan.get());
        return risky.stream().filter(d -> picked.contains(d.bookingId())).toList();
    }

    private void remind(Due booking, Instant now) {
        jdbc.update("UPDATE bookings SET release_reminded_at = ? WHERE id = ?", utc(now), booking.bookingId());
        BigDecimal owed = refunds.owedOnCancelling(booking.fare(), Duration.between(now, booking.boarding()));
        String when = booking.boarding().truncatedTo(ChronoUnit.SECONDS).toString();
        notifications.send(booking.passengerId(), Type.RELEASE_REMINDER, owed.signum() == 0
                ? Text.of("Your seat from {from} to {to} leaves {when}. If your plans have changed, cancelling now lets "
                        + "someone else take it, and you would owe nothing. "
                        + "If you are still travelling, there is nothing to do.",
                        "from", booking.fromStop(), "to", booking.toStop(), "when", when)
                : Text.of("Your seat from {from} to {to} leaves {when}. If your plans have changed, cancelling now lets "
                        + "someone else take it, and you would owe your driver Rs {owed} of your Rs {fare} fare. "
                        + "If you are still travelling, there is nothing to do.",
                        "from", booking.fromStop(), "to", booking.toStop(), "when", when,
                        "owed", owed.toPlainString(), "fare", booking.fare().toPlainString()),
                booking.bookingId());
        events.write(EventType.INTERVENTION_ISSUED, new Issued(booking.bookingId(), booking.passengerId(),
                "release_reminder", booking.survival(), targeting.enabled() ? "scheduler" : "everyone"));
    }

    private Object[] window(Instant now) {
        return new Object[] {utc(now), utc(now.plus(before)), (double) before.toSeconds()};
    }

    private static Object[] append(Object[] parameters, Object[] more) {
        Object[] all = java.util.Arrays.copyOf(parameters, parameters.length + more.length);
        System.arraycopy(more, 0, all, parameters.length, more.length);
        return all;
    }

    private static Due due(java.sql.ResultSet rs) throws java.sql.SQLException {
        return new Due(rs.getLong("id"), rs.getLong("passenger_id"), rs.getLong("ride_id"), rs.getInt("seats"),
                rs.getBigDecimal("price"), rs.getString("from_stop"), rs.getString("to_stop"),
                rs.getObject("boarding", OffsetDateTime.class).toInstant(), null);
    }

    private static OffsetDateTime utc(Instant instant) {
        return OffsetDateTime.ofInstant(instant, ZoneOffset.UTC);
    }
}
