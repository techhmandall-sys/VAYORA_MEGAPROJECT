import dataclasses
import uuid

import pytest
import yaml

from experiments.sweep import (CONFIGS, build_report, cell_label, cells, named_cells, run_sweep,
                               sweep_world, to_markdown)
from sim.config import apply_cell, load_variant, load_world, with_parameter

WORLD = load_world(CONFIGS / "world.yaml")
RELEASE = "demand.intervention_response.early_release_probability"
ANNOYED = "demand.intervention_response.annoyed_cancel_probability"


def test_a_dotted_path_replaces_one_value_and_leaves_the_original_alone():
    changed = with_parameter(WORLD, RELEASE, 0.9)

    assert changed.demand.intervention_response.early_release_probability == 0.9
    assert WORLD.demand.intervention_response.early_release_probability == 0.5
    assert changed.supply == WORLD.supply
    assert changed.demand.types == WORLD.demand.types
    assert with_parameter(WORLD, "supply.rides_per_day", 3).supply.rides_per_day == 3


def test_an_unknown_parameter_is_an_error():
    # The message names the part of the configuration the misspelt key was looked for in.
    with pytest.raises(KeyError, match="no such interventionresponse parameter"):
        with_parameter(WORLD, "demand.intervention_response.early_relase_probability", 0.9)
    with pytest.raises(KeyError):
        with_parameter(WORLD, "weather.rain", 1)


def test_the_grid_is_every_combination_with_a_name_that_spells_it_out():
    grid = cells({RELEASE: [0.25, 1.0], ANNOYED: [0.0, 0.05]})

    assert len(grid) == 4
    assert grid[0] == {RELEASE: 0.25, ANNOYED: 0.0}
    assert grid[-1] == {RELEASE: 1.0, ANNOYED: 0.05}
    assert cell_label("B4", grid[-1]) == \
        "B4[early_release_probability=1.0,annoyed_cancel_probability=0.05]"


def test_a_parameter_that_changes_the_baseline_gets_a_baseline_of_its_own(pg_conn, sa_conn):
    run_id = uuid.uuid4()
    world = dataclasses.replace(
        WORLD, demand=dataclasses.replace(WORLD.demand, searches_per_day=20))
    config = {"name": "t", "baseline": "variants/B3.yaml", "variant": "variants/B4.yaml",
              "baseline_per_cell": True, "parameters": {"supply.rides_per_day": [4, 12]}}

    labelled = run_sweep(pg_conn, config, world, range(1, 4), run_id)
    report = build_report(sa_conn, config, labelled, run_id)

    scarce, plenty = report["cells"]
    # More rides, more completed trips: the two baselines must differ, and each cell is
    # compared with its own.
    assert scarce["measures"]["per_100"]["baseline_mean"] < plenty["measures"]["per_100"]["baseline_mean"]
    assert report["baseline_means"] == {}
    variants = {row[0] for row in pg_conn.execute(
        "SELECT DISTINCT variant FROM events WHERE run_id = %s", (run_id,)).fetchall()}
    assert variants == {"B3[rides_per_day=4]", "B4[rides_per_day=4]",
                        "B3[rides_per_day=12]", "B4[rides_per_day=12]"}
    assert "on the same world" in to_markdown(report)


def test_every_shipped_sweep_names_real_variants_and_real_parameters():
    sweeps = sorted((CONFIGS / "sweeps").glob("*.yaml"))

    assert sweeps
    for path in sweeps:
        config = yaml.safe_load(path.read_text(encoding="utf-8"))
        load_variant(CONFIGS / config["baseline"])
        variant = load_variant(CONFIGS / config["variant"])
        world = load_world(sweep_world(config))
        for _, cell in named_cells(config):
            apply_cell(world, variant, cell)


