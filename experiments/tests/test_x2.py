import pytest
import yaml

from experiments.analysis.compare import load_analysis
from experiments.analysis.time_cost import CONFIG, crossing, judge, label, load_x2

SEEDS = range(1, 31)
COSTS = [0.0, 0.001, 0.002, 0.005, 0.01, 0.03]


def _around(value, wobble=0.01):
    return {s: value + wobble * ((s % 5) - 2) for s in SEEDS}


def _data(earliest_gain, b3_gain):
    """Per-cost data: B0 at 30, EARLIEST at 30 + its gain, B3 at EARLIEST + B3's gain."""
    out = {}
    for cost, gain, extra in zip(COSTS, earliest_gain, b3_gain, strict=True):
        earliest = _around(30.0 + gain)
        out[cost] = {"B0": {"per_100": _around(30.0)}, "EARLIEST": {"per_100": earliest},
                     "EARLIEST_B": {"per_100": earliest},
                     "B3": {"per_100": {s: v + extra + 0.005 * (s % 3) for s, v in earliest.items()}}}
    return out


CONFIG_ = {"costs": COSTS, "crossing_between": [0.001, 0.03], "exposure_hazard_per_hour": 0.0031}
GAPS = {"B0": {s: 0.1 for s in SEEDS}, "EARLIEST": {s: -0.9 + 0.01 * (s % 4) for s in SEEDS}}
SAME = {"B0": {"seeds": 30, "earlier_seeds": 30, "identical": 30}}


def test_a_crossing_is_interpolated_between_the_grid_points_around_it():
    assert crossing([0.0, 0.01, 0.03], [0.3, 0.1, -0.1]) == pytest.approx(0.02)
    assert crossing([0.0, 0.01], [0.3, 0.1]) is None


def test_the_verdicts_follow_the_written_readings():
    data = _data([0.32, 0.30, 0.25, 0.15, 0.05, -0.20], [0.0] * 6)

    verdict = judge(data, GAPS, CONFIG_, load_analysis(), SAME)

    assert verdict["H2.0"]["holds"]
    assert verdict["H2.1"]["falls"] and verdict["H2.1"]["crosses"]
    assert 0.01 < verdict["H2.1"]["crossing_cost"] < 0.03
    assert verdict["H2.2"]["holds"]
    # EARLIEST leaves about 0.985 h earlier; 0.985 * 0.0031 is 0.31%, against 0.32 / 30 = 1.07%.
    assert verdict["H2.3"]["shift_hours"]["mean_difference"] == pytest.approx(0.985, abs=0.01)
    assert verdict["H2.3"]["holds"]


def test_a_gain_that_never_crosses_or_a_b3_that_pulls_away_is_reported_as_such():
    data = _data([0.32, 0.31, 0.31, 0.30, 0.30, 0.29], [0.0, 0.0, 0.0, 0.0, 0.0, 0.3])
    flat = judge(data, GAPS, CONFIG_, load_analysis(), SAME)

    assert not flat["H2.1"]["crosses"]
    assert flat["H2.1"]["crossing_cost"] is None
    assert not flat["H2.1"]["holds"]
    assert not flat["H2.2"]["holds"]


def test_the_shipped_config_names_two_sweeps_over_one_grid_and_rejects_a_bad_range(tmp_path):
    config = load_x2()

    assert config["costs"][0] == 0
    assert label("B0", config, 0.0) == "B0[time_deviation_cost_per_hour=0.0]"

    raw = yaml.safe_load(CONFIG.read_text(encoding="utf-8"))
    raw["crossing_between"] = [0.03, 0.001]
    bad = tmp_path / "x2.yaml"
    bad.write_text(yaml.safe_dump(raw), encoding="utf-8")
    with pytest.raises(ValueError, match="crossing range"):
        load_x2(bad)
