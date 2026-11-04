import dataclasses
import json
import math
import re
import uuid
from collections import Counter
from datetime import datetime, timedelta

import pytest

from experiments.analysis.queries import run_query
from vayora_events import EventType, EventWriter
from sim.config import Variant, load_variant, load_world
from sim.frozen import BOOKING_HORIZON_DAYS, LATENT_TYPES, SPAN_DAYS
from sim.run import CONFIGS
from sim.simulator import MemorySink, Simulation

WORLD = load_world(CONFIGS / "world.yaml")
B0 = load_variant(CONFIGS / "variants" / "B0.yaml")


def _run(world=WORLD, seed=1, variant=B0):
    sink = MemorySink()
    sim = Simulation(world, variant, seed, sink)
    sim.run()
    return sim, sink.events


def _counts(events):
    return Counter(e.event_type for e in events)


def _demand(world, **changes):
    return dataclasses.replace(world, demand=dataclasses.replace(world.demand, **changes))


def _supply(world, **changes):
    return dataclasses.replace(world, supply=dataclasses.replace(world.supply, **changes))


def _only(world, kind):
    """A world in which every passenger is of one latent type."""
    types = {
        name: dataclasses.replace(spec, share=1.0 if name == kind else 0.0)
        for name, spec in world.demand.types.items()
    }
    return _demand(world, types=types)


@pytest.fixture(scope="module")
def baseline():
    return _run()


def test_the_same_seed_reproduces_the_run_exactly_and_another_seed_does_not(baseline):
    _, events = baseline

    assert _run(seed=1)[1] == events
    assert _run(seed=2)[1] != events


def test_the_run_produces_a_working_corridor_not_an_empty_or_saturated_one(baseline):
    _, events = baseline
    counts = _counts(events)

    # Guards against a config or code change that quietly kills part of the funnel.
    assert counts["search_issued"] > 2000
    for event_type in ["booking_requested", "booking_accepted", "booking_rejected",
                       "booking_cancelled", "seat_refilled", "trip_started",
                       "trip_completed", "trip_failed"]:
        assert counts[event_type] > 0, event_type
    assert counts["trip_completed"] < counts["search_issued"]


def test_every_event_uses_the_frozen_vocabulary_and_snake_case_keys(baseline):
    _, events = baseline
    vocabulary = {t.value for t in EventType}
    snake = re.compile(r"^[a-z][a-z0-9_]*$")

    for event in events:
        assert event.event_type in vocabulary
        assert all(snake.match(key) for key in event.payload)
        assert event.sim_time.utcoffset() is not None
        assert event.actor_type in ("passenger", "driver")
        assert isinstance(event.actor_id, int)


def test_latent_type_never_appears_in_any_event(baseline):
    """Research integrity rule 1."""
    _, events = baseline
    forbidden = set(LATENT_TYPES) | {"kind", "latent", "type", "passenger_type"}

    for event in events:
        assert not forbidden & set(event.payload), event
        assert not forbidden & {v for v in event.payload.values() if isinstance(v, str)}, event


def test_events_are_in_time_order_and_inside_the_simulated_span(baseline):
    _, events = baseline
    times = [e.sim_time for e in events]
    end = WORLD.start + timedelta(days=SPAN_DAYS, hours=WORLD.supply.trip_duration_hours)

    assert times == sorted(times)
    assert times[0] >= WORLD.start
    assert times[-1] <= end
    searches = [e.sim_time for e in events if e.event_type == "search_issued"]
    assert max(searches) < WORLD.start + timedelta(days=SPAN_DAYS)


def test_each_booking_follows_one_legal_path(baseline):
    _, events = baseline
    paths: dict[int, list[str]] = {}
    for event in events:
        if "booking_id" in event.payload and event.event_type not in (
                "seat_refilled", "recovery_booked"):
            paths.setdefault(event.payload["booking_id"], []).append(event.event_type)

    legal = {
        ("booking_requested", "booking_rejected"),
        ("booking_requested", "booking_cancelled"),  # driver withdrew before answering
        ("booking_requested", "booking_accepted", "booking_cancelled"),
        ("booking_requested", "booking_accepted", "trip_started", "trip_completed"),
        ("booking_requested", "booking_accepted", "trip_started", "trip_failed"),
    }
    assert paths
    assert {tuple(path) for path in paths.values()} <= legal
    # Nothing is left hanging once the run is over.
    assert all(len(path) >= 2 for path in paths.values())


