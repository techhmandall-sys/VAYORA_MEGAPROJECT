"""Stage 2 acceptance: hand-crafted event rows in, hand-computed numbers out.

No simulator, no app, no real data. The expected values below were worked out on
paper from the counts in SEEDS; the test fails if metrics.sql disagrees.
"""

import json
import uuid
from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy import text

from experiments.analysis.queries import load_queries, run_query

RUN_ID = uuid.UUID("11111111-1111-1111-1111-111111111111")
OTHER_RUN_ID = uuid.UUID("22222222-2222-2222-2222-222222222222")
VARIANT = "B0"

NOW = datetime(2026, 1, 5, 9, 0, tzinfo=timezone.utc)
IST = timezone(timedelta(hours=5, minutes=30))

H = timedelta(hours=1)
M = timedelta(minutes=1)

# How long before departure each cancellation happens. Late means under 24 hours.
SEEDS = {
    1: {
        "search_issued": 200,
        "booking_requested": 60,
        "booking_accepted": 45,
        "booking_rejected": 15,
        "trip_started": 33,
        "trip_completed": 30,
        "trip_failed": 3,
        "recovery_search": 8,
        "recovery_booked": 6,
        # 4 late, 6 early; 24h exactly sits on the early side of the boundary
        "cancel_lead": [2 * H, 5 * H, 12 * H, 23 * H + 59 * M,
                        24 * H, 24 * H + M, 36 * H, 72 * H, 100 * H, 167 * H],
    },
    2: {
        "search_issued": 150,
        "booking_requested": 30,
        "booking_accepted": 24,
        "booking_rejected": 6,
        "trip_started": 18,
        "trip_completed": 18,
        "recovery_search": 5,
        "recovery_booked": 1,
        # all 5 late
        "cancel_lead": [30 * M, 1 * H, 3 * H, 10 * H, 20 * H],
    },
    3: {
        "search_issued": 120,
        "booking_requested": 48,
        "booking_accepted": 12,
        "booking_rejected": 36,
        "trip_started": 9,
        "trip_completed": 7,
        "trip_failed": 2,
        # no recovery searches at all: the rate is undefined, not zero
        # 2 late, 6 early
        "cancel_lead": [6 * H, 18 * H,
                        25 * H, 48 * H, 60 * H, 96 * H, 120 * H, 150 * H],
    },
}

# Worked by hand from SEEDS.
EXPECTED_PRIMARY = {
    1: (200, 30, 15.0),          # 100 * 30 / 200
    2: (150, 18, 12.0),          # 100 * 18 / 150
    3: (120, 7, 35 / 6),         # 100 * 7 / 120 = 5.8333...
}
EXPECTED_LATE = {
    1: (10, 4, 0.4),             # 4 / 10
    2: (5, 5, 1.0),              # 5 / 5
    3: (8, 2, 0.25),             # 2 / 8
}
EXPECTED_FUNNEL = {
    # booking_rate, acceptance_rate, recovery_success_rate
    1: (0.30, 0.75, 0.75),       # 60/200, 45/60, 6/8
    2: (0.20, 0.80, 0.20),       # 30/150, 24/30, 1/5
    3: (0.40, 0.25, None),       # 48/120, 12/48, 0 recovery searches
}

INSERT = text(
    "INSERT INTO events (run_id, variant, seed, sim_time, event_type, payload) "
    "VALUES (:run_id, :variant, :seed, :sim_time, :event_type, CAST(:payload AS jsonb))"
)


def _rows(run_id, variant, seed, spec):
    rows = []

    def add(event_type, payload=None):
        rows.append({
            "run_id": run_id, "variant": variant, "seed": seed, "sim_time": NOW,
            "event_type": event_type, "payload": json.dumps(payload or {}),
        })

    for event_type, count in spec.items():
        if event_type == "cancel_lead":
            continue
        for _ in range(count):
            add(event_type)
    for lead in spec.get("cancel_lead", []):
        # Departure written in IST while sim_time is UTC: the query must compare
        # instants, not wall-clock strings.
        departure = (NOW + lead).astimezone(IST)
        add("booking_cancelled", {"departure_time": departure.isoformat()})
    return rows


@pytest.fixture
def crafted(sa_conn):
    rows = []
    for seed, spec in SEEDS.items():
        rows += _rows(RUN_ID, VARIANT, seed, spec)
    # Rows the queries must ignore: same run under another variant, and another run.
    decoy = {"search_issued": 50, "trip_completed": 50, "booking_requested": 50,
             "booking_accepted": 50, "recovery_search": 4, "recovery_booked": 4,
             "cancel_lead": [1 * H, 2 * H, 3 * H]}
    rows += _rows(RUN_ID, "B1", 1, decoy)
    rows += _rows(OTHER_RUN_ID, VARIANT, 1, decoy)
    sa_conn.execute(INSERT, rows)
    return sa_conn


