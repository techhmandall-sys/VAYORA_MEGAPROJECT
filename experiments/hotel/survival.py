"""The platform's survival models, fitted on real cancellations: the public hotel bookings.

    python -m experiments.hotel.survival

Kaplan-Meier, Cox and gradient-boosted survival, as experiments/hazard/train.py fits on
the simulator, here on bookings made within the horizon at two hotels in Portugal. Trained
on some years of arrival and checked on others (experiments/configs/hotel_survival.yaml).
A Cox model that knows only how far ahead the booking was made stands beside the full one.

Time is counted in days from the day the booking was made. The file has dates only, so a
cancellation on day k is placed at k + 0.5, and a booking still standing at arrival on day
L is censored at L + 1, having outlasted every cancellation that day. Nothing here is
VAYORA data, and nothing here is served: the platform's model is still the simulator's.
Writes experiments/reports/hotel-survival.json.
"""

from __future__ import annotations

import csv
import json
from pathlib import Path
from typing import Any, Iterable

import numpy as np
import pandas as pd
import warnings

import yaml
from lifelines import CoxPHFitter, KaplanMeierFitter
from lifelines.exceptions import ConvergenceWarning
from sksurv.ensemble import GradientBoostingSurvivalAnalysis
from sksurv.metrics import concordance_index_censored, integrated_brier_score
from sksurv.util import Surv

from experiments.hotel.load import MONTHS, HotelConfig, fetch, load_config

ROOT = Path(__file__).resolve().parents[2]
CONFIG = ROOT / "experiments" / "configs" / "hotel_survival.yaml"
REPORT = ROOT / "experiments" / "reports" / "hotel-survival.json"

# Columns that change after a booking is made: never a feature.
AFTER_BOOKING = {"booking_changes", "total_of_special_requests", "required_car_parking_spaces",
                 "assigned_room_type", "days_in_waiting_list", "reservation_status",
                 "reservation_status_date", "is_canceled"}


def load_survival_config(path: Path = CONFIG) -> dict[str, Any]:
    config = yaml.safe_load(path.read_text(encoding="utf-8"))
    if set(config["train_years"]) & set(config["validation_years"]):
        raise ValueError("training and validation years must be disjoint")
    if not set(config["timing_only"]) <= set(config["features"]):
        raise ValueError("the timing-only model's features must be among the features")
    return config


def rows(records: Iterable[dict[str, str]], hotel: HotelConfig, *, all_leads: bool = False) -> pd.DataFrame:
    """One row per booking made within the horizon (or at any lead time): its features, time and outcome.

    arrival_week (ISO year and week of arrival) is a cluster for resampling, never a feature.
    """
    out = []
    for record in records:
        lead = int(record["lead_time"])
        if lead > hotel.horizon_days and not all_leads:
            continue
        cancelled = record["reservation_status"] == "Canceled"
        arrival = pd.Timestamp(int(record["arrival_date_year"]), MONTHS[record["arrival_date_month"]],
                               int(record["arrival_date_day_of_month"]))
        iso = arrival.isocalendar()
        if cancelled:
            made = arrival - pd.Timedelta(days=lead)
            duration = (pd.Timestamp(record["reservation_status_date"]) - made).days + 0.5
        else:
            duration = lead + 1.0
        out.append({
            "year": int(record["arrival_date_year"]),
            "arrival_week": int(iso[0]) * 100 + int(iso[1]),
            "duration_days": duration,
            "cancelled": cancelled,
            "lead_days": lead,
            "city_hotel": int(record["hotel"] == "City Hotel"),
            "adults": int(record["adults"]),
            "children": _count(record["children"]) + _count(record["babies"]),
            "weekend_nights": int(record["stays_in_weekend_nights"]),
            "week_nights": int(record["stays_in_week_nights"]),
            "repeated_guest": int(record["is_repeated_guest"]),
            "previous_cancellations": int(record["previous_cancellations"]),
            "previous_stays": int(record["previous_bookings_not_canceled"]),
            "non_refundable": int(record["deposit_type"] == "Non Refund"),
            "refundable": int(record["deposit_type"] == "Refundable"),
            "transient": int(record["customer_type"] == "Transient"),
            "online_agent": int(record["market_segment"] == "Online TA"),
            "price_per_night": float(record["adr"]),
        })
    return pd.DataFrame(out)


def _count(value: str) -> int:
    return 0 if value in ("", "NA") else int(float(value))


def _surv(frame: pd.DataFrame):
    return Surv.from_arrays(frame["cancelled"].to_numpy(), frame["duration_days"].to_numpy())


