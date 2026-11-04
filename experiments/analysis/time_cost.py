"""Judges experiment X2, a cost of leaving away from the wanted time, against its hypotheses.

    python -m experiments.analysis.time_cost

Reads the two sweeps named in experiments/configs/x2.yaml through metrics.sql
(EXPERIMENT_PROTOCOL.md sections 26 and 28) and writes experiments/reports/x2-time-cost.json and
.md:

- H2.0  at cost 0, B0, EARLIEST and B3 wrote exactly the events of the earlier world-h3 run;
- H2.1  EARLIEST - B0 falls as the cost rises and crosses zero inside the configured range;
- H2.2  B3 - EARLIEST is equivalent to zero, within analysis.yaml's margin, at every cost;
- H2.3  how much earlier EARLIEST's passengers leave than B0's, times the end-of-exposure
        hazard, is less than EARLIEST's observed relative gain at cost 0.

Every cell is paired by seed. Each verdict is the reading of section 26 that x2.yaml wrote down
before the runs; the intervals beside it say how firm it is.
"""

from __future__ import annotations

import json
import os
import statistics
import uuid
from pathlib import Path
from typing import Any

import yaml
from sqlalchemy import Connection, create_engine, make_url

from experiments.analysis.compare import REPORTS, differences, equivalence, load_analysis, per_seed
from experiments.analysis.proximity import relative_gain, summary
from experiments.analysis.queries import run_query
from experiments.sweep import cell_label

CONFIGS = Path(__file__).resolve().parents[1] / "configs"
CONFIG = CONFIGS / "x2.yaml"


def load_x2(path: Path = CONFIG) -> dict[str, Any]:
    config = yaml.safe_load(path.read_text(encoding="utf-8"))
    sweeps = [yaml.safe_load((CONFIGS / config[key]["config"]).read_text(encoding="utf-8"))
              for key in ("earliest_sweep", "b3_sweep")]
    grids = [s["parameters"] for s in sweeps]
    if grids[0] != grids[1] or len(grids[0]) != 1:
        raise ValueError("both X2 sweeps must vary the same single parameter over the same grid")
    ((parameter, costs),) = grids[0].items()
    low, high = config["crossing_between"]
    if costs != sorted(costs) or costs[0] != 0 or not low < high or {low, high} - set(costs):
        raise ValueError("the grid must rise from 0, and the crossing range must be two of its costs")
    return config | {"parameter": parameter, "costs": costs}


def label(variant: str, config: dict[str, Any], cost: float) -> str:
    return cell_label(variant, {config["parameter"]: cost})


def same_events(conn: Connection, new: tuple[str, str], old: tuple[str, str]) -> dict[str, int]:
    """Seeds of a cell whose events are identical, digest for digest, to an earlier run's."""
    digests = [{r["seed"]: (r["events"], r["digest"])
                for r in run_query(conn, "event_digest", run_id=uuid.UUID(run), variant=variant)}
               for run, variant in (new, old)]
    return {"seeds": len(digests[0]), "earlier_seeds": len(digests[1]),
            "identical": sum(1 for s, d in digests[0].items() if digests[1].get(s) == d)}


def crossing(costs: list[float], means: list[float]) -> float | None:
    """The cost, interpolated linearly on the grid, at which the mean first drops to zero or below."""
    for i in range(len(costs) - 1):
        m0, m1 = means[i], means[i + 1]
        if m0 > 0 >= m1:
            return costs[i] + (costs[i + 1] - costs[i]) * m0 / (m0 - m1)
    return None


