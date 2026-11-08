"""Judges experiment X3: the reconfirmation ceiling against the observed change in standing seats.

    python -m experiments.analysis.ceiling

For every cell in experiments/configs/x3.yaml, a policy that asks passengers to reconfirm against the
same ranking without requests (EXPERIMENT_PROTOCOL.md sections 26 and 29), it computes from the event
log, per seed and per 100 searches, on rides that departed:

- the terms of the seat identity ΔB = ΔF − ΔU − ΔO (the paper's Proposition 7), with refills counted
  when requested and when the refilling booking stands at departure;
- the first-order ceiling of Proposition 8, eq. (17):
      ρ (r_e − r_l) S(Q∩𝓛) + ρ (1 − r_e) S(Q∩𝓔) − η (1 − r_e) S(Q∩𝓝).
  Each asked booking is put in 𝓛, 𝓔 or 𝓝 by what its twin did in the baseline run. The twin is the
  same search booking the same ride, accepted at the same moment; common random numbers give it the
  same cancellation draw.
  - An asked booking with no twin is one whose world had already diverged. The central ceiling
    shares those bookings among the classes in proportion; the conservative one puts them all in 𝓛.
  - r_e and r_l are the baseline's refill shares for early and late releases.

It writes experiments/reports/x3-ceiling.json and .md and judges H3.1 to H3.3 as x3.yaml reads them.
"""

from __future__ import annotations

import json
import os
import statistics
import uuid
from collections import defaultdict
from dataclasses import asdict, dataclass
from datetime import timedelta
from pathlib import Path
from typing import Any

import yaml
from scipy import stats
from sqlalchemy import Connection, create_engine, make_url

from experiments.analysis.compare import REPORTS, load_analysis
from experiments.analysis.proximity import summary
from experiments.analysis.queries import run_query
from experiments.analysis.time_cost import same_events
from experiments.sweep import cell_label, named_cells, sweep_world
from sim.config import apply_cell, load_variant, load_world

CONFIGS = Path(__file__).resolve().parents[1] / "configs"
CONFIG = CONFIGS / "x3.yaml"
SEAT_TERMS = ("standing_seats", "released_seats", "refilled_seats", "refilled_standing_seats")
CLASSES = ("late", "early", "travels", "withdrawn", "unmatched")


@dataclass(frozen=True)
class Cell:
    name: str
    group: str
    run: str
    policy: str
    baseline_run: str
    baseline: str
    rho: float
    eta: float


def load_x3(path: Path = CONFIG) -> dict[str, Any]:
    return yaml.safe_load(path.read_text(encoding="utf-8"))


def cells_from(config: dict[str, Any]) -> list[Cell]:
    out = []
    for ladder in config["ladders"]:
        response = load_world(CONFIGS / ladder["world"]).demand.intervention_response
        for policy in ladder["policies"]:
            out.append(Cell(f"{policy} (run …{ladder['run'][-3:]})", "ladder", ladder["run"], policy,
                            ladder["run"], ladder["baseline"], response.early_release_probability,
                            response.annoyed_cancel_probability))
    for entry in config["sweeps"]:
        sweep = yaml.safe_load((CONFIGS / entry["config"]).read_text(encoding="utf-8"))
        world = load_world(sweep_world(sweep))
        variant = load_variant(CONFIGS / sweep["variant"])
        baseline = load_variant(CONFIGS / sweep["baseline"]).name
        for name, cell in named_cells(sweep):
            changed, _ = apply_cell(world, variant, cell)
            response = changed.demand.intervention_response
            if "baseline_from" in entry:
                base_run, base_label = entry["baseline_from"]["run"], entry["baseline_from"]["variant"]
            else:
                base_run = entry["run"]
                base_label = cell_label(baseline, cell, name) if sweep.get("baseline_per_cell") else baseline
            label = cell_label(variant.name, cell, name)
            out.append(Cell(label, sweep["name"], entry["run"], label, base_run, base_label,
                            response.early_release_probability, response.annoyed_cancel_probability))
    return out


# ---------------------------------------------------------------- the pieces, each testable alone