def test_started_trips_equal_completed_plus_failed(baseline):
    _, events = baseline
    counts = _counts(events)

    assert counts["trip_started"] == counts["trip_completed"] + counts["trip_failed"]


def test_no_ride_is_ever_oversold(baseline):
    sim, events = baseline
    seats = {ride.id: ride.seats for ride in sim.rides}
    size = {b.id: b.seats for b in sim.bookings}
    ride_of = {b.id: b.ride.id for b in sim.bookings}
    held: Counter = Counter()

    for event in events:
        booking = event.payload.get("booking_id")
        if event.event_type == "booking_requested":
            held[ride_of[booking]] += size[booking]
            assert held[ride_of[booking]] <= seats[ride_of[booking]]
        elif event.event_type in ("booking_rejected", "booking_cancelled"):
            held[ride_of[booking]] -= size[booking]
            assert held[ride_of[booking]] >= 0

    for ride in sim.rides:
        assert ride.seats_available == ride.seats - held[ride.id]


def test_bookings_respect_the_horizon_and_the_passengers_time_window(baseline):
    _, events = baseline
    wanted = {
        e.payload["search_id"]: datetime.fromisoformat(e.payload["desired_departure"])
        for e in events if e.event_type == "search_issued"
    }
    requests = [e for e in events if e.event_type == "booking_requested"]

    for event in requests:
        departure = datetime.fromisoformat(event.payload["departure_time"])
        assert timedelta(0) < departure - event.sim_time <= timedelta(days=BOOKING_HORIZON_DAYS)
        gap = abs(departure - wanted[event.payload["search_id"]])
        assert gap <= timedelta(hours=WORLD.demand.departure_tolerance_hours)


def test_cancellations_carry_a_departure_time_and_happen_before_it(baseline):
    _, events = baseline
    cancellations = [e for e in events if e.event_type == "booking_cancelled"]

    assert {e.payload["cancelled_by"] for e in cancellations} == {"passenger", "driver"}
    for event in cancellations:
        departure = datetime.fromisoformat(event.payload["departure_time"])
        assert departure.utcoffset() is not None
        assert event.sim_time < departure
        assert event.actor_type == event.payload["cancelled_by"]


def test_a_refilled_seat_was_first_released_by_a_passenger_on_that_ride(baseline):
    _, events = baseline
    released: Counter = Counter()

    for event in events:
        ride = event.payload.get("ride_id")
        if event.event_type == "booking_cancelled" and event.payload["cancelled_by"] == "passenger":
            released[ride] += event.payload["seats"]
        elif event.event_type == "seat_refilled":
            released[ride] -= event.payload["seats"]
            assert released[ride] >= 0


def test_only_a_passenger_left_without_a_seat_searches_again(baseline):
    _, events = baseline
    retry = WORLD.demand.retry
    left_out: set[int] = set()   # search ids currently entitled to another attempt
    search_of: dict[int, int] = {}
    again = [e for e in events if e.event_type == "recovery_search"]

    assert again
    for event in events:
        payload = event.payload
        if event.event_type == "booking_requested":
            search_of[payload["booking_id"]] = payload["search_id"]
        elif event.event_type == "candidates_returned" and payload["count"] == 0:
            left_out.add(payload["search_id"])
        elif event.event_type == "booking_rejected":
            left_out.add(search_of[payload["booking_id"]])
        elif event.event_type == "booking_cancelled" and payload["cancelled_by"] == "driver":
            left_out.add(search_of[payload["booking_id"]])
        elif event.event_type == "recovery_search":
            assert payload["search_id"] in left_out, event
            assert 1 <= payload["attempt"] <= retry.max_attempts
            left_out.discard(payload["search_id"])


def test_an_empty_search_says_whether_no_ride_ran_then_or_the_rides_were_full(baseline):
    _, events = baseline
    answers = [e.payload for e in events if e.event_type == "candidates_returned"]

    assert all(a["count"] <= a["rides_in_window"] for a in answers)
    empty = [a for a in answers if a["count"] == 0]
    # Seats are scarce in the shipped world, so both reasons occur.
    assert any(a["rides_in_window"] == 0 for a in empty)
    assert any(a["rides_in_window"] > 0 for a in empty)


def test_where_no_ride_can_fill_up_an_empty_search_is_always_for_want_of_a_ride():
    _, events = _run(_supply(WORLD, seats={50: 1.0}))
    empty = [e.payload for e in events
             if e.event_type == "candidates_returned" and e.payload["count"] == 0]

    assert empty
    assert all(a["rides_in_window"] == 0 for a in empty)