def test_a_sweep_runs_each_cell_and_reports_it_against_the_baseline(pg_conn, sa_conn):
    run_id = uuid.uuid4()
    # A quieter world keeps this quick; the grid's two cells are the extremes.
    world = dataclasses.replace(
        WORLD, demand=dataclasses.replace(WORLD.demand, searches_per_day=20))
    config = {"name": "t", "baseline": "variants/B3.yaml", "variant": "variants/B4.yaml",
              "parameters": {RELEASE: [0.0, 1.0], ANNOYED: [0.0]}}

    labelled = run_sweep(pg_conn, config, world, range(1, 4), run_id)
    report = build_report(sa_conn, config, labelled, run_id)

    never, always = report["cells"]
    assert never["parameters"] == {RELEASE: 0.0, ANNOYED: 0.0}
    # Nobody ever releases: asking changes no outcome, so the cell equals the baseline.
    assert never["measures"]["per_100"]["vs_baseline"]["mean_difference"] == 0.0
    assert never["measures"]["late_share"]["vs_baseline"]["mean_difference"] == 0.0
    # Everyone destined to cancel releases when asked: fewer cancellations are late.
    assert always["measures"]["late_share"]["vs_baseline"]["mean_difference"] < 0
    assert always["measures"]["contact_rate"]["mean"] > 0
    assert report["baseline_means"]["contact_rate"] == 0.0

    markdown = to_markdown(report)
    assert "| early_release_probability | annoyed_cancel_probability | B3 | Mean |" in markdown
    assert "B3: " in markdown


BUDGET = "variant.intervention.budget.contacts_per_round"


def test_a_variant_parameter_changes_the_variant_and_not_the_world():
    b5 = load_variant(CONFIGS / "variants" / "B5.yaml")

    world, variant = apply_cell(WORLD, b5, {BUDGET: 7, RELEASE: 0.9})

    assert variant.intervention.budget.contacts_per_round == 7
    assert variant.intervention.survival_threshold == b5.intervention.survival_threshold
    assert b5.intervention.budget.contacts_per_round != 7
    assert world.demand.intervention_response.early_release_probability == 0.9
    with pytest.raises(KeyError, match="no such contactbudget parameter"):
        apply_cell(WORLD, b5, {"variant.intervention.budget.contacts_per_ruond": 7})
    # B4 has no budget to change.
    with pytest.raises(KeyError):
        apply_cell(WORLD, load_variant(CONFIGS / "variants" / "B4.yaml"), {BUDGET: 7})


def test_a_tighter_budget_sends_fewer_requests_against_one_shared_baseline(pg_conn, sa_conn):
    run_id = uuid.uuid4()
    config = {"name": "t", "baseline": "variants/B4.yaml", "variant": "variants/B5.yaml",
              "parameters": {BUDGET: [1, 50]}}

    labelled = run_sweep(pg_conn, config, WORLD, range(1, 3), run_id)
    report = build_report(sa_conn, config, labelled, run_id)

    tight, loose = report["cells"]
    assert tight["variant"] == "B5[contacts_per_round=1]"
    assert tight["measures"]["contact_rate"]["mean"] < loose["measures"]["contact_rate"]["mean"]
    assert tight["measures"]["contact_rate"]["mean"] < report["baseline_means"]["contact_rate"]
    variants = {row[0] for row in pg_conn.execute(
        "SELECT DISTINCT variant FROM events WHERE run_id = %s", (run_id,)).fetchall()}
    assert variants == {"B4", "B5[contacts_per_round=1]", "B5[contacts_per_round=50]"}


def test_a_named_cell_sets_several_values_at_once_and_is_stored_under_its_name():
    config = {"cells": [{"name": "scale=2", "set": {"demand.types.committed.weibull_scale_hours": 5000,
                                                     "demand.types.flexible.weibull_scale_hours": 800}}]}

    ((name, cell),) = named_cells(config)
    changed, _ = apply_cell(WORLD, load_variant(CONFIGS / "variants" / "B4.yaml"), cell)

    assert cell_label("B4", cell, name) == "B4[scale=2]"
    assert changed.demand.types["committed"].weibull_scale_hours == 5000
    assert changed.demand.types["flexible"].weibull_scale_hours == 800
    assert changed.demand.types["opportunistic"] == WORLD.demand.types["opportunistic"]
    assert WORLD.demand.types["committed"].weibull_scale_hours == 2500


def test_a_sweep_varies_the_world_its_config_names():
    assert sweep_world({}) == CONFIGS / "world.yaml"
    assert sweep_world({"world": "worlds/proximity_w0.5.yaml"}) == CONFIGS / "worlds" / "proximity_w0.5.yaml"
