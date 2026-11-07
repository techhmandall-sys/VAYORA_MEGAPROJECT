"""Evaluates the durability models with intervals, Uno's concordance and time-dependent AUC (X4).

    python -m experiments.hazard.evaluate

EXPERIMENT_PROTOCOL.md sections 26 and 30; settings and the readings of H4.1 to H4.3 in
experiments/configs/x4.yaml. For the simulator's models (hazard.yaml's seeds and settings) and for the
real hotel bookings, within 7 days of arrival and at every lead time, it fits:

- Kaplan-Meier and Cox, as the platform's models are fitted;
- the configured gradient-boosted model;
- a gradient-boosted model tuned on held-out training data;
- a random survival forest.

Each is scored once on the evaluation set: Harrell's and Uno's concordance, the time-dependent AUC,
the integrated Brier score, and the Brier score for still being booked at departure or arrival.
Harrell's concordance and that Brier score get percentile intervals from resampling the evaluation
set by cluster (validation seed; week of arrival), with the fitted models held fixed.

H4.2 reads the event log: the calibration of the scores B4 logged when the platform acts on them,
against B4's scores in a world where nobody answers (configs/sweeps/intervention_null.yaml).
Writes experiments/reports/x4-models.json and .md.
"""

from __future__ import annotations

import csv
import itertools
import json
import os
import statistics
import uuid
import warnings
from dataclasses import dataclass
from typing import Any, Callable

import numpy as np
import pandas as pd
import yaml
from lifelines import CoxPHFitter, KaplanMeierFitter
from lifelines.exceptions import ConvergenceWarning
from lifelines.utils import concordance_index
from scipy import stats
from sksurv.ensemble import GradientBoostingSurvivalAnalysis, RandomSurvivalForest
from sksurv.metrics import concordance_index_ipcw, cumulative_dynamic_auc, integrated_brier_score
from sksurv.util import Surv
from sqlalchemy import create_engine, make_url

from experiments.analysis.queries import run_query
from experiments.hazard.train import CONFIGS, REPORTS, fit_cox, fit_gradient_boosting, load_config, seeds, simulate
from experiments.hotel.load import fetch, load_config as load_hotel_config
from experiments.hotel.survival import load_survival_config, rows as hotel_rows
from experiments.sweep import cell_label
from intel.app.hazard.features import FEATURES

CONFIG = CONFIGS / "x4.yaml"
PREDICTION_CHUNK = 2000  # rows of survival curves predicted at once: a memory bound, not a tunable


def progress(message: str) -> None:
    print(message, flush=True)


# ---------------------------------------------------------------- measures

def harrell(time: np.ndarray, event: np.ndarray, risk: np.ndarray) -> float:
    """Harrell's concordance; `risk` is higher for a booking expected to be cancelled sooner."""
    return float(concordance_index(time, -risk, event))


def cluster_interval(clusters: np.ndarray, statistic: Callable[[np.ndarray], float], *, resamples: int, seed: int,
                     confidence: float) -> tuple[float, float]:
    """Percentile interval of `statistic(rows)` over resamples of whole clusters, with replacement."""
    ids = np.unique(clusters)
    members = {c: np.flatnonzero(clusters == c) for c in ids}
    rng = np.random.default_rng(seed)
    values = [statistic(np.concatenate([members[c] for c in rng.choice(ids, size=len(ids))]))
              for _ in range(resamples)]
    tail = 100 * (1 - confidence) / 2
    return float(np.percentile(values, tail)), float(np.percentile(values, 100 - tail))


def step_values(values: np.ndarray, grid: np.ndarray, at: np.ndarray) -> np.ndarray:
    """Per-row survival step functions, tabulated on `grid`, read at per-row times `at` (1 before the grid)."""
    index = np.searchsorted(grid, at, side="right") - 1
    picked = values[np.arange(len(values)), np.clip(index, 0, None)]
    return np.where(index < 0, 1.0, picked)


@dataclass
class Predictions:
    """One model's predictions on the evaluation set."""
    name: str
    risk: np.ndarray        # higher: expected to be cancelled sooner
    at_end: np.ndarray      # chance of still being booked at departure (or arrival), every row
    curves: np.ndarray      # survival at the Brier times, rows by times


