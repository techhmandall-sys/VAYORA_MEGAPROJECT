import math
import random
import statistics

import pytest

from sim.hazard import (
    cancellation_time,
    cumulative_hazard,
    proximity_cancellation_time,
    proximity_hazard_by_departure,
)


def _time(exposure, *, shock_time=None, multiplier=1.0, shape=1.5, scale=100.0):
    return cancellation_time(
        exposure, shape=shape, scale=scale, shock_time=shock_time, shock_multiplier=multiplier)


def test_without_a_shock_it_is_the_weibull_quantile():
    # S(t) = exp(-(t/scale)^shape); at t = scale the cumulative hazard is exactly 1.
    assert _time(1.0) == pytest.approx(100.0)
    assert _time(0.0) == 0.0
    assert _time(2.0 ** 1.5) == pytest.approx(200.0)


def test_sampled_times_have_the_weibull_median():
    rng = random.Random(1)
    times = [_time(rng.expovariate(1.0), shape=1.8, scale=110.0) for _ in range(40_000)]

    assert statistics.median(times) == pytest.approx(110.0 * math.log(2) ** (1 / 1.8), rel=0.02)


def test_a_shock_after_the_cancellation_changes_nothing():
    assert _time(1.0, shock_time=150.0, multiplier=15.0) == pytest.approx(_time(1.0))


def test_a_shock_before_the_cancellation_brings_it_forward_but_not_before_the_shock():
    unshocked = _time(1.0)
    shocked = _time(1.0, shock_time=40.0, multiplier=15.0)

    assert 40.0 < shocked < unshocked


def test_a_multiplier_of_one_is_no_shock_at_all():
    assert _time(1.0, shock_time=40.0, multiplier=1.0) == pytest.approx(_time(1.0))


def test_time_is_continuous_and_increasing_in_exposure_across_the_shock():
    at_shock = (40.0 / 100.0) ** 1.5
    just_before = _time(at_shock - 1e-9, shock_time=40.0, multiplier=15.0)
    just_after = _time(at_shock + 1e-9, shock_time=40.0, multiplier=15.0)

    assert just_before == pytest.approx(40.0, abs=1e-4)
    assert just_after == pytest.approx(40.0, abs=1e-4)
    assert just_before < just_after


def test_negative_exposure_is_rejected():
    with pytest.raises(ValueError):
        _time(-0.1)


def _near(exposure, *, hours_left=72.0, rate=0.02, scale_hours=24.0):
    return proximity_cancellation_time(
        exposure, hours_left=hours_left, rate=rate, scale_hours=scale_hours)


def _cumulative(u, *, hours_left=72.0, rate=0.02, scale_hours=24.0, steps=20_000):
    """The proximity hazard integrated numerically from acceptance to u hours after it."""
    width = u / steps
    return sum(rate * math.exp(-(hours_left - (i + 0.5) * width) / scale_hours) * width
               for i in range(steps))


@pytest.mark.parametrize("exposure", [0.01, 0.1, 0.3, 0.45])
def test_the_proximity_time_is_where_the_integrated_hazard_reaches_the_exposure(exposure):
    time = _near(exposure)

    assert 0 < time < 72.0
    assert _cumulative(time) == pytest.approx(exposure, rel=1e-6)


def test_an_exposure_beyond_the_hazard_left_before_departure_never_cancels():
    at_departure = 0.02 * 24.0 * (1 - math.exp(-72.0 / 24.0))

    assert _near(at_departure * 0.999) == pytest.approx(72.0, abs=0.5)
    assert _near(at_departure) is None
    assert _near(at_departure * 2) is None


def test_no_proximity_rate_or_no_time_left_never_cancels():
    assert _near(0.01, rate=0.0) is None
    assert _near(0.01, hours_left=0.0) is None


def test_sampled_proximity_cancellations_bunch_up_near_departure():
    rng = random.Random(2)
    times = [t for t in (_near(rng.expovariate(1.0)) for _ in range(20_000)) if t is not None]
    first_day = sum(1 for t in times if t < 24.0)
    last_day = sum(1 for t in times if t > 48.0)

    # Integrated hazard 0.48 * (e^-2 - e^-3) = 0.041 in the first day after acceptance and
    # 0.48 * (1 - e^-1) = 0.303 in the last day before departure: about 5.6 times as many
    # cancellations in the last day once survival to it is allowed for.
    assert last_day > 4 * first_day > 0


def test_a_negative_proximity_exposure_is_rejected():
    with pytest.raises(ValueError):
        _near(-0.1)


@pytest.mark.parametrize("exposure", [0.05, 0.2, 0.9, 3.0])
@pytest.mark.parametrize("shock_time", [None, 30.0])
def test_the_cumulative_hazard_is_what_the_sampler_inverts(exposure, shock_time):
    time = _time(exposure, shock_time=shock_time, multiplier=15.0)

    assert cumulative_hazard(time, shape=1.5, scale=100.0, shock_time=shock_time,
                             shock_multiplier=15.0) == pytest.approx(exposure)


def test_the_proximity_hazard_by_departure_is_the_integral_to_departure():
    assert proximity_hazard_by_departure(72.0, rate=0.02, scale_hours=24.0) == pytest.approx(
        _cumulative(72.0), rel=1e-6)
    assert proximity_hazard_by_departure(72.0, rate=0.0, scale_hours=24.0) == 0.0