def test_primary_metric_matches_hand_computed_values(crafted):
    result = run_query(crafted, "primary_metric", run_id=RUN_ID, variant=VARIANT)

    assert [r["seed"] for r in result] == [1, 2, 3]
    for row in result:
        searches, completed, per_100 = EXPECTED_PRIMARY[row["seed"]]
        assert row["searches"] == searches
        assert row["completed"] == completed
        assert float(row["per_100"]) == pytest.approx(per_100, abs=1e-9)


def test_late_cancellation_share_matches_hand_computed_values(crafted):
    result = run_query(crafted, "late_cancellation_share", run_id=RUN_ID, variant=VARIANT)

    assert [r["seed"] for r in result] == [1, 2, 3]
    for row in result:
        cancellations, late, late_share = EXPECTED_LATE[row["seed"]]
        assert row["cancellations"] == cancellations
        assert row["late"] == late
        assert row["missing_departure_time"] == 0
        assert float(row["late_share"]) == pytest.approx(late_share, abs=1e-9)


def test_funnel_rates_match_hand_computed_values(crafted):
    result = run_query(crafted, "funnel_rates", run_id=RUN_ID, variant=VARIANT)

    assert [r["seed"] for r in result] == [1, 2, 3]
    for row in result:
        booking, acceptance, recovery = EXPECTED_FUNNEL[row["seed"]]
        assert float(row["booking_rate"]) == pytest.approx(booking, abs=1e-9)
        assert float(row["acceptance_rate"]) == pytest.approx(acceptance, abs=1e-9)
        if recovery is None:
            assert row["recovery_success_rate"] is None
        else:
            assert float(row["recovery_success_rate"]) == pytest.approx(recovery, abs=1e-9)


# Worked by hand from SEEDS' cancel_lead: (under_2h, h2_6, h6_12, h12_24, h24_48, h48_96, h96_plus).
EXPECTED_TIMING = {
    1: (0, 2, 0, 2, 3, 1, 2),
    2: (2, 1, 1, 1, 0, 0, 0),
    3: (0, 0, 1, 1, 1, 2, 3),
}
BANDS = ("under_2h", "h2_6", "h6_12", "h12_24", "h24_48", "h48_96", "h96_plus")


def test_cancellation_timing_matches_hand_computed_values(crafted):
    result = run_query(crafted, "cancellation_timing", run_id=RUN_ID, variant=VARIANT)

    assert [r["seed"] for r in result] == [1, 2, 3]
    for row in result:
        assert tuple(row[band] for band in BANDS) == EXPECTED_TIMING[row["seed"]]
        assert row["cancellations"] == sum(EXPECTED_TIMING[row["seed"]])
        assert row["missing_departure_time"] == 0
        # The late bands are exactly what late_cancellation_share counts as late.
        assert sum(row[band] for band in BANDS[:4]) == EXPECTED_LATE[row["seed"]][1]


def test_seed_with_no_searches_has_undefined_metric_not_an_error(sa_conn):
    sa_conn.execute(INSERT, _rows(RUN_ID, VARIANT, 9, {"trip_completed": 2}))

    (row,) = run_query(sa_conn, "primary_metric", run_id=RUN_ID, variant=VARIANT)

    assert (row["searches"], row["completed"], row["per_100"]) == (0, 2, None)


def test_cancellation_without_departure_time_is_surfaced(sa_conn):
    rows = _rows(RUN_ID, VARIANT, 1, {"cancel_lead": [2 * H]})
    rows += _rows(RUN_ID, VARIANT, 1, {"booking_cancelled": 1})
    sa_conn.execute(INSERT, rows)

    (row,) = run_query(sa_conn, "late_cancellation_share", run_id=RUN_ID, variant=VARIANT)

    assert (row["cancellations"], row["late"], row["missing_departure_time"]) == (2, 1, 1)


def test_metrics_file_defines_the_expected_queries():
    assert set(load_queries()) == {
        "primary_metric", "late_cancellation_share", "funnel_rates", "intervention_volume",
        "refill_additionality", "empty_search_reasons", "refill_by_release_timing",
        "cancellation_timing", "daily_cancellation_hazard", "seats_travelled",
        "late_cancellation_share_passenger"}


