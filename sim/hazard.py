"""The ground-truth cancellation process.

A booking's hazard is Weibull in hours since it was accepted. An unobservable shock
may hit at some moment; from then on the hazard is multiplied. Cox PH and
gradient-boosted survival models cannot represent this exactly, which is deliberate
(research integrity rule 2).

A world may also give it a second, independent hazard tied to the time left before
departure (`proximity_cancellation_time`); the booking is cancelled by whichever comes first.
"""

from __future__ import annotations

import math


def cancellation_time(
    exposure: float,
    *,
    shape: float,
    scale: float,
    shock_time: float | None,
    shock_multiplier: float,
) -> float:
    """Hours after acceptance at which the booking would cancel.

    Inverse-transform sampling: `exposure` is a draw from Exp(1) and the result is the
    time at which the cumulative hazard reaches it. The caller compares the result with
    the time left until departure; a later time means the booking survives.

    Cumulative hazard is (t / scale) ** shape up to the shock and grows
    `shock_multiplier` times as fast after it.
    """
    if exposure < 0:
        raise ValueError("exposure must be non-negative")
    if shock_time is not None:
        at_shock = (shock_time / scale) ** shape
        if exposure > at_shock:
            exposure = at_shock + (exposure - at_shock) / shock_multiplier
    return scale * exposure ** (1.0 / shape)


def cumulative_hazard(
    hours: float,
    *,
    shape: float,
    scale: float,
    shock_time: float | None,
    shock_multiplier: float,
) -> float:
    """The cumulative hazard `cancellation_time` inverts, at `hours` after acceptance.

    exp(-cumulative_hazard(t)) is the chance a booking is not cancelled by this hazard within t
    hours, given its shock time.
    """
    weibull = (hours / scale) ** shape
    if shock_time is not None and hours > shock_time:
        at_shock = (shock_time / scale) ** shape
        return at_shock + shock_multiplier * (weibull - at_shock)
    return weibull


def proximity_hazard_by_departure(hours_left: float, *, rate: float, scale_hours: float) -> float:
    """The cumulative hazard tied to departure from acceptance, `hours_left` out, to departure."""
    if rate <= 0 or hours_left <= 0:
        return 0.0
    return rate * scale_hours * (1.0 - math.exp(-hours_left / scale_hours))


def proximity_cancellation_time(
    exposure: float,
    *,
    hours_left: float,
    rate: float,
    scale_hours: float,
) -> float | None:
    """Hours after acceptance at which a hazard tied to departure would cancel the booking.

    The hazard is ``rate * exp(-v / scale_hours)`` with v the hours left before departure, so it
    rises as departure nears. From acceptance, when `hours_left` remain, the cumulative hazard
    after u hours is ``rate * scale_hours * (exp(-(hours_left - u) / scale_hours) -
    exp(-hours_left / scale_hours))``; setting it equal to `exposure`, a draw from Exp(1), gives
    the time in closed form. Returns None when the cumulative hazard at departure is below
    `exposure`: this hazard alone does not cancel the booking.
    """
    if exposure < 0:
        raise ValueError("exposure must be non-negative")
    if rate <= 0 or hours_left <= 0:
        return None
    if exposure >= proximity_hazard_by_departure(hours_left, rate=rate, scale_hours=scale_hours):
        return None
    at_acceptance = math.exp(-hours_left / scale_hours)
    return hours_left + scale_hours * math.log(exposure / (rate * scale_hours) + at_acceptance)
