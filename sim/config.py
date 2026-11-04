"""Loads experiments/configs YAML into immutable, validated objects.

Loading is strict: an unknown or missing key is an error, so a typo in a config can
never silently fall back to a default hidden in Python.
"""

from __future__ import annotations

import dataclasses
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Any, Mapping

import yaml

from sim.frozen import LATENT_TYPES


class ConfigError(ValueError):
    pass


@dataclass(frozen=True)
class PassengerType:
    share: float
    lead_days_mean: float
    book_probability: float
    weibull_shape: float
    weibull_scale_hours: float
    no_show_probability: float
    # How much a last-mile gap speeds up this type's cancellation: the Weibull scale is
    # divided by (1 + last_mile_sensitivity * offset_km), so 0 leaves the type exactly as
    # before. Never read by anything a feature could see; only the distance is observable.
    last_mile_sensitivity: float = 0.0
    # This type's hazard at the moment of departure from risk tied to departure (per hour);
    # see Proximity. 0 leaves the type exactly as in world h3.
    proximity_rate: float = 0.0


@dataclass(frozen=True)
class Shock:
    rate_per_day: float
    hazard_multiplier: float


@dataclass(frozen=True)
class InterventionResponse:
    """How a passenger reacts to being asked to reconfirm a booking."""

    early_release_probability: float
    annoyed_cancel_probability: float
    response_delay_mean_hours: float


@dataclass(frozen=True)
class Retry:
    """Whether a passenger who was left without a seat searches again."""

    probability: float
    delay_mean_hours: float
    max_attempts: int


@dataclass(frozen=True)
class LastMile:
    """The gap between a passenger's start and the stop they would board at.

    Drawn log-normal in metres, independent of the ride chosen: it is a property of
    where the passenger is, not of the platform (feature 91 estimates it per candidate;
    this is the ground truth it would be estimating). A non-walk access option (the
    simulator's stand-in for feature 91's rickshaw or bus) is offered beyond
    offer_beyond_metres, mirroring core-api's vayora.rickshaw.offer-beyond-metres.
    """

    offset_metres_mean: float
    offset_metres_sigma: float
    offer_beyond_metres: float


@dataclass(frozen=True)
class FlexibleBooking:
    """Who chose a flexible booking, and so is rebooked at once when their driver withdraws.

    The platform's own rule (features 81 and 88): the closest other open ride with the seats,
    leaving within window_hours of the withdrawn one.
    """

    share: float
    window_hours: float


@dataclass(frozen=True)
class Proximity:
    """Cancellation risk tied to the time left before departure (experiment X1).

    On real airline tickets cancellations come more often as departure nears; the Weibull
    hazard counts only time since acceptance. Here a booking can also be cancelled by a hazard
    that depends only on the hours v left before its ride leaves:
    ``proximity_rate * exp(-v / scale_hours)``, with each type's own proximity_rate. `share` is
    the part of each type's Weibull hazard moved away: that hazard is multiplied by
    (1 - share). share 0 with every proximity_rate 0 is world h3, draw for draw.
    """

    share: float
    scale_hours: float


@dataclass(frozen=True)
class Supply:
    rides_per_day: float
    departure_hours: Mapping[int, float]
    seats: Mapping[int, float]
    publish_lead_days_min: float
    publish_lead_days_max: float
    trip_duration_hours: float
    accept_probability: float
    response_delay_mean_hours: float
    withdraw_probability: float


@dataclass(frozen=True)
class Demand:
    searches_per_day: float
    population: int
    departure_hours: Mapping[int, float]
    departure_tolerance_hours: float
    # What leaving away from the wanted time costs a passenger (experiment X2): the chance of
    # booking the ride offered is the type's book_probability times exp(-cost * gap), the gap
    # in hours. 0 is world h3 exactly: the same draw decides against the same probability.
    time_deviation_cost_per_hour: float
    party_size: Mapping[int, float]
    types: Mapping[str, PassengerType]
    shock: Shock
    intervention_response: InterventionResponse
    retry: Retry
    flexible_booking: FlexibleBooking
    last_mile: LastMile
    proximity: Proximity


