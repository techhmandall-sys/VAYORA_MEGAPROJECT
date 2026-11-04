"""Trains and evaluates the booking-durability models.

    python -m experiments.hazard.train [--config experiments/configs/hazard_h4.yaml]

The configuration defaults to experiments/configs/hazard.yaml (model h3); another names its own
version and world, as hazard_h4.yaml does for experiment X1.

Simulates the training and validation seeds, fits three models, scores each on the
validation seeds, and writes:

- intel/app/hazard/models/<version>-km.json and -cox.json   the two servable models
- experiments/reports/hazard-<version>.json                 every number, plus provenance

Nothing is chosen in code. The report is the evidence; the choice is recorded in
docs/AI_ML_METHODOLOGY.md.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd
import yaml
from lifelines import CoxPHFitter, KaplanMeierFitter
from lifelines.statistics import proportional_hazard_test
from sksurv.ensemble import GradientBoostingSurvivalAnalysis
from sksurv.metrics import concordance_index_censored, integrated_brier_score
from sksurv.util import Surv

from experiments.hazard.dataset import survival_rows
from intel.app.hazard.features import FEATURE_VERSION, FEATURES
from intel.app.hazard.model import MODEL_DIR, HazardModel
from sim.config import load_variant, load_world
from sim.frozen import SEEDS_PER_VARIANT
from sim.simulator import MemorySink, Simulation

ROOT = Path(__file__).resolve().parents[2]
CONFIGS = ROOT / "experiments" / "configs"
REPORTS = ROOT / "experiments" / "reports"
EXPERIMENT_SEEDS = set(range(1, SEEDS_PER_VARIANT + 1))


def load_config(path: Path = CONFIGS / "hazard.yaml") -> dict[str, Any]:
    config = yaml.safe_load(path.read_text(encoding="utf-8"))
    train, validation = seeds(config["train_seeds"]), seeds(config["validation_seeds"])
    if set(train) & set(validation) or (set(train) | set(validation)) & EXPERIMENT_SEEDS:
        raise ValueError("training, validation and experiment seeds must be disjoint")
    return config


def seeds(spec: dict[str, int]) -> list[int]:
    return list(range(spec["first"], spec["last"] + 1))


def simulate(config: dict[str, Any], which: list[int]) -> pd.DataFrame:
    world = load_world(CONFIGS / config["world"])
    variant = load_variant(CONFIGS / config["variant"])
    rows: list[dict[str, Any]] = []
    for seed in which:
        sink = MemorySink()
        Simulation(world, variant, seed, sink).run()
        rows += [{**row, "seed": seed} for row in survival_rows(sink.events)]
    return pd.DataFrame(rows)


def fit_kaplan_meier(train: pd.DataFrame, version: str) -> HazardModel:
    km = KaplanMeierFitter().fit(train["duration_hours"], train["cancelled"])
    curve = km.survival_function_.iloc[:, 0]
    curve = curve[curve.index > 0]
    return HazardModel(
        version=f"{version}-km", feature_version=FEATURE_VERSION, kind="kaplan_meier",
        features=FEATURES, coef=(0.0,) * len(FEATURES), mean=(0.0,) * len(FEATURES),
        **_steps(curve.index, -np.log(curve.to_numpy())))


def fit_cox(train: pd.DataFrame, version: str, penalizer: float) -> tuple[HazardModel, CoxPHFitter]:
    # A feature that never varies says nothing and stops the fit converging: on real bookings
    # desired_gap_hours is always 0. It keeps a coefficient of 0, so the model reads as any other.
    varying = [name for name in FEATURES if train[name].nunique() > 1]
    cox = CoxPHFitter(penalizer=penalizer)
    cox.fit(train[[*varying, "duration_hours", "cancelled"]],
            duration_col="duration_hours", event_col="cancelled")
    baseline = cox.baseline_cumulative_hazard_.iloc[:, 0]
    model = HazardModel(
        version=f"{version}-cox", feature_version=FEATURE_VERSION, kind="cox_ph",
        features=FEATURES,
        coef=tuple(float(cox.params_[name]) if name in varying else 0.0 for name in FEATURES),
        mean=tuple(float(cox._norm_mean[name]) if name in varying else float(train[name].iloc[0]) for name in FEATURES),
        **_steps(baseline.index, baseline.to_numpy()))
    return model, cox


def _steps(times, cumulative_hazard) -> dict[str, tuple[float, ...]]:
    """Keeps only the times at which the cumulative hazard actually rises."""
    kept_times: list[float] = []
    kept_hazard: list[float] = []
    for time, hazard in zip(times, cumulative_hazard, strict=True):
        if not kept_hazard or hazard > kept_hazard[-1]:
            kept_times.append(float(time))
            kept_hazard.append(float(hazard))
    return {"times": tuple(kept_times), "cumulative_hazard": tuple(kept_hazard)}


def fit_gradient_boosting(train: pd.DataFrame, config: dict[str, Any]):
    params = config["params"]
    if len(train) > config["max_train_rows"]:
        train = train.sample(config["max_train_rows"], random_state=params["random_state"])
    model = GradientBoostingSurvivalAnalysis(**params)
    model.fit(train[list(FEATURES)].to_numpy(), _surv(train))
    return model


def evaluate(name: str, train: pd.DataFrame, valid: pd.DataFrame, config: dict[str, Any],
             risk: np.ndarray, survival_at) -> dict[str, Any]:
    """`risk` orders bookings by danger; `survival_at(row_index, hours)` is S(hours | x)."""
    concordance = concordance_index_censored(
        valid["cancelled"].to_numpy(), valid["duration_hours"].to_numpy(), risk)[0]

    longest = min(train["duration_hours"].max(), valid["duration_hours"].max())
    times = [t for t in config["brier_times_hours"] if t < longest]
    curves = np.array([[survival_at(i, t) for t in times] for i in range(len(valid))])
    brier = integrated_brier_score(_surv(train), _surv(valid), curves, times)

    # Driver-withdrawn bookings are censored before departure: their outcome is unknown.
    known = valid.index[valid["cancelled"] | valid["reached_departure"]]
    predicted = np.array([survival_at(i, valid.at[i, "horizon_hours"]) for i in known])
    survived = valid.loc[known, "reached_departure"].to_numpy(dtype=float)

    return {
        "model": name,
        "concordance": float(concordance),
        "integrated_brier_score": float(brier),
        "brier_times_hours": times,
        "departure": {
            "bookings": int(len(known)),
            "observed_survival": float(survived.mean()),
            "mean_predicted_survival": float(predicted.mean()),
            "brier_score": float(np.mean((predicted - survived) ** 2)),
            "calibration": _calibration(predicted, survived, config["calibration_bins"]),
        },
    }


def last_mile_ablation(train: pd.DataFrame, valid: pd.DataFrame, penalizer: float) -> dict[str, float]:
    """Cox concordance on the validation seeds, with the two last-mile features and
    without them (the model as it stood before this ablation). This, not the single
    served model's number, is what licenses any claim that pickup accessibility
    contributed: a model trained without the features is a different fit, not the
    served one with their coefficients zeroed.
    """
    without = tuple(f for f in FEATURES if not f.startswith("last_mile_"))
    concordance = {}
    for label, feats in (("with_last_mile", FEATURES), ("without_last_mile", without)):
        cox = CoxPHFitter(penalizer=penalizer)
        cox.fit(train[[*feats, "duration_hours", "cancelled"]],
                duration_col="duration_hours", event_col="cancelled")
        risk = cox.predict_partial_hazard(valid[list(feats)]).to_numpy()
        concordance[label] = float(concordance_index_censored(
            valid["cancelled"].to_numpy(), valid["duration_hours"].to_numpy(), risk)[0])
    return concordance


def _calibration(predicted: np.ndarray, observed: np.ndarray, bins: int) -> list[dict[str, Any]]:
    order = np.argsort(predicted, kind="stable")
    return [
        {"bookings": int(len(part)),
         "mean_predicted": float(predicted[part].mean()),
         "observed": float(observed[part].mean())}
        for part in np.array_split(order, bins) if len(part)
    ]


def _surv(frame: pd.DataFrame):
    return Surv.from_arrays(frame["cancelled"].to_numpy(), frame["duration_hours"].to_numpy())


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--config", type=Path, default=CONFIGS / "hazard.yaml")
    config = load_config(parser.parse_args().config)
    version = config["version"]
    train = simulate(config, seeds(config["train_seeds"]))
    valid = simulate(config, seeds(config["validation_seeds"]))
    features = valid[list(FEATURES)].to_dict("records")

    km = fit_kaplan_meier(train, version)
    cox, lifelines_cox = fit_cox(train, version, config["cox"]["penalizer"])
    boosted = fit_gradient_boosting(train, config["gradient_boosting"])
    boosted_curves = boosted.predict_survival_function(valid[list(FEATURES)].to_numpy())

    results = [
        evaluate("kaplan_meier", train, valid, config, np.zeros(len(valid)),
                 lambda i, t: km.survival(features[i], t)),
        evaluate("cox_ph", train, valid, config,
                 np.array([cox._relative_risk(x) for x in features]),
                 lambda i, t: cox.survival(features[i], t)),
        evaluate("gradient_boosting", train, valid, config,
                 boosted.predict(valid[list(FEATURES)].to_numpy()),
                 lambda i, t: float(boosted_curves[i](min(t, boosted_curves[i].domain[1])))),
    ]

    ph_test = proportional_hazard_test(
        lifelines_cox, train[[*FEATURES, "duration_hours", "cancelled"]], time_transform="rank")
    report = {
        "version": version,
        "feature_version": FEATURE_VERSION,
        "data": "synthetic: simulator output under experiments/configs/" + config["world"],
        "config": config,
        "train": _describe(train),
        "validation": _describe(valid),
        "models": results,
        "cox": {
            "coefficients": dict(zip(FEATURES, cox.coef, strict=True)),
            "proportional_hazards_test_p": {
                name: float(ph_test.summary.loc[name, "p"]) for name in FEATURES},
        },
        "last_mile_ablation": last_mile_ablation(train, valid, config["cox"]["penalizer"]),
    }

    MODEL_DIR.mkdir(exist_ok=True)
    for model in (km, cox):
        (MODEL_DIR / f"{model.version}.json").write_text(model.to_json() + "\n", encoding="utf-8")
    REPORTS.mkdir(exist_ok=True)
    out = REPORTS / f"hazard-{version}.json"
    out.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")

    print(f"wrote {out.relative_to(ROOT)}")
    for result in results:
        print(f"{result['model']:>18}  C={result['concordance']:.3f}  "
              f"IBS={result['integrated_brier_score']:.4f}  "
              f"departure Brier={result['departure']['brier_score']:.4f}")
    ablation = report["last_mile_ablation"]
    print(f"last-mile ablation (Cox concordance)  with={ablation['with_last_mile']:.3f}  "
          f"without={ablation['without_last_mile']:.3f}")


def _describe(frame: pd.DataFrame) -> dict[str, Any]:
    return {
        "seeds": sorted(int(s) for s in frame["seed"].unique()),
        "bookings": int(len(frame)),
        "cancelled_by_passenger": int(frame["cancelled"].sum()),
        "censored_at_departure": int(frame["reached_departure"].sum()),
        "censored_by_driver_withdrawal": int(
            (~frame["cancelled"] & ~frame["reached_departure"]).sum()),
    }


if __name__ == "__main__":
    main()
