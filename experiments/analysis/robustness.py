"""Judges experiment X5, robustness, against its hypotheses.

    python -m experiments.analysis.robustness

Reads the sweeps named in experiments/configs/x5.yaml through metrics.sql (EXPERIMENT_PROTOCOL.md
sections 26 and 31) and writes experiments/reports/x5-robustness.json and .md:

- H5.1  B4 - B3 is equivalent to zero, within analysis.yaml's margin, in every reconfirmation cell;
- H5.2  B3 - B0 has its 95% interval wholly above zero in every cell of world h3.

Each cell is paired by seed with its own baseline.
"""

from __future__ import annotations

import json
import os
import uuid
from pathlib import Path
from typing import Any

import yaml
from sqlalchemy import Connection, create_engine, make_url

from experiments.analysis.compare import REPORTS, differences, equivalence, load_analysis
from experiments.analysis.proximity import summary
from experiments.analysis.queries import run_query
from experiments.sweep import cell_label, named_cells

CONFIGS = Path(__file__).resolve().parents[1] / "configs"
CONFIG = CONFIGS / "x5.yaml"


def load_x5(path: Path = CONFIG) -> dict[str, Any]:
    return yaml.safe_load(path.read_text(encoding="utf-8"))


def sweep_cells(entry: dict[str, Any]) -> list[dict[str, Any]]:
    """Each cell of a sweep: its name and the labels its variant and baseline are stored under."""
    sweep = yaml.safe_load((CONFIGS / entry["config"]).read_text(encoding="utf-8"))
    variant = yaml.safe_load((CONFIGS / sweep["variant"]).read_text(encoding="utf-8"))["name"]
    baseline = yaml.safe_load((CONFIGS / sweep["baseline"]).read_text(encoding="utf-8"))["name"]
    per_cell = sweep.get("baseline_per_cell", False)
    return [{"sweep": sweep["name"], "world": sweep.get("world", "world.yaml"), "run": entry["run"],
             "cell": name or ",".join(f"{k.rsplit('.', 1)[-1]}={v}" for k, v in cell.items()),
             "variant": cell_label(variant, cell, name),
             "baseline": cell_label(baseline, cell, name) if per_cell else baseline,
             "h5_2": entry.get("h5_2", False)}
            for name, cell in named_cells(sweep)]


def contrast(conn: Connection, cell: dict[str, Any], analysis: dict[str, Any]) -> dict[str, Any]:
    def per_100(variant: str) -> dict[int, float]:
        rows = run_query(conn, "primary_metric", run_id=uuid.UUID(cell["run"]), variant=variant)
        return {r["seed"]: float(r["per_100"]) for r in rows if r["per_100"] is not None}

    diffs = differences(per_100(cell["baseline"]), per_100(cell["variant"]))
    return cell | {"difference": summary(diffs, analysis),
                   "equivalence": equivalence(diffs, analysis["equivalence_margin"], analysis["equivalence_alpha"])}


def judge(reconfirmation: list[dict[str, Any]], ranking: list[dict[str, Any]]) -> dict[str, Any]:
    not_equivalent = [f"{c['sweep']} {c['cell']}" for c in reconfirmation if not c["equivalence"]["equivalent"]]
    h3_cells = [c for c in ranking if c["h5_2"]]
    not_above = [f"{c['sweep']} {c['cell']}" for c in h3_cells if not c["difference"]["ci_low"] > 0]
    return {
        "H5.1": {"rule": "B4 - B3 equivalent to zero in every cell", "not_equivalent": not_equivalent,
                 "holds": not not_equivalent},
        "H5.2": {"rule": "B3 - B0 wholly above zero in every cell of world h3", "not_above_zero": not_above,
                 "holds": bool(h3_cells) and not not_above},
    }


def to_markdown(report: dict[str, Any]) -> str:
    lines = ["# Experiment X5: robustness", "",
             "Synthetic data (simulator), 30 paired seeds per cell, each against its own baseline. Sweeps and "
             "readings: `experiments/configs/x5.yaml`. Hypotheses: docs/EXPERIMENT_PROTOCOL.md section 26, fixed "
             "before these runs.", "", "| Hypothesis | Rule | Holds |", "|---|---|---|"]
    lines += [f"| {k} | {v['rule']} | {'yes' if v['holds'] else 'NO'} |" for k, v in report["hypotheses"].items()]
    for key, title in (("reconfirmation", "B4 − B3"), ("ranking", "B3 − B0")):
        lines += ["", f"## {title}, completed rides per 100 searches", "",
                  "| Sweep | World | Cell | Difference (95% CI) | Equivalence p |", "|---|---|---|---|---|"]
        for c in report[key]:
            d = c["difference"]
            lines.append(f"| {c['sweep']} | {c['world']} | {c['cell']} | {d['mean_difference']:+.3f} "
                         f"({d['ci_low']:+.3f} to {d['ci_high']:+.3f}) | {c['equivalence']['tost_p']:.4f} |")
    return "\n".join(lines)


def main() -> None:
    config, analysis = load_x5(), load_analysis()
    url = os.environ.get("VAYORA_DB_URL")
    if not url:
        raise SystemExit("VAYORA_DB_URL is not set")
    engine = create_engine(make_url(url).set(drivername="postgresql+psycopg"))
    with engine.connect() as conn:
        reconfirmation = [contrast(conn, c, analysis) for e in config["reconfirmation"] for c in sweep_cells(e)]
        ranking = [contrast(conn, c, analysis) for e in config["ranking"] for c in sweep_cells(e)]
    report = {"config": config, "analysis": analysis, "hypotheses": judge(reconfirmation, ranking),
              "reconfirmation": reconfirmation, "ranking": ranking}
    stem = REPORTS / "x5-robustness"
    stem.with_suffix(".json").write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    stem.with_suffix(".md").write_text(to_markdown(report) + "\n", encoding="utf-8")
    print(to_markdown(report))


if __name__ == "__main__":
    main()