@dataclass(frozen=True)
class World:
    start: datetime
    supply: Supply
    demand: Demand


@dataclass(frozen=True)
class ContactBudget:
    """Limits on how many reconfirmation requests one scoring round may send."""

    contacts_per_round: int
    max_contacts_per_ride: int
    # Seats asked about among rides leaving on the same day.
    max_seats_asked_per_departure_day: int
    # A release this long before departure, or longer, counts in full; later ones
    # count for proportionally less. An assumption, not an estimate.
    refill_horizon_hours: float
    solver_time_limit_seconds: float
    # Who chooses within the limits. "scheduler": the CP-SAT contact scheduler, which
    # weighs each booking's score and time left. "random": bookings taken in a random
    # order until a limit stops them, to measure whether the scheduler beats chance.
    chooser: str = "scheduler"


@dataclass(frozen=True)
class Intervention:
    """Ask a booking to reconfirm when its predicted survival falls below a threshold."""

    survival_threshold: float
    # No request is sent closer to departure than this: a seat released later than
    # that has little chance of being refilled.
    min_hours_before_departure: float
    scoring_interval_hours: float
    # None: everyone below the threshold is asked. Otherwise the scheduler chooses
    # among them within these limits.
    budget: ContactBudget | None = None
    # Who is asked. "model": bookings the model scores below the threshold. "oracle":
    # exactly the bookings the simulator knows will be cancelled late. The oracle reads
    # ground truth no platform could have; it exists only to measure the most any
    # reconfirmation policy could gain, and must never be reported as a method.
    selector: str = "model"


@dataclass(frozen=True)
class Variant:
    name: str
    ranking: str
    # Model file in intel/app/hazard/models, without the extension.
    hazard_model: str | None = None
    intervention: Intervention | None = None


def load_world(path: Path) -> World:
    raw = _read(path)
    _require_keys(raw, {"start", "supply", "demand"}, path.name)

    start = datetime.fromisoformat(str(raw["start"]))
    if start.tzinfo is None:
        raise ConfigError("start must carry a UTC offset")

    demand_raw = dict(raw["demand"])
    types_raw = demand_raw.pop("types", None) or {}
    shock_raw = demand_raw.pop("shock", None) or {}
    response_raw = demand_raw.pop("intervention_response", None) or {}
    retry_raw = demand_raw.pop("retry", None) or {}
    flexible_raw = demand_raw.pop("flexible_booking", None) or {}
    last_mile_raw = demand_raw.pop("last_mile", None) or {}
    proximity_raw = demand_raw.pop("proximity", None) or {}
    if set(types_raw) != set(LATENT_TYPES):
        raise ConfigError(f"demand.types must be exactly {sorted(LATENT_TYPES)}")
    types = {
        name: _build(PassengerType, types_raw[name], f"demand.types.{name}")
        for name in LATENT_TYPES
    }
    demand = _build(
        Demand,
        {**demand_raw, "types": types, "shock": _build(Shock, shock_raw, "demand.shock"),
         "intervention_response": _build(
             InterventionResponse, response_raw, "demand.intervention_response"),
         "retry": _build(Retry, retry_raw, "demand.retry"),
         "flexible_booking": _build(FlexibleBooking, flexible_raw, "demand.flexible_booking"),
         "last_mile": _build(LastMile, last_mile_raw, "demand.last_mile"),
         "proximity": _build(Proximity, proximity_raw, "demand.proximity")},
        "demand",
    )
    world = World(start=start, supply=_build(Supply, raw["supply"], "supply"), demand=demand)
    validate(world)
    return world