def test_a_ride_not_yet_published_is_not_counted_as_running():
    # Every ride published exactly a day before it leaves: a search for further ahead
    # than that, beyond the time window, cannot see any ride.
    world = _supply(WORLD, publish_lead_days_min=1.0, publish_lead_days_max=1.0)
    _, events = _run(world)
    tolerance = timedelta(hours=world.demand.departure_tolerance_hours)
    wanted: dict[int, datetime] = {}
    too_early = seen = 0

    for event in events:
        if event.event_type in ("search_issued", "recovery_search"):
            wanted[event.payload["search_id"]] = datetime.fromisoformat(
                event.payload["desired_departure"])
        elif event.event_type == "candidates_returned":
            if wanted[event.payload["search_id"]] - event.sim_time > timedelta(days=1) + tolerance:
                too_early += 1
                assert event.payload["rides_in_window"] == 0, event
            elif event.payload["rides_in_window"] > 0:
                seen += 1

    assert too_early and seen


def _rebookings(events):
    """Each driver cancellation followed at the same instant by a request on the same search."""
    search_of: dict[int, int] = {}
    requested_at: dict[tuple[int, datetime], dict] = {}
    for event in events:
        if event.event_type == "booking_requested":
            search_of[event.payload["booking_id"]] = event.payload["search_id"]
            requested_at[(event.payload["search_id"], event.sim_time)] = event.payload
    pairs = []
    for event in events:
        if event.event_type == "booking_cancelled" and event.payload["cancelled_by"] == "driver":
            again = requested_at.get((search_of[event.payload["booking_id"]], event.sim_time))
            if again is not None and again["booking_id"] != event.payload["booking_id"]:
                pairs.append((event.payload, again))
    return pairs


def _withdrawing(world, share):
    """A world where drivers often withdraw, and this share of passengers chose flexible."""
    world = _supply(world, withdraw_probability=0.3)
    return _demand(world, flexible_booking=dataclasses.replace(world.demand.flexible_booking, share=share))


def test_with_no_flexible_share_a_withdrawal_rebooks_nobody(baseline):
    _, events = baseline
    assert WORLD.demand.flexible_booking.share == 0
    assert _rebookings(events) == []


def test_a_flexible_passenger_is_rebooked_at_once_on_a_ride_within_the_window():
    world = _withdrawing(WORLD, 1.0)
    _, events = _run(world)
    window = timedelta(hours=world.demand.flexible_booking.window_hours)
    departure_of = {e.payload["booking_id"]: datetime.fromisoformat(e.payload["departure_time"])
                    for e in events if e.event_type == "booking_requested"}

    pairs = _rebookings(events)

    assert pairs
    for cancelled, again in pairs:
        withdrawn_departure = datetime.fromisoformat(cancelled["departure_time"])
        assert again["ride_id"] != cancelled["ride_id"]
        assert abs(departure_of[again["booking_id"]] - withdrawn_departure) <= window
        assert again["seats"] == cancelled["seats"]


def test_rebooking_keeps_every_trip_accounted_for_and_no_ride_oversold():
    # Overselling raises inside the simulator, so a run that finishes has none.
    _, events = _run(_withdrawing(WORLD, 1.0))
    counts = _counts(events)

    assert counts["trip_started"] == counts["trip_completed"] + counts["trip_failed"]


def test_only_the_flexible_share_is_rebooked():
    every = len(_rebookings(_run(_withdrawing(WORLD, 1.0))[1]))
    half = len(_rebookings(_run(_withdrawing(WORLD, 0.5))[1]))

    assert 0 < half < every


def test_a_recovery_booking_is_a_real_booking_made_on_a_repeat_search(baseline):
    _, events = baseline
    requested = {e.payload["booking_id"] for e in events if e.event_type == "booking_requested"}
    searched_again = {e.payload["search_id"] for e in events if e.event_type == "recovery_search"}
    recovered = [e for e in events if e.event_type == "recovery_booked"]

    assert recovered
    assert len(recovered) < len(searched_again) + sum(
        1 for e in events if e.event_type == "recovery_search") - len(searched_again) + 1
    for event in recovered:
        assert event.payload["booking_id"] in requested
        assert event.payload["search_id"] in searched_again
        assert event.payload["attempt"] >= 1


