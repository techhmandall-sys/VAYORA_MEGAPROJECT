-- VAYORA metric queries. Every number in the report comes from one of these.
--
-- Each query starts with a `-- name:` line and binds :run_id and :variant
-- (see experiments/analysis/queries.py). All queries return one row per seed.
--
-- Payload contract these queries rely on:
--   booking_cancelled.payload.departure_time  ISO-8601 timestamp with offset —
--   the scheduled departure of the ride whose seat was released.

-- name: primary_metric
-- Completed rides per 100 searches. The only headline number.
SELECT seed,
  COUNT(*) FILTER (WHERE event_type = 'search_issued')   AS searches,
  COUNT(*) FILTER (WHERE event_type = 'trip_completed')  AS completed,
  100.0 * COUNT(*) FILTER (WHERE event_type = 'trip_completed')
        / NULLIF(COUNT(*) FILTER (WHERE event_type = 'search_issued'), 0)
        AS per_100
FROM events
WHERE run_id = :run_id AND variant = :variant
GROUP BY seed
ORDER BY seed;

-- name: late_cancellation_share
-- Cancellations made less than 24 hours before departure, as a fraction of all
-- cancellations. Exactly 24 hours before departure is not late.
-- A seed with no cancellations returns no row.
-- missing_departure_time must be 0: such rows sit in the denominator but can
-- never count as late, so any non-zero value means late_share is understated.
SELECT seed,
  COUNT(*) AS cancellations,
  COUNT(*) FILTER (
    WHERE CAST(payload->>'departure_time' AS timestamptz) - sim_time < INTERVAL '24 hours'
  ) AS late,
  COUNT(*) FILTER (WHERE payload->>'departure_time' IS NULL) AS missing_departure_time,
  1.0 * COUNT(*) FILTER (
    WHERE CAST(payload->>'departure_time' AS timestamptz) - sim_time < INTERVAL '24 hours'
  ) / COUNT(*) AS late_share
FROM events
WHERE run_id = :run_id AND variant = :variant
  AND event_type = 'booking_cancelled'
GROUP BY seed
ORDER BY seed;

-- name: funnel_rates
-- booking_rate           booking requests per search
-- acceptance_rate        accepted requests as a fraction of all requests
--                        (a request never answered counts as not accepted)
-- recovery_success_rate  recovery searches that ended in a booking
SELECT seed,
  1.0 * COUNT(*) FILTER (WHERE event_type = 'booking_requested')
      / NULLIF(COUNT(*) FILTER (WHERE event_type = 'search_issued'), 0)
      AS booking_rate,
  1.0 * COUNT(*) FILTER (WHERE event_type = 'booking_accepted')
      / NULLIF(COUNT(*) FILTER (WHERE event_type = 'booking_requested'), 0)
      AS acceptance_rate,
  1.0 * COUNT(*) FILTER (WHERE event_type = 'recovery_booked')
      / NULLIF(COUNT(*) FILTER (WHERE event_type = 'recovery_search'), 0)
      AS recovery_success_rate
FROM events
WHERE run_id = :run_id AND variant = :variant
GROUP BY seed
ORDER BY seed;

-- name: intervention_volume
-- asked         reconfirmation requests sent
-- released      requests the passenger answered by giving the seat up
-- refilled      bookings that took a seat a passenger had released earlier
-- contact_rate  requests per accepted booking: the contact budget actually spent
-- A seed with no accepted booking has an undefined contact_rate, not zero.
SELECT seed,
  COUNT(*) FILTER (WHERE event_type = 'intervention_issued') AS asked,
  COUNT(*) FILTER (WHERE event_type = 'intervention_responded'
                     AND payload->>'response' = 'released') AS released,
  COUNT(*) FILTER (WHERE event_type = 'seat_refilled') AS refilled,
  1.0 * COUNT(*) FILTER (WHERE event_type = 'intervention_issued')
      / NULLIF(COUNT(*) FILTER (WHERE event_type = 'booking_accepted'), 0)
      AS contact_rate