def classify(asked: list[dict[str, Any]], twins: dict[tuple, tuple], late: timedelta) -> dict[int, dict[str, int]]:
    """Seats of asked bookings per seed and class, by what each booking's twin did.

    twins maps (seed, search_id, ride_id, accepted_at) to (passenger_cancelled_at, driver_cancelled,
    started) for the baseline's accepted bookings.
    """
    out: dict[int, dict[str, int]] = defaultdict(lambda: dict.fromkeys(CLASSES, 0))
    for b in asked:
        seats = b["seats"]
        twin = twins.get((b["seed"], b["search_id"], b["ride_id"], b["accepted_at"]))
        if twin is None:
            kind = "unmatched"
        else:
            cancelled_at, driver_cancelled, started = twin
            if driver_cancelled:
                kind = "withdrawn"
            elif cancelled_at is not None:
                # A twin that cancelled before the ask means the worlds had diverged after all.
                kind = ("unmatched" if cancelled_at <= b["asked_at"]
                        else "late" if b["departure"] - cancelled_at < late else "early")
            elif started:
                kind = "travels"
            else:
                kind = "unmatched"
        out[b["seed"]][kind] += seats
    return out


def ceiling_terms(classes: dict[str, int], rho: float, eta: float, r_early: float, r_late: float, *,
                  conservative: bool = False) -> dict[str, float]:
    """The three terms of Proposition 8's first-order ceiling, eq. (17), in seats."""
    late, early, travels = classes["late"], classes["early"], classes["travels"]
    unmatched = classes["unmatched"]
    if conservative:
        late += unmatched
        scale = 1.0
    else:
        matched = sum(classes[k] for k in ("late", "early", "travels", "withdrawn"))
        scale = (matched + unmatched) / matched if matched else 0.0
    return {"late": scale * rho * (r_early - r_late) * late,
            "early": scale * rho * (1 - r_early) * early,
            "travels": -scale * eta * (1 - r_early) * travels}


def ceiling_seats(classes: dict[str, int], rho: float, eta: float, r_early: float, r_late: float, *,
                  conservative: bool = False) -> float:
    """Proposition 8's first-order ceiling, eq. (17), in seats."""
    return sum(ceiling_terms(classes, rho, eta, r_early, r_late, conservative=conservative).values())


def seat_differences(policy: dict[str, dict[str, Any]], baseline: dict[str, dict[str, Any]]) -> dict[str, int]:
    """Policy minus baseline for each seat term, summed over rides withdrawn in neither run.

    Each argument maps ride id to that ride's ride_seat_accounting row for one seed.
    """
    withdrawn = {r for rows in (policy, baseline) for r, row in rows.items() if row["driver_cancelled"]}
    zero = dict.fromkeys(SEAT_TERMS, 0)
    out = dict.fromkeys(SEAT_TERMS, 0)
    for ride in (set(policy) | set(baseline)) - withdrawn:
        for term in SEAT_TERMS:
            out[term] += policy.get(ride, zero)[term] - baseline.get(ride, zero)[term]
    return out


def judge(rows: list[dict[str, Any]], config: dict[str, Any]) -> dict[str, Any]:
    breaches = [r["name"] for r in rows if r["standing"]["ci_low"] > r["ceiling_central"]]
    allowed = len(rows) // config["cells_per_allowed_breach"]
    negative = [r["name"] for r in rows if r["residual_standing"]["ci_high"] < 0]
    spearman = float(stats.spearmanr([r["ceiling_rides"] for r in rows],
                                     [r["completed"]["mean_difference"] for r in rows]).statistic)
    return {
        "H3.1": {"rule": f"at most {allowed} of {len(rows)} cells with the whole interval of ΔB above the ceiling",
                 "breaches": breaches, "holds": len(breaches) <= allowed},
        "H3.2": {"rule": "ΔO, refills counted when they stand, has an interval reaching zero in every cell",
                 "below_zero": negative, "holds": not negative},
        "H3.3": {"rule": f"Spearman between the ceiling in completed rides and the observed effect is at least "
                         f"{config['spearman_threshold']}",
                 "spearman": spearman, "holds": spearman >= config["spearman_threshold"]},
    }