@dataclass
class Evaluation:
    train_time: np.ndarray
    train_event: np.ndarray
    time: np.ndarray
    event: np.ndarray
    known: np.ndarray       # rows whose outcome at departure is known
    survived: np.ndarray    # still booked at departure, for the known rows (0/1, aligned with all rows)
    clusters: np.ndarray
    auc_times: list[float]
    uno_tau: float
    brier_times: list[float]


def assess(p: Predictions, e: Evaluation, boot: dict[str, Any]) -> dict[str, Any]:
    train, test = Surv.from_arrays(e.train_event, e.train_time), Surv.from_arrays(e.event, e.time)
    longest = min(e.train_time.max(), e.time.max())
    auc_times = [t for t in e.auc_times if t < longest]
    auc, mean_auc = cumulative_dynamic_auc(train, test, p.risk, auc_times)
    tau = min(e.uno_tau, longest)
    known = np.flatnonzero(e.known)

    def brier(rows: np.ndarray) -> float:
        rows = rows[e.known[rows]]
        return float(np.mean((p.at_end[rows] - e.survived[rows]) ** 2))

    options = dict(resamples=boot["resamples"], seed=boot["seed"], confidence=boot["confidence"])
    return {
        "model": p.name,
        "harrell": harrell(e.time, e.event, p.risk),
        "harrell_interval": cluster_interval(e.clusters, lambda r: harrell(e.time[r], e.event[r], p.risk[r]), **options),
        "uno": float(concordance_index_ipcw(train, test, p.risk, tau=tau)[0]),
        "uno_tau": float(tau),
        "auc": {str(t): float(a) for t, a in zip(auc_times, auc, strict=True)},
        "mean_auc": float(mean_auc),
        "integrated_brier_score": float(integrated_brier_score(train, test, p.curves, e.brier_times)),
        "end_brier": brier(known),
        "end_brier_interval": cluster_interval(e.clusters, brier, **options),
    }


# ---------------------------------------------------------------- the added models

def _sample(frame: pd.DataFrame, rows: int, seed: int) -> pd.DataFrame:
    return frame.sample(rows, random_state=seed) if len(frame) > rows else frame


def fit_forest(frame: pd.DataFrame, features: list[str], time: str, settings: dict[str, Any], *,
               time_grid: float | None = None):
    """A random survival forest on sampled training rows; with `time_grid`, times rounded up to it."""
    sample = _sample(frame, settings["max_train_rows"], settings["params"]["random_state"])
    times = sample[time].to_numpy(dtype=float)
    if time_grid:
        times = np.ceil(times / time_grid) * time_grid
    return RandomSurvivalForest(**settings["params"]).fit(
        sample[features].to_numpy(), Surv.from_arrays(sample["cancelled"].to_numpy(), times))


def tune_boosting(fit_part: pd.DataFrame, hold_out: pd.DataFrame, everything: pd.DataFrame, features: list[str],
                  time: str, settings: dict[str, Any]) -> tuple[Any, dict[str, Any], list[dict[str, Any]]]:
    """Fits every combination on `fit_part`, keeps the one with the best concordance on `hold_out`, and
    refits it on a sample of `everything`."""
    fixed, grid = settings["fixed"], settings["grid"]

    def fit(frame: pd.DataFrame, params: dict[str, Any]):
        sample = _sample(frame, settings["max_train_rows"], fixed["random_state"])
        return GradientBoostingSurvivalAnalysis(**params).fit(
            sample[features].to_numpy(), Surv.from_arrays(sample["cancelled"].to_numpy(), sample[time].to_numpy()))

    tried = []
    for values in itertools.product(*grid.values()):
        params = dict(zip(grid, values, strict=True)) | fixed
        model = fit(fit_part, params)
        score = harrell(hold_out[time].to_numpy(), hold_out["cancelled"].to_numpy(),
                        model.predict(hold_out[features].to_numpy()))
        tried.append({"params": params, "hold_out_harrell": score})
    best = max(tried, key=lambda t: t["hold_out_harrell"])["params"]
    return fit(everything, best), best, tried