def test_first_searches_are_counted_once_however_often_people_try_again(baseline):
    _, events = baseline
    first = [e.payload["search_id"] for e in events if e.event_type == "search_issued"]

    assert len(first) == len(set(first))
    assert all(e.payload["attempt"] == 0 for e in events if e.event_type == "search_issued")


def test_with_retrying_off_nobody_searches_twice():
    quiet = _demand(WORLD, retry=dataclasses.replace(WORLD.demand.retry, max_attempts=0))
    counts = _counts(_run(quiet)[1])

    assert counts["recovery_search"] == 0 and counts["recovery_booked"] == 0
    assert counts["search_issued"] > 0


def test_retrying_fills_more_trips_from_the_same_first_searches(baseline):
    quiet = _demand(WORLD, retry=dataclasses.replace(WORLD.demand.retry, max_attempts=0))
    without = _counts(_run(quiet)[1])
    with_retry = _counts(baseline[1])

    assert with_retry["search_issued"] == without["search_issued"]
    assert with_retry["trip_completed"] > without["trip_completed"]


def test_demand_is_identical_whatever_the_supply_and_the_ranking():
    """Paired environments: a variant or a supply change must not alter who searches."""
    def searches(events):
        return [(e.sim_time, e.payload) for e in events if e.event_type == "search_issued"]

    _, plenty = _run()
    _, scarce = _run(_supply(WORLD, rides_per_day=2, accept_probability=0.3))

    assert searches(plenty) == searches(scarce)
    assert _counts(plenty)["booking_requested"] > _counts(scarce)["booking_requested"]


def test_supply_is_identical_whatever_the_demand():
    quiet, _ = _run(_demand(WORLD, searches_per_day=5))
    busy, _ = _run()

    def offered(sim):
        return [(r.id, r.departure, r.seats, r.publish_at, r.withdraw_at) for r in sim.rides]

    assert offered(quiet) == offered(busy)


def test_latent_types_behave_as_configured():
    def cancelled_share(kind):
        counts = Counter()
        for seed in (1, 2, 3):
            events = _run(_only(_supply(WORLD, withdraw_probability=0.0), kind), seed)[1]
            counts.update(_counts(events))
        return counts["booking_cancelled"] / counts["booking_accepted"]

    committed, opportunistic = cancelled_share("committed"), cancelled_share("opportunistic")

    assert committed < 0.15
    assert opportunistic > 2 * committed


def test_shocks_add_cancellations():
    calm = dataclasses.replace(WORLD.demand.shock, rate_per_day=0.0)
    stormy = dataclasses.replace(WORLD.demand.shock, rate_per_day=0.5)

    def cancellations(shock):
        events = _run(_only(_demand(WORLD, shock=shock), "committed"))[1]
        return sum(1 for e in events
                   if e.event_type == "booking_cancelled" and e.payload["cancelled_by"] == "passenger")

    assert cancellations(stormy) > 2 * cancellations(calm)


def _proximity(world, share, rate, scale_hours=24.0):
    """World h3 with a share of each type's risk moved to a hazard tied to departure."""
    types = {name: dataclasses.replace(spec, proximity_rate=rate)
             for name, spec in world.demand.types.items()}
    return _demand(world, types=types, proximity=dataclasses.replace(
        world.demand.proximity, share=share, scale_hours=scale_hours))


def _passenger_cancellations(events):
    """Hours before departure of every cancellation a passenger made."""
    return [(datetime.fromisoformat(e.payload["departure_time"]) - e.sim_time).total_seconds() / 3600
            for e in events
            if e.event_type == "booking_cancelled" and e.payload["cancelled_by"] == "passenger"]


def test_without_proximity_rates_the_hazard_scale_changes_nothing(baseline):
    _, events = baseline

    assert _run(_proximity(WORLD, share=0.0, rate=0.0, scale_hours=99.0))[1] == events


def test_the_hazard_tied_to_departure_leaves_who_searches_and_what_runs_alone(baseline):
    sim, events = baseline
    moved, moved_events = _run(_proximity(WORLD, share=0.9, rate=0.01))

    def searches(evs):
        return [(e.sim_time, e.payload) for e in evs if e.event_type == "search_issued"]

    assert searches(moved_events) == searches(events)
    assert [r.departure for r in moved.rides] == [r.departure for r in sim.rides]


