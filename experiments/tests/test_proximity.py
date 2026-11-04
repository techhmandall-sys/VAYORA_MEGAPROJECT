import dataclasses

import numpy as np
import pytest
import yaml

from experiments.proximity.calibrate import (
    CONFIGS,
    calibrate,
    expected_world,
    load_proximity,
    solve_rate,
    world_text,
)
from sim.config import load_world
from sim.frozen import LATENT_TYPES

WORLD = CONFIGS / "world.yaml"


def _survival(weibull, unit, share, rate):
    return float(np.mean(np.exp(-(1 - share) * weibull - rate * unit)))


def test_the_solved_rate_keeps_mean_survival_where_it_was():
    rng = np.random.default_rng(0)
    weibull = rng.exponential(0.2, 500)
    unit = 24.0 * (1 - np.exp(-rng.uniform(1, 168, 500) / 24.0))

    rate = solve_rate(weibull, unit, 0.5, upper=10.0, tolerance=1e-12)

    assert rate > 0
    assert _survival(weibull, unit, 0.5, rate) == pytest.approx(_survival(weibull, unit, 0, 0), abs=1e-9)
    assert solve_rate(weibull, unit, 0.9, upper=10.0, tolerance=1e-12) > rate


def test_a_rate_out_of_reach_is_an_error_not_a_guess():
    weibull, unit = np.array([0.5, 1.0]), np.array([1e-6, 1e-6])

    with pytest.raises(ValueError, match="no rate"):
        solve_rate(weibull, unit, 0.9, upper=1.0, tolerance=1e-12)


def test_the_written_world_differs_from_world_h3_only_in_the_proximity_settings(tmp_path):
    rates = {kind: 0.001 * (i + 1) for i, kind in enumerate(LATENT_TYPES)}
    path = tmp_path / "w.yaml"
    path.write_text(world_text(WORLD.read_text(encoding="utf-8"), 0.5, 24.0, rates, "# test\n"),
                    encoding="utf-8")

    world = load_world(path)

    assert world == expected_world(load_world(WORLD), 0.5, 24.0, rates)
    assert world.demand.types["flexible"].proximity_rate == rates["flexible"]


def test_calibration_seeds_may_not_overlap_any_other_seeds(tmp_path):
    raw = yaml.safe_load((CONFIGS / "proximity.yaml").read_text(encoding="utf-8"))
    raw["calibration_seeds"] = {"first": 25, "last": 35}
    path = tmp_path / "proximity.yaml"
    path.write_text(yaml.safe_dump(raw), encoding="utf-8")

    with pytest.raises(ValueError, match="disjoint"):
        load_proximity(path)


def test_calibration_on_one_seed_keeps_each_types_chance_of_reaching_departure(tmp_path):
    config = dict(load_proximity(), shares=[0.5], calibration_seeds={"first": 3001, "last": 3001})

    report = calibrate(config, worlds_dir=tmp_path)

    written = report["worlds"]["proximity_w0.5.yaml"]
    for kind in LATENT_TYPES:
        assert written["analytic_survival"][kind] == pytest.approx(
            report["world_h3"]["target_survival"][kind], abs=1e-9)
        assert written["rates_per_hour"][kind] > 0
    world = load_world(tmp_path / "proximity_w0.5.yaml")
    assert world.demand.proximity.share == 0.5
    assert dataclasses.replace(world.demand.proximity, share=0.0) == load_world(WORLD).demand.proximity