def evaluate(name: str, train: pd.DataFrame, valid: pd.DataFrame, config: dict[str, Any],
             risk: np.ndarray, survival_at) -> dict[str, Any]:
    """`risk` orders bookings by danger; `survival_at(i, days)` is S(days | booking i)."""
    concordance = concordance_index_censored(valid["cancelled"].to_numpy(), valid["duration_days"].to_numpy(),
                                             risk)[0]
    longest = min(train["duration_days"].max(), valid["duration_days"].max())
    times = [t for t in config["brier_times_days"] if t < longest]
    curves = np.array([[survival_at(i, t) for t in times] for i in range(len(valid))])
    brier = integrated_brier_score(_surv(train), _surv(valid), curves, times)
    # Every booking's outcome at arrival is known: cancelled, or still booked.
    predicted = np.array([survival_at(i, valid.at[i, "lead_days"] + 1.0) for i in range(len(valid))])
    survived = (~valid["cancelled"]).to_numpy(dtype=float)
    order = np.argsort(predicted, kind="stable")
    return {
        "model": name,
        "concordance": float(concordance),
        "integrated_brier_score": float(brier),
        "brier_times_days": times,
        "arrival": {
            "observed_still_booked": float(survived.mean()),
            "mean_predicted": float(predicted.mean()),
            "brier_score": float(np.mean((predicted - survived) ** 2)),
            "calibration": [{"bookings": int(len(part)), "mean_predicted": float(predicted[part].mean()),
                             "observed": float(survived[part].mean())}
                            for part in np.array_split(order, config["calibration_bins"]) if len(part)],
        },
    }


def fit_and_evaluate(train: pd.DataFrame, valid: pd.DataFrame, config: dict[str, Any]) -> list[dict[str, Any]]:
    features = list(config["features"])
    km = KaplanMeierFitter().fit(train["duration_days"], train["cancelled"])
    results = [evaluate("kaplan_meier", train, valid, config, np.zeros(len(valid)),
                        lambda i, t: float(km.predict(t)))]
    for name, columns in (("cox_ph", features), ("cox_timing_only", list(config["timing_only"]))):
        cox = CoxPHFitter(penalizer=config["cox"]["penalizer"])
        with warnings.catch_warnings():
            # A fit that has not converged is an error, never a result.
            warnings.simplefilter("error", ConvergenceWarning)
            cox.fit(train[[*columns, "duration_days", "cancelled"]], duration_col="duration_days", event_col="cancelled",
                    fit_options={"max_steps": config["cox"]["max_steps"], "step_size": config["cox"]["step_size"]})
        risk = cox.predict_partial_hazard(valid[columns]).to_numpy()
        curves = cox.predict_survival_function(valid[columns], times=sorted({*config["brier_times_days"],
                                                                             *(valid["lead_days"] + 1.0)}))
        results.append(evaluate(name, train, valid, config, risk,
                                lambda i, t, c=curves: float(c.iloc[:, i].loc[t])))
    boosting = config["gradient_boosting"]
    sample = train.sample(boosting["max_train_rows"], random_state=boosting["params"]["random_state"]) \
        if len(train) > boosting["max_train_rows"] else train
    boosted = GradientBoostingSurvivalAnalysis(**boosting["params"]).fit(sample[features].to_numpy(), _surv(sample))
    boosted_curves = boosted.predict_survival_function(valid[features].to_numpy())
    results.append(evaluate("gradient_boosting", train, valid, config, boosted.predict(valid[features].to_numpy()),
                            lambda i, t: float(boosted_curves[i](min(t, boosted_curves[i].domain[1])))))
    return results


def main() -> None:
    hotel = load_config()
    config = load_survival_config()
    leaky = AFTER_BOOKING & set(config["features"])
    if leaky:
        raise ValueError(f"features known only after booking: {sorted(leaky)}")
    with fetch(hotel).open(newline="", encoding="utf-8") as file:
        frame = rows(csv.DictReader(file), hotel)
    train = frame[frame["year"].isin(config["train_years"])].reset_index(drop=True)
    valid = frame[frame["year"].isin(config["validation_years"])].reset_index(drop=True)

    report = {
        "data": "real: Antonio, de Almeida and Nunes (2019), Hotel booking demand datasets, CC BY 4.0; "
                f"bookings made at most {hotel.horizon_days} days before arrival",
        "config": config,
        "train": {"years": config["train_years"], "bookings": int(len(train)), "cancelled": int(train["cancelled"].sum())},
        "validation": {"years": config["validation_years"], "bookings": int(len(valid)),
                       "cancelled": int(valid["cancelled"].sum())},
        "models": fit_and_evaluate(train, valid, config),
    }
    REPORT.parent.mkdir(exist_ok=True)
    REPORT.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(f"wrote {REPORT.relative_to(ROOT)}")
    for model in report["models"]:
        print(f"{model['model']:>18}  C={model['concordance']:.3f}  IBS={model['integrated_brier_score']:.4f}  "
              f"arrival Brier={model['arrival']['brier_score']:.4f}")


if __name__ == "__main__":
    main()
