"""Trains the booking-durability models on real bookings, once there are enough of them.

    python -m experiments.hazard.train_real

Refuses until experiments/configs/real_data.yaml says there are enough. Earlier outcomes train and
later ones validate: there are no seeds to keep apart here, and it is how a model would meet
bookings it has not seen. A passenger can appear on both sides, as they would in use.

Writes experiments/reports/hazard-<version>.json and, beside it, the models. Nothing is served from
this: intel keeps serving what it was given, and replacing it is the team's decision to make, on
this report, as with every other model.
"""

from __future__ import annotations

import json
import os
import sys
from datetime import datetime, timezone
from typing import Any, Mapping

import numpy as np
import pandas as pd
import psycopg
from sqlalchemy import make_url

from experiments import real_data
from experiments.hazard.train import REPORTS, evaluate, fit_cox, fit_kaplan_meier, load_config
from intel.app.hazard.features import FEATURE_VERSION, FEATURES
from intel.app.hazard.model import HazardModel


def train(rows: list[dict[str, Any]], hazard: Mapping[str, Any], config: Mapping[str, Any]) -> tuple[dict[str, Any], list[HazardModel]]:
    """`rows` in the order their outcomes happened, as survival_rows gives them."""
    if not real_data.model_is_enough(real_data.model_counts(rows), config):
        raise ValueError("not enough real bookings to train on")
    version = config["model"]["version"]
    cut = int(len(rows) * config["model"]["train_share"])
    frame = pd.DataFrame(rows)
    fit, valid = frame.iloc[:cut].reset_index(drop=True), frame.iloc[cut:].reset_index(drop=True)
    features = valid[list(FEATURES)].to_dict("records")

    km = fit_kaplan_meier(fit, version)
    cox, _ = fit_cox(fit, version, hazard["cox"]["penalizer"])
    report = {
        "version": version,
        "feature_version": FEATURE_VERSION,
        "data": "real: the platform's own bookings, without demo and test accounts",
        "train": {"bookings": len(fit), "cancelled": int(fit["cancelled"].sum())},
        "validation": {"bookings": len(valid), "cancelled": int(valid["cancelled"].sum())},
        "models": [
            evaluate("kaplan_meier", fit, valid, hazard, np.zeros(len(valid)), lambda i, t: km.survival(features[i], t)),
            evaluate("cox_ph", fit, valid, hazard, np.array([cox._relative_risk(x) for x in features]),
                     lambda i, t: cox.survival(features[i], t)),
        ],
        "cox_coefficients": dict(zip(FEATURES, cox.coef, strict=True)),
    }
    return report, [km, cox]


def main() -> int:
    url = os.environ.get("VAYORA_DB_URL")
    if not url:
        print("VAYORA_DB_URL is not set", file=sys.stderr)
        return 2
    config = real_data.load_config()
    dsn = make_url(url).set(drivername="postgresql").render_as_string(hide_password=False)
    with psycopg.connect(dsn) as conn:
        events = real_data.read_live_events(conn, config)
    rows = real_data.finished_booking_rows(events, datetime.now(timezone.utc))
    counts = real_data.model_counts(rows)
    if not real_data.model_is_enough(counts, config):
        print(f"Nothing trained: {counts['accepted_bookings']} of {config['model']['min_accepted_bookings']} accepted "
              f"bookings, {counts['passenger_cancellations']} of {config['model']['min_passenger_cancellations']} "
              "cancellations. See experiments/configs/real_data.yaml.", file=sys.stderr)
        return 1
    report, models = train(rows, load_config(), config)
    folder = REPORTS / f"hazard-{report['version']}-models"
    folder.mkdir(parents=True, exist_ok=True)
    for model in models:
        (folder / f"{model.version}.json").write_text(model.to_json() + "\n", encoding="utf-8")
    out = REPORTS / f"hazard-{report['version']}.json"
    out.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {out.name}. Nothing is served from it.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