def sksurv_predictions(name: str, model, frame: pd.DataFrame, features: list[str], end: np.ndarray,
                       brier_times: list[float]) -> Predictions:
    x = frame[features].to_numpy()
    grid = np.asarray(model.unique_times_, dtype=float)
    at_end, curves = [], []
    # A whole table of curves (rows by every event time) can exhaust memory, so a chunk at a time.
    for start in range(0, len(x), PREDICTION_CHUNK):
        rows = slice(start, start + PREDICTION_CHUNK)
        table = model.predict_survival_function(x[rows], return_array=True)
        at_end.append(step_values(table, grid, end[rows]))
        curves.append(np.column_stack([step_values(table, grid, np.full(len(table), t)) for t in brier_times]))
    return Predictions(name, model.predict(x), np.concatenate(at_end), np.vstack(curves))


def lifelines_cox_predictions(name: str, cox: CoxPHFitter, frame: pd.DataFrame, columns: list[str], end: np.ndarray,
                              brier_times: list[float]) -> Predictions:
    """S(t | x) = S0(t) ** exp((x - mean) . beta), lifelines' own centring."""
    hazard = cox.predict_partial_hazard(frame[columns]).to_numpy()
    baseline = cox.baseline_survival_.iloc[:, 0]
    grid, s0 = baseline.index.to_numpy(dtype=float), baseline.to_numpy()

    def at(times: np.ndarray) -> np.ndarray:
        index = np.searchsorted(grid, times, side="right") - 1
        return np.where(index < 0, 1.0, s0[np.clip(index, 0, None)]) ** hazard

    curves = np.column_stack([at(np.full(len(frame), t)) for t in brier_times])
    return Predictions(name, hazard, at(end), curves)


def km_predictions(train: pd.DataFrame, time: str, n: int, end: np.ndarray, brier_times: list[float]) -> Predictions:
    km = KaplanMeierFitter().fit(train[time], train["cancelled"])
    curves = np.tile(km.survival_function_at_times(brier_times).to_numpy(), (n, 1))
    return Predictions("kaplan_meier", np.zeros(n), km.survival_function_at_times(end).to_numpy(), curves)


# ---------------------------------------------------------------- the simulator

def simulator(x4: dict[str, Any], boot: dict[str, Any]) -> dict[str, Any]:
    config = load_config(CONFIGS / x4["simulator"]["hazard_config"])
    train = simulate(config, seeds(config["train_seeds"]))
    valid = simulate(config, seeds(config["validation_seeds"]))
    tuning = set(seeds(x4["simulator"]["tuning_seeds"]))
    if not tuning < set(seeds(config["train_seeds"])):
        raise ValueError("tuning seeds must be some, not all, of the training seeds")
    features, time = list(FEATURES), "duration_hours"
    brier_times = [t for t in config["brier_times_hours"]
                   if t < min(train[time].max(), valid[time].max())]
    end = valid["horizon_hours"].to_numpy(dtype=float)
    evaluation = Evaluation(
        train[time].to_numpy(), train["cancelled"].to_numpy(), valid[time].to_numpy(), valid["cancelled"].to_numpy(),
        (valid["cancelled"] | valid["reached_departure"]).to_numpy(), valid["reached_departure"].to_numpy(dtype=float),
        valid["seed"].to_numpy(), x4["simulator"]["auc_times"], x4["simulator"]["uno_tau"], brier_times)

    progress(f"simulator: {len(train)} training and {len(valid)} validation rows")
    cox, _ = fit_cox(train, config["version"], config["cox"]["penalizer"])
    rows = valid[features].to_dict("records")
    cox_pred = Predictions(
        "cox_ph", np.array([cox._relative_risk(r) for r in rows]),
        np.array([cox.survival(r, h) for r, h in zip(rows, end, strict=True)]),
        np.array([[cox.survival(r, t) for t in brier_times] for r in rows]))
    boosted = fit_gradient_boosting(train, config["gradient_boosting"])
    progress("simulator: cox and boosting fitted")
    tuned, best, tried = tune_boosting(train[~train["seed"].isin(tuning)], train[train["seed"].isin(tuning)], train,
                                       features, time, x4["gradient_boosting_tuned"])
    progress(f"simulator: boosting tuned, {best}")
    settings = x4["random_survival_forest"]
    forest = fit_forest(train, features, time, settings, time_grid=settings["simulator_time_grid_hours"])
    progress("simulator: forest fitted")
    predictions = [
        km_predictions(train, time, len(valid), end, brier_times),
        cox_pred,
        sksurv_predictions("gradient_boosting", boosted, valid, features, end, brier_times),
        sksurv_predictions("gradient_boosting_tuned", tuned, valid, features, end, brier_times),
        sksurv_predictions("random_survival_forest", forest, valid, features, end, brier_times),
    ]
    return {"train_rows": len(train), "validation_rows": len(valid), "tuned_params": best, "tuning": tried,
            "models": [assess(p, evaluation, boot) for p in predictions]}


