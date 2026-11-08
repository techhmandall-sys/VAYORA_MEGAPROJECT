from datetime import datetime, timedelta, timezone

import pytest

from experiments.analysis.ceiling import (
    cells_from,
    ceiling_seats,
    ceiling_terms,
    classify,
    exploratory,
    judge,
    load_x3,
    seat_differences,
)

T0 = datetime(2026, 1, 5, tzinfo=timezone.utc)
H = timedelta(hours=1)
LATE = timedelta(hours=24)


def _asked(search, seats=1, accepted=1, asked=10, departs=72, seed=1):
    return {"seed": seed, "search_id": str(search), "ride_id": "9", "seats": seats,
            "accepted_at": T0 + accepted * H, "asked_at": T0 + asked * H, "departure": T0 + departs * H}


def _twin(search, cancelled=None, driver=False, started=False, accepted=1, seed=1):
    key = (seed, str(search), "9", T0 + accepted * H)
    return key, (None if cancelled is None else T0 + cancelled * H, driver, started)


def test_each_asked_booking_takes_its_twins_fate():
    twins = dict([_twin(1, cancelled=60), _twin(2, cancelled=30), _twin(3, started=True),
                  _twin(4, driver=True), _twin(5, cancelled=5), _twin(6, started=True, accepted=2)])
    asked = [_asked(1, seats=2), _asked(2), _asked(3, seats=3), _asked(4), _asked(5), _asked(6), _asked(7)]

    classes = classify(asked, twins, LATE)[1]

    # 1 cancels 12 h before departure (late); 2 cancels 42 h before, after the ask (early); 3 travels;
    # 4's ride is withdrawn; 5's twin cancelled before the ask, 6's was accepted at another moment and
    # 7 has none: the worlds had diverged, so all three are unmatched.
    assert classes == {"late": 2, "early": 1, "travels": 3, "withdrawn": 1, "unmatched": 3}


def test_the_ceiling_is_eq_17_and_shares_out_or_assumes_the_worst_for_unmatched_bookings():
    classes = {"late": 10, "early": 20, "travels": 50, "withdrawn": 0, "unmatched": 0}
    by_hand = 0.5 * (0.9 - 0.6) * 10 + 0.5 * (1 - 0.9) * 20 - 0.02 * (1 - 0.9) * 50

    assert ceiling_seats(classes, 0.5, 0.02, 0.9, 0.6) == pytest.approx(by_hand)

    with_gap = dict(classes, unmatched=80)
    assert ceiling_seats(with_gap, 0.5, 0.02, 0.9, 0.6) == pytest.approx(2 * by_hand)
    assert ceiling_seats(with_gap, 0.5, 0.02, 0.9, 0.6, conservative=True) == pytest.approx(
        by_hand + 0.5 * 0.3 * 80)


def _ride(standing=0, released=0, refilled=0, refilled_standing=0, driver=False):
    return {"standing_seats": standing, "released_seats": released, "refilled_seats": refilled,
            "refilled_standing_seats": refilled_standing, "driver_cancelled": driver}


def test_seat_differences_leave_out_rides_withdrawn_in_either_run():
    policy = {"1": _ride(standing=3, released=1, refilled=1, refilled_standing=1), "2": _ride(standing=2),
              "3": _ride(released=2, driver=True)}
    baseline = {"1": _ride(standing=2, released=1), "3": _ride(standing=4), "4": _ride(released=1)}

    assert seat_differences(policy, baseline) == {
        "standing_seats": 3, "released_seats": -1, "refilled_seats": 1, "refilled_standing_seats": 1}


def _row(name, low, residual_high, ceiling, rides, observed):
    return {"name": name, "standing": {"ci_low": low}, "ceiling_central": ceiling,
            "residual_standing": {"ci_high": residual_high}, "ceiling_rides": rides,
            "completed": {"mean_difference": observed}}


CONFIG = {"cells_per_allowed_breach": 20, "spearman_threshold": 0.8}


def test_the_verdicts_follow_the_written_readings():
    rows = [_row(f"c{k}", -0.1, 0.05, 0.2, 0.01 * k, 0.01 * k + 0.001) for k in range(20)]
    rows.append(_row("over", 0.3, 0.05, 0.2, 0.5, 0.6))

    verdict = judge(rows, CONFIG)

    assert verdict["H3.1"]["breaches"] == ["over"] and verdict["H3.1"]["holds"]
    assert verdict["H3.2"]["holds"] and verdict["H3.3"]["holds"]


def test_two_breaches_in_twenty_cells_a_negative_residual_or_unrelated_ranks_are_reported():
    rows = [_row(f"c{k}", 0.3 if k < 2 else -0.1, -0.01 if k == 5 else 0.05, 0.2, 0.01 * k, (-1) ** k * k)
            for k in range(20)]

    verdict = judge(rows, CONFIG)

    assert not verdict["H3.1"]["holds"]
    assert verdict["H3.2"]["below_zero"] == ["c5"] and not verdict["H3.2"]["holds"]
    assert not verdict["H3.3"]["holds"]


def test_the_shipped_cells_cover_the_ladders_x1_and_every_sweep_cell():
    cells = cells_from(load_x3())

    assert len(cells) == 4 + 1 + 6 + 9 + 3 + 4 + 4 + 3 + 3 * 3  # the last, X5's three sweeps
    budget = [c for c in cells if c.group == "contact-budget"]
    assert {c.baseline for c in budget} == {"B3"} and {c.baseline_run[-3:] for c in budget} == {"004"}
    response = next(c for c in cells if c.policy.startswith("B4[early_release_probability=1.0,annoyed"))
    assert response.rho == 1.0


def test_the_ceiling_is_the_sum_of_its_three_terms():
    classes = {"late": 10, "early": 20, "travels": 50, "withdrawn": 5, "unmatched": 0}
    terms = ceiling_terms(classes, 0.5, 0.02, 0.9, 0.6)

    assert terms["travels"] < 0 < terms["late"]
    assert sum(terms.values()) == pytest.approx(ceiling_seats(classes, 0.5, 0.02, 0.9, 0.6))


def test_exploratory_readings_count_distinct_cells_and_the_exact_residuals_sign():
    def row(name, group, standing, ceiling, residual_low, residual_high):
        return {"name": name, "group": group, "standing": {"mean_difference": standing},
                "ceiling_central": ceiling, "ceiling_rides": ceiling, "completed": {"mean_difference": standing},
                "residual": {"ci_low": residual_low, "ci_high": residual_high}}

    rows = [row("a", "ladder", 0.1, 0.2, 0.01, 0.1), row("a again", "sweep", 0.1, 0.2, 0.01, 0.1),
            row("b", "ladder", 0.3, 0.4, -0.1, 0.1), row("c", "demand-density", 0.5, 0.3, -0.2, -0.1)]

    e = exploratory(rows)

    assert e["distinct_cells"] == 3
    assert e["residual_when_requested"] == {"above_zero": 2, "across_zero": 1, "below_zero": ["c"]}
