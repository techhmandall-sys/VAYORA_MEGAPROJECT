from experiments.analysis.robustness import judge, load_x5, sweep_cells


def _cell(name, *, equivalent=True, low=0.1, h5_2=False):
    return {"sweep": "s", "cell": name, "equivalence": {"equivalent": equivalent}, "difference": {"ci_low": low},
            "h5_2": h5_2}


def test_the_verdicts_follow_the_written_readings():
    reconfirmation = [_cell("a"), _cell("b")]
    ranking = [_cell("6", h5_2=True), _cell("20", h5_2=True), _cell("scale=3", low=-0.2)]

    verdict = judge(reconfirmation, ranking)

    # The scale cells are reported beside H5.2, not judged by it.
    assert verdict["H5.1"]["holds"] and verdict["H5.2"]["holds"]


def test_a_cell_out_of_the_margin_or_not_above_zero_is_reported_as_such():
    verdict = judge([_cell("a"), _cell("b", equivalent=False)], [_cell("6", low=-0.01, h5_2=True)])

    assert verdict["H5.1"]["not_equivalent"] == ["s b"] and not verdict["H5.1"]["holds"]
    assert verdict["H5.2"]["not_above_zero"] == ["s 6"] and not verdict["H5.2"]["holds"]


def test_the_shipped_sweeps_name_each_cell_and_its_own_baseline():
    config = load_x5()
    supply = sweep_cells(config["reconfirmation"][0])
    scale = sweep_cells(config["reconfirmation"][2])

    assert [c["variant"] for c in supply] == ["B4[rides_per_day=6]", "B4[rides_per_day=12]", "B4[rides_per_day=20]"]
    assert [c["baseline"] for c in supply] == ["B3[rides_per_day=6]", "B3[rides_per_day=12]", "B3[rides_per_day=20]"]
    assert [c["variant"] for c in scale] == ["B4[scale=1]", "B4[scale=2]", "B4[scale=3]"]
    assert {c["world"] for c in scale} == {"worlds/proximity_w0.5.yaml"}
    assert [c["h5_2"] for e in config["ranking"] for c in sweep_cells(e)] == [True] * 3 + [False] * 3
