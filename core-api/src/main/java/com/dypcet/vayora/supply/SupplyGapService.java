package com.dypcet.vayora.supply;

import com.dypcet.vayora.eventlog.EventLogService;
import com.dypcet.vayora.eventlog.EventType;
import com.dypcet.vayora.eventlog.HasActor;
import com.dypcet.vayora.notification.NotificationService;
import com.dypcet.vayora.notification.NotificationService.Type;
import com.dypcet.vayora.notification.Text;
import java.time.Clock;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Finds stretches and days where passengers searched and found no ride, and tells a few
 * drivers who have driven that stretch before. Nothing more: no driver is pressed twice in
 * a week, and the notice only says what passengers looked for.
 *
 * <p>Everything is read from the event log's live writes (run_id null): a search and the
 * count of rides it was offered. How often a nudge leads to a ride is logged as
 * nudge_converted for the record, and is not a result: the project's rules make driver
 * response a swept assumption in the simulator, never a reported finding.
 */
@Service
public class SupplyGapService {

    private static final ZoneId INDIA_ZONE = ZoneId.of("Asia/Kolkata");

    /**
     * @param emptySearches searches for that day and stretch that were offered no ride
     * @param driversNudged drivers told about it so far
     */
    public record Gap(LocalDate date, String fromStop, String toStop, int emptySearches, int driversNudged) {
    }

    record GapDetected(String date, String fromStop, String toStop, int emptySearches) implements HasActor {
        @Override
        public String actorType() {
            return "platform";
        }

        @Override
        public Long actorId() {
            return null;
        }
    }

    record NudgeIssued(long driverId, String date, String fromStop, String toStop) implements HasActor {
        @Override
        public String actorType() {
            return "platform";
        }

        @Override
        public Long actorId() {
            return null;
        }
    }

    record NudgeConverted(long driverId, long rideId, String date, String fromStop, String toStop) implements HasActor {
        @Override
        public String actorType() {
            return "driver";
        }

        @Override
        public Long actorId() {
            return driverId;
        }
    }

    private final JdbcTemplate jdbc;
    private final EventLogService events;
    private final NotificationService notifications;
    private final Clock clock;
    private final int horizonDays;
    private final int minEmptySearches;
    private final double nearStopMetres;
    private final int driverHistoryDays;
    private final int daysBetweenNudges;
    private final int mostNudgesPerGap;

    public SupplyGapService(JdbcTemplate jdbc, EventLogService events, NotificationService notifications, Clock clock,
            @Value("${vayora.supply.horizon-days}") int horizonDays,
            @Value("${vayora.supply.min-empty-searches}") int minEmptySearches,
            @Value("${vayora.supply.near-stop-km}") double nearStopKm,
            @Value("${vayora.supply.driver-history-days}") int driverHistoryDays,
            @Value("${vayora.supply.days-between-nudges}") int daysBetweenNudges,
            @Value("${vayora.supply.most-nudges-per-gap}") int mostNudgesPerGap) {
        this.jdbc = jdbc;
        this.events = events;
        this.notifications = notifications;
        this.clock = clock;
        this.horizonDays = horizonDays;
        this.minEmptySearches = minEmptySearches;
        this.nearStopMetres = nearStopKm * 1000.0;
        this.driverHistoryDays = driverHistoryDays;
        this.daysBetweenNudges = daysBetweenNudges;
        this.mostNudgesPerGap = mostNudgesPerGap;
    }

    /** Days from today to the horizon where enough searches on one stretch found nothing. */
    public List<Gap> upcoming() {
        LocalDate today = LocalDate.now(clock.withZone(INDIA_ZONE));
        return jdbc.query("""
                WITH searched AS (
                    SELECT s.id, (s.payload->>'date')::date AS day,
                           ST_SetSRID(ST_MakePoint((s.payload->>'origin_lon')::float8,
                                                   (s.payload->>'origin_lat')::float8), 4326)::geography AS o,
                           ST_SetSRID(ST_MakePoint((s.payload->>'destination_lon')::float8,
                                                   (s.payload->>'destination_lat')::float8), 4326)::geography AS d,
                           (SELECT (c.payload->>'count')::int FROM events c
                            WHERE c.run_id IS NULL AND c.event_type = 'candidates_returned'
                              AND c.actor_id = s.actor_id AND c.id > s.id
                            ORDER BY c.id LIMIT 1) AS offered
                    FROM events s
                    WHERE s.run_id IS NULL AND s.event_type = 'search_issued'
                      AND (s.payload->>'date')::date BETWEEN ? AND ?
                ), named AS (
                    SELECT day,
                           (SELECT name FROM ride_stops x WHERE ST_DWithin(x.location, o, ?)
                            ORDER BY x.location <-> o LIMIT 1) AS from_stop,
                           (SELECT name FROM ride_stops x WHERE ST_DWithin(x.location, d, ?)
                            ORDER BY x.location <-> d LIMIT 1) AS to_stop
                    FROM searched WHERE offered = 0
                )
                SELECT day, from_stop, to_stop, COUNT(*) AS empty_searches,
                       (SELECT COUNT(*) FROM events n WHERE n.run_id IS NULL AND n.event_type = 'nudge_issued'
                          AND n.payload->>'date' = day::text AND n.payload->>'from_stop' = from_stop
                          AND n.payload->>'to_stop' = to_stop) AS nudged
                FROM named
                WHERE from_stop IS NOT NULL AND to_stop IS NOT NULL AND from_stop <> to_stop
                GROUP BY day, from_stop, to_stop
                HAVING COUNT(*) >= ?
                ORDER BY day, empty_searches DESC, from_stop, to_stop""",
                (rs, n) -> new Gap(rs.getObject("day", LocalDate.class), rs.getString("from_stop"),
                        rs.getString("to_stop"), rs.getInt("empty_searches"), rs.getInt("nudged")),
                today, today.plusDays(horizonDays), nearStopMetres, nearStopMetres, minEmptySearches);
    }

