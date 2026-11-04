"""Judges experiment X1, the hazard tied to departure, against its hypotheses.

    python -m experiments.analysis.proximity

Reads the runs named in experiments/configs/x1.yaml through metrics.sql (EXPERIMENT_PROTOCOL.md
sections 26 and 27) and writes experiments/reports/x1-proximity.json and .md:

- H1.0  every variant and seed of the share-0 runs wrote exactly the events of the earlier
        world-h3 run (query event_digest);
- H1.1  EARLIEST's relative gain over B0, mean(EARLIEST - B0) / mean(B0), at the largest share is
        below h1_1_fraction of its value at share 0;
- H1.2  ORACLE - B3 is larger at the largest share than at share 0;
- H1.3  B4 - B3 is equivalent to zero within the margin of analysis.yaml at every share.

Seeds are paired across worlds as well as across variants: seed s draws the same searches and
rides in every world, so cross-world contrasts are taken seed by seed too. Each verdict is the
rule the protocol wrote down; the intervals beside it say how firm it is.
"""

from __future__ import annotations

import json
import os
import statistics
import uuid
from pathlib import Path
from typing import Any

import numpy as np
import yaml
from scipy import stats
from sqlalchemy import Connection, create_engine, make_url

from experiments.analysis.compare import (
    REPORTS,
    bootstrap_interval,
    differences,
    equivalence,
    load_analysis,
    per_seed,
)
from experiments.analysis.queries import run_query

CONFIG = Path(__file__).resolve().parents[1] / "configs" / "x1.yaml"
RANKING = ["B0", "B3", "EARLIEST", "B3-KM"]
RECONFIRMATION = ["B3", "B0", "B4", "ORACLE"]
DESCRIBED = ["per_100", "seats_per_100", "late_share_passenger", "contact_rate", "refilled"]


def load_x1(path: Path = CONFIG) -> dict[str, Any]:
    config = yaml.safe_load(path.read_text(encoding="utf-8"))
    shares = [w["share"] for w in config["worlds"]]
    if shares != sorted(shares) or shares[0] != 0:
        raise ValueError("x1.yaml must list the worlds by share, starting at share 0")
    return config


def relative_gain(baseline: dict[int, float], variant: dict[int, float]) -> float:
    seeds = sorted(set(baseline) & set(variant))
    return (statistics.fmean(variant[s] - baseline[s] for s in seeds)
            / statistics.fmean(baseline[s] for s in seeds))


def gain_ratio_interval(at_zero: tuple[dict[int, float], dict[int, float]],
                        at_share: tuple[dict[int, float], dict[int, float]],
                        resamples: int, seed: int, confidence: float = 0.95) -> tuple[float, float]:
    """Percentile bootstrap of relative_gain(at_share) / relative_gain(at_zero), resampling seeds."""
    seeds = sorted(set.intersection(*(set(d) for d in (*at_zero, *at_share))))
    columns = [np.array([d[s] for s in seeds]) for d in (*at_zero, *at_share)]
    picks = np.random.default_rng(seed).integers(0, len(seeds), size=(resamples, len(seeds)))
    b0, e0, bw, ew = (c[picks].mean(axis=1) for c in columns)
    ratios = ((ew - bw) / bw) / ((e0 - b0) / b0)
    tail = 100 * (1 - confidence) / 2
    return float(np.percentile(ratios, tail)), float(np.percentile(ratios, 100 - tail))


def summary(diffs: list[float], analysis: dict[str, Any]) -> dict[str, Any]:
    n, mean = len(diffs), statistics.fmean(diffs)
    half = stats.t.ppf(0.975, n - 1) * statistics.stdev(diffs) / n ** 0.5
    low, high = bootstrap_interval(diffs, analysis["bootstrap"]["resamples"],
                                   analysis["bootstrap"]["seed"])
    return {"seeds": n, "mean_difference": mean, "ci_low": mean - half, "ci_high": mean + half,
            "bootstrap_ci_low": low, "bootstrap_ci_high": high}


def reproduction(conn: Connection, entry: dict[str, Any]) -> dict[str, Any]:
    out = {}
    for variant in entry["variants"]:
        new, old = ({r["seed"]: (r["events"], r["digest"]) for r in
                     run_query(conn, "event_digest", run_id=uuid.UUID(run), variant=variant)}
                    for run in (entry["run"], entry["earlier"]))
        out[variant] = {"seeds": len(new), "earlier_seeds": len(old),
                        "identical": sum(1 for s in new if old.get(s) == new[s])}
    return {"run": entry["run"], "earlier": entry["earlier"], "variants": out}


