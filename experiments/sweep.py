"""Runs one variant across a grid of parameters and compares each cell to a baseline.

    python -m experiments.sweep experiments/configs/sweeps/intervention_response.yaml

Each cell is the variant on a world with those parameters replaced, stored under a
variant name that spells the cell out. A parameter whose path starts with ``variant.``
is replaced in the variant instead of the world, and never touches the baseline. By default the baseline is run once on the
unmodified world, which is only right when the swept parameters cannot affect it. With
``baseline_per_cell: true`` in the config the baseline is run on every cell's world too
and each cell is compared with its own. Everything is paired by
seed and every figure is read back from the event log through metrics.sql.

A config may name the world it varies (``world: worlds/...yaml``; world.yaml otherwise), may list
named ``cells``, each setting several values together, instead of a grid of ``parameters``, and may
compare several ``variants`` with the baseline instead of one ``variant``. ``--resume`` continues a
sweep stopped part-way.

Writes experiments/reports/sweep-<name>-<run id>.json and .md.
"""

from __future__ import annotations

import argparse
import dataclasses
import itertools
import json
import os
import statistics
import uuid
from pathlib import Path
from typing import Any

import psycopg
import yaml
from sqlalchemy import Connection, create_engine, make_url

from experiments.analysis.compare import paired, per_seed
from vayora_events import EventWriter
from sim.config import Variant, World, apply_cell, load_variant, load_world, validate, validate_variant
from sim.frozen import SEEDS_PER_VARIANT
from sim.simulator import Simulation

ROOT = Path(__file__).resolve().parents[1]
CONFIGS = ROOT / "experiments" / "configs"
REPORTS = ROOT / "experiments" / "reports"

MEASURES = [("per_100", "Completed rides per 100 searches", 2),
            ("late_share", "Late share of cancellations", 3),
            ("contact_rate", "Reconfirmation requests per accepted booking", 3),
            ("refilled", "Released seats refilled", 1),
            ("refills_only_option", "Refills by a passenger offered no other ride", 1),
            ("empty_share", "Searches offered no ride", 3)]




def cells(parameters: dict[str, list[Any]]) -> list[dict[str, Any]]:
    names = list(parameters)
    return [dict(zip(names, values, strict=True)) for values in itertools.product(*(parameters[n] for n in names))]


def named_cells(config: dict[str, Any]) -> list[tuple[str | None, dict[str, Any]]]:
    """A sweep's cells: every combination of `parameters`, or the `cells` it lists by name.

    A named cell sets several values together, e.g. every type's Weibull scale at once:
    ``cells: [{name: "scale=2", set: {demand.types.committed.weibull_scale_hours: 5000, ...}}]``.
    """
    if "cells" in config:
        return [(c["name"], dict(c["set"])) for c in config["cells"]]
    return [(None, cell) for cell in cells(config["parameters"])]


def cell_label(variant: str, cell: dict[str, Any], name: str | None = None) -> str:
    """The name a cell's events are stored under, e.g. ``B4[early_release_probability=0.5]``,
    or ``B4[scale=2]`` for a named cell."""
    if name is not None:
        return f"{variant}[{name}]"
    settings = [path.rsplit(".", 1)[-1] + "=" + str(value) for path, value in cell.items()]
    return variant + "[" + ",".join(settings) + "]"


def sweep_world(config: dict[str, Any]) -> Path:
    """The world a sweep varies: the one its config names, or world.yaml."""
    return CONFIGS / config.get("world", "world.yaml")


def sweep_variants(config: dict[str, Any]) -> list[str]:
    """The variants a sweep compares with its baseline: `variant`, or the list `variants`."""
    return list(config["variants"]) if "variants" in config else [config["variant"]]


def completed(conn: psycopg.Connection, run_id: uuid.UUID) -> set[tuple[str, int]]:
    """For a sweep resumed after a crash: the (variant, seed) pairs it finished.

    A sweep writes one pair at a time, committing every few thousand events, so only the pair it was
    writing last can be incomplete. Its events are deleted, and every other pair is kept.
    """
    last = conn.execute("SELECT variant, seed FROM events WHERE run_id = %s ORDER BY id DESC LIMIT 1",
                        (run_id,)).fetchone()
    if last:
        conn.execute("DELETE FROM events WHERE run_id = %s AND variant = %s AND seed = %s", (run_id, *last))
        conn.commit()
    return {(v, s) for v, s in conn.execute(
        "SELECT DISTINCT variant, seed FROM events WHERE run_id = %s", (run_id,)).fetchall()}


def run(conn: psycopg.Connection, world: World, variant: Variant, label: str, seeds: range,
        run_id: uuid.UUID, done: set[tuple[str, int]] = frozenset()) -> None:
    labelled = dataclasses.replace(variant, name=label)
    for seed in seeds:
        if (label, seed) in done:
            continue
        with EventWriter(conn, run_id=run_id, variant=label, seed=seed) as writer:
            Simulation(world, labelled, seed, writer).run()