# ---------------------------------------------------------------- the hotels

def hotels(x4: dict[str, Any], boot: dict[str, Any], *, all_leads: bool) -> dict[str, Any]:
    hotel, config = load_hotel_config(), load_survival_config()
    with fetch(hotel).open(newline="", encoding="utf-8") as file:
        frame = hotel_rows(csv.DictReader(file), hotel, all_leads=all_leads)
    train = frame[frame["year"].isin(config["train_years"])].reset_index(drop=True)
    valid = frame[frame["year"].isin(config["validation_years"])].reset_index(drop=True)
    features, time, h = list(config["features"]), "duration_days", x4["hotels"]
    brier_times = h["brier_times_all"] if all_leads else config["brier_times_days"]
    brier_times = [t for t in brier_times if t < min(train[time].max(), valid[time].max())]
    end = valid["lead_days"].to_numpy(dtype=float) + 1.0
    evaluation = Evaluation(
        train[time].to_numpy(), train["cancelled"].to_numpy(), valid[time].to_numpy(), valid["cancelled"].to_numpy(),
        np.ones(len(valid), dtype=bool), (~valid["cancelled"]).to_numpy(dtype=float), valid["arrival_week"].to_numpy(),
        h["auc_times_all"] if all_leads else h["auc_times_horizon"],
        h["uno_tau_all"] if all_leads else h["uno_tau_horizon"], brier_times)

    predictions = [km_predictions(train, time, len(valid), end, brier_times)]
    for name, columns in (("cox_ph", features), ("cox_timing_only", list(config["timing_only"]))):
        cox = CoxPHFitter(penalizer=config["cox"]["penalizer"])
        with warnings.catch_warnings():
            warnings.simplefilter("error", ConvergenceWarning)  # an unconverged fit is an error, never a result
            cox.fit(train[[*columns, time, "cancelled"]], duration_col=time, event_col="cancelled",
                    fit_options={"max_steps": config["cox"]["max_steps"], "step_size": config["cox"]["step_size"]})
        predictions.append(lifelines_cox_predictions(name, cox, valid, columns, end, brier_times))
    boosting = config["gradient_boosting"]
    sample = _sample(train, boosting["max_train_rows"], boosting["params"]["random_state"])
    boosted = GradientBoostingSurvivalAnalysis(**boosting["params"]).fit(
        sample[features].to_numpy(), Surv.from_arrays(sample["cancelled"].to_numpy(), sample[time].to_numpy()))
    weeks = np.unique(train["arrival_week"])
    held = set(np.random.default_rng(x4["gradient_boosting_tuned"]["fixed"]["random_state"]).choice(
        weeks, size=max(1, round(h["tuning_share"] * len(weeks))), replace=False))
    in_hold = train["arrival_week"].isin(held)
    tuned, best, tried = tune_boosting(train[~in_hold], train[in_hold], train, features, time,
                                       x4["gradient_boosting_tuned"])
    progress(f"hotels ({'all leads' if all_leads else 'within 7 days'}): boosting tuned, {best}")
    forest = fit_forest(train, features, time, x4["random_survival_forest"])
    progress("hotels: forest fitted")
    predictions += [sksurv_predictions("gradient_boosting", boosted, valid, features, end, brier_times),
                    sksurv_predictions("gradient_boosting_tuned", tuned, valid, features, end, brier_times),
                    sksurv_predictions("random_survival_forest", forest, valid, features, end, brier_times)]
    return {"train_rows": len(train), "validation_rows": len(valid), "tuned_params": best, "tuning": tried,
            "models": [assess(p, evaluation, boot) for p in predictions]}