def test_moving_risk_to_departure_moves_cancellations_towards_it(baseline):
    _, events = baseline
    _, moved = _run(_proximity(WORLD, share=0.9, rate=0.01))

    def late_share(evs):
        hours = _passenger_cancellations(evs)
        return sum(1 for h in hours if h < 24) / len(hours)

    assert late_share(moved) > late_share(events) + 0.1


def test_a_share_with_no_proximity_rate_only_takes_risk_away(baseline):
    _, events = baseline
    _, lighter = _run(_proximity(WORLD, share=0.5, rate=0.0))

    assert len(_passenger_cancellations(lighter)) < len(_passenger_cancellations(events))


def _booked_gaps(events):
    """Hours between each requested ride's departure and the time its passenger wanted."""
    wanted = {e.payload["search_id"]: datetime.fromisoformat(e.payload["desired_departure"])
              for e in events if e.event_type == "search_issued"}
    return [abs(datetime.fromisoformat(e.payload["departure_time"]) - wanted[e.payload["search_id"]])
            .total_seconds() / 3600
            for e in events if e.event_type == "booking_requested"]


def test_with_no_time_cost_the_booking_chance_is_exactly_the_types_own(baseline):
    sim, _ = baseline
    kind = WORLD.demand.types["flexible"]
    passenger = next(iter(sim._passenger_of.values()))
    ride = next(r for r in sim.rides if r.departure != passenger.desired_departure)

    assert sim._book_probability(kind, passenger, ride) == kind.book_probability

    costly = Simulation(_demand(WORLD, time_deviation_cost_per_hour=0.1), B0, 1, MemorySink())
    gap = abs(ride.departure - passenger.desired_departure)
    assert costly._book_probability(kind, passenger, ride) == pytest.approx(
        kind.book_probability * math.exp(-0.1 * gap))


def test_a_time_cost_leaves_searches_and_rides_alone_and_books_closer_to_the_wanted_time(baseline):
    sim, events = baseline
    costly, costly_events = _run(_demand(WORLD, time_deviation_cost_per_hour=0.5))

    def searches(evs):
        return [(e.sim_time, e.payload) for e in evs if e.event_type == "search_issued"]

    assert searches(costly_events) == searches(events)
    assert [r.departure for r in costly.rides] == [r.departure for r in sim.rides]
    assert _counts(costly_events)["booking_requested"] < _counts(events)["booking_requested"]
    assert (sum(_booked_gaps(costly_events)) / len(_booked_gaps(costly_events))
            < sum(_booked_gaps(events)) / len(_booked_gaps(events)))


@pytest.mark.parametrize("change, absent", [
    (lambda w: _supply(w, accept_probability=0.0), ["booking_accepted", "trip_started"]),
    (lambda w: _supply(w, withdraw_probability=1.0), ["trip_started", "trip_completed"]),
    (lambda w: _demand(w, types={
        name: dataclasses.replace(spec, book_probability=0.0)
        for name, spec in w.demand.types.items()}), ["booking_requested"]),
])
def test_switching_a_behaviour_off_removes_its_events(change, absent):
    counts = _counts(_run(change(WORLD))[1])

    assert counts["search_issued"] > 0
    for event_type in absent:
        assert counts[event_type] == 0


def test_an_unknown_ranking_is_refused():
    with pytest.raises(ValueError, match="unknown ranking"):
        Simulation(WORLD, Variant(name="BX", ranking="vibes"), 1, MemorySink())


def test_payloads_survive_a_round_trip_through_json(baseline):
    _, events = baseline

    for event in events[:500]:
        assert json.loads(json.dumps(event.payload)) == event.payload


def test_a_run_written_to_postgres_is_read_correctly_by_the_metric_queries(pg_conn, sa_conn):
    run_id = uuid.uuid4()
    world = _demand(WORLD, searches_per_day=15)
    expected = {}
    for seed in (1, 2):
        expected[seed] = _counts(_run(world, seed)[1])
        with EventWriter(pg_conn, run_id=run_id, variant=B0.name, seed=seed) as writer:
            Simulation(world, B0, seed, writer).run()

    primary = {r["seed"]: r for r in run_query(sa_conn, "primary_metric", run_id=run_id, variant="B0")}
    late = {r["seed"]: r for r in
            run_query(sa_conn, "late_cancellation_share", run_id=run_id, variant="B0")}

    assert set(primary) == {1, 2}
    for seed, counts in expected.items():
        assert primary[seed]["searches"] == counts["search_issued"]
        assert primary[seed]["completed"] == counts["trip_completed"]
        assert late[seed]["cancellations"] == counts["booking_cancelled"]
        assert late[seed]["missing_departure_time"] == 0