def run_sweep(conn: psycopg.Connection, config: dict[str, Any], world: World, seeds: range,
              run_id: uuid.UUID, *, resume: bool = False) -> list[tuple[str, dict[str, Any], str | None]]:
    baseline = load_variant(CONFIGS / config["baseline"])
    variants = [load_variant(CONFIGS / path) for path in sweep_variants(config)]
    per_cell = config.get("baseline_per_cell", False)
    done = completed(conn, run_id) if resume else frozenset()
    if not per_cell:
        run(conn, world, baseline, baseline.name, seeds, run_id, done)
    labelled = []
    for name, cell in named_cells(config):
        if per_cell:
            changed, _ = apply_cell(world, baseline, cell)
            validate(changed)
            run(conn, changed, baseline, cell_label(baseline.name, cell, name), seeds, run_id, done)
        for variant in variants:
            changed, varied = apply_cell(world, variant, cell)
            validate(changed)
            validate_variant(varied)
            label = cell_label(variant.name, cell, name)
            run(conn, changed, varied, label, seeds, run_id, done)
            labelled.append((label, cell, name))
    return labelled


def build_report(conn: Connection, config: dict[str, Any],
                 labelled: list[tuple[str, dict[str, Any], str | None]], run_id: uuid.UUID) -> dict[str, Any]:
    baseline = load_variant(CONFIGS / config["baseline"]).name
    per_cell = config.get("baseline_per_cell", False)
    shared = None if per_cell else per_seed(conn, run_id, baseline)
    report: dict[str, Any] = {
        "name": config["name"], "run_id": str(run_id), "data": "synthetic (simulator)",
        "baseline": baseline, "baseline_per_cell": per_cell,
        "parameters": config.get("parameters") or {"cell": [name for name, _ in named_cells(config)]},
        "baseline_means": {} if per_cell else {
            column: statistics.fmean(shared[column].values())
            for column, _, _ in MEASURES if shared[column]},
        "cells": [],
    }
    for label, cell, name in labelled:
        reference = per_seed(conn, run_id, cell_label(baseline, cell, name)) if per_cell else shared
        values = per_seed(conn, run_id, label)
        report["cells"].append({
            "variant": label, "parameters": cell if name is None else {"cell": name}, "settings": cell,
            "measures": {
                column: {"mean": statistics.fmean(values[column].values()),
                         "baseline_mean": statistics.fmean(reference[column].values())
                         if reference[column] else None,
                         "vs_baseline": paired(reference[column], values[column])}
                for column, _, _ in MEASURES if values[column]},
        })
    return report


def to_markdown(report: dict[str, Any]) -> str:
    names = [path.rsplit(".", 1)[-1] for path in report["parameters"]]
    lines = [
        f"# Sweep `{report['name']}`, run `{report['run_id']}`", "",
        f"Synthetic data from the simulator. Each row is the variant on a world with those "
        f"parameters, compared seed by seed with **{report['baseline']}** on "
        + ("the same world." if report.get("baseline_per_cell") else "the unmodified world.")
        + " Intervals are 95% t intervals on the mean per-seed difference.", "",
    ]
    for column, label, decimals in MEASURES:
        base = report["baseline_means"].get(column)
        lines += [f"## {label}", ""]
        if base is not None:
            lines += [f"{report['baseline']}: {base:.{decimals}f}", ""]
        lines += ["| " + " | ".join(names)
                  + f" | {report['baseline']} | Mean | Difference | 95% CI | Seeds up / down |",
                  "|" + "---|" * (len(names) + 5)]
        for cell in report["cells"]:
            measure = cell["measures"].get(column)
            if measure is None:
                continue
            diff = measure["vs_baseline"]
            reference = measure.get("baseline_mean")
            row = [str(v) for v in cell["parameters"].values()]
            row += ["" if reference is None else f"{reference:.{decimals}f}",
                    f"{measure['mean']:.{decimals}f}"]
            row += ["", "", ""] if diff is None else [
                f"{diff['mean_difference']:+.{decimals}f}",
                f"{diff['ci_low']:+.{decimals}f} to {diff['ci_high']:+.{decimals}f}",
                f"{diff['seeds_improved']} / {diff['seeds_worsened']}"]
            lines.append("| " + " | ".join(row) + " |")
        lines.append("")
    return "\n".join(lines)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("config", type=Path)
    parser.add_argument("--world", type=Path, default=None,
                        help="the world to vary; by default the one the config names, else world.yaml")
    parser.add_argument("--run-id", type=uuid.UUID, default=None)
    parser.add_argument("--resume", action="store_true",
                        help="continue a sweep stopped part-way, keeping every (variant, seed) it finished")
    args = parser.parse_args()

    url = os.environ.get("VAYORA_DB_URL")
    if not url:
        parser.error("VAYORA_DB_URL is not set")
    config = yaml.safe_load(args.config.read_text(encoding="utf-8"))
    run_id = args.run_id or uuid.uuid4()
    seeds = range(1, SEEDS_PER_VARIANT + 1)

    dsn = make_url(url).set(drivername="postgresql").render_as_string(hide_password=False)
    with psycopg.connect(dsn) as conn:
        labelled = run_sweep(conn, config, load_world(args.world or sweep_world(config)), seeds, run_id,
                             resume=args.resume)
    engine = create_engine(make_url(url).set(drivername="postgresql+psycopg"))
    with engine.connect() as conn:
        report = build_report(conn, config, labelled, run_id)

    REPORTS.mkdir(exist_ok=True)
    stem = REPORTS / f"sweep-{config['name']}-{run_id}"
    stem.with_suffix(".json").write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    stem.with_suffix(".md").write_text(to_markdown(report) + "\n", encoding="utf-8")
    print(to_markdown(report))


if __name__ == "__main__":
    main()