def judge(data: dict[float, dict[str, dict[str, dict[str, dict[int, float]]]]],
          config: dict[str, Any], analysis: dict[str, Any],
          reproduced: list[dict[str, Any]]) -> dict[str, Any]:
    """data[share][run kind][variant][measure] = {seed: value}."""
    shares = [w["share"] for w in config["worlds"]]
    zero, top = shares[0], shares[-1]
    boot = analysis["bootstrap"]

    def per_100(share: float, kind: str, variant: str) -> dict[int, float]:
        return data[share][kind][variant]["per_100"]

    gains = {share: relative_gain(per_100(share, "ranking", "B0"), per_100(share, "ranking", "EARLIEST"))
             for share in shares}
    ratio = gains[top] / gains[zero]
    oracle = {share: differences(per_100(share, "reconfirmation", "B3"),
                                 per_100(share, "reconfirmation", "ORACLE")) for share in shares}
    oracle_change = [a - b for a, b in zip(oracle[top], oracle[zero], strict=True)]
    b4 = {share: equivalence(differences(per_100(share, "reconfirmation", "B3"),
                                         per_100(share, "reconfirmation", "B4")),
                             analysis["equivalence_margin"], analysis["equivalence_alpha"])
          for share in shares}
    identical = all(v["identical"] == v["seeds"] == v["earlier_seeds"]
                    for entry in reproduced for v in entry["variants"].values())
    return {
        "H1.0": {"rule": "share-0 runs write the earlier h3 runs' events, seed by seed",
                 "runs": reproduced, "holds": identical},
        "H1.1": {"rule": f"relative gain of EARLIEST over B0 at share {top} below "
                         f"{config['h1_1_fraction']} of its value at share {zero}",
                 "relative_gain": gains, "ratio": ratio,
                 "ratio_bootstrap_ci": gain_ratio_interval(
                     (per_100(zero, "ranking", "B0"), per_100(zero, "ranking", "EARLIEST")),
                     (per_100(top, "ranking", "B0"), per_100(top, "ranking", "EARLIEST")),
                     boot["resamples"], boot["seed"]),
                 "holds": ratio < config["h1_1_fraction"]},
        "H1.2": {"rule": f"ORACLE - B3 larger at share {top} than at share {zero}",
                 "oracle_minus_b3": {share: statistics.fmean(d) for share, d in oracle.items()},
                 "change": summary(oracle_change, analysis),
                 "holds": statistics.fmean(oracle_change) > 0},
        "H1.3": {"rule": "B4 - B3 equivalent to zero at every share",
                 "by_share": b4, "holds": all(e["equivalent"] for e in b4.values())},
    }


def describe(data: dict[float, Any], analysis: dict[str, Any]) -> dict[str, Any]:
    """Means of the main measures, and each run's contrasts with its baseline, per share."""
    out = {}
    for share, kinds in data.items():
        out[share] = {}
        for kind, baseline in (("ranking", "B0"), ("reconfirmation", "B3")):
            for variant, measures in kinds[kind].items():
                row = out[share].setdefault(f"{kind}:{variant}", {})
                for measure in DESCRIBED:
                    if measures.get(measure):
                        row[measure] = statistics.fmean(measures[measure].values())
                if variant != baseline:
                    row["per_100_vs_" + baseline] = summary(
                        differences(kinds[kind][baseline]["per_100"], measures["per_100"]), analysis)
    return out


def exploratory(data: dict[float, Any], analysis: dict[str, Any]) -> dict[float, Any]:
    """B3 - EARLIEST per share: not among X1's hypotheses, added after the runs were seen."""
    return {share: summary(differences(kinds["ranking"]["EARLIEST"]["per_100"],
                                       kinds["ranking"]["B3"]["per_100"]), analysis)
            for share, kinds in data.items()}