# ---- variants that use the durability model -----------------------------------

B3 = load_variant(CONFIGS / "variants" / "B3.yaml")
B4 = load_variant(CONFIGS / "variants" / "B4.yaml")
B5 = load_variant(CONFIGS / "variants" / "B5.yaml")
POLICY_EVENTS = {"hazard_scored", "intervention_issued", "intervention_responded"}


def _response(world, **changes):
    return _demand(world, intervention_response=dataclasses.replace(
        world.demand.intervention_response, **changes))


@pytest.fixture(scope="module")
def intervened():
    return _run(variant=B4)


def test_every_variant_faces_the_same_searches_and_the_same_rides(baseline, intervened):
    def searches(events):
        return [(e.sim_time, e.payload) for e in events if e.event_type == "search_issued"]

    def offered(sim):
        return [(r.id, r.departure, r.seats, r.publish_at, r.withdraw_at) for r in sim.rides]

    for sim, events in (_run(variant=B3), intervened):
        assert searches(events) == searches(baseline[1])
        assert offered(sim) == offered(baseline[0])


EARLIEST = load_variant(CONFIGS / "variants" / "EARLIEST.yaml")


def test_earliest_needs_no_model_faces_the_same_world_and_offers_the_soonest_ride_first(baseline):
    assert EARLIEST.hazard_model is None
    sim, events = _run(variant=EARLIEST)

    assert [(e.sim_time, e.payload) for e in events if e.event_type == "search_issued"] == \
        [(e.sim_time, e.payload) for e in baseline[1] if e.event_type == "search_issued"]
    assert [(r.id, r.departure, r.seats) for r in sim.rides] == [(r.id, r.departure, r.seats) for r in baseline[0].rides]

    departure = {ride.id: ride.departure for ride in sim.rides}
    ranked: dict[tuple, list[tuple[int, int]]] = {}
    for e in events:
        if e.event_type == "candidate_ranked":
            ranked.setdefault((e.payload["search_id"], e.sim_time), []).append((e.payload["rank"], e.payload["ride_id"]))
    orders = [[departure[ride] for _, ride in sorted(offers)] for offers in ranked.values() if len(offers) > 1]
    assert orders and all(order == sorted(order) for order in orders)


def test_model_variants_keep_every_invariant_and_leak_nothing(intervened):
    sim, events = intervened
    counts = _counts(events)
    forbidden = set(LATENT_TYPES) | {"kind", "latent", "type", "passenger_type", "cancel_at"}

    assert counts["trip_started"] == counts["trip_completed"] + counts["trip_failed"]
    assert [e.sim_time for e in events] == sorted(e.sim_time for e in events)
    for ride in sim.rides:
        assert 0 <= ride.seats_available <= ride.seats
    for event in events:
        assert not forbidden & set(event.payload), event
        assert not forbidden & {v for v in event.payload.values() if isinstance(v, str)}, event
        assert (event.actor_type, event.actor_id is None) in [
            ("passenger", False), ("driver", False), ("platform", True)]


def test_scores_are_probabilities_and_name_the_model_that_made_them(intervened):
    _, events = intervened
    scores = [e for e in events if e.event_type == "hazard_scored"]

    assert scores
    for event in scores:
        payload = event.payload
        assert 0.0 < payload["survival_probability"] <= 1.0
        assert 0.0 <= payload["elapsed_hours"] < payload["horizon_hours"]
        assert (payload["model_version"], payload["feature_version"]) == ("h3-cox", "f2")


def test_a_booking_is_asked_at_most_once_only_when_risky_and_never_too_late(intervened):
    sim, events = intervened
    policy = B4.intervention
    departure = {b.id: WORLD.start + timedelta(hours=b.ride.departure) for b in sim.bookings}
    asked = [e for e in events if e.event_type == "intervention_issued"]

    assert asked
    assert len({e.payload["booking_id"] for e in asked}) == len(asked)
    for event in asked:
        assert event.payload["survival_probability"] < policy.survival_threshold
        assert event.payload["action"] == "reconfirm"
        remaining = departure[event.payload["booking_id"]] - event.sim_time
        assert remaining >= timedelta(hours=policy.min_hours_before_departure)