def exploratory(rows: list[dict[str, Any]]) -> dict[str, Any]:
    """Readings chosen after H3.1 to H3.3 were judged. Reported as such, never as results.

    - spearman_seats: H3.3's correlation with both sides in seats, without eq. (19)'s conversion.
    - spearman_without_demand: H3.3 without the demand sweep's cells.
    - spearman_distinct: H3.3 counting once each cell whose results equal another's to six places
      (the same runs met in several groups).
    - residual_when_requested: how many cells have the identity's exact residual (refills counted when
      requested, as Proposition 7 counts them) wholly above, across or wholly below zero.
    """
    def spearman(subset, x, y):
        return float(stats.spearmanr([x(r) for r in subset], [y(r) for r in subset]).statistic)

    rides = lambda r: r["ceiling_rides"]  # noqa: E731
    observed = lambda r: r["completed"]["mean_difference"]  # noqa: E731
    seen, distinct = set(), []
    for r in rows:
        key = (round(r["standing"]["mean_difference"], 6), round(r["ceiling_central"], 6))
        if key not in seen:
            seen.add(key)
            distinct.append(r)
    residual = [r["residual"] for r in rows]
    return {
        "spearman_seats": spearman(rows, lambda r: r["ceiling_central"], lambda r: r["standing"]["mean_difference"]),
        "spearman_without_demand": spearman([r for r in rows if r["group"] != "demand-density"], rides, observed),
        "spearman_distinct": spearman(distinct, rides, observed),
        "distinct_cells": len(distinct),
        "residual_when_requested": {
            "above_zero": sum(1 for d in residual if d["ci_low"] > 0),
            "across_zero": sum(1 for d in residual if d["ci_low"] <= 0 <= d["ci_high"]),
            "below_zero": [r["name"] for r in rows if r["residual"]["ci_high"] < 0]},
    }


# ---------------------------------------------------------------- reading the log

class Log:
    """Reads what each cell needs, keeping only compact summaries of each baseline."""

    def __init__(self, conn: Connection) -> None:
        self.conn = conn
        self.baselines: dict[tuple[str, str], dict[str, Any]] = {}

    def query(self, name: str, run: str, variant: str) -> list[dict[str, Any]]:
        return run_query(self.conn, name, run_id=uuid.UUID(run), variant=variant)

    def rides(self, run: str, variant: str) -> dict[int, dict[str, dict[str, Any]]]:
        out: dict[int, dict[str, dict[str, Any]]] = defaultdict(dict)
        for row in self.query("ride_seat_accounting", run, variant):
            out[row["seed"]][row["ride_id"]] = row
        return out

    def searches(self, run: str, variant: str) -> dict[int, tuple[int, float]]:
        return {r["seed"]: (r["searches"], float(r["per_100"]))
                for r in self.query("primary_metric", run, variant)}

    def baseline(self, run: str, variant: str) -> dict[str, Any]:
        key = (run, variant)
        if key not in self.baselines:
            fates = self.query("booking_fates", run, variant)
            started = [f for f in fates if f["started"]]
            timing = self.query("refill_by_release_timing", run, variant)
            self.baselines[key] = {
                "twins": {(f["seed"], f["search_id"], f["ride_id"], f["accepted_at"]):
                          (f["passenger_cancelled_at"], f["driver_cancelled"], f["started"])
                          for f in fates if f["accepted_at"] is not None},
                "completed_share": sum(1 for f in started if f["completed"]) / len(started),
                "seats_per_booking": sum(f["seats"] for f in started) / len(started),
                "r_early": statistics.fmean(float(t["early_refill_share"]) for t in timing
                                            if t["early_refill_share"] is not None),
                "r_late": statistics.fmean(float(t["late_refill_share"]) for t in timing
                                           if t["late_refill_share"] is not None),
                "rides": self.rides(run, variant),
                "searches": self.searches(run, variant),
            }
        return self.baselines[key]