def load_variant(path: Path) -> Variant:
    raw = _read(path)
    _require_keys(raw, {"name", "ranking"}, path.name, optional={"hazard_model", "intervention"})
    intervention = raw.get("intervention")
    if intervention is not None:
        if not isinstance(intervention, Mapping):
            raise ConfigError(f"{path.name}: intervention must be a mapping")
        budget = intervention.get("budget")
        intervention = _build(Intervention, {"selector": "model", **intervention, "budget": None},
                              f"{path.name}: intervention")
        if budget is not None:
            budget = _build(ContactBudget, {"chooser": "scheduler", **budget}, f"{path.name}: intervention.budget")
            intervention = dataclasses.replace(intervention, budget=budget)
    variant = Variant(raw["name"], raw["ranking"], raw.get("hazard_model"), intervention)
    try:
        validate_variant(variant)
    except ConfigError as error:
        raise ConfigError(f"{path.name}: {error}") from None
    return variant


def validate_variant(variant: Variant) -> None:
    """Rejects a variant the simulator could not run, as loaded or as a sweep changed it."""
    intervention = variant.intervention
    if intervention is not None:
        if intervention.selector not in ("model", "oracle"):
            raise ConfigError("intervention.selector must be model or oracle")
        budget = intervention.budget
        if budget is not None:
            if min(budget.contacts_per_round, budget.max_contacts_per_ride,
                   budget.max_seats_asked_per_departure_day) < 1:
                raise ConfigError("intervention.budget limits must be at least 1")
            if budget.refill_horizon_hours <= 0 or budget.solver_time_limit_seconds <= 0:
                raise ConfigError("intervention.budget durations must be positive")
            if budget.chooser not in ("scheduler", "random"):
                raise ConfigError("intervention.budget.chooser must be scheduler or random")
        if not 0 <= intervention.survival_threshold <= 1:
            raise ConfigError("intervention.survival_threshold must be between 0 and 1")
        if intervention.scoring_interval_hours <= 0 or intervention.min_hours_before_departure < 0:
            raise ConfigError("intervention intervals must be positive")
    needs_model = variant.ranking == "predicted_survival" or variant.intervention is not None
    if needs_model and variant.hazard_model is None:
        raise ConfigError("this variant needs a hazard_model")


def validate(world: World) -> None:
    """Rejects a world the simulator could not run or that makes no sense."""
    supply, demand = world.supply, world.demand
    for name, value in [
        ("supply.rides_per_day", supply.rides_per_day),
        ("supply.trip_duration_hours", supply.trip_duration_hours),
        ("supply.response_delay_mean_hours", supply.response_delay_mean_hours),
        ("demand.searches_per_day", demand.searches_per_day),
        ("demand.population", demand.population),
        ("demand.shock.hazard_multiplier", demand.shock.hazard_multiplier),
        ("demand.intervention_response.response_delay_mean_hours",
         demand.intervention_response.response_delay_mean_hours),
        ("demand.retry.delay_mean_hours", demand.retry.delay_mean_hours),
        ("demand.last_mile.offset_metres_mean", demand.last_mile.offset_metres_mean),
        ("demand.last_mile.offset_metres_sigma", demand.last_mile.offset_metres_sigma),
        ("demand.proximity.scale_hours", demand.proximity.scale_hours),
    ]:
        if value <= 0:
            raise ConfigError(f"{name} must be positive")
    if (demand.departure_tolerance_hours < 0 or demand.shock.rate_per_day < 0
            or demand.flexible_booking.window_hours < 0 or demand.time_deviation_cost_per_hour < 0):
        raise ConfigError("tolerances, windows and rates cannot be negative")
    if demand.last_mile.offer_beyond_metres < 0:
        raise ConfigError("demand.last_mile.offer_beyond_metres cannot be negative")
    # A share of 1 would leave nothing of the Weibull hazard, and divides by zero.
    if not 0 <= demand.proximity.share < 1:
        raise ConfigError("demand.proximity.share must be at least 0 and below 1")
    if demand.retry.max_attempts < 0 or demand.retry.max_attempts != int(demand.retry.max_attempts):
        raise ConfigError("demand.retry.max_attempts must be a whole number, 0 or more")
    if not 0 <= supply.publish_lead_days_min <= supply.publish_lead_days_max:
        raise ConfigError("supply.publish_lead_days_min must not exceed the max")

    probabilities = [
        ("supply.accept_probability", supply.accept_probability),
        ("supply.withdraw_probability", supply.withdraw_probability),
        ("demand.intervention_response.early_release_probability",
         demand.intervention_response.early_release_probability),
        ("demand.intervention_response.annoyed_cancel_probability",
         demand.intervention_response.annoyed_cancel_probability),
        ("demand.retry.probability", demand.retry.probability),
        ("demand.flexible_booking.share", demand.flexible_booking.share),
    ]
    for name, kind in demand.types.items():
        probabilities += [
            (f"demand.types.{name}.book_probability", kind.book_probability),
            (f"demand.types.{name}.no_show_probability", kind.no_show_probability),
        ]
        if min(kind.weibull_shape, kind.weibull_scale_hours, kind.lead_days_mean) <= 0:
            raise ConfigError(
                f"demand.types.{name}: Weibull shape, scale and lead time must be positive")
        if kind.last_mile_sensitivity < 0:
            raise ConfigError(f"demand.types.{name}.last_mile_sensitivity cannot be negative")
        if kind.proximity_rate < 0:
            raise ConfigError(f"demand.types.{name}.proximity_rate cannot be negative")
    for name, value in probabilities:
        if not 0 <= value <= 1:
            raise ConfigError(f"{name} must be between 0 and 1")

    if abs(sum(kind.share for kind in demand.types.values()) - 1.0) > 1e-9:
        raise ConfigError("demand.types shares must sum to 1")

    for name, weights in [
        ("supply.departure_hours", supply.departure_hours),
        ("supply.seats", supply.seats),
        ("demand.departure_hours", demand.departure_hours),
        ("demand.party_size", demand.party_size),
    ]:
        if not weights or any(w < 0 for w in weights.values()) or sum(weights.values()) <= 0:
            raise ConfigError(f"{name} needs non-negative weights with a positive total")
    for name, hours in [
        ("supply.departure_hours", supply.departure_hours),
        ("demand.departure_hours", demand.departure_hours),
    ]:
        if any(not 0 <= hour < 24 for hour in hours):
            raise ConfigError(f"{name} keys must be hours of the day, 0 to 23")
    if any(n < 1 for n in supply.seats) or any(n < 1 for n in demand.party_size):
        raise ConfigError("seat counts and party sizes must be at least 1")