def test_only_the_passenger_releases_a_seat_and_a_release_is_a_cancellation(intervened):
    _, events = intervened
    responses = [e for e in events if e.event_type == "intervention_responded"]
    cancelled_at = {
        e.payload["booking_id"]: e.sim_time for e in events
        if e.event_type == "booking_cancelled" and e.payload["cancelled_by"] == "passenger"}

    assert {e.payload["response"] for e in responses} == {"released", "confirmed"}
    for event in responses:
        assert event.actor_type == "passenger"
        if event.payload["response"] == "released":
            assert cancelled_at[event.payload["booking_id"]] == event.sim_time


def test_asking_changes_nothing_when_nobody_ever_releases():
    deaf = _response(WORLD, early_release_probability=0.0, annoyed_cancel_probability=0.0)

    def outcome(variant):
        return [(e.event_type, e.sim_time, e.payload) for e in _run(deaf, variant=variant)[1]
                if e.event_type not in POLICY_EVENTS]

    assert outcome(B4) == outcome(B3)


def test_early_releases_move_cancellations_earlier_not_just_add_them(intervened):
    def lead_hours(events):
        return [
            (datetime.fromisoformat(e.payload["departure_time"]) - e.sim_time) / timedelta(hours=1)
            for e in events
            if e.event_type == "booking_cancelled" and e.payload["cancelled_by"] == "passenger"]

    def late_share(leads):
        return sum(1 for lead in leads if lead < 24) / len(leads)

    assert late_share(lead_hours(intervened[1])) < late_share(lead_hours(_run(variant=B3)[1]))


def test_a_variant_that_needs_a_model_must_name_one(tmp_path):
    from sim.config import ConfigError

    path = tmp_path / "BX.yaml"
    path.write_text("name: BX\nranking: predicted_survival\n", encoding="utf-8")
    with pytest.raises(ConfigError, match="hazard_model"):
        load_variant(path)
    path.write_text("name: BX\nranking: departure_time\nnudge: true\n", encoding="utf-8")
    with pytest.raises(ConfigError, match="nudge"):
        load_variant(path)


# ---- the contact budget ---------------------------------------------------------

def _asked(events):
    return [e for e in events if e.event_type == "intervention_issued"]


def _budget(**changes):
    return dataclasses.replace(B5, intervention=dataclasses.replace(
        B5.intervention, budget=dataclasses.replace(B5.intervention.budget, **changes)))


@pytest.fixture(scope="module")
def budgeted():
    return _run(variant=B5)