def to_markdown(report: dict[str, Any]) -> str:
    h = report["hypotheses"]
    shares = list(report["described"])
    lines = [
        "# Experiment X1: a hazard tied to departure",
        "",
        "Synthetic data (simulator), 30 seeds per variant. Runs and worlds: `experiments/configs/x1.yaml`.",
        "Hypotheses: docs/EXPERIMENT_PROTOCOL.md section 26, fixed before these runs.",
        "",
        "| Hypothesis | Rule | Holds |",
        "|---|---|---|",
    ]
    lines += [f"| {name} | {h[name]['rule']} | {'yes' if h[name]['holds'] else 'NO'} |" for name in h]
    lines += ["", "## H1.0: the share-0 runs repeat the earlier runs", "",
              "| Run | Earlier run | Variant | Seeds identical |", "|---|---|---|---|"]
    for entry in h["H1.0"]["runs"]:
        for variant, v in entry["variants"].items():
            lines.append(f"| `…{entry['run'][-3:]}` | `…{entry['earlier'][-3:]}` | {variant} "
                         f"| {v['identical']} / {v['seeds']} |")
    g = h["H1.1"]
    lines += ["", "## H1.1: EARLIEST's relative gain over B0", "",
              "| Share | Relative gain |", "|---|---|"]
    lines += [f"| {s} | {g['relative_gain'][s]:+.4%} |" for s in shares]
    low, high = g["ratio_bootstrap_ci"]
    lines += ["", f"Ratio, largest share to share 0: {g['ratio']:.3f} "
                  f"(bootstrap 95% interval {low:.3f} to {high:.3f})."]
    o = h["H1.2"]
    c = o["change"]
    lines += ["", "## H1.2: ORACLE − B3", "", "| Share | ORACLE − B3 |", "|---|---|"]
    lines += [f"| {s} | {o['oracle_minus_b3'][s]:+.3f} |" for s in shares]
    lines += ["", f"Change from share 0 to the largest share, seed by seed: {c['mean_difference']:+.3f} "
                  f"(t interval {c['ci_low']:+.3f} to {c['ci_high']:+.3f}; bootstrap "
                  f"{c['bootstrap_ci_low']:+.3f} to {c['bootstrap_ci_high']:+.3f})."]
    lines += ["", "## H1.3: B4 − B3 within the margin", "",
              "| Share | B4 − B3 | TOST p | Equivalent |", "|---|---|---|---|"]
    for s in shares:
        e = h["H1.3"]["by_share"][s]
        diff = report["described"][s]["reconfirmation:B4"]["per_100_vs_B3"]
        lines.append(f"| {s} | {diff['mean_difference']:+.3f} ({diff['ci_low']:+.3f} to "
                     f"{diff['ci_high']:+.3f}) | {e['tost_p']:.4f} | {'yes' if e['equivalent'] else 'no'} |")
    lines += ["", "## Exploratory, not a hypothesis of X1: B3 − EARLIEST", "",
              "Added after the runs were seen; a question for experiment X2 (H2.2), not a result.", "",
              "| Share | B3 − EARLIEST (95% CI) | Bootstrap |", "|---|---|---|"]
    for s in shares:
        e = report["exploratory_b3_minus_earliest"][s]
        lines.append(f"| {s} | {e['mean_difference']:+.3f} ({e['ci_low']:+.3f} to {e['ci_high']:+.3f}) "
                     f"| {e['bootstrap_ci_low']:+.3f} to {e['bootstrap_ci_high']:+.3f} |")
    lines += ["", "## Every variant, per share", "",
              "| Share | Run: variant | Completed per 100 | vs baseline (95% CI) | Seats per 100 "
              "| Late share, passengers |", "|---|---|---|---|---|---|"]
    for s in shares:
        for name, row in report["described"][s].items():
            vs = row.get("per_100_vs_B0") or row.get("per_100_vs_B3")
            cell = (f"{vs['mean_difference']:+.3f} ({vs['ci_low']:+.3f} to {vs['ci_high']:+.3f})"
                    if vs else "baseline")
            lines.append(f"| {s} | {name} | {row['per_100']:.2f} | {cell} | {row['seats_per_100']:.2f} "
                         f"| {row['late_share_passenger']:.3f} |")
    return "\n".join(lines)


def main() -> None:
    config, analysis = load_x1(), load_analysis()
    url = os.environ.get("VAYORA_DB_URL")
    if not url:
        raise SystemExit("VAYORA_DB_URL is not set")
    engine = create_engine(make_url(url).set(drivername="postgresql+psycopg"))
    with engine.connect() as conn:
        data = {
            w["share"]: {
                "ranking": {v: per_seed(conn, uuid.UUID(w["ranking_run"]), v) for v in RANKING},
                "reconfirmation": {v: per_seed(conn, uuid.UUID(w["reconfirmation_run"]), v)
                                   for v in RECONFIRMATION},
            } for w in config["worlds"]}
        reproduced = [reproduction(conn, entry) for entry in config["reproduces"]]
    report = {"config": config, "analysis": analysis,
              "hypotheses": judge(data, config, analysis, reproduced),
              "described": describe(data, analysis),
              "exploratory_b3_minus_earliest": exploratory(data, analysis)}
    stem = REPORTS / "x1-proximity"
    stem.with_suffix(".json").write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    stem.with_suffix(".md").write_text(to_markdown(report) + "\n", encoding="utf-8")
    print(to_markdown(report))


if __name__ == "__main__":
    main()
