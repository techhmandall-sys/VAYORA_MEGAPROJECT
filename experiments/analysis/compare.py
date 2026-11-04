"""Compares variants of one run, seed by seed, from the event log.

    python -m experiments.analysis.compare --run-id <uuid> --baseline B0 B3 B4

Every figure comes from a query in metrics.sql. Variants are paired by seed: the same
seed is the same world, so the per-seed difference removes world-to-world noise.

The primary metric's contrasts also get a bootstrap interval, Holm's correction across the
variants of the report, and an equivalence test at the margin in configs/analysis.yaml
(EXPERIMENT_PROTOCOL.md section 25). Those are added after every earlier figure, so a report
rebuilt from the same events keeps every number it had.
Writes experiments/reports/ladder-<run id>.json and .md.
"""

from __future__ import annotations

import argparse
import json
import os
import statistics
import uuid
from pathlib import Path
from typing import Any, Sequence

import numpy as np
import yaml
from scipy import stats
from sqlalchemy import Connection, create_engine, make_url

from experiments.analysis.queries import run_query

REPORTS = Path(__file__).resolve().parents[1] / "reports"
ANALYSIS = Path(__file__).resolve().parents[1] / "configs" / "analysis.yaml"

# (query, column, label, decimals)
MEASURES = [
    ("primary_metric", "per_100", "Completed rides per 100 searches", 2),
    ("late_cancellation_share", "late_share", "Late share of cancellations", 3),
    ("funnel_rates", "booking_rate", "Booking requests per search", 3),
    ("intervention_volume", "contact_rate", "Reconfirmation requests per accepted booking", 3),
    ("intervention_volume", "refilled", "Released seats refilled", 1),
    ("refill_additionality", "refills_only_option",
     "Refills by a passenger offered no other ride", 1),
    ("refill_additionality", "empty_share", "Searches offered no ride", 3),
    ("empty_search_reasons", "no_ride_share", "Searches offered no ride: none left at that time", 3),
    ("empty_search_reasons", "full_share", "Searches offered no ride: every ride then full", 3),
    ("refill_by_release_timing", "early_refill_share",
     "Share of seats refilled, rides with only early releases", 3),
    ("refill_by_release_timing", "late_refill_share",
     "Share of seats refilled, rides with only late releases", 3),
    # Added 2026-11-04, last so that earlier sections of a rebuilt report stay as they were.
    ("seats_travelled", "seats_per_100", "Seats travelled per 100 searches", 2),
    ("late_cancellation_share_passenger", "late_share_passenger",
     "Late share of passenger cancellations", 3),
]


def per_seed(conn: Connection, run_id: uuid.UUID, variant: str) -> dict[str, dict[int, float]]:
    """{column: {seed: value}} for every measure; undefined values are left out."""
    out: dict[str, dict[int, float]] = {}
    for query in {m[0] for m in MEASURES}:
        rows = run_query(conn, query, run_id=run_id, variant=variant)
        for _, column, _, _ in (m for m in MEASURES if m[0] == query):
            out[column] = {r["seed"]: float(r[column]) for r in rows if r[column] is not None}
    return out


def paired(baseline: dict[int, float], variant: dict[int, float],
           confidence: float = 0.95) -> dict[str, Any] | None:
    """Mean per-seed difference, its t interval and a Wilcoxon signed-rank test."""
    seeds = sorted(set(baseline) & set(variant))
    if len(seeds) < 2:
        return None
    differences = [variant[s] - baseline[s] for s in seeds]
    mean = statistics.fmean(differences)
    spread = statistics.stdev(differences)
    half = stats.t.ppf(0.5 + confidence / 2, len(seeds) - 1) * spread / len(seeds) ** 0.5
    if any(differences):
        p_value = float(stats.wilcoxon(differences).pvalue)
    else:
        p_value = 1.0  # identical on every seed
    return {
        "seeds": len(seeds),
        "mean_difference": mean,
        "ci_low": mean - half,
        "ci_high": mean + half,
        "confidence": confidence,
        "wilcoxon_p": p_value,
        "seeds_improved": sum(1 for d in differences if d > 0),
        "seeds_worsened": sum(1 for d in differences if d < 0),
    }


def load_analysis(path: Path = ANALYSIS) -> dict[str, Any]:
    return yaml.safe_load(path.read_text(encoding="utf-8"))


def differences(baseline: dict[int, float], variant: dict[int, float]) -> list[float]:
    """Per-seed differences over the seeds both have, in seed order."""
    return [variant[s] - baseline[s] for s in sorted(set(baseline) & set(variant))]