def evaluate(cell: Cell, log: Log, analysis: dict[str, Any], late: timedelta) -> dict[str, Any]:
    base = log.baseline(cell.baseline_run, cell.baseline)
    rides = log.rides(cell.run, cell.policy)
    searches = log.searches(cell.run, cell.policy)
    asked = [f for f in log.query("booking_fates", cell.run, cell.policy) if f["asked_at"] is not None]
    classes = classify(asked, base["twins"], late)
    seeds = sorted(set(searches) & set(base["searches"]))
    if any(searches[s][0] != base["searches"][s][0] for s in seeds):
        raise ValueError(f"{cell.name}: the policy and its baseline saw different searches")
    per_seed: dict[str, list[float]] = defaultdict(list)
    for seed in seeds:
        scale = 100.0 / searches[seed][0]
        d = seat_differences(rides.get(seed, {}), base["rides"].get(seed, {}))
        standing, released = d["standing_seats"], d["released_seats"]
        per_seed["standing"].append(scale * standing)
        per_seed["released"].append(scale * released)
        per_seed["refilled"].append(scale * d["refilled_seats"])
        per_seed["refilled_standing"].append(scale * d["refilled_standing_seats"])
        per_seed["residual"].append(scale * (d["refilled_seats"] - released - standing))
        per_seed["residual_standing"].append(scale * (d["refilled_standing_seats"] - released - standing))
        per_seed["completed"].append(searches[seed][1] - base["searches"][seed][1])
        c = classes.get(seed, dict.fromkeys(CLASSES, 0))
        args = (cell.rho, cell.eta, base["r_early"], base["r_late"])
        for term, value in ceiling_terms(c, *args).items():
            per_seed["term_" + term].append(scale * value)
        per_seed["ceiling_central"].append(scale * ceiling_seats(c, *args))
        per_seed["ceiling_conservative"].append(scale * ceiling_seats(c, *args, conservative=True))
        for k in CLASSES:
            per_seed["asked_" + k].append(scale * c[k])
    asked_total = sum(sum(c.values()) for c in classes.values())
    unmatched = sum(c["unmatched"] for c in classes.values())
    central = statistics.fmean(per_seed["ceiling_central"])
    row = asdict(cell) | {
        "seeds": len(seeds),
        "r_early": base["r_early"], "r_late": base["r_late"],
        "matched_share": 1 - unmatched / asked_total if asked_total else None,
        "asked_seats_per_100": {k: statistics.fmean(per_seed["asked_" + k]) for k in CLASSES},
        "ceiling_central": central,
        "ceiling_terms": {t: statistics.fmean(per_seed["term_" + t]) for t in ("late", "early", "travels")},
        "ceiling_conservative": statistics.fmean(per_seed["ceiling_conservative"]),
        "ceiling_rides": base["completed_share"] * central / base["seats_per_booking"],
        "completed_share": base["completed_share"], "seats_per_booking": base["seats_per_booking"],
    }
    for name in ("standing", "released", "refilled", "refilled_standing", "residual", "residual_standing",
                 "completed"):
        row[name] = summary(per_seed[name], analysis)
    return row