FROM events
WHERE run_id = :run_id AND variant = :variant
GROUP BY seed
ORDER BY seed;

-- name: refill_additionality
-- Can a refilled seat have added a booking, or did it only move one?
--
-- searches_shown       searches, first or repeat, that got an answer
-- shown_nothing        of those, the ones offered no ride at all
-- empty_share          shown_nothing / searches_shown: how often seats are what is missing
-- refills              bookings that took a seat somebody had released
-- refills_only_option  of those, the ones whose search was offered that ride and no other
-- only_option_share    refills_only_option / refills; undefined with no refills
--
-- refills_only_option describes who takes released seats. It does NOT bound the bookings
-- released seats add (corrected 2026-11-04): a refiller who had another ride on offer leaves
-- that ride's seat free, and a later searcher with no other option can take it, a booking
-- added with no only-option refill at all. What a policy adds is measured by comparing seats
-- standing at departure, which change by refilled minus released minus otherwise-empty seats.
--
-- A booking is matched to the answer its own search got by search id and instant, since
-- a repeat search reuses the search id. Matching is by grouping, not joining: the keys
-- live inside the payload, where a join has no statistics to plan with.
WITH scoped AS (
  SELECT seed, sim_time, event_type, payload
  FROM events
  WHERE run_id = :run_id AND variant = :variant
    AND event_type IN ('candidates_returned', 'booking_requested', 'seat_refilled')
),
booked AS (
  -- One row per booking: the search that made it, when, and whether it took a released seat.
  SELECT seed,
         MAX(payload->>'search_id') AS search_id,
         MAX(sim_time) FILTER (WHERE event_type = 'booking_requested') AS requested_at,
         BOOL_OR(event_type = 'seat_refilled') AS refilled
  FROM scoped
  WHERE event_type IN ('booking_requested', 'seat_refilled')
  GROUP BY seed, payload->>'booking_id'
),
answers AS (
  -- One row per answer a search got, with whether the booking it led to was a refill.
  SELECT seed, MAX(offered) AS offered, BOOL_OR(refilled) AS refilled
  FROM (
    SELECT seed, payload->>'search_id' AS search_id, sim_time AS at,
           (payload->>'count')::int AS offered, FALSE AS refilled
    FROM scoped
    WHERE event_type = 'candidates_returned'
    UNION ALL
    SELECT seed, search_id, requested_at, NULL, TRUE
    FROM booked
    WHERE refilled
  ) both_kinds
  GROUP BY seed, search_id, at
)
SELECT seed,
  COUNT(*) FILTER (WHERE offered IS NOT NULL) AS searches_shown,
  COUNT(*) FILTER (WHERE offered = 0) AS shown_nothing,
  1.0 * COUNT(*) FILTER (WHERE offered = 0)
      / NULLIF(COUNT(*) FILTER (WHERE offered IS NOT NULL), 0) AS empty_share,
  COUNT(*) FILTER (WHERE refilled) AS refills,
  COUNT(*) FILTER (WHERE refilled AND offered = 1) AS refills_only_option,
  1.0 * COUNT(*) FILTER (WHERE refilled AND offered = 1)
      / NULLIF(COUNT(*) FILTER (WHERE refilled), 0) AS only_option_share
FROM answers
GROUP BY seed
ORDER BY seed;

