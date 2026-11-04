from collections import Counter

import numpy as np
import pandas as pd
import pytest

from experiments.hazard.dataset import survival_rows
from experiments.hazard.train import (
    EXPERIMENT_SEEDS, CONFIGS, fit_cox, fit_kaplan_meier, load_config, seeds)
from intel.app.hazard.features import FEATURES
from sim.config import load_variant, load_world
from sim.frozen import LATENT_TYPES
from sim.simulator import MemorySink, Simulation


@pytest.fixture(scope="module")
def run():
    sink = MemorySink()
    Simulation(load_world(CONFIGS / "world.yaml"), load_variant(CONFIGS / "variants" / "B0.yaml"),
               5001, sink).run()
    return sink.events, survival_rows(sink.events)


def test_training_validation_and_experiment_seeds_never_overlap(tmp_path):
    config = load_config()
    train, validation = set(seeds(config["train_seeds"])), set(seeds(config["validation_seeds"]))

    assert not train & validation
    assert not (train | validation) & EXPERIMENT_SEEDS

    leaky = tmp_path / "hazard.yaml"
    leaky.write_text((CONFIGS / "hazard.yaml").read_text(encoding="utf-8").replace(
        "{first: 2001, last: 2010}", "{first: 25, last: 35}"), encoding="utf-8")
    with pytest.raises(ValueError, match="disjoint"):
        load_config(leaky)


@pytest.mark.parametrize("name, version", [("hazard.yaml", "h3"), ("hazard_h4.yaml", "h4")])
def test_every_model_config_keeps_its_seeds_apart_and_names_a_world_that_loads(name, version):
    config = load_config(CONFIGS / name)

    assert config["version"] == version
    assert load_world(CONFIGS / config["world"]) is not None


def test_there_is_one_row_per_accepted_booking_with_the_right_outcome(run):
    events, rows = run
    counts = Counter(e.event_type for e in events)
    passenger_cancels = sum(
        1 for e in events
        if e.event_type == "booking_cancelled" and e.payload["cancelled_by"] == "passenger")

    assert len(rows) == counts["booking_accepted"]
    assert sum(r["cancelled"] for r in rows) == passenger_cancels
    assert sum(r["reached_departure"] for r in rows) == counts["trip_started"]
    assert not any(r["cancelled"] and r["reached_departure"] for r in rows)


def test_durations_are_measured_from_acceptance_and_never_pass_departure(run):
    _, rows = run

    for row in rows:
        assert 0 <= row["duration_hours"] <= row["horizon_hours"]
        if row["reached_departure"]:
            assert row["duration_hours"] == pytest.approx(row["horizon_hours"])
        # The feature is taken at the request, slightly before acceptance.
        assert row["lead_hours"] >= row["horizon_hours"]


def test_rows_hold_exactly_the_model_features_and_nothing_latent(run):
    _, rows = run
    outcome = {"duration_hours", "cancelled", "horizon_hours", "reached_departure"}

    assert set(rows[0]) == set(FEATURES) | outcome
    assert not set(rows[0]) & (set(LATENT_TYPES) | {"kind", "passenger_id", "seed"})


def test_history_features_only_ever_look_backwards(run):
    events, rows = run
    # The first accepted booking of a run can have no history at all.
    assert all(rows[0][name] == 0.0 for name in FEATURES if name.startswith("prior_"))
    assert any(row["prior_cancellations"] > 0 for row in rows)
    for row in rows:
        assert row["prior_cancellations"] + row["prior_completed"] + row["prior_no_shows"] \
            <= row["prior_accepted"]


def test_the_exported_cox_model_reproduces_lifelines(run):
    _, rows = run
    frame = pd.DataFrame(rows)

    exported, fitted = fit_cox(frame, "t", penalizer=0.01)
    sample = frame.head(25)
    # At event times only: between them lifelines interpolates the baseline hazard and
    # the exported model holds it constant, a difference of about 0.001.
    times = [exported.times[i] for i in (5, len(exported.times) // 2, -1)]
    expected = fitted.predict_survival_function(sample[list(FEATURES)], times=times)

    for column, (_, row) in zip(expected.columns, sample.iterrows(), strict=True):
        ours = [exported.survival(row[list(FEATURES)].to_dict(), t) for t in times]
        assert ours == pytest.approx(expected[column].to_numpy(), abs=1e-6)


def test_the_kaplan_meier_export_ignores_features_and_matches_the_cancel_rate(run):
    _, rows = run
    frame = pd.DataFrame(rows)
    model = fit_kaplan_meier(frame, "t")

    one = model.survival(frame.iloc[0][list(FEATURES)].to_dict(), 24.0)
    other = model.survival(frame.iloc[-1][list(FEATURES)].to_dict(), 24.0)

    assert one == other
    assert 0.8 < one < 1.0
    assert np.isfinite(model.cumulative_hazard).all()
