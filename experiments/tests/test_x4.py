import numpy as np
import pytest
import yaml

from experiments.hazard.evaluate import (
    CONFIG,
    calibration_bins,
    calibration_in_the_large,
    cluster_interval,
    compare_calibration,
    fit_forest,
    harrell,
    judge,
    step_values,
)


def test_harrell_is_one_for_a_perfect_ranking_and_a_half_for_none():
    time = np.array([1.0, 2.0, 3.0, 4.0])
    event = np.array([True, True, True, False])

    assert harrell(time, event, np.array([4.0, 3.0, 2.0, 1.0])) == 1.0
    assert harrell(time, event, np.zeros(4)) == 0.5


def test_a_cluster_interval_resamples_whole_clusters_reproducibly():
    clusters = np.array([1, 1, 2, 2, 3, 3])
    values = np.array([0.0, 0.0, 1.0, 1.0, 2.0, 2.0])
    mean = lambda rows: float(values[rows].mean())  # noqa: E731

    first = cluster_interval(clusters, mean, resamples=500, seed=7, confidence=0.95)

    assert first == cluster_interval(clusters, mean, resamples=500, seed=7, confidence=0.95)
    assert 0.0 <= first[0] < 1.0 < first[1] <= 2.0
    assert cluster_interval(clusters, lambda rows: 0.3, resamples=50, seed=1, confidence=0.9) == (0.3, 0.3)


def test_step_values_read_each_rows_curve_at_its_own_time():
    grid = np.array([1.0, 2.0, 5.0])
    table = np.array([[0.9, 0.8, 0.5], [0.95, 0.7, 0.6]])

    assert step_values(table, grid, np.array([0.5, 3.0])).tolist() == [1.0, 0.7]
    assert step_values(table, grid, np.array([5.0, 9.0])).tolist() == [0.5, 0.6]


def _scored(seed, scores, started, withdrawn=False):
    return {"seed": seed, "scores": scores, "started": started, "driver_cancelled": withdrawn}


def test_calibration_in_the_large_pools_every_scored_round_and_drops_withdrawn_rides():
    rows = [_scored(1, [0.9, 0.8], True), _scored(1, [0.6], False), _scored(1, [0.2], True, withdrawn=True)]

    (one,) = calibration_in_the_large(rows).values()

    assert one["pairs"] == 3
    assert one["mean_score"] == pytest.approx((0.9 + 0.8 + 0.6) / 3)
    assert one["observed"] == pytest.approx(2 / 3)
    assert [b["pairs"] for b in calibration_bins(rows, 3)] == [1, 1, 1]


def test_comparing_calibration_pairs_seeds_and_tests_the_difference_two_sided():
    acting = {s: {"mean_score": 0.8, "observed": 0.7 + 0.001 * s} for s in range(1, 11)}
    quiet = {s: {"mean_score": 0.8, "observed": 0.8 - 0.001 * s} for s in range(1, 11)}

    result = compare_calibration(acting, quiet)

    assert result["seeds"] == 10
    assert result["difference"] == pytest.approx(-0.1 + 0.002 * 5.5)
    assert result["p_value"] < 1e-6


def _models(pairs):
    return {"models": [{"model": name, "harrell": c} for name, c in pairs]}


def test_the_verdicts_follow_the_written_readings():
    x4 = yaml.safe_load(CONFIG.read_text(encoding="utf-8"))
    report = {
        "hotels_horizon": _models([("kaplan_meier", 0.5), ("cox_ph", 0.60), ("random_survival_forest", 0.65)]),
        "hotels_all_leads": _models([("kaplan_meier", 0.5), ("cox_ph", 0.75), ("random_survival_forest", 0.80)]),
        "simulator": _models([("kaplan_meier", 0.5), ("cox_ph", 0.638), ("random_survival_forest", 0.655)]),
        "calibration": {"comparison": {"p_value": 0.001}},
    }

    verdict = judge(report, x4)

    # Kaplan-Meier ranks no one, so its 0.5 at both horizons does not count against H4.1.
    assert verdict["H4.1"]["holds"] and set(verdict["H4.1"]["by_model"]) == {"cox_ph", "random_survival_forest"}
    assert verdict["H4.2"]["holds"]
    assert verdict["H4.3"]["holds"] and verdict["H4.3"]["largest_gain_over_cox"] == pytest.approx(0.017)

    report["simulator"] = _models([("cox_ph", 0.638), ("gradient_boosting_tuned", 0.67)])
    report["hotels_all_leads"] = _models([("kaplan_meier", 0.5), ("cox_ph", 0.58), ("random_survival_forest", 0.80)])
    report["calibration"] = {"comparison": {"p_value": 0.2}}
    verdict = judge(report, x4)

    assert not verdict["H4.1"]["holds"] and not verdict["H4.2"]["holds"] and not verdict["H4.3"]["holds"]


def test_a_forest_on_a_time_grid_keeps_curves_only_at_grid_times():
    import pandas as pd

    rng = np.random.default_rng(0)
    frame = pd.DataFrame({"x": rng.normal(size=200), "t": rng.uniform(0.1, 30.0, size=200),
                          "cancelled": rng.random(200) < 0.5})
    settings = {"max_train_rows": 500, "params": {"n_estimators": 5, "min_samples_leaf": 10, "random_state": 0}}

    forest = fit_forest(frame, ["x"], "t", settings, time_grid=1.0)

    assert set(forest.unique_times_) <= set(np.arange(1.0, 31.0))