-- name: empty_search_reasons
-- Why a search was offered nothing: no published ride left in the passenger's time window,
-- or rides in it without enough seats. Counts every answer, first or repeat, as
-- refill_additionality does, so searches_shown and shown_nothing equal its columns.
--
-- searches_shown   searches that got an answer
-- shown_nothing    of those, the ones offered no ride
-- no_ride_then     offered nothing because no published ride left in the window
-- rides_full       offered nothing although rides left in the window: none had the seats
-- reason_unknown   offered nothing, logged before rides_in_window existed; must be 0
-- no_ride_share    no_ride_then / searches_shown
-- full_share       rides_full / searches_shown
--
-- The two shares are undefined for a seed with any reason unknown, rather than wrong.
SELECT seed,
  COUNT(*) AS searches_shown,
  COUNT(*) FILTER (WHERE offered = 0) AS shown_nothing,
  COUNT(*) FILTER (WHERE offered = 0 AND in_window = 0) AS no_ride_then,
  COUNT(*) FILTER (WHERE offered = 0 AND in_window > 0) AS rides_full,
  COUNT(*) FILTER (WHERE offered = 0 AND in_window IS NULL) AS reason_unknown,
  CASE WHEN COUNT(*) FILTER (WHERE offered = 0 AND in_window IS NULL) = 0
       THEN 1.0 * COUNT(*) FILTER (WHERE offered = 0 AND in_window = 0) / COUNT(*)
  END AS no_ride_share,
  CASE WHEN COUNT(*) FILTER (WHERE offered = 0 AND in_window IS NULL) = 0
       THEN 1.0 * COUNT(*) FILTER (WHERE offered = 0 AND in_window > 0) / COUNT(*)
  END AS full_share
FROM (
  SELECT seed, (payload->>'count')::int AS offered,
         (payload->>'rides_in_window')::int AS in_window
  FROM events
  WHERE run_id = :run_id AND variant = :variant
    AND event_type = 'candidates_returned'
) answers
GROUP BY seed
ORDER BY seed;

-- name: refill_by_release_timing
-- Are seats a passenger releases late refilled anyway, and how much better do early ones do?
--
-- Seats on a ride are interchangeable, so a refill cannot be tied to one release. This is
-- therefore answered per ride: rides whose passenger releases were all early (24 hours or
-- more before departure), and rides whose releases were all late. Rides with both, and
-- rides a driver cancelled bookings on, are left out.
--
-- early_rides, early_released, early_refilled   rides with only early releases, and their seats
-- early_refill_share                             early_refilled / early_released
-- late_rides, late_released, late_refilled       the same for rides with only late releases
-- late_refill_share                              late_refilled / late_released
--
-- If late releases are refilled about as often as early ones, freeing a seat earlier has
-- little left to gain.
WITH scoped AS (
  SELECT seed, sim_time, event_type, payload
  FROM events
  WHERE run_id = :run_id AND variant = :variant
    AND event_type IN ('booking_cancelled', 'seat_refilled')
),
rides AS (
  SELECT seed, payload->>'ride_id' AS ride_id,
         SUM((payload->>'seats')::int) FILTER (
             WHERE event_type = 'booking_cancelled' AND payload->>'cancelled_by' = 'passenger')
             AS released,
         SUM((payload->>'seats')::int) FILTER (WHERE event_type = 'seat_refilled') AS refilled,
         BOOL_OR(event_type = 'booking_cancelled' AND payload->>'cancelled_by' = 'passenger'
                 AND CAST(payload->>'departure_time' AS timestamptz) - sim_time >= interval '24 hours')
             AS any_early,
         BOOL_OR(event_type = 'booking_cancelled' AND payload->>'cancelled_by' = 'passenger'
                 AND CAST(payload->>'departure_time' AS timestamptz) - sim_time < interval '24 hours')
             AS any_late,
         BOOL_OR(event_type = 'booking_cancelled' AND payload->>'cancelled_by' = 'driver')
             AS driver_cancelled
  FROM scoped
  GROUP BY seed, payload->>'ride_id'
)
SELECT seed,
  COUNT(*) FILTER (WHERE any_early AND NOT any_late) AS early_rides,
  COALESCE(SUM(released) FILTER (WHERE any_early AND NOT any_late), 0) AS early_released,
  COALESCE(SUM(COALESCE(refilled, 0)) FILTER (WHERE any_early AND NOT any_late), 0) AS early_refilled,
  1.0 * SUM(COALESCE(refilled, 0)) FILTER (WHERE any_early AND NOT any_late)
      / NULLIF(SUM(released) FILTER (WHERE any_early AND NOT any_late), 0) AS early_refill_share,
  COUNT(*) FILTER (WHERE any_late AND NOT any_early) AS late_rides,
  COALESCE(SUM(released) FILTER (WHERE any_late AND NOT any_early), 0) AS late_released,
  COALESCE(SUM(COALESCE(refilled, 0)) FILTER (WHERE any_late AND NOT any_early), 0) AS late_refilled,
  1.0 * SUM(COALESCE(refilled, 0)) FILTER (WHERE any_late AND NOT any_early)
      / NULLIF(SUM(released) FILTER (WHERE any_late AND NOT any_early), 0) AS late_refill_share