def to_markdown(report: dict[str, Any]) -> str:
    h = report["hypotheses"]
    lines = [
        "# Experiment X3: the reconfirmation ceiling, cell by cell",
        "",
        "Synthetic data (simulator), 30 paired seeds per cell. Cells and readings: `experiments/configs/x3.yaml`.",
        "Hypotheses: docs/EXPERIMENT_PROTOCOL.md section 26, fixed before X3 was computed. Seats are per 100",
        "searches, on rides that departed; each cell is a policy minus the same ranking without requests.",
        "",
        "| Hypothesis | Rule | Holds |",
        "|---|---|---|",
    ]
    lines += [f"| {k} | {v['rule']} | {'yes' if v['holds'] else 'NO'} |" for k, v in h.items()]
    lines += ["", f"Breaches of the ceiling: {', '.join(h['H3.1']['breaches']) or 'none'}. "
                  f"Cells with ΔO wholly below zero: {', '.join(h['H3.2']['below_zero']) or 'none'}. "
                  f"Spearman: {h['H3.3']['spearman']:.3f}."]
    e = report["exploratory"]
    lines += ["", "Exploratory, chosen after the hypotheses were judged: Spearman in seats "
                  f"{e['spearman_seats']:.3f}; without the demand cells {e['spearman_without_demand']:.3f}; "
                  f"over {e['distinct_cells']} distinct cells {e['spearman_distinct']:.3f}. The identity's exact "
                  f"residual (refills counted when requested) is wholly above zero in "
                  f"{e['residual_when_requested']['above_zero']} cells, across zero in "
                  f"{e['residual_when_requested']['across_zero']}, and wholly below in: "
                  f"{', '.join(e['residual_when_requested']['below_zero']) or 'none'}."]
    for check in report["checks"]:
        lines.append(f"Baseline check: {check['what']}: {check['identical']} of {check['seeds']} seeds identical.")
    lines += ["", "| Cell | ρ | η | Twins found | ΔB observed (95% CI) | Ceiling, central | Ceiling, conservative "
                  "| ΔO, refills standing (95% CI) | ΔO, refills requested | Completed rides, observed | "
                  "Ceiling in rides |", "|---|---|---|---|---|---|---|---|---|---|---|"]
    for r in report["cells"]:
        s, o = r["standing"], r["residual_standing"]
        lines.append(
            f"| {r['name']} | {r['rho']:g} | {r['eta']:g} | {r['matched_share']:.1%} "
            f"| {s['mean_difference']:+.3f} ({s['ci_low']:+.3f} to {s['ci_high']:+.3f}) "
            f"| {r['ceiling_central']:+.3f} | {r['ceiling_conservative']:+.3f} "
            f"| {o['mean_difference']:+.3f} ({o['ci_low']:+.3f} to {o['ci_high']:+.3f}) "
            f"| {r['residual']['mean_difference']:+.3f} | {r['completed']['mean_difference']:+.3f} "
            f"| {r['ceiling_rides']:+.3f} |")
    lines += ["", "## Who was asked, seats per 100 searches, by what the booking would have done unasked", "",
              "| Cell | Late canceller (𝓛) | Early canceller (𝓔) | Would travel (𝓝) | Ride withdrawn | No twin |",
              "|---|---|---|---|---|---|"]
    for r in report["cells"]:
        a = r["asked_seats_per_100"]
        lines.append(f"| {r['name']} | {a['late']:.2f} | {a['early']:.2f} | {a['travels']:.2f} "
                     f"| {a['withdrawn']:.2f} | {a['unmatched']:.2f} |")
    return "\n".join(lines)


def main() -> None:
    config, analysis = load_x3(), load_analysis()
    url = os.environ.get("VAYORA_DB_URL")
    if not url:
        raise SystemExit("VAYORA_DB_URL is not set")
    late = timedelta(hours=config["late_hours"])
    engine = create_engine(make_url(url).set(drivername="postgresql+psycopg"))
    checks = []
    with engine.connect() as conn:
        log = Log(conn)
        for entry in config["sweeps"]:
            if "baseline_from" in entry:
                source = entry["baseline_from"]
                result = same_events(conn, (entry["run"], source["shared_variant"]),
                                     (source["run"], source["shared_variant"]))
                checks.append({"what": f"{source['shared_variant']} in {entry['run']} against {source['run']}",
                               **result})
                if not result["identical"] == result["seeds"] == result["earlier_seeds"]:
                    raise SystemExit(f"{entry['config']}: its runs and the baseline's are not the same world")
        rows = []
        for cell in cells_from(config):
            rows.append(evaluate(cell, log, analysis, late))
            print(f"done {cell.name}", flush=True)
    report = {"config": config, "analysis": analysis, "checks": checks,
              "hypotheses": judge(rows, config), "exploratory": exploratory(rows), "cells": rows}
    stem = REPORTS / "x3-ceiling"
    stem.with_suffix(".json").write_text(json.dumps(report, indent=2, default=str) + "\n", encoding="utf-8")
    stem.with_suffix(".md").write_text(to_markdown(report) + "\n", encoding="utf-8")
    print(to_markdown(report))


if __name__ == "__main__":
    main()