def _event(seed, event_type, payload=None, variant=VARIANT, at=NOW):
    return {"run_id": RUN_ID, "variant": variant, "seed": seed, "sim_time": at,
            "event_type": event_type, "payload": json.dumps(payload or {})}


def test_seats_travelled_counts_each_completed_booking_s_seats(sa_conn):
    rows = [_event(1, "search_issued") for _ in range(10)]
    # Bookings 1, 2 and 4 travel (2 + 1 + 1 seats); booking 3 (3 seats) never completes.
    for booking, seats in ((1, 2), (2, 1), (3, 3), (4, 1)):
        rows.append(_event(1, "booking_requested", {"booking_id": booking, "seats": seats}))
    rows += [_event(1, "trip_completed", {"booking_id": b}) for b in (1, 2, 4)]
    # Seed 2 searched but nobody travelled: zero, not missing.
    rows += [_event(2, "search_issued") for _ in range(4)]
    rows.append(_event(2, "booking_requested", {"booking_id": 1, "seats": 2}))
    # A decoy under another variant, with the same booking id as seed 1's.
    rows += [_event(1, "booking_requested", {"booking_id": 1, "seats": 3}, variant="B1"),
             _event(1, "trip_completed", {"booking_id": 1}, variant="B1")]
    sa_conn.execute(INSERT, rows)

    result = run_query(sa_conn, "seats_travelled", run_id=RUN_ID, variant=VARIANT)

    assert [(r["seed"], r["searches"], r["completed"], r["seats_completed"]) for r in result] == [
        (1, 10, 3, 4), (2, 4, 0, 0)]
    assert float(result[0]["seats_per_100"]) == pytest.approx(40.0)
    assert float(result[1]["seats_per_100"]) == 0.0


def test_late_share_of_passenger_cancellations_leaves_out_drivers(sa_conn):
    def cancelled(lead, by):
        departure = (NOW + lead).astimezone(IST)
        return _event(1, "booking_cancelled", {"departure_time": departure.isoformat(), "cancelled_by": by})

    # Passengers: 2 late, 1 early. Drivers: 2 late, which late_cancellation_share also counts.
    rows = [cancelled(2 * H, "passenger"), cancelled(10 * H, "passenger"), cancelled(30 * H, "passenger"),
            cancelled(1 * H, "driver"), cancelled(5 * H, "driver")]
    sa_conn.execute(INSERT, rows)

    (passenger,) = run_query(sa_conn, "late_cancellation_share_passenger", run_id=RUN_ID, variant=VARIANT)
    (everyone,) = run_query(sa_conn, "late_cancellation_share", run_id=RUN_ID, variant=VARIANT)

    assert (passenger["cancellations"], passenger["late"]) == (3, 2)
    assert float(passenger["late_share_passenger"]) == pytest.approx(2 / 3)
    assert float(everyone["late_share"]) == pytest.approx(4 / 5)


def test_intervention_volume_matches_hand_computed_values(sa_conn):
    def event(seed, event_type, payload=None):
        return {"run_id": RUN_ID, "variant": VARIANT, "seed": seed, "sim_time": NOW,
                "event_type": event_type, "payload": json.dumps(payload or {})}

    rows = [event(1, "booking_accepted") for _ in range(20)]
    rows += [event(1, "intervention_issued") for _ in range(5)]
    rows += [event(1, "intervention_responded", {"response": "released"}) for _ in range(2)]
    rows += [event(1, "intervention_responded", {"response": "confirmed"}) for _ in range(3)]
    rows += [event(1, "seat_refilled") for _ in range(4)]
    rows += [event(2, "search_issued")]  # a seed with nothing accepted and nothing asked
    sa_conn.execute(INSERT, rows)

    one, two = run_query(sa_conn, "intervention_volume", run_id=RUN_ID, variant=VARIANT)

    assert (one["asked"], one["released"], one["refilled"]) == (5, 2, 4)
    assert float(one["contact_rate"]) == pytest.approx(0.25)  # 5 / 20
    assert (two["asked"], two["contact_rate"]) == (0, None)