    /** Logs each new gap once, and nudges drivers about it. Returns how many were nudged. */
    @Transactional
    public int detectAndNudge() {
        int nudged = 0;
        for (Gap gap : upcoming()) {
            String day = gap.date().toString();
            if (!seenBefore(day, gap.fromStop(), gap.toStop())) {
                events.write(EventType.SUPPLY_GAP_DETECTED,
                        new GapDetected(day, gap.fromStop(), gap.toStop(), gap.emptySearches()));
            }
            for (long driver : driversFor(gap)) {
                notifications.send(driver, Type.SUPPLY_NUDGE, Text.of("Passengers looked for a ride from {from} to {to}"
                                + " on {date} and found none. If you are driving then, you could offer seats.",
                        "from", gap.fromStop(), "to", gap.toStop(), "date", day), null);
                events.write(EventType.NUDGE_ISSUED, new NudgeIssued(driver, day, gap.fromStop(), gap.toStop()));
                nudged++;
            }
        }
        return nudged;
    }

    /**
     * When a driver publishes a ride on a day and stretch they were nudged about, logs that
     * once. Called for every ride published.
     */
    public void published(long driverId, long rideId) {
        jdbc.query("""
                SELECT n.payload->>'date' AS day, n.payload->>'from_stop' AS from_stop, n.payload->>'to_stop' AS to_stop
                FROM events n
                JOIN rides r ON r.id = ?
                JOIN ride_stops a ON a.ride_id = r.id AND a.name = n.payload->>'from_stop'
                JOIN ride_stops b ON b.ride_id = r.id AND b.name = n.payload->>'to_stop' AND b.seq > a.seq
                WHERE n.run_id IS NULL AND n.event_type = 'nudge_issued'
                  AND (n.payload->>'driver_id')::bigint = ?
                  AND n.payload->>'date' = ((r.departure_time + make_interval(mins => a.offset_minutes))
                                            AT TIME ZONE 'Asia/Kolkata')::date::text
                  AND NOT EXISTS (SELECT 1 FROM events c WHERE c.run_id IS NULL AND c.event_type = 'nudge_converted'
                                    AND (c.payload->>'driver_id')::bigint = ? AND c.payload->>'date' = n.payload->>'date'
                                    AND c.payload->>'from_stop' = n.payload->>'from_stop'
                                    AND c.payload->>'to_stop' = n.payload->>'to_stop')
                LIMIT 1""",
                (org.springframework.jdbc.core.RowCallbackHandler) rs ->
                        events.write(EventType.NUDGE_CONVERTED, new NudgeConverted(driverId, rideId,
                                rs.getString("day"), rs.getString("from_stop"), rs.getString("to_stop"))),
                rideId, driverId, driverId);
    }

    private boolean seenBefore(String day, String from, String to) {
        return Boolean.TRUE.equals(jdbc.queryForObject("""
                SELECT EXISTS (SELECT 1 FROM events WHERE run_id IS NULL AND event_type = 'supply_gap_detected'
                                 AND payload->>'date' = ? AND payload->>'from_stop' = ? AND payload->>'to_stop' = ?)""",
                Boolean.class, day, from, to));
    }

    /**
     * Drivers who completed a ride on this stretch recently, were not nudged in the last
     * few days, and are not already offering this stretch that day; most experienced first.
     */
    private List<Long> driversFor(Gap gap) {
        int left = mostNudgesPerGap - gap.driversNudged();
        if (left <= 0) {
            return List.of();
        }
        return jdbc.queryForList("""
                SELECT r.driver_id
                FROM rides r
                JOIN ride_stops a ON a.ride_id = r.id AND a.name = ?
                JOIN ride_stops b ON b.ride_id = r.id AND b.name = ? AND b.seq > a.seq
                JOIN users u ON u.id = r.driver_id AND u.status = 'ACTIVE'
                WHERE r.status = 'COMPLETED' AND r.departure_time > now() - make_interval(days => ?)
                  AND NOT EXISTS (SELECT 1 FROM events n WHERE n.run_id IS NULL AND n.event_type = 'nudge_issued'
                                    AND (n.payload->>'driver_id')::bigint = r.driver_id
                                    AND n.sim_time > now() - make_interval(days => ?))
                  AND NOT EXISTS (SELECT 1 FROM rides o
                                    JOIN ride_stops oa ON oa.ride_id = o.id AND oa.name = a.name
                                    JOIN ride_stops ob ON ob.ride_id = o.id AND ob.name = b.name AND ob.seq > oa.seq
                                  WHERE o.driver_id = r.driver_id AND o.status = 'SCHEDULED'
                                    AND (o.departure_time AT TIME ZONE 'Asia/Kolkata')::date = ?)
                GROUP BY r.driver_id
                ORDER BY COUNT(*) DESC, r.driver_id
                LIMIT ?""",
                Long.class, gap.fromStop(), gap.toStop(), driverHistoryDays, daysBetweenNudges, gap.date(), left);
    }
}