def test_a_budget_never_sends_more_than_it_allows_in_a_round_a_ride_or_a_day(budgeted):
    sim, events = budgeted
    budget = B5.intervention.budget
    booking = {b.id: b for b in sim.bookings}
    rounds, rides, days = Counter(), Counter(), Counter()
    for event in _asked(events):
        asked = booking[event.payload["booking_id"]]
        rounds[event.sim_time] += 1
        rides[event.sim_time, asked.ride.id] += 1
        days[event.sim_time, int(asked.ride.departure // 24)] += asked.seats

    assert rounds
    assert max(rounds.values()) <= budget.contacts_per_round
    assert max(rides.values()) <= budget.max_contacts_per_ride
    assert max(days.values()) <= budget.max_seats_asked_per_departure_day


def test_a_budget_asks_only_bookings_the_threshold_would_and_fewer_of_them(budgeted, intervened):
    sim, events = budgeted
    policy = B5.intervention
    departure = {b.id: WORLD.start + timedelta(hours=b.ride.departure) for b in sim.bookings}
    asked = _asked(events)

    assert 0 < len(asked) < len(_asked(intervened[1]))
    assert len({e.payload["booking_id"] for e in asked}) == len(asked)
    for event in asked:
        assert event.payload["survival_probability"] < policy.survival_threshold
        remaining = departure[event.payload["booking_id"]] - event.sim_time
        assert remaining >= timedelta(hours=policy.min_hours_before_departure)


def test_a_budget_keeps_every_invariant_and_faces_the_same_world(budgeted, baseline):
    sim, events = budgeted
    counts = _counts(events)

    assert counts["trip_started"] == counts["trip_completed"] + counts["trip_failed"]
    assert [e.sim_time for e in events] == sorted(e.sim_time for e in events)
    assert all(0 <= ride.seats_available <= ride.seats for ride in sim.rides)
    assert [(e.sim_time, e.payload) for e in events if e.event_type == "search_issued"] == \
        [(e.sim_time, e.payload) for e in baseline[1] if e.event_type == "search_issued"]


def test_a_budget_too_large_to_bind_is_the_threshold_policy_exactly(intervened):
    unlimited = _budget(contacts_per_round=10_000, max_contacts_per_ride=10_000,
                        max_seats_asked_per_departure_day=10_000)

    def story(events):
        return [(e.event_type, e.sim_time, e.payload) for e in events]

    # Something never worth asking (survival of exactly 1) could differ; nothing below
    # the threshold is.
    assert story(_run(variant=dataclasses.replace(unlimited, name="B4"))[1]) == story(intervened[1])


def test_the_same_seed_gives_the_same_plan_every_time(budgeted):
    def story(events):
        return [(e.event_type, e.sim_time, e.payload) for e in events]

    assert story(_run(variant=B5)[1]) == story(budgeted[1])


def test_the_scheduler_is_given_no_ground_truth():
    import inspect

    from intel.app.scheduler import plan as scheduler
    from sim.simulator import Simulation

    fields = set(scheduler.Candidate.__dataclass_fields__)
    assert fields == {"booking_id", "ride_id", "departure_day", "seats", "survival_probability",
                      "hours_to_departure"}
    source = inspect.getsource(Simulation._within_budget)
    for hidden in ("cancel_at", "kind", "release_draw", "annoyed_draw", "_passenger_of"):
        assert hidden not in source


# ---- the same budget, chosen at random --------------------------------------------

def test_random_choice_keeps_the_limits_and_the_threshold_and_is_not_the_scheduler(budgeted):
    random_choice = _budget(chooser="random")
    sim, events = _run(variant=random_choice)
    budget = random_choice.intervention.budget
    booking = {b.id: b for b in sim.bookings}
    rounds, rides, days = Counter(), Counter(), Counter()
    for event in _asked(events):
        asked = booking[event.payload["booking_id"]]
        rounds[event.sim_time] += 1
        rides[event.sim_time, asked.ride.id] += 1
        days[event.sim_time, int(asked.ride.departure // 24)] += asked.seats
        assert event.payload["survival_probability"] < random_choice.intervention.survival_threshold

    assert rounds
    assert max(rounds.values()) <= budget.contacts_per_round
    assert max(rides.values()) <= budget.max_contacts_per_ride
    assert max(days.values()) <= budget.max_seats_asked_per_departure_day
    # Same limits, different choices.
    assert [e.payload["booking_id"] for e in _asked(events)] !=         [e.payload["booking_id"] for e in _asked(budgeted[1])]


def test_random_choice_is_the_same_for_the_same_seed():
    random_choice = _budget(chooser="random")

    def story(events):
        return [(e.event_type, e.sim_time, e.payload) for e in events]

    assert story(_run(variant=random_choice)[1]) == story(_run(variant=random_choice)[1])


def test_random_choice_is_given_no_ground_truth():
    import inspect

    from sim.simulator import Simulation

    source = inspect.getsource(Simulation._at_random)
    for hidden in ("cancel_at", "kind", "release_draw", "annoyed_draw", "_passenger_of"):
        assert hidden not in source


# ---- the oracle upper bound -----------------------------------------------------

ORACLE = load_variant(CONFIGS / "variants" / "ORACLE.yaml")


def test_the_oracle_asks_only_bookings_that_would_cancel_late_and_leaks_nothing():
    sim, events = _run(variant=ORACLE)
    booking = {b.id: b for b in sim.bookings}
    asked = [e for e in events if e.event_type == "intervention_issued"]
    forbidden = set(LATENT_TYPES) | {"kind", "latent", "type", "passenger_type", "cancel_at"}

    assert asked
    for event in asked:
        b = booking[event.payload["booking_id"]]
        assert b.cancel_at is not None and b.ride.departure - b.cancel_at < 24
        assert not forbidden & set(event.payload)
    # Every booking that would have cancelled late, and could still be asked in time, was.
    for b in sim.bookings:
        if b.accepted_at is not None and b.cancel_at is not None and b.ride.departure - b.cancel_at < 24:
            first_round = (b.accepted_at // 24 + 1) * 24
            if b.ride.departure - first_round >= 24 and b.cancel_at > first_round:
                assert b.contacted, b.id


def test_the_oracle_faces_the_same_world():
    _, events = _run(variant=ORACLE)
    _, baseline = _run(variant=B3)
    assert [(e.sim_time, e.payload) for e in events if e.event_type == "search_issued"] ==         [(e.sim_time, e.payload) for e in baseline if e.event_type == "search_issued"]