def test_refill_additionality_matches_hand_computed_values(sa_conn):
    later = NOW + 5 * H

    def event(seed, event_type, payload, when=NOW, variant=VARIANT):
        return {"run_id": RUN_ID, "variant": variant, "seed": seed, "sim_time": when,
                "event_type": event_type, "payload": json.dumps(payload)}

    def search(seed, search_id, offered, booking_id=None, refill=False, when=NOW, variant=VARIANT):
        rows = [event(seed, "candidates_returned", {"search_id": search_id, "count": offered},
                      when, variant)]
        if booking_id is not None:
            rows.append(event(seed, "booking_requested",
                              {"search_id": search_id, "booking_id": booking_id}, when, variant))
        if refill:
            rows.append(event(seed, "seat_refilled", {"booking_id": booking_id}, when, variant))
        return rows

    rows = []
    # Seed 1: six answers, two of them empty. Three refills: one by a passenger offered
    # only that ride, one offered three, and one on a repeat search.
    rows += search(1, 1, 0)
    rows += search(1, 2, 1, booking_id=10, refill=True)
    rows += search(1, 3, 3, booking_id=11, refill=True)
    rows += search(1, 4, 2, booking_id=12)              # booked, but no released seat
    # Search 5 found nothing, then on its repeat was offered one ride and took a released
    # seat on it. The repeat reuses the search id: the booking belongs to the later answer.
    rows += search(1, 5, 0)
    rows += search(1, 5, 1, booking_id=13, refill=True, when=later)
    # Seed 2: searches, no refills at all.
    rows += search(2, 1, 2, booking_id=20)
    rows += search(2, 2, 0)
    # Another variant in the same run must not leak in.
    rows += search(1, 9, 1, booking_id=99, refill=True, variant="B1")
    sa_conn.execute(INSERT, rows)

    one, two = run_query(sa_conn, "refill_additionality", run_id=RUN_ID, variant=VARIANT)

    assert (one["searches_shown"], one["shown_nothing"]) == (6, 2)
    assert float(one["empty_share"]) == pytest.approx(2 / 6)
    assert (one["refills"], one["refills_only_option"]) == (3, 2)
    assert float(one["only_option_share"]) == pytest.approx(2 / 3)
    assert (two["searches_shown"], two["shown_nothing"], two["refills"],
            two["refills_only_option"], two["only_option_share"]) == (2, 1, 0, 0, None)


def test_empty_search_reasons_matches_hand_computed_values(sa_conn):
    def answer(seed, offered, in_window=None, variant=VARIANT):
        payload = {"search_id": 1, "count": offered}
        if in_window is not None:
            payload["rides_in_window"] = in_window
        return {"run_id": RUN_ID, "variant": variant, "seed": seed, "sim_time": NOW,
                "event_type": "candidates_returned", "payload": json.dumps(payload)}

    sa_conn.execute(INSERT, [
        # Seed 1: five answers, three empty: one with no ride then, two with full rides.
        answer(1, 0, 0), answer(1, 0, 3), answer(1, 0, 2), answer(1, 2, 4), answer(1, 1, 1),
        # Seed 2: one empty answer logged without the reason, so its shares are undefined.
        answer(2, 0), answer(2, 0, 0), answer(2, 3, 5),
        # Another variant in the same run must not leak in.
        answer(1, 0, 5, variant="B1"),
    ])

    one, two = run_query(sa_conn, "empty_search_reasons", run_id=RUN_ID, variant=VARIANT)

    assert (one["searches_shown"], one["shown_nothing"], one["no_ride_then"],
            one["rides_full"], one["reason_unknown"]) == (5, 3, 1, 2, 0)
    assert float(one["no_ride_share"]) == pytest.approx(1 / 5)
    assert float(one["full_share"]) == pytest.approx(2 / 5)
    assert (two["searches_shown"], two["shown_nothing"], two["no_ride_then"],
            two["rides_full"], two["reason_unknown"]) == (3, 2, 1, 0, 1)
    assert (two["no_ride_share"], two["full_share"]) == (None, None)


