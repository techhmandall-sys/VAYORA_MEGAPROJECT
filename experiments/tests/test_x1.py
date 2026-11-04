import pytest
import yaml

from experiments.analysis.compare import load_analysis
from experiments.analysis.proximity import (
    CONFIG,
    exploratory,
    gain_ratio_interval,
    judge,
    load_x1,
    relative_gain,
)

SEEDS = range(1, 31)


def _const(value, wobble=0.01):
    """Per-seed values around `value`, with a small spread so intervals are defined."""
    return {s: value + wobble * ((s % 5) - 2) for s in SEEDS}


def _world(b0, earliest, b3, b4, oracle):
    measures = lambda values: {"per_100": values}  # noqa: E731
    return {
        "ranking": {"B0": measures(_const(b0)), "EARLIEST": measures(_const(earliest)),
                    "B3": measures(_const(b3 - 0.2))},
        "reconfirmation": {"B3": measures(_const(b3)), "B4": measures(_const(b4, 0.02)),
                           "ORACLE": measures(_const(oracle))},
    }


CONFIG_ = {"worlds": [{"share": 0.0}, {"share": 0.5}, {"share": 0.9}], "h1_1_fraction": 0.5}
REPRODUCED = [{"run": "a", "earlier": "b",
               "variants": {"B0": {"seeds": 30, "earlier_seeds": 30, "identical": 30}}}]


def test_the_relative_gain_is_the_mean_difference_over_the_baseline_mean():
    assert relative_gain({1: 10.0, 2: 20.0}, {1: 11.0, 2: 22.0}) == pytest.approx(0.1)


def test_the_ratio_interval_brackets_a_ratio_the_data_fix():
    b0, e0 = _const(30.0), _const(30.3)
    bw, ew = _const(30.0), _const(30.06)

    low, high = gain_ratio_interval((b0, e0), (bw, ew), 2000, 1)

    assert low <= 0.2 <= high


def test_the_verdicts_follow_the_written_rules():
    data = {0.0: _world(30.0, 30.3, 30.5, 30.52, 30.9),
            0.5: _world(30.0, 30.2, 30.5, 30.51, 31.0),
            0.9: _world(30.0, 30.1, 30.5, 30.53, 31.2)}

    verdict = judge(data, CONFIG_, load_analysis(), REPRODUCED)

    assert verdict["H1.0"]["holds"]
    assert verdict["H1.1"]["ratio"] == pytest.approx(1 / 3)
    assert verdict["H1.1"]["holds"]
    assert verdict["H1.2"]["change"]["mean_difference"] == pytest.approx(0.3)
    assert verdict["H1.2"]["holds"]
    assert verdict["H1.3"]["holds"]


def test_a_result_against_the_hypotheses_is_reported_as_such():
    data = {0.0: _world(30.0, 30.3, 30.5, 30.52, 31.0),
            0.5: _world(30.0, 30.3, 30.5, 30.80, 30.9),
            0.9: _world(30.0, 30.3, 30.5, 30.52, 30.8)}
    missing = [{"run": "a", "earlier": "b",
                "variants": {"B0": {"seeds": 30, "earlier_seeds": 30, "identical": 29}}}]

    verdict = judge(data, CONFIG_, load_analysis(), missing)

    assert not verdict["H1.0"]["holds"]
    assert not verdict["H1.1"]["holds"]
    assert not verdict["H1.2"]["holds"]
    assert not verdict["H1.3"]["holds"]


def test_the_shipped_config_starts_at_share_0_and_rejects_another_order(tmp_path):
    assert load_x1()["worlds"][0]["share"] == 0

    raw = yaml.safe_load(CONFIG.read_text(encoding="utf-8"))
    raw["worlds"].reverse()
    path = tmp_path / "x1.yaml"
    path.write_text(yaml.safe_dump(raw), encoding="utf-8")
    with pytest.raises(ValueError, match="by share"):
        load_x1(path)


def test_the_exploratory_contrast_is_b3_minus_earliest_seed_by_seed():
    data = {0.0: _world(30.0, 30.25, 30.5, 30.52, 30.9)}  # ranking B3 is 30.3

    (only,) = exploratory(data, load_analysis()).values()

    assert only["mean_difference"] == pytest.approx(0.05)
    assert only["seeds"] == 30
