package com.dypcet.vayora.hazard;

import com.dypcet.vayora.eventlog.EventLogService;
import com.dypcet.vayora.eventlog.EventType;
import com.dypcet.vayora.hazard.HazardScorer.Score;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Re-scores every confirmed booking that has not left yet.
 *
 * <p>Each score is appended to the event log as {@code hazard_scored}; nothing is updated
 * in place, so the history of what the model said and when is kept. A booking is scored
 * at most once per calendar day however often this runs. The score changes nothing about
 * the booking: it is information for the platform, never a decision.
 */
@Service
public class HazardScoringService {

    private static final Logger log = LoggerFactory.getLogger(HazardScoringService.class);
    private static final ZoneId INDIA_ZONE = ZoneId.of("Asia/Kolkata");
    /** Arbitrary; only has to be unique among this application's advisory locks. */
    private static final long SCORING_LOCK = 4972001L;

    /**
     * @param scored        bookings given a new score in this run
     * @param alreadyScored bookings skipped because they had been scored today
     * @param failed        bookings for which no score could be obtained
     * @param skippedRun    true if another run held the lock and this one did nothing
     */
    public record Summary(int scored, int alreadyScored, int failed, boolean skippedRun) {
    }

    record Scored(long bookingId, double survivalProbability, double elapsedHours,
            double horizonHours, String modelVersion, String featureVersion,
            Map<String, Double> contributions) {
    }

    /** The newest score of one live booking. */
    public record LatestScore(long bookingId, long rideId, String passengerName, String fromStop,
            String toStop, Instant boardingTime, double survivalProbability, String modelVersion,
            Instant scoredAt, Map<String, Double> contributions) {
    }

    private record Candidate(long bookingId, String features, Instant acceptedAt, Instant boarding) {
    }

    private final JdbcTemplate jdbc;
    private final HazardScorer scorer;
    private final EventLogService events;
    private final ObjectMapper mapper;
    private final Clock clock;

    public HazardScoringService(JdbcTemplate jdbc, HazardScorer scorer, EventLogService events,
            ObjectMapper mapper, Clock clock) {
        this.jdbc = jdbc;
        this.scorer = scorer;
        this.events = events;
        this.mapper = mapper;
        this.clock = clock;
    }

    @Scheduled(cron = "${vayora.hazard.scoring-cron}", zone = "Asia/Kolkata")
    void scheduledRun() {
        Summary summary = scoreActiveBookings();
        log.info("Hazard scoring: {}", summary);
    }

    @Transactional
    public Summary scoreActiveBookings() {
        // Two overlapping runs would each see a booking as not yet scored today.
        Boolean locked = jdbc.queryForObject(
                "SELECT pg_try_advisory_xact_lock(?)", Boolean.class, SCORING_LOCK);
        if (!Boolean.TRUE.equals(locked)) {
            return new Summary(0, 0, 0, true);
        }
        Instant now = clock.instant();
        Instant today = now.atZone(INDIA_ZONE).toLocalDate().atStartOfDay(INDIA_ZONE).toInstant();

        List<Candidate> candidates = jdbc.query("""
                SELECT b.id, b.hazard_features::text AS features, b.accepted_at,
                       r.departure_time + make_interval(mins => s.offset_minutes) AS boarding
                FROM bookings b
                JOIN rides r ON r.id = b.ride_id
                JOIN ride_stops s ON s.ride_id = b.ride_id AND s.seq = b.from_seq
                WHERE b.status = 'CONFIRMED' AND r.status = 'SCHEDULED'
                  AND b.hazard_features IS NOT NULL AND b.accepted_at IS NOT NULL
                  AND r.departure_time + make_interval(mins => s.offset_minutes) > ?
                ORDER BY b.id""",
                (rs, n) -> new Candidate(rs.getLong("id"), rs.getString("features"),
                        rs.getObject("accepted_at", OffsetDateTime.class).toInstant(),
                        rs.getObject("boarding", OffsetDateTime.class).toInstant()),
                utc(now));

        int scored = 0;
        int alreadyScored = 0;
        int failed = 0;
        for (Candidate candidate : candidates) {
            if (scoredSince(candidate.bookingId(), today)) {
                alreadyScored++;
                continue;
            }
            double elapsed = hours(candidate.acceptedAt(), now);
            double horizon = hours(candidate.acceptedAt(), candidate.boarding());
            Optional<Score> score = features(candidate)
                    .flatMap(features -> scorer.score(features, elapsed, horizon));
            if (score.isEmpty()) {
                failed++;
                continue;
            }
            events.write(EventType.HAZARD_SCORED, new Scored(candidate.bookingId(),
                    score.get().survivalProbability(), elapsed, horizon,
                    score.get().modelVersion(), score.get().featureVersion(),
                    score.get().contributions()));
            scored++;
        }
        return new Summary(scored, alreadyScored, failed, false);
    }