def _read(path: Path) -> dict[str, Any]:
    data = yaml.safe_load(Path(path).read_text(encoding="utf-8"))
    if not isinstance(data, dict):
        raise ConfigError(f"{path} must contain a mapping")
    return data


def _build(cls, raw: Any, where: str):
    if not isinstance(raw, Mapping):
        raise ConfigError(f"{where} must be a mapping")
    _require_keys(raw, {f.name for f in dataclasses.fields(cls)}, where)
    return cls(**raw)


def _require_keys(raw: Mapping[str, Any], expected: set[str], where: str,
                  optional: frozenset[str] | set[str] = frozenset()) -> None:
    missing, unknown = expected - set(raw), set(raw) - expected - optional
    if missing or unknown:
        raise ConfigError(
            f"{where}: missing keys {sorted(missing)}, unknown keys {sorted(unknown)}"
        )


# A dotted path that starts with this names a variant setting, not a world one.
VARIANT_PREFIX = "variant."


def with_parameter(target: Any, path: str, value: Any) -> Any:
    """A copy of a world or a variant with the dotted `path` (e.g. ``demand.shock.rate_per_day``) set."""
    head, _, rest = path.partition(".")
    if not dataclasses.is_dataclass(target) or not hasattr(target, head):
        raise KeyError(f"no such {type(target).__name__.lower()} parameter: {path}")
    current = getattr(target, head)
    return dataclasses.replace(target, **{head: with_parameter(current, rest, value) if rest else value})


def apply_cell(world: World, variant: Variant, cell: dict[str, Any]) -> tuple[World, Variant]:
    """The world and the variant of one cell of the grid."""
    for path, value in cell.items():
        if path.startswith(VARIANT_PREFIX):
            variant = with_parameter(variant, path.removeprefix(VARIANT_PREFIX), value)
        else:
            world = with_parameter(world, path, value)
    return world, variant
