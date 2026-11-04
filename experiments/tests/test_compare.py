import uuid

import pytest
from scipy import stats

from experiments.analysis.compare import (bootstrap_interval, build_report, equivalence, holm,
                                          load_analysis, paired, to_markdown)
from vayora_events import EventWriter
from sim.config import load_variant, load_world
from sim.run import CONFIGS
from sim.simulator import Simulation


def test_paired_difference_and_interval_match_hand_computed_values():
    baseline = {1: 10.0, 2: 12.0, 3: 11.0, 4: 13.0}
    variant = {1: 11.0, 2: 14.0, 3: 12.0, 4: 16.0, 5: 99.0}  # seed 5 has no pair

    result = paired(baseline, variant)

    # Differences 1, 2, 1, 3: mean 1.75, sd 0.9574, t(0.975, 3) = 3.1824.
    assert result["seeds"] == 4
    assert result["mean_difference"] == pytest.approx(1.75)
    assert result["ci_low"] == pytest.approx(1.75 - 3.1824 * 0.9574 / 2, abs=1e-3)
    assert result["ci_high"] == pytest.approx(1.75 + 3.1824 * 0.9574 / 2, abs=1e-3)
    assert (result["seeds_improved"], result["seeds_worsened"]) == (4, 0)
    assert 0 < result["wilcoxon_p"] <= 1


def test_identical_variants_differ_by_exactly_nothing():
    same = {1: 10.0, 2: 12.0, 3: 11.0}

    result = paired(same, dict(same))

    assert (result["mean_difference"], result["ci_low"], result["ci_high"]) == (0.0, 0.0, 0.0)
    assert result["wilcoxon_p"] == 1.0


def test_one_shared_seed_is_too_few_to_compare():
    assert paired({1: 1.0}, {1: 2.0}) is None


def test_bootstrap_interval_is_reproducible_and_brackets_the_mean():
    diffs = [0.3, -0.1, 0.4, 0.2, 0.0, 0.5, 0.1, 0.2]

    first = bootstrap_interval(diffs, 5000, 7)
    again = bootstrap_interval(diffs, 5000, 7)

    assert first == again
    assert first[0] < sum(diffs) / len(diffs) < first[1]
    # Resampled means can never leave the range of the differences.
    assert min(diffs) <= first[0] and first[1] <= max(diffs)


def test_bootstrap_of_identical_differences_has_no_width():
    assert bootstrap_interval([0.25] * 6, 1000, 1) == pytest.approx((0.25, 0.25))


def test_equivalence_matches_two_hand_computed_one_sided_tests():
    # Differences 0.02, 0, 0.04, 0.02: mean 0.02, sd 0.016330, standard error 0.008165, 3 df.
    diffs = [0.02, 0.0, 0.04, 0.02]

    result = equivalence(diffs, margin=0.1, alpha=0.05)

    error = 0.0163299 / 2
    expected = max(stats.t.sf((0.02 + 0.1) / error, 3), stats.t.cdf((0.02 - 0.1) / error, 3))
    assert result["tost_p"] == pytest.approx(expected, rel=1e-4)
    assert result["equivalent"] is True and result["margin"] == 0.1


def test_a_difference_near_the_margin_is_not_equivalent():
    result = equivalence([0.30, 0.28, 0.33, 0.31, 0.29], margin=0.1, alpha=0.05)

    assert result["equivalent"] is False and result["tost_p"] > 0.5


def test_identical_variants_are_equivalent_without_dividing_by_zero():
    assert equivalence([0.0, 0.0, 0.0], margin=0.1, alpha=0.05) == {
        "margin": 0.1, "tost_p": 0.0, "equivalent": True}


def test_holm_matches_hand_computed_adjustment():
    # Sorted 0.01, 0.03, 0.04: times 3, 2, 1 gives 0.03, 0.06, 0.04, then made monotone.
    assert holm({"a": 0.01, "b": 0.04, "c": 0.03}) == pytest.approx({"a": 0.03, "b": 0.06, "c": 0.06})


def test_holm_never_exceeds_one():
    assert holm({"a": 0.6, "b": 0.7}) == {"a": 1.0, "b": 1.0}


def test_analysis_settings_are_in_configuration():
    analysis = load_analysis()

    assert analysis["equivalence_margin"] == 0.10
    assert analysis["bootstrapped_measures"][0] == "per_100"


def test_a_real_run_is_compared_from_the_event_log(pg_conn, sa_conn):
    run_id = uuid.uuid4()
    world = load_world(CONFIGS / "world.yaml")
    for name in ("B0", "B4"):
        variant = load_variant(CONFIGS / "variants" / f"{name}.yaml")
        for seed in (1, 2, 3):
            with EventWriter(pg_conn, run_id=run_id, variant=name, seed=seed) as writer:
                Simulation(world, variant, seed, writer).run()

    report = build_report(sa_conn, run_id, "B0", ["B4"])

    b0, b4 = report["variants"]["B0"], report["variants"]["B4"]
    assert b0["per_100"]["seeds"] == b4["per_100"]["seeds"] == 3
    assert b0["per_100"]["vs_baseline"] is None
    assert b4["per_100"]["vs_baseline"]["seeds"] == 3
    # B0 never contacts anyone; B4 does.
    assert b0["contact_rate"]["mean"] == 0.0
    assert b4["contact_rate"]["mean"] > 0.0
    markdown = to_markdown(report)
    assert "Completed rides per 100 searches" in markdown and "| B4 | 3 |" in markdown
    # The analysis plan: bootstrap and equivalence on the primary metric, Holm across its family.
    contrast = b4["per_100"]["vs_baseline"]
    assert contrast["bootstrap_ci_low"] <= contrast["mean_difference"] <= contrast["bootstrap_ci_high"]
    assert {"tost_p", "equivalent", "holm_p"} <= set(contrast)
    assert contrast["holm_p"] == contrast["wilcoxon_p"]  # a family of one
    assert "bootstrap_ci_low" in b4["seats_per_100"]["vs_baseline"]
    assert "holm_p" not in b4["seats_per_100"]["vs_baseline"]
    assert report["analysis"]["equivalence_margin"] == 0.10
    assert "## Analysis plan: bootstrap, Holm and equivalence" in markdown
    # Seats travelled can never be fewer than completed bookings.
    assert b4["seats_per_100"]["mean"] >= b4["per_100"]["mean"]