FROM rides
WHERE released IS NOT NULL AND NOT driver_cancelled
GROUP BY seed
ORDER BY seed;

-- name: cancellation_timing
-- How long before departure each cancellation came, in bands.
--
-- Counts every booking_cancelled, as late_cancellation_share does, so the four bands under
-- 24 hours add up to its `late`. Each band includes its lower edge: exactly 24 hours
-- before departure is in h24_48, as it is not late there either.
--
-- under_2h, h2_6, h6_12, h12_24      the late bands
-- h24_48, h48_96, h96_plus           the early ones
-- missing_departure_time             must be 0, as for late_cancellation_share
SELECT seed,
  COUNT(*) AS cancellations,
  COUNT(*) FILTER (WHERE lead < INTERVAL '2 hours') AS under_2h,
  COUNT(*) FILTER (WHERE lead >= INTERVAL '2 hours' AND lead < INTERVAL '6 hours') AS h2_6,
  COUNT(*) FILTER (WHERE lead >= INTERVAL '6 hours' AND lead < INTERVAL '12 hours') AS h6_12,
  COUNT(*) FILTER (WHERE lead >= INTERVAL '12 hours' AND lead < INTERVAL '24 hours') AS h12_24,
  COUNT(*) FILTER (WHERE lead >= INTERVAL '24 hours' AND lead < INTERVAL '48 hours') AS h24_48,
  COUNT(*) FILTER (WHERE lead >= INTERVAL '48 hours' AND lead < INTERVAL '96 hours') AS h48_96,
  COUNT(*) FILTER (WHERE lead >= INTERVAL '96 hours') AS h96_plus,
  COUNT(*) FILTER (WHERE lead IS NULL) AS missing_departure_time
FROM (
  SELECT seed, CAST(payload->>'departure_time' AS timestamptz) - sim_time AS lead
  FROM events
  WHERE run_id = :run_id AND variant = :variant
    AND event_type = 'booking_cancelled'
) cancelled
GROUP BY seed
ORDER BY seed;