def bootstrap_interval(diffs: Sequence[float], resamples: int, seed: int,
                       confidence: float = 0.95) -> tuple[float, float]:
    """Percentile bootstrap interval of the mean per-seed difference.

    Each call starts its own generator from `seed`, so an interval does not depend on which
    other contrasts were computed before it.
    """
    rng = np.random.default_rng(seed)
    values = np.asarray(diffs, dtype=float)
    means = rng.choice(values, size=(resamples, len(values)), replace=True).mean(axis=1)
    tail = 100 * (1 - confidence) / 2
    return float(np.percentile(means, tail)), float(np.percentile(means, 100 - tail))


def equivalence(diffs: Sequence[float], margin: float, alpha: float) -> dict[str, Any]:
    """Two one-sided t tests that the mean difference lies within +/- margin.

    The p-value is the larger of the two one-sided p-values. Equivalent when it is below
    alpha, which is the same as the (1 - 2 alpha) t interval lying inside +/- margin.
    """
    n = len(diffs)
    mean = statistics.fmean(diffs)
    error = statistics.stdev(diffs) / n ** 0.5
    if error == 0:
        p_value = 0.0 if abs(mean) < margin else 1.0
    else:
        below = stats.t.sf((mean + margin) / error, n - 1)  # against: mean <= -margin
        above = stats.t.cdf((mean - margin) / error, n - 1)  # against: mean >= +margin
        p_value = float(max(below, above))
    return {"margin": margin, "tost_p": p_value, "equivalent": p_value < alpha}


def holm(p_values: dict[str, float]) -> dict[str, float]:
    """Holm's step-down adjustment of one family of p-values, keyed by contrast."""
    ordered = sorted(p_values.items(), key=lambda item: item[1])
    adjusted: dict[str, float] = {}
    running = 0.0
    for rank, (name, p_value) in enumerate(ordered):
        running = max(running, min(1.0, (len(ordered) - rank) * p_value))
        adjusted[name] = running
    return adjusted


def build_report(conn: Connection, run_id: uuid.UUID, baseline: str,
                 variants: list[str], analysis: dict[str, Any] | None = None) -> dict[str, Any]:
    analysis = analysis or load_analysis()
    data = {name: per_seed(conn, run_id, name) for name in [baseline, *variants]}
    report: dict[str, Any] = {
        "run_id": str(run_id), "baseline": baseline, "data": "synthetic (simulator)",
        "variants": {},
    }
    for name, measures in data.items():
        entry: dict[str, Any] = {}
        for _, column, label, _ in MEASURES:
            values = measures[column]
            entry[column] = {
                "label": label,
                "seeds": len(values),
                "mean": statistics.fmean(values.values()) if values else None,
                "vs_baseline": None if name == baseline
                else paired(data[baseline][column], values),
            }
        report["variants"][name] = entry
    add_analysis(report, data, analysis)
    return report


def add_analysis(report: dict[str, Any], data: dict[str, dict[str, dict[int, float]]],
                 analysis: dict[str, Any]) -> None:
    """Bootstrap intervals, equivalence and Holm's correction, added to the contrasts in place."""
    baseline = report["baseline"]
    primary, *_ = analysis["bootstrapped_measures"]
    boot = analysis["bootstrap"]
    family: dict[str, float] = {}
    for name, entry in report["variants"].items():
        for column in analysis["bootstrapped_measures"]:
            contrast = entry[column]["vs_baseline"]
            if contrast is None:
                continue
            diffs = differences(data[baseline][column], data[name][column])
            low, high = bootstrap_interval(diffs, boot["resamples"], boot["seed"], contrast["confidence"])
            contrast["bootstrap_ci_low"], contrast["bootstrap_ci_high"] = low, high
            if column == primary:
                contrast.update(equivalence(diffs, analysis["equivalence_margin"],
                                            analysis["equivalence_alpha"]))
                family[name] = contrast["wilcoxon_p"]
    for name, adjusted in holm(family).items():
        report["variants"][name][primary]["vs_baseline"]["holm_p"] = adjusted
    report["analysis"] = {
        "bootstrap_resamples": boot["resamples"], "bootstrap_seed": boot["seed"],
        "equivalence_margin": analysis["equivalence_margin"],
        "equivalence_alpha": analysis["equivalence_alpha"],
        "holm_family": f"{primary}: the {len(family)} contrasts against {baseline} in this report",
    }