# ---------------------------------------------------------------- H4.2: acting on the scores

def calibration_in_the_large(scored: list[dict[str, Any]]) -> dict[int, dict[str, float]]:
    """Per seed: scored booking-rounds, mean logged score, mean outcome (still booked at departure)."""
    pairs: dict[int, list[tuple[float, float]]] = {}
    for row in scored:
        if row["driver_cancelled"]:
            continue
        pairs.setdefault(row["seed"], []).extend((s, float(row["started"])) for s in row["scores"])
    return {seed: {"pairs": len(p), "mean_score": statistics.fmean(s for s, _ in p),
                   "observed": statistics.fmean(o for _, o in p)} for seed, p in pairs.items()}


def calibration_bins(scored: list[dict[str, Any]], bins: int) -> list[dict[str, float]]:
    pairs = sorted((s, float(r["started"])) for r in scored if not r["driver_cancelled"] for s in r["scores"])
    return [{"pairs": len(part), "mean_score": statistics.fmean(s for s, _ in part),
             "observed": statistics.fmean(o for _, o in part)}
            for part in (pairs[k * len(pairs) // bins:(k + 1) * len(pairs) // bins] for k in range(bins)) if part]


def compare_calibration(acting: dict[int, dict[str, float]], not_acting: dict[int, dict[str, float]]) -> dict[str, Any]:
    seeds_ = sorted(set(acting) & set(not_acting))
    gap = lambda c: c["observed"] - c["mean_score"]  # noqa: E731
    diffs = [gap(acting[s]) - gap(not_acting[s]) for s in seeds_]
    return {"seeds": len(seeds_), "acting_gap": statistics.fmean(gap(acting[s]) for s in seeds_),
            "not_acting_gap": statistics.fmean(gap(not_acting[s]) for s in seeds_),
            "difference": statistics.fmean(diffs), "p_value": float(stats.ttest_1samp(diffs, 0.0).pvalue)}


def calibration(x4: dict[str, Any]) -> dict[str, Any]:
    url = os.environ.get("VAYORA_DB_URL")
    if not url:
        raise SystemExit("VAYORA_DB_URL is not set")
    c = x4["calibration"]
    sweep = yaml.safe_load((CONFIGS / c["not_acting"]["config"]).read_text(encoding="utf-8"))
    variant = yaml.safe_load((CONFIGS / sweep["variant"]).read_text(encoding="utf-8"))["name"]
    null_label = cell_label(variant, {k: v[0] for k, v in sweep["parameters"].items()})
    engine = create_engine(make_url(url).set(drivername="postgresql+psycopg"))
    with engine.connect() as conn:
        acting = run_query(conn, "scored_outcomes", run_id=uuid.UUID(c["acting"]["run"]), variant=c["acting"]["variant"])
        quiet = run_query(conn, "scored_outcomes", run_id=uuid.UUID(c["not_acting"]["run"]), variant=null_label)
    return {"not_acting_variant": null_label,
            "comparison": compare_calibration(calibration_in_the_large(acting), calibration_in_the_large(quiet)),
            "bins_acting": calibration_bins(acting, c["bins"]), "bins_not_acting": calibration_bins(quiet, c["bins"])}


# ---------------------------------------------------------------- verdicts and report

def judge(report: dict[str, Any], x4: dict[str, Any]) -> dict[str, Any]:
    horizon = {m["model"]: m["harrell"] for m in report["hotels_horizon"]["models"]}
    every = {m["model"]: m["harrell"] for m in report["hotels_all_leads"]["models"]}
    ranking = [name for name in horizon if name != "kaplan_meier"]
    sim = {m["model"]: m["harrell"] for m in report["simulator"]["models"]}
    best_gain = max(c - sim["cox_ph"] for name, c in sim.items() if name != "cox_ph")
    comparison = report["calibration"]["comparison"]
    return {
        "H4.1": {"rule": "each hotel model that ranks bookings has a higher Harrell concordance at all lead times "
                         "than within 7 days",
                 "by_model": {n: {"within_7_days": horizon[n], "all_leads": every[n]} for n in ranking},
                 "holds": all(every[n] > horizon[n] for n in ranking)},
        "H4.2": {"rule": f"calibration-in-the-large differs, acting against not acting (paired t, p < {x4['h4_2_alpha']})",
                 "p_value": comparison["p_value"], "holds": comparison["p_value"] < x4["h4_2_alpha"]},
        "H4.3": {"rule": f"no simulator model beats Cox's Harrell concordance by more than {x4['h4_3_margin']}",
                 "largest_gain_over_cox": best_gain, "holds": best_gain <= x4["h4_3_margin"]},
    }


def to_markdown(report: dict[str, Any]) -> str:
    lines = ["# Experiment X4: the durability models, with intervals", "",
             "Settings and readings: `experiments/configs/x4.yaml`. Hypotheses: docs/EXPERIMENT_PROTOCOL.md "
             "section 26, fixed before X4 was computed.", "",
             "| Hypothesis | Rule | Holds |", "|---|---|---|"]
    lines += [f"| {k} | {v['rule']} | {'yes' if v['holds'] else 'NO'} |" for k, v in report["hypotheses"].items()]
    for key, title in (("simulator", "Simulator, validation seeds 2001–2010 (synthetic)"),
                       ("hotels_horizon", "Hotels, bookings made at most 7 days ahead, 2017 (real)"),
                       ("hotels_all_leads", "Hotels, every lead time, 2017 (real)")):
        part = report[key]
        lines += ["", f"## {title}", "",
                  f"{part['train_rows']} training rows, {part['validation_rows']} evaluated. Tuned boosting: "
                  f"{part['tuned_params']}.", "",
                  "| Model | Harrell C (95% interval) | Uno C | Mean AUC | IBS | Brier at the end (95% interval) |",
                  "|---|---|---|---|---|---|"]
        for m in part["models"]:
            lo, hi = m["harrell_interval"]
            blo, bhi = m["end_brier_interval"]
            lines.append(f"| {m['model']} | {m['harrell']:.3f} ({lo:.3f} to {hi:.3f}) | {m['uno']:.3f} | "
                         f"{m['mean_auc']:.3f} | {m['integrated_brier_score']:.4f} | {m['end_brier']:.4f} "
                         f"({blo:.4f} to {bhi:.4f}) |")
    c = report["calibration"]
    cmp_ = c["comparison"]
    lines += ["", "## H4.2: calibration of the logged scores", "",
              f"Observed share still booked at departure minus the mean logged score, per seed: acting "
              f"(B4) {cmp_['acting_gap']:+.4f}, not acting ({c['not_acting_variant']}) {cmp_['not_acting_gap']:+.4f}; "
              f"difference {cmp_['difference']:+.4f}, paired t over {cmp_['seeds']} seeds p = {cmp_['p_value']:.2g}.",
              "", "| Tenth | Mean score, acting | Observed, acting | Mean score, not acting | Observed, not acting |",
              "|---|---|---|---|---|"]
    for k, (a, n) in enumerate(zip(c["bins_acting"], c["bins_not_acting"], strict=False), start=1):
        lines.append(f"| {k} | {a['mean_score']:.3f} | {a['observed']:.3f} | {n['mean_score']:.3f} | {n['observed']:.3f} |")
    return "\n".join(lines)


def main() -> None:
    x4 = yaml.safe_load(CONFIG.read_text(encoding="utf-8"))
    boot = x4["bootstrap"]
    report: dict[str, Any] = {"config": x4}
    report["calibration"] = calibration(x4)
    print("calibration done", flush=True)
    report["simulator"] = simulator(x4, boot)
    print("simulator done", flush=True)
    report["hotels_horizon"] = hotels(x4, boot, all_leads=False)
    print("hotels within 7 days done", flush=True)
    report["hotels_all_leads"] = hotels(x4, boot, all_leads=True)
    report["hypotheses"] = judge(report, x4)
    stem = REPORTS / "x4-models"
    stem.with_suffix(".json").write_text(json.dumps(report, indent=2, default=str) + "\n", encoding="utf-8")
    stem.with_suffix(".md").write_text(to_markdown(report) + "\n", encoding="utf-8")
    print(to_markdown(report))


if __name__ == "__main__":
    main()