-- name: daily_cancellation_hazard
-- The survival curve over the booking horizon, a day at a time: of the bookings still
-- standing on each day before departure, how many their passenger cancelled that day.
-- Run on the simulator's runs and on the public hotel bookings alike
-- (EXPERIMENT_PROTOCOL.md section 18), so the two are counted the same way.
--
-- Day N runs from N to N+1 whole days before departure. A booking stands from the day it
-- was accepted until the day it ended: cancelled by its passenger (an event), cancelled
-- by anyone else (it stops standing, uncounted), or departed. A booking accepted more than
-- 7 days out is counted from day 7.
--
-- accepted                    bookings accepted
-- no_shows                    of those, ones whose passenger did not turn up at departure
-- standing_dN, cancelled_dN   bookings standing on day N, and those their passenger cancelled then
-- week_survival               the product over days 7 to 0 of (1 - cancelled / standing), a day
--                             nobody stood on counting as 1: of the bookings standing at the
--                             start of the week, or from the first day anyone stood, the share
--                             still standing at departure
WITH bookings AS (
  SELECT seed,
    MIN(sim_time) FILTER (WHERE event_type = 'booking_accepted') AS accepted_at,
    MIN(CAST(payload->>'departure_time' AS timestamptz))
        FILTER (WHERE event_type = 'booking_requested') AS departs_at,
    MIN(sim_time) FILTER (WHERE event_type = 'booking_cancelled') AS ended_at,
    BOOL_OR(event_type = 'booking_cancelled' AND payload->>'cancelled_by' = 'passenger') AS by_passenger,
    BOOL_OR(event_type = 'trip_failed' AND payload->>'reason' = 'passenger_no_show') AS no_show
  FROM events
  WHERE run_id = :run_id AND variant = :variant
    AND event_type IN ('booking_requested', 'booking_accepted', 'booking_cancelled', 'trip_failed')
  GROUP BY seed, payload->>'booking_id'
),
days AS (
  SELECT seed, no_show, COALESCE(by_passenger, false) AS by_passenger,
    FLOOR(EXTRACT(EPOCH FROM departs_at - accepted_at) / 86400)::int AS entered,
    FLOOR(EXTRACT(EPOCH FROM departs_at - ended_at) / 86400)::int AS ended
  FROM bookings
  WHERE accepted_at IS NOT NULL
),
counted AS (
  SELECT seed,
    COUNT(*) AS accepted,
    COUNT(*) FILTER (WHERE no_show) AS no_shows,
    COUNT(*) FILTER (WHERE entered >= 7 AND (ended IS NULL OR ended <= 7)) AS standing_d7,
    COUNT(*) FILTER (WHERE entered >= 7 AND ended = 7 AND by_passenger) AS cancelled_d7,
    COUNT(*) FILTER (WHERE entered >= 6 AND (ended IS NULL OR ended <= 6)) AS standing_d6,
    COUNT(*) FILTER (WHERE entered >= 6 AND ended = 6 AND by_passenger) AS cancelled_d6,
    COUNT(*) FILTER (WHERE entered >= 5 AND (ended IS NULL OR ended <= 5)) AS standing_d5,
    COUNT(*) FILTER (WHERE entered >= 5 AND ended = 5 AND by_passenger) AS cancelled_d5,
    COUNT(*) FILTER (WHERE entered >= 4 AND (ended IS NULL OR ended <= 4)) AS standing_d4,
    COUNT(*) FILTER (WHERE entered >= 4 AND ended = 4 AND by_passenger) AS cancelled_d4,
    COUNT(*) FILTER (WHERE entered >= 3 AND (ended IS NULL OR ended <= 3)) AS standing_d3,
    COUNT(*) FILTER (WHERE entered >= 3 AND ended = 3 AND by_passenger) AS cancelled_d3,
    COUNT(*) FILTER (WHERE entered >= 2 AND (ended IS NULL OR ended <= 2)) AS standing_d2,
    COUNT(*) FILTER (WHERE entered >= 2 AND ended = 2 AND by_passenger) AS cancelled_d2,
    COUNT(*) FILTER (WHERE entered >= 1 AND (ended IS NULL OR ended <= 1)) AS standing_d1,
    COUNT(*) FILTER (WHERE entered >= 1 AND ended = 1 AND by_passenger) AS cancelled_d1,
    COUNT(*) FILTER (WHERE entered >= 0 AND (ended IS NULL OR ended <= 0)) AS standing_d0,
    COUNT(*) FILTER (WHERE entered >= 0 AND ended = 0 AND by_passenger) AS cancelled_d0
  FROM days
  GROUP BY seed
)
SELECT *,
  COALESCE(1 - 1.0 * cancelled_d7 / NULLIF(standing_d7, 0), 1) * COALESCE(1 - 1.0 * cancelled_d6 / NULLIF(standing_d6, 0), 1)
  * COALESCE(1 - 1.0 * cancelled_d5 / NULLIF(standing_d5, 0), 1) * COALESCE(1 - 1.0 * cancelled_d4 / NULLIF(standing_d4, 0), 1)
  * COALESCE(1 - 1.0 * cancelled_d3 / NULLIF(standing_d3, 0), 1) * COALESCE(1 - 1.0 * cancelled_d2 / NULLIF(standing_d2, 0), 1)
  * COALESCE(1 - 1.0 * cancelled_d1 / NULLIF(standing_d1, 0), 1) * COALESCE(1 - 1.0 * cancelled_d0 / NULLIF(standing_d0, 0), 1)
  AS week_survival
FROM counted
ORDER BY seed;