def judge(data: dict[float, dict[str, dict[str, dict[int, float]]]], gaps: dict[str, dict[int, float]],
          config: dict[str, Any], analysis: dict[str, Any], reproduced: dict[str, Any]) -> dict[str, Any]:
    """data[cost][name][measure] = {seed: value}, with names B0, EARLIEST (the first sweep's),
    EARLIEST_B (the second sweep's baseline) and B3; gaps[variant] = {seed: mean gap in hours}."""
    costs = config["costs"]
    zero, top = costs[0], costs[-1]
    low, high = config["crossing_between"]

    def contrast(cost: float, base: str, other: str) -> list[float]:
        return differences(data[cost][base]["per_100"], data[cost][other]["per_100"])

    earliest = {cost: contrast(cost, "B0", "EARLIEST") for cost in costs}
    means = [statistics.fmean(earliest[c]) for c in costs]
    change = summary([a - b for a, b in zip(earliest[top], earliest[zero], strict=True)], analysis)
    falls = bool(change["ci_high"] < 0)
    crosses = bool(means[costs.index(low)] > 0 > means[costs.index(high)])
    b3 = {cost: equivalence(contrast(cost, "EARLIEST_B", "B3"),
                            analysis["equivalence_margin"], analysis["equivalence_alpha"]) for cost in costs}
    shift = differences(gaps["EARLIEST"], gaps["B0"])  # B0's gap minus EARLIEST's: hours earlier
    shift_summary = summary(shift, analysis)
    hazard = config["exposure_hazard_per_hour"]
    predicted = shift_summary["mean_difference"] * hazard
    observed = relative_gain(data[zero]["B0"]["per_100"], data[zero]["EARLIEST"]["per_100"])
    return {
        "H2.0": {"rule": "at cost 0, B0, EARLIEST and B3 write the earlier run's events, seed by seed",
                 "cells": reproduced,
                 "holds": all(v["identical"] == v["seeds"] == v["earlier_seeds"] for v in reproduced.values())},
        "H2.1": {"rule": f"EARLIEST - B0 falls from cost {zero} to {top} (whole interval of the change below "
                         f"zero) and is above zero at {low} and below zero at {high}",
                 "earliest_minus_b0": {c: summary(earliest[c], analysis) for c in costs},
                 "change": change, "falls": falls, "crosses": crosses,
                 "crossing_cost": crossing(costs, means), "holds": falls and crosses},
        "H2.2": {"rule": "B3 - EARLIEST equivalent to zero at every cost",
                 "b3_minus_earliest": {c: summary(contrast(c, "EARLIEST_B", "B3"), analysis) for c in costs},
                 "by_cost": b3, "holds": all(e["equivalent"] for e in b3.values())},
        "H2.3": {"rule": f"(B0's mean gap - EARLIEST's) x {hazard} per hour is below EARLIEST's relative "
                         f"gain over B0 at cost {zero}",
                 "shift_hours": shift_summary,
                 "predicted_relative_gain": predicted,
                 "predicted_interval": [shift_summary["ci_low"] * hazard, shift_summary["ci_high"] * hazard],
                 "observed_relative_gain": observed,
                 "share_explained": predicted / observed,
                 "holds": predicted < observed},
    }


