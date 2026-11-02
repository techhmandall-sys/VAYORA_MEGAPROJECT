import json
from datetime import datetime, timedelta, timezone

import numpy as np
import pytest
import yaml

from experiments import real_data
from experiments.hazard import train_real
from experiments.hazard.train import load_config as load_hazard_config
from experiments.real_data import LiveEvent
from intel.app.hazard.model import MODEL_DIR
from sim.config import load_world

KOLHAPUR = (16.705, 74.2433)
PUNE = (18.5204, 73.8567)
SATARA = (17.6805, 74.0183)
CHENNAI = (13.0827, 80.2707)
BENGALURU = (12.9716, 77.5946)
START = datetime(2026, 11, 1, 6, 0, tzinfo=timezone.utc)


@pytest.fixture
def config():
    return real_data.load_config()


def search(when, origin, destination, passenger=1):
    return LiveEvent("search_issued", {
        "passenger_id": passenger, "origin_lat": origin[0], "origin_lon": origin[1],
        "destination_lat": destination[0], "destination_lon": destination[1], "date": "2026-11-05", "seats": 1,
    }, when)


def requested(booking, passenger, when, departure):
    return LiveEvent("booking_requested", {
        "booking_id": booking, "passenger_id": passenger, "seats": 1, "ride_id": 1, "from_seq": 0, "to_seq": 1,
        "departure_time": departure.isoformat(), "last_mile_distance_m": 0, "last_mile_mode_available": False,
    }, when)


def accepted(booking, when):
    return LiveEvent("booking_accepted", {"booking_id": booking, "ride_id": 1, "driver_id": 9, "instant": True}, when)


def cancelled(booking, passenger, when, by="passenger"):
    return LiveEvent("booking_cancelled", {"booking_id": booking, "passenger_id": passenger, "cancelled_by": by}, when)


def started(booking, passenger, when):
    return LiveEvent("trip_started", {"booking_id": booking, "passenger_id": passenger, "ride_id": 1, "driver_id": 9}, when)


def test_only_searches_along_the_corridor_in_the_simulators_direction_count(config):
    estimate = real_data.corridor_demand([
        search(START, KOLHAPUR, PUNE),
        search(START, SATARA, PUNE, passenger=2),
        search(START, PUNE, KOLHAPUR, passenger=3),  # the other way: told apart
        search(START, CHENNAI, BENGALURU, passenger=4),  # another road altogether
        search(START, PUNE, PUNE, passenger=5),
    ], config)

    assert estimate["searches"] == 2
    assert estimate["passengers"] == 2
    assert estimate["other_direction"] == 1


def test_a_day_with_no_searches_counts_as_a_zero_not_as_nothing(config):
    estimate = real_data.corridor_demand([
        search(START, KOLHAPUR, PUNE), search(START, KOLHAPUR, PUNE),
        search(START + timedelta(days=3), KOLHAPUR, PUNE),
    ], config)

    assert estimate["days"] == 4
    assert estimate["per_day"] == pytest.approx(0.75)
    assert estimate["interval"][0] <= 0.75 <= estimate["interval"][1]


def test_a_day_is_a_day_in_india(config):
    # 20:00 UTC on the 1st is the 2nd in India, the same day as 06:00 UTC on the 2nd.
    estimate = real_data.corridor_demand([
        search(datetime(2026, 11, 1, 20, 0, tzinfo=timezone.utc), KOLHAPUR, PUNE),
        search(datetime(2026, 11, 2, 6, 0, tzinfo=timezone.utc), KOLHAPUR, PUNE),
    ], config)

    assert estimate["days"] == 1


def test_no_searches_at_all_is_said_plainly(config):
    estimate = real_data.corridor_demand([], config)
    counts = real_data.model_counts([])

    assert estimate["per_day"] is None
    assert not real_data.demand_is_enough(estimate, config)
    assert not real_data.model_is_enough(counts, config)
    assert "not enough yet" in real_data.describe(estimate, counts, config)


def test_demand_needs_both_the_days_and_the_people(config):
    days, people = config["demand"]["min_days"], config["demand"]["min_passengers"]

    assert real_data.demand_is_enough({"days": days, "passengers": people}, config)
    assert not real_data.demand_is_enough({"days": days - 1, "passengers": people}, config)
    assert not real_data.demand_is_enough({"days": days, "passengers": people - 1}, config)


def test_demo_accounts_are_left_out_with_everything_about_their_bookings():
    departure = START + timedelta(days=2)
    kept = real_data.without_accounts([
        search(START, KOLHAPUR, PUNE, passenger=7),
        search(START, KOLHAPUR, PUNE, passenger=8),
        requested(1, 7, START, departure), accepted(1, START), cancelled(1, 7, START),
        requested(2, 8, START, departure), accepted(2, START),
    ], excluded={7})

    assert [event.payload.get("booking_id") for event in kept] == [None, 2, 2]
    assert kept[0].payload["passenger_id"] == 8


def test_a_real_world_reads_the_events_of_real_people_only(pg_conn, config):
    pg_conn.execute("CREATE TABLE users (id BIGINT, email TEXT)")
    pg_conn.execute("INSERT INTO users VALUES (1, 'real@gmail.com'), (2, 'made-up@demo.vayora.test')")
    insert = "INSERT INTO events (run_id, sim_time, event_type, payload) VALUES (%s, %s, 'search_issued', %s)"
    for run_id, passenger in ((None, 1), (None, 2), ("5eeb0000-0000-4000-8000-000000000099", 1)):
        pg_conn.execute(insert, (run_id, START, json.dumps(search(START, KOLHAPUR, PUNE, passenger).payload)))

    events = real_data.read_live_events(pg_conn, config)

    # Neither the demo account's, nor anything from a simulated run.
    assert [event.payload["passenger_id"] for event in events] == [1]