def to_markdown(report: dict[str, Any]) -> str:
    baseline = report["baseline"]
    lines = [
        f"# Variant comparison, run `{report['run_id']}`", "",
        "Synthetic data from the simulator. Differences are per seed against "
        f"**{baseline}**, with a 95% t interval and a Wilcoxon signed-rank p-value.", "",
    ]
    for _, column, label, decimals in MEASURES:
        lines += [f"## {label}", "",
                  f"| Variant | Seeds | Mean | Difference vs {baseline} | 95% CI | p | Seeds up / down |",
                  "|---|---|---|---|---|---|---|"]
        for name, entry in report["variants"].items():
            cell = entry[column]
            mean = "undefined" if cell["mean"] is None else f"{cell['mean']:.{decimals}f}"
            diff = cell["vs_baseline"]
            if diff is None:
                lines.append(f"| {name} | {cell['seeds']} | {mean} | | | | |")
            else:
                lines.append(
                    f"| {name} | {cell['seeds']} | {mean} "
                    f"| {diff['mean_difference']:+.{decimals}f} "
                    f"| {diff['ci_low']:+.{decimals}f} to {diff['ci_high']:+.{decimals}f} "
                    f"| {_p(diff['wilcoxon_p'])} "
                    f"| {diff['seeds_improved']} / {diff['seeds_worsened']} |")
        lines.append("")
    if "analysis" in report:
        lines += analysis_markdown(report)
    return "\n".join(lines)


def analysis_markdown(report: dict[str, Any]) -> list[str]:
    plan = report["analysis"]
    baseline = report["baseline"]
    margin = plan["equivalence_margin"]
    lines = [
        "## Analysis plan: bootstrap, Holm and equivalence", "",
        f"Percentile bootstrap of the per-seed differences ({plan['bootstrap_resamples']} resamples, "
        f"seed {plan['bootstrap_seed']}). Holm's correction over {plan['holm_family']}. "
        f"Equivalence: two one-sided tests at +/-{margin:g}, each at {plan['equivalence_alpha']:g} "
        "(EXPERIMENT_PROTOCOL.md section 25).", "",
    ]
    for _, column, label, decimals in MEASURES:
        rows = [(name, entry[column]["vs_baseline"]) for name, entry in report["variants"].items()
                if entry[column]["vs_baseline"] and "bootstrap_ci_low" in entry[column]["vs_baseline"]]
        if not rows:
            continue
        lines += [f"### {label}", "",
                  f"| Variant | Difference vs {baseline} | 95% t interval | 95% bootstrap interval "
                  f"| Wilcoxon p | Holm p | Equivalence p (+/-{margin:g}) | Equivalent |",
                  "|---|---|---|---|---|---|---|---|"]
        for name, diff in rows:
            holm_p = _p(diff["holm_p"]) if "holm_p" in diff else ""
            tost = _p(diff["tost_p"]) if "tost_p" in diff else ""
            same = ("yes" if diff["equivalent"] else "no") if "equivalent" in diff else ""
            lines.append(
                f"| {name} | {diff['mean_difference']:+.{decimals + 1}f} "
                f"| {diff['ci_low']:+.{decimals + 1}f} to {diff['ci_high']:+.{decimals + 1}f} "
                f"| {diff['bootstrap_ci_low']:+.{decimals + 1}f} to {diff['bootstrap_ci_high']:+.{decimals + 1}f} "
                f"| {_p(diff['wilcoxon_p'])} | {holm_p} | {tost} | {same} |")
        lines.append("")
    return lines


def _p(value: float) -> str:
    return "<0.0001" if value < 0.0001 else f"{value:.4f}"


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--run-id", type=uuid.UUID, required=True)
    parser.add_argument("--baseline", required=True)
    parser.add_argument("variants", nargs="+")
    args = parser.parse_args()

    url = os.environ.get("VAYORA_DB_URL")
    if not url:
        parser.error("VAYORA_DB_URL is not set")
    engine = create_engine(make_url(url).set(drivername="postgresql+psycopg"))
    with engine.connect() as conn:
        report = build_report(conn, args.run_id, args.baseline, args.variants)

    REPORTS.mkdir(exist_ok=True)
    stem = REPORTS / f"ladder-{args.run_id}"
    stem.with_suffix(".json").write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    stem.with_suffix(".md").write_text(to_markdown(report) + "\n", encoding="utf-8")
    print(to_markdown(report))


if __name__ == "__main__":
    main()