def to_markdown(report: dict[str, Any]) -> str:
    h = report["hypotheses"]
    costs = report["config"]["costs"]
    lines = [
        "# Experiment X2: a cost of leaving away from the wanted time",
        "",
        "Synthetic data (simulator), 30 paired seeds. Sweeps and readings: `experiments/configs/x2.yaml`.",
        "Hypotheses: docs/EXPERIMENT_PROTOCOL.md section 26, fixed before these runs.",
        "",
        "| Hypothesis | Rule | Holds |",
        "|---|---|---|",
    ]
    lines += [f"| {name} | {h[name]['rule']} | {'yes' if h[name]['holds'] else 'NO'} |" for name in h]
    lines += ["", "## H2.0: cost 0 repeats the earlier run", "",
              "| Cell | Seeds identical |", "|---|---|"]
    lines += [f"| {cell} | {v['identical']} / {v['seeds']} |" for cell, v in h["H2.0"]["cells"].items()]
    lines += ["", "## H2.1 and H2.2: completed rides per 100 searches, seed by seed", "",
              "| Cost per hour | EARLIEST − B0 (95% CI) | B3 − EARLIEST (95% CI) | B3 − EARLIEST equivalence p |",
              "|---|---|---|---|"]
    for c in costs:
        e, b = h["H2.1"]["earliest_minus_b0"][c], h["H2.2"]["b3_minus_earliest"][c]
        lines.append(f"| {c} | {e['mean_difference']:+.3f} ({e['ci_low']:+.3f} to {e['ci_high']:+.3f}) "
                     f"| {b['mean_difference']:+.3f} ({b['ci_low']:+.3f} to {b['ci_high']:+.3f}) "
                     f"| {h['H2.2']['by_cost'][c]['tost_p']:.4f} |")
    ch = h["H2.1"]["change"]
    cross = h["H2.1"]["crossing_cost"]
    lines += ["", f"Change in EARLIEST − B0 from the smallest to the largest cost: {ch['mean_difference']:+.3f} "
                  f"({ch['ci_low']:+.3f} to {ch['ci_high']:+.3f}). Falls: {'yes' if h['H2.1']['falls'] else 'no'}. "
                  f"Crosses inside the range: {'yes' if h['H2.1']['crosses'] else 'no'}. "
                  + (f"Interpolated crossing: {cross:.4f} per hour." if cross is not None
                     else "The mean never drops to zero on the grid.")]
    s = h["H2.3"]
    sh = s["shift_hours"]
    lines += ["", "## H2.3: how much of the gain shorter exposure explains", "",
              f"EARLIEST's passengers asked for rides leaving {sh['mean_difference']:.3f} hours earlier than B0's "
              f"({sh['ci_low']:.3f} to {sh['ci_high']:.3f}), relative to the time each wanted. At "
              f"{report['config']['exposure_hazard_per_hour']} per hour that predicts a relative gain of "
              f"{s['predicted_relative_gain']:.4%} ({s['predicted_interval'][0]:.4%} to "
              f"{s['predicted_interval'][1]:.4%}); the observed gain was {s['observed_relative_gain']:.4%}, "
              f"so exposure accounts for about {s['share_explained']:.0%} of it."]
    lines += ["", "## Means per cell", "",
              "| Cost per hour | B0 | EARLIEST | B3 | Booking requests per search, B0 | EARLIEST |",
              "|---|---|---|---|---|---|"]
    for c in costs:
        m = report["means"][c]
        lines.append(f"| {c} | {m['B0']['per_100']:.2f} | {m['EARLIEST']['per_100']:.2f} | {m['B3']['per_100']:.2f} "
                     f"| {m['B0']['booking_rate']:.3f} | {m['EARLIEST']['booking_rate']:.3f} |")
    return "\n".join(lines)


def main() -> None:
    config, analysis = load_x2(), load_analysis()
    url = os.environ.get("VAYORA_DB_URL")
    if not url:
        raise SystemExit("VAYORA_DB_URL is not set")
    first, second = (uuid.UUID(config[k]["run"]) for k in ("earliest_sweep", "b3_sweep"))
    names = {"B0": (first, "B0"), "EARLIEST": (first, "EARLIEST"),
             "EARLIEST_B": (second, "EARLIEST"), "B3": (second, "B3")}
    engine = create_engine(make_url(url).set(drivername="postgresql+psycopg"))
    with engine.connect() as conn:
        data = {c: {name: per_seed(conn, run, label(v, config, c)) for name, (run, v) in names.items()}
                for c in config["costs"]}
        zero = config["costs"][0]
        gaps = {v: {r["seed"]: float(r["mean_gap_hours"]) for r in run_query(
                    conn, "booked_departure_gap", run_id=first, variant=label(v, config, zero))}
                for v in ("B0", "EARLIEST")}
        reproduced = {f"{name}: {label(v, config, zero)}": same_events(
                          conn, (str(run), label(v, config, zero)), (config["reproduces"], v))
                      for name, (run, v) in names.items()}
    report = {"config": config, "analysis": analysis,
              "hypotheses": judge(data, gaps, config, analysis, reproduced),
              "means": {c: {name: {m: statistics.fmean(data[c][name][m].values())
                                   for m in ("per_100", "booking_rate", "seats_per_100")}
                            for name in names} for c in config["costs"]}}
    stem = REPORTS / "x2-time-cost"
    stem.with_suffix(".json").write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    stem.with_suffix(".md").write_text(to_markdown(report) + "\n", encoding="utf-8")
    print(to_markdown(report))


if __name__ == "__main__":
    main()