    /** The most recent score of every confirmed booking on a ride that has not started. */
    public List<LatestScore> latestScores() {
        return jdbc.query("""
                SELECT DISTINCT ON (b.id)
                       b.id, b.ride_id, u.full_name, s.name AS from_stop, t.name AS to_stop,
                       r.departure_time + make_interval(mins => s.offset_minutes) AS boarding,
                       (e.payload->>'survival_probability')::float8 AS survival,
                       e.payload->>'model_version' AS model_version, e.sim_time,
                       e.payload->'contributions' AS contributions
                FROM bookings b
                JOIN rides r ON r.id = b.ride_id
                JOIN users u ON u.id = b.passenger_id
                JOIN ride_stops s ON s.ride_id = b.ride_id AND s.seq = b.from_seq
                JOIN ride_stops t ON t.ride_id = b.ride_id AND t.seq = b.to_seq
                JOIN events e ON e.event_type = 'hazard_scored' AND e.run_id IS NULL
                             AND e.payload @> jsonb_build_object('booking_id', b.id)
                WHERE b.status = 'CONFIRMED' AND r.status = 'SCHEDULED'
                ORDER BY b.id, e.id DESC""",
                (rs, n) -> new LatestScore(rs.getLong("id"), rs.getLong("ride_id"),
                        rs.getString("full_name"), rs.getString("from_stop"),
                        rs.getString("to_stop"),
                        rs.getObject("boarding", OffsetDateTime.class).toInstant(),
                        rs.getDouble("survival"), rs.getString("model_version"),
                        rs.getObject("sim_time", OffsetDateTime.class).toInstant(),
                        shares(rs.getString("contributions"))));
    }

    /** Scores logged before explanations existed have none. */
    private Map<String, Double> shares(String json) {
        if (json == null) {
            return Map.of();
        }
        try {
            return mapper.readValue(json, new TypeReference<Map<String, Double>>() { });
        } catch (JsonProcessingException e) {
            return Map.of();
        }
    }

    private boolean scoredSince(long bookingId, Instant since) {
        return Boolean.TRUE.equals(jdbc.queryForObject("""
                SELECT EXISTS (
                    SELECT 1 FROM events
                    WHERE event_type = 'hazard_scored' AND run_id IS NULL
                      AND payload @> jsonb_build_object('booking_id', ?::bigint)
                      AND sim_time >= ?)""",
                Boolean.class, bookingId, utc(since)));
    }

    private Optional<Map<String, Double>> features(Candidate candidate) {
        try {
            return Optional.of(mapper.readValue(candidate.features(),
                    new TypeReference<Map<String, Double>>() { }));
        } catch (JsonProcessingException e) {
            log.warn("Booking {} has unreadable hazard features", candidate.bookingId());
            return Optional.empty();
        }
    }

    private static double hours(Instant from, Instant to) {
        return Math.max(0, Duration.between(from, to).toSeconds()) / 3600.0;
    }

    private static OffsetDateTime utc(Instant instant) {
        return OffsetDateTime.ofInstant(instant, ZoneOffset.UTC);
    }
}
