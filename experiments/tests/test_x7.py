import yaml

from experiments.analysis.joint import CONFIGS, SCALE, draw, judge, load_x7, settings
from experiments.sweep import named_cells


def test_the_hypercube_is_fixed_by_its_seed_and_covers_each_range_once_per_stratum():
    config = load_x7()
    points = draw(config, rounded=False)

    assert points == draw(config, rounded=False)
    assert len(points) == config["points"]
    assert all(abs(r[k] - u[k]) <= 0.5 * 10 ** -config["decimals"] + 1e-12
               for r, u in zip(draw(config), points, strict=True) for k in r)
    for name, (low, high) in config["ranges"].items():
        values = sorted(p[name] for p in points)
        assert low <= values[0] and values[-1] <= high
        # A Latin hypercube puts exactly one point in each of the n equal slices of every range.
        width = (high - low) / len(points)
        slices = sorted(min(int((v - low) / width), len(points) - 1) for v in values)
        assert slices == list(range(len(points)))


def test_a_point_scales_every_types_weibull_scale_and_sets_the_rest_directly():
    point = {"supply.rides_per_day": 9.5, SCALE: 2.0}

    cell = settings(point, 3)

    assert cell["supply.rides_per_day"] == 9.5
    assert cell["demand.types.committed.weibull_scale_hours"] == 5000
    assert cell["demand.types.opportunistic.weibull_scale_hours"] == 220
    assert SCALE not in cell


def test_the_written_sweeps_hold_every_point_once_and_in_order():
    config = load_x7()
    names = []
    for part in config["parts"]:
        sweep = yaml.safe_load((CONFIGS / part["config"]).read_text(encoding="utf-8"))
        assert sweep["variants"] == config["variants"] and sweep["baseline_per_cell"]
        names += [name for name, _ in named_cells(sweep)]
    assert names == [f"p{n:02d}" for n in range(1, config["points"] + 1)]
    first = yaml.safe_load((CONFIGS / config["parts"][0]["config"]).read_text(encoding="utf-8"))["cells"][0]
    assert first["set"] == settings(draw(config)[0], config["decimals"])


def _point(name, oracle, equivalent):
    return {"point": name, "oracle": {"mean_difference": oracle}, "b4_equivalence": {"equivalent": equivalent}}


def test_the_verdicts_follow_the_written_readings():
    config = load_x7()
    # p3's B4 is out of the margin, but its oracle gain is above the threshold, so H7.1 does not judge it.
    verdict = judge([_point("p1", 0.1, True), _point("p2", 0.19, True), _point("p3", 0.3, False)], config)
    assert verdict["H7.1"]["holds"] and verdict["H7.1"]["points_judged"] == ["p1", "p2"]
    assert verdict["H7.2"]["holds"]

    verdict = judge([_point("p1", 0.1, False), _point("p2", 0.6, True)], config)
    assert verdict["H7.1"]["not_equivalent"] == ["p1"] and verdict["H7.2"]["over_cap"] == ["p2"]