def test_a_booking_is_read_as_the_platform_scores_it():
    departure = datetime(2026, 11, 3, 18, 0, tzinfo=timezone.utc)  # 23:30 in India
    rows = real_data.finished_booking_rows([
        requested(1, 7, START, departure), accepted(1, START), started(1, 7, departure),
    ], now=departure + timedelta(days=1))

    assert rows[0]["departure_hour"] == 23  # India's hour, not the 18 of UTC
    assert rows[0]["desired_gap_hours"] == 0  # a platform search names a day, not a time
    assert rows[0]["reached_departure"] is True
    assert rows[0]["cancelled"] is False


def test_history_builds_up_from_live_events():
    departure = START + timedelta(days=2)
    later = START + timedelta(days=4)
    rows = real_data.finished_booking_rows([
        requested(1, 7, START, departure), accepted(1, START), cancelled(1, 7, START + timedelta(hours=1)),
        requested(2, 7, later, later + timedelta(days=1)), accepted(2, later), started(2, 7, later + timedelta(days=1)),
    ], now=later + timedelta(days=2))

    assert rows[0]["cancelled"] is True
    assert rows[1]["prior_accepted"] == 1
    assert rows[1]["prior_cancellations"] == 1


def test_a_booking_still_to_come_has_no_outcome_and_is_left_out():
    now = START + timedelta(days=1)
    rows = real_data.finished_booking_rows([
        # Will leave tomorrow: its passenger cancelling now would be counted, its surviving would not.
        requested(1, 7, START, now + timedelta(days=1)), accepted(1, START), cancelled(1, 7, START + timedelta(hours=1)),
        requested(2, 8, START, now - timedelta(hours=1)), accepted(2, START), started(2, 8, now - timedelta(hours=1)),
    ], now=now)

    assert len(rows) == 1
    assert rows[0]["reached_departure"] is True


def test_the_calibrated_world_differs_from_world_yaml_only_in_demand(tmp_path, config):
    text = real_data.WORLD.read_text(encoding="utf-8")
    estimate = {"per_day": 43.25, "searches": 1211, "passengers": 90, "days": 28}

    written = tmp_path / "calibrated.yaml"
    written.write_text(real_data.calibrated_world_text(text, estimate), encoding="utf-8")
    calibrated, original = load_world(written), load_world(real_data.WORLD)

    assert calibrated.demand.searches_per_day == pytest.approx(43.2, abs=0.11)
    assert yaml.safe_load(written.read_text(encoding="utf-8"))["supply"] == yaml.safe_load(text)["supply"]
    assert original.demand.searches_per_day == 60
    assert "1211 real searches by 90 people over 28 days" in written.read_text(encoding="utf-8")


def bookings(count, cancel_share=0.3, seed=0):
    """A made-up history, for testing the training alone: nothing here is evidence of anything."""
    random = np.random.RandomState(seed)
    events, now = [], START
    for booking in range(count):
        now += timedelta(hours=1)
        passenger = int(random.randint(1, count // 4 + 2))
        horizon = float(random.uniform(10, 160))
        departure = now + timedelta(hours=horizon)
        events += [requested(booking, passenger, now, departure), accepted(booking, now)]
        if random.random() < cancel_share:
            events.append(cancelled(booking, passenger, now + timedelta(hours=float(random.uniform(1, horizon)))))
        else:
            events.append(started(booking, passenger, departure))
    events.sort(key=lambda event: event.sim_time)
    return real_data.finished_booking_rows(events, now=now + timedelta(days=30))


def test_training_refuses_until_there_are_enough_bookings(config):
    rows = bookings(50)

    with pytest.raises(ValueError, match="not enough"):
        train_real.train(rows, load_hazard_config(), config)


def test_training_trains_on_earlier_outcomes_validates_on_later_and_serves_nothing(config):
    model_files = sorted(MODEL_DIR.glob("*.json"))
    rows = bookings(600)

    report, models = train_real.train(rows, load_hazard_config(), config)

    assert report["data"].startswith("real")
    assert report["train"]["bookings"] == int(len(rows) * config["model"]["train_share"])
    assert report["train"]["bookings"] + report["validation"]["bookings"] == len(rows)
    assert [result["model"] for result in report["models"]] == ["kaplan_meier", "cox_ph"]
    assert [model.version for model in models] == ["real-1-km", "real-1-cox"]
    assert 0 <= report["models"][1]["concordance"] <= 1
    assert sorted(MODEL_DIR.glob("*.json")) == model_files  # nothing added to what intel serves


def test_a_feature_that_never_varies_does_not_stop_the_fit(config):
    # On real bookings desired_gap_hours is always 0, which would otherwise end the fit in an error.
    rows = bookings(600)
    assert {row["desired_gap_hours"] for row in rows} == {0.0}

    _, (_, cox) = train_real.train(rows, load_hazard_config(), config)

    assert cox.coef[cox.features.index("desired_gap_hours")] == 0.0
    assert any(coefficient != 0.0 for coefficient in cox.coef)