def test_refill_by_release_timing_matches_hand_computed_values(sa_conn):
    departure = NOW + 100 * H

    def event(ride, event_type, seats, before, by="passenger", seed=1, variant=VARIANT):
        payload = {"ride_id": ride, "seats": seats}
        if event_type == "booking_cancelled":
            payload |= {"cancelled_by": by, "departure_time": departure.astimezone(IST).isoformat()}
        return {"run_id": RUN_ID, "variant": variant, "seed": seed, "sim_time": departure - before,
                "event_type": event_type, "payload": json.dumps(payload)}

    rows = [
        # Ride 1: two early releases, 3 seats; 2 refilled.
        event(1, "booking_cancelled", 2, 72 * H), event(1, "booking_cancelled", 1, 30 * H),
        event(1, "seat_refilled", 2, 20 * H),
        # Ride 2: one late release of 2 seats; 1 refilled. Exactly 24 h before is early,
        # so 23h59m is late.
        event(2, "booking_cancelled", 2, 23 * H + 59 * M), event(2, "seat_refilled", 1, 5 * H),
        # Ride 3: one early release, never refilled.
        event(3, "booking_cancelled", 1, 24 * H),
        # Ride 4: early and late both: left out.
        event(4, "booking_cancelled", 1, 50 * H), event(4, "booking_cancelled", 1, 2 * H),
        event(4, "seat_refilled", 2, H),
        # Ride 5: a driver cancelled a booking on it: left out.
        event(5, "booking_cancelled", 1, 60 * H), event(5, "booking_cancelled", 1, 10 * H, by="driver"),
        # Ride 6: refills with no passenger release (cannot happen in the simulator): left out.
        event(6, "seat_refilled", 1, 3 * H),
        # Another variant must not leak in.
        event(1, "booking_cancelled", 4, 2 * H, variant="B1"),
    ]
    sa_conn.execute(INSERT, rows)

    (one,) = run_query(sa_conn, "refill_by_release_timing", run_id=RUN_ID, variant=VARIANT)

    assert (one["early_rides"], one["early_released"], one["early_refilled"]) == (2, 4, 2)
    assert float(one["early_refill_share"]) == pytest.approx(0.5)
    assert (one["late_rides"], one["late_released"], one["late_refilled"]) == (1, 2, 1)
    assert float(one["late_refill_share"]) == pytest.approx(0.5)


def test_daily_cancellation_hazard_matches_hand_computed_values(sa_conn):
    day = timedelta(days=1)
    departure = NOW + 10 * day
    leaves = departure.astimezone(IST).isoformat()

    def booking(number, accepted_before, ended_before=None, by="passenger", no_show=False,
                accepted=True, variant=VARIANT, seed=1):
        def event(event_type, before, payload):
            return {"run_id": RUN_ID, "variant": variant, "seed": seed, "sim_time": departure - before,
                    "event_type": event_type, "payload": json.dumps({"booking_id": number} | payload)}

        rows = [event("booking_requested", accepted_before, {"departure_time": leaves})]
        if accepted:
            rows.append(event("booking_accepted", accepted_before, {}))
        if ended_before is not None:
            rows.append(event("booking_cancelled", ended_before, {"departure_time": leaves, "cancelled_by": by}))
        if no_show:
            rows.append(event("trip_failed", 0 * day, {"reason": "passenger_no_show"}))
        return rows

    sa_conn.execute(INSERT, [
        *booking(1, 5 * day, 2.5 * day),                # stands days 5 to 2, cancelled on day 2
        *booking(2, 3 * day),                           # exactly 3 days: stands days 3 to 0
        *booking(3, 6.9 * day, 1.2 * day, by="driver"),  # stands days 6 to 1; a driver's, not counted
        *booking(4, 0.5 * day, 0.1 * day),              # stands day 0 and is cancelled then
        *booking(5, 9 * day, 8 * day),                  # gone before the week starts: stands on no day
        *booking(6, 2 * day, no_show=True),             # stands days 2 to 0, then does not turn up
        *booking(7, 4 * day, accepted=False),           # never accepted: never stands
        *booking(8, 4 * day, 1 * day),                  # exactly 24 h out is day 1, not day 0
        *booking(9, 7.5 * day),                         # stands every day of the week
        *booking(1, 3 * day, 1 * day, variant="B1"),    # another variant must not leak in
        # Seed 2: nobody stands before day 3. Those days count as 1, not as undefined.
        *booking(1, 3 * day, 1.5 * day, seed=2),
        *booking(2, 3 * day, seed=2),
    ])

    one, two = run_query(sa_conn, "daily_cancellation_hazard", run_id=RUN_ID, variant=VARIANT)

    assert (one["accepted"], one["no_shows"]) == (8, 1)
    assert [one[f"standing_d{n}"] for n in range(7, -1, -1)] == [1, 2, 3, 4, 5, 6, 5, 4]
    assert [one[f"cancelled_d{n}"] for n in range(7, -1, -1)] == [0, 0, 0, 0, 0, 1, 1, 1]
    # (1 - 1/6)(1 - 1/5)(1 - 1/4), every other day losing nobody
    assert float(one["week_survival"]) == pytest.approx(0.5)
    assert [two[f"standing_d{n}"] for n in range(7, -1, -1)] == [0, 0, 0, 0, 2, 2, 2, 1]
    assert float(two["week_survival"]) == pytest.approx(0.5)  # 1 - 1/2, on day 1
