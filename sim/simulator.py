"""One seeded run of the corridor under one variant.

Randomness is split into independent streams so that two variants given the same seed
face the same world:

- ``supply``          every ride: when it leaves, its seats, whether the driver withdraws
- ``demand``          when each search arrives
- ``person:<id>``     a person's latent type, fixed for the whole run
- ``search:<n>``      who makes the n-th search and everything about that search, drawn
                      in full on arrival whether or not it ends up being used
- ``search:<n>:retry:<k>``  whether that passenger searches a k-th further time, when,
                      and the draws that attempt will need

A variant changes what the platform does with a search. It cannot change who shows up,
what they are like, or what was on offer.

A variant that uses the durability model sees passengers only through a
``FeatureTracker`` fed with the events this run has emitted, exactly as the training
data was built. It has no path to ``Passenger.kind``.

Time is in hours since ``World.start``.
"""

from __future__ import annotations

import dataclasses
import math
import random
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import Any, Mapping, Protocol

import simpy

from intel.app.hazard.features import FeatureTracker
from intel.app.hazard.model import MODEL_DIR, HazardModel
from intel.app.scheduler.plan import Candidate, Limits, plan
from vayora_events import EventType
from sim.config import PassengerType, Variant, World
from sim.frozen import BOOKING_HORIZON_DAYS, DESTINATION, LATENT_TYPES, ORIGIN, SPAN_DAYS
from sim.hazard import cancellation_time, proximity_cancellation_time

HOURS_PER_DAY = 24.0


class Sink(Protocol):
    """Where events go. ``vayora_events.EventWriter`` satisfies this."""

    def write(
        self,
        event_type: EventType | str,
        payload: Mapping[str, Any] | None = None,
        *,
        sim_time: datetime,
        actor_type: str | None = None,
        actor_id: int | None = None,
    ) -> None: ...


@dataclass(frozen=True)
class Event:
    event_type: str
    payload: dict[str, Any]
    sim_time: datetime
    actor_type: str | None
    actor_id: int | None


class MemorySink:
    """Keeps events in a list, validating the type like the real writer does."""

    def __init__(self) -> None:
        self.events: list[Event] = []

    def write(self, event_type, payload=None, *, sim_time, actor_type=None, actor_id=None):
        self.events.append(Event(
            EventType(event_type).value, dict(payload or {}), sim_time, actor_type, actor_id))


@dataclass
class Ride:
    id: int
    driver_id: int
    departure: float
    seats: int
    publish_at: float
    withdraw_at: float | None
    seats_available: int
    status: str = "unpublished"  # unpublished, open, in_progress, completed, withdrawn
    # Seats handed back by a cancellation and not yet taken by a later booking.
    released: int = 0
    bookings: list[Booking] = field(default_factory=list)


@dataclass
class Booking:
    id: int
    ride: Ride
    passenger_id: int
    seats: int
    status: str = "pending"  # pending, confirmed, rejected, cancelled, completed, no_show
    # Model features as they stood at the request; None when the variant has no model.
    features: dict[str, float] | None = None
    accepted_at: float | None = None
    # Ground truth: when the passenger will cancel, or None if they will not. Hidden
    # from every policy; read only to decide how the passenger answers a request.
    cancel_at: float | None = None
    contacted: bool = False


@dataclass(frozen=True)
class Passenger:
    """One search by one person, and every random draw its story will need."""

    id: int
    search_id: int
    # Latent. Must never leave this module in an event payload or a feature.
    kind: str
    desired_departure: float
    seats: int
    book_draw: float
    accept_draw: float
    response_delay: float
    cancel_exposure: float
    shock_time: float | None
    no_show_draw: float
    # Appended last so that adding them left every earlier draw, and so B0, unchanged.
    intervention_delay: float
    release_draw: float
    annoyed_draw: float
    # Straight-line metres from this passenger's start to wherever they would board;
    # independent of which ride they take. Never leaves this module as a feature of its
    # own passenger: only the distance (sim/hazard's effect on it) is observable.
    last_mile_offset_m: float
    # Exp(1), for the hazard tied to departure (sim/hazard.py). Drawn last of all, so a
    # world without that hazard makes every earlier draw, and every run, as before.
    proximity_exposure: float
    # 0 for the first search; 1 and up for a search made after being left without a seat.
    attempt: int = 0


# departure_time      closest to the time the passenger asked for
# predicted_survival  most likely to last until departure, by the variant's hazard model
# earliest_departure  soonest to leave, within the passenger's window: no model at all. With
#                     the no-feature model, predicted_survival orders rides the same way,
#                     since its survival falls with nothing but hours to departure.
RANKINGS = ("departure_time", "predicted_survival", "earliest_departure")


class Simulation:

    def __init__(self, world: World, variant: Variant, seed: int, sink: Sink) -> None:
        if variant.ranking not in RANKINGS:
            raise ValueError(f"unknown ranking {variant.ranking!r}; known: {sorted(RANKINGS)}")
        self.world = world
        self.variant = variant
        self.seed = seed
        self.sink = sink
        self.env = simpy.Environment()
        self.rides: list[Ride] = []
        self.bookings: list[Booking] = []
        self.tracker = FeatureTracker()
        self.model = (HazardModel.load(MODEL_DIR / f"{variant.hazard_model}.json")
                      if variant.hazard_model else None)
        if self.model is None and (
                variant.ranking == "predicted_survival" or variant.intervention is not None):
            raise ValueError(f"variant {variant.name} needs a hazard_model")
        self._searches = 0
        self._passenger_of: dict[int, Passenger] = {}  # by booking id

    def run(self) -> None:
        self.rides = self._generate_rides()
        for ride in self.rides:
            self.env.process(self._ride_life(ride))
        self.env.process(self._arrivals())
        if self.variant.intervention is not None:
            self.env.process(self._scoring_rounds())
        # No horizon: arrivals stop at the end of the span and the last trips finish.
        self.env.run()

    # ---- supply ---------------------------------------------------------------

    def _generate_rides(self) -> list[Ride]:
        supply = self.world.supply
        rng = self._stream("supply")
        rides: list[Ride] = []
        for day in range(SPAN_DAYS):
            for _ in range(_poisson(rng, supply.rides_per_day)):
                departure = day * HOURS_PER_DAY + _weighted(rng, supply.departure_hours)
                seats = _weighted(rng, supply.seats)
                lead = rng.uniform(supply.publish_lead_days_min, supply.publish_lead_days_max)
                publish_at = max(0.0, departure - lead * HOURS_PER_DAY)
                withdraws = rng.random() < supply.withdraw_probability
                withdraw_at = rng.uniform(publish_at, departure)
                ride_id = len(rides) + 1
                rides.append(Ride(
                    id=ride_id,
                    # One driver per ride: repeat drivers are not modelled yet.
                    driver_id=ride_id,
                    departure=departure,
                    seats=seats,
                    publish_at=publish_at,
                    withdraw_at=withdraw_at if withdraws else None,
                    seats_available=seats,
                ))
        return rides

    def _ride_life(self, ride: Ride):
        yield self.env.timeout(ride.publish_at)
        ride.status = "open"

        if ride.withdraw_at is not None:
            yield self.env.timeout(ride.withdraw_at - self.env.now)
            ride.status = "withdrawn"
            for booking in ride.bookings:
                if booking.status in ("pending", "confirmed"):
                    self._cancel(booking, by="driver", actor_id=ride.driver_id)
            return

        yield self.env.timeout(ride.departure - self.env.now)
        ride.status = "in_progress"
        travelling: list[Booking] = []
        for booking in ride.bookings:
            if booking.status == "pending":
                # The driver left without answering, as core-api's TripService does.
                self._reject(booking)
            elif booking.status == "confirmed":
                self._emit(EventType.TRIP_STARTED, self._trip(booking), "driver", ride.driver_id)
                travelling.append(booking)
        for booking in travelling:
            if self._passenger_of[booking.id].no_show_draw < self._kind(booking).no_show_probability:
                booking.status = "no_show"
                self._emit(EventType.TRIP_FAILED,
                           {**self._trip(booking), "reason": "passenger_no_show"},
                           "driver", ride.driver_id)

        yield self.env.timeout(self.world.supply.trip_duration_hours)
        ride.status = "completed"
        for booking in travelling:
            if booking.status == "confirmed":
                booking.status = "completed"
                self._emit(EventType.TRIP_COMPLETED, self._trip(booking), "driver", ride.driver_id)

    # ---- demand ---------------------------------------------------------------

    def _arrivals(self):
        rng = self._stream("demand")
        per_hour = self.world.demand.searches_per_day / HOURS_PER_DAY
        span = SPAN_DAYS * HOURS_PER_DAY
        while True:
            yield self.env.timeout(rng.expovariate(per_hour))
            if self.env.now >= span:
                return
            self._search(self._new_passenger())

    def _new_passenger(self) -> Passenger:
        demand, supply = self.world.demand, self.world.supply
        self._searches += 1
        rng = self._stream(f"search:{self._searches}")

        person = rng.randrange(demand.population) + 1
        kind = self._stream(f"person:{person}").choices(
            LATENT_TYPES, weights=[demand.types[k].share for k in LATENT_TYPES])[0]
        lead_days = min(rng.expovariate(1.0 / demand.types[kind].lead_days_mean),
                        BOOKING_HORIZON_DAYS)
        day = min(int((self.env.now + lead_days * HOURS_PER_DAY) // HOURS_PER_DAY), SPAN_DAYS - 1)
        hour = _weighted(rng, demand.departure_hours)
        shock_rate = demand.shock.rate_per_day / HOURS_PER_DAY
        return Passenger(
            id=person,
            search_id=self._searches,
            kind=kind,
            desired_departure=day * HOURS_PER_DAY + hour,
            seats=_weighted(rng, demand.party_size),
            book_draw=rng.random(),
            accept_draw=rng.random(),
            response_delay=rng.expovariate(1.0 / supply.response_delay_mean_hours),
            cancel_exposure=rng.expovariate(1.0),
            shock_time=rng.expovariate(shock_rate) if shock_rate > 0 else None,
            no_show_draw=rng.random(),
            intervention_delay=rng.expovariate(
                1.0 / demand.intervention_response.response_delay_mean_hours),
            release_draw=rng.random(),
            annoyed_draw=rng.random(),
            last_mile_offset_m=rng.lognormvariate(
                math.log(demand.last_mile.offset_metres_mean), demand.last_mile.offset_metres_sigma),
            proximity_exposure=rng.expovariate(1.0),
        )

    def _maybe_retry(self, passenger: Passenger) -> None:
        """A passenger left without a seat may search again later, with fresh luck."""
        retry = self.world.demand.retry
        if passenger.attempt >= retry.max_attempts:
            return
        rng = self._stream(f"search:{passenger.search_id}:retry:{passenger.attempt + 1}")
        retries = rng.random() < retry.probability
        delay = rng.expovariate(1.0 / retry.delay_mean_hours)
        demand, supply = self.world.demand, self.world.supply
        shock_rate = demand.shock.rate_per_day / HOURS_PER_DAY
        again = dataclasses.replace(
            passenger,
            attempt=passenger.attempt + 1,
            book_draw=rng.random(),
            accept_draw=rng.random(),
            response_delay=rng.expovariate(1.0 / supply.response_delay_mean_hours),
            cancel_exposure=rng.expovariate(1.0),
            shock_time=rng.expovariate(shock_rate) if shock_rate > 0 else None,
            no_show_draw=rng.random(),
            intervention_delay=rng.expovariate(
                1.0 / demand.intervention_response.response_delay_mean_hours),
            release_draw=rng.random(),
            annoyed_draw=rng.random(),
            last_mile_offset_m=rng.lognormvariate(
                math.log(demand.last_mile.offset_metres_mean), demand.last_mile.offset_metres_sigma),
            proximity_exposure=rng.expovariate(1.0),
        )
        if retries:
            self.env.process(self._search_again(again, delay))

    def _search_again(self, passenger: Passenger, delay: float):
        yield self.env.timeout(delay)
        # No point once every ride they could have taken has left.
        latest = passenger.desired_departure + self.world.demand.departure_tolerance_hours
        if self.env.now < latest:
            self._search(passenger)

    def _search(self, passenger: Passenger) -> None:
        now = self.env.now
        # A repeat search is logged as a recovery search, not a new search: the primary
        # metric counts people who came looking, once each.
        first = passenger.attempt == 0
        self._emit(EventType.SEARCH_ISSUED if first else EventType.RECOVERY_SEARCH, {
            "search_id": passenger.search_id,
            "passenger_id": passenger.id,
            "origin": ORIGIN,
            "destination": DESTINATION,
            "desired_departure": self._iso(passenger.desired_departure),
            "seats": passenger.seats,
            "attempt": passenger.attempt,
        }, "passenger", passenger.id)

        tolerance = self.world.demand.departure_tolerance_hours
        horizon = BOOKING_HORIZON_DAYS * HOURS_PER_DAY
        in_window = [
            ride for ride in self.rides
            if ride.status == "open"
            and now < ride.departure <= now + horizon
            and abs(ride.departure - passenger.desired_departure) <= tolerance
        ]
        candidates = self._rank(
            [ride for ride in in_window if ride.seats_available >= passenger.seats], passenger)

        # rides_in_window says why a search found nothing: no published ride at that time
        # (0), or rides at that time without enough seats (above 0). Only what a platform
        # could see: a ride not yet published is not counted.
        self._emit(EventType.CANDIDATES_RETURNED,
                   {"search_id": passenger.search_id, "passenger_id": passenger.id,
                    "count": len(candidates), "rides_in_window": len(in_window)},
                   "passenger", passenger.id)
        for rank, ride in enumerate(candidates, start=1):
            self._emit(EventType.CANDIDATE_RANKED,
                       {"search_id": passenger.search_id, "passenger_id": passenger.id,
                        "ride_id": ride.id, "rank": rank},
                       "passenger", passenger.id)

        kind = self.world.demand.types[passenger.kind]
        if not candidates:
            self._maybe_retry(passenger)
        elif passenger.book_draw < kind.book_probability:
            self._request(passenger, candidates[0])

    # ---- bookings -------------------------------------------------------------

    def _rank(self, candidates: list[Ride], passenger: Passenger) -> list[Ride]:
        def gap(ride: Ride) -> float:
            return abs(ride.departure - passenger.desired_departure)

        if self.variant.ranking == "predicted_survival":
            def key(ride: Ride):
                survival = self.model.conditional_survival(
                    self._features(passenger, ride), elapsed_hours=0.0,
                    horizon_hours=ride.departure - self.env.now)
                return (-survival, gap(ride), ride.id)
        elif self.variant.ranking == "earliest_departure":
            def key(ride: Ride):
                return (ride.departure, gap(ride), ride.id)
        else:
            def key(ride: Ride):
                return (gap(ride), ride.id)
        return sorted(candidates, key=key)

    def _features(self, passenger: Passenger, ride: Ride) -> dict[str, float]:
        """What the platform knows about this passenger booking this ride right now."""
        return self.tracker.features(
            passenger_id=passenger.id, seats=passenger.seats, now=self._at(self.env.now),
            departure=self._at(ride.departure),
            desired_departure=self._at(passenger.desired_departure),
            last_mile_distance_m=passenger.last_mile_offset_m,
            last_mile_mode_available=self._last_mile_mode_available(passenger))

    def _last_mile_mode_available(self, passenger: Passenger) -> bool:
        return passenger.last_mile_offset_m >= self.world.demand.last_mile.offer_beyond_metres

    def _request(self, passenger: Passenger, ride: Ride) -> None:
        booking = Booking(len(self.bookings) + 1, ride, passenger.id, passenger.seats)
        if self.model is not None:
            booking.features = self._features(passenger, ride)
        self.bookings.append(booking)
        ride.bookings.append(booking)
        self._passenger_of[booking.id] = passenger
        self._take_seats(ride, booking.seats)

        self._emit(EventType.BOOKING_REQUESTED, {
            "booking_id": booking.id,
            "search_id": passenger.search_id,
            "ride_id": ride.id,
            "passenger_id": passenger.id,
            "seats": booking.seats,
            "departure_time": self._iso(ride.departure),
            "last_mile_distance_m": round(passenger.last_mile_offset_m),
            "last_mile_mode_available": self._last_mile_mode_available(passenger),
        }, "passenger", passenger.id)

        if passenger.attempt > 0:
            self._emit(EventType.RECOVERY_BOOKED, {
                "booking_id": booking.id,
                "search_id": passenger.search_id,
                "ride_id": ride.id,
                "passenger_id": passenger.id,
                "attempt": passenger.attempt,
            }, "passenger", passenger.id)

        refilled = min(booking.seats, ride.released)
        if refilled:
            ride.released -= refilled
            self._emit(EventType.SEAT_REFILLED, {
                "booking_id": booking.id,
                "ride_id": ride.id,
                "seats": refilled,
                "departure_time": self._iso(ride.departure),
            }, "passenger", passenger.id)

        self.env.process(self._booking_life(booking, passenger))

    def _booking_life(self, booking: Booking, passenger: Passenger):
        ride = booking.ride
        yield self.env.timeout(passenger.response_delay)
        if booking.status != "pending":
            return  # the ride left or was withdrawn before the driver answered
        if passenger.accept_draw >= self.world.supply.accept_probability:
            self._reject(booking)
            return
        booking.status = "confirmed"
        booking.accepted_at = self.env.now
        self._emit(EventType.BOOKING_ACCEPTED, {
            "booking_id": booking.id, "ride_id": ride.id, "driver_id": ride.driver_id,
        }, "driver", ride.driver_id)

        kind = self._kind(booking)
        # A bigger last-mile gap shortens the expected time to cancellation; how much
        # depends on the (unobservable) type, never on anything a feature could see.
        scale = kind.weibull_scale_hours / (
            1.0 + kind.last_mile_sensitivity * (passenger.last_mile_offset_m / 1000.0))
        # A world may move a share of the risk from the clock since acceptance to a hazard
        # tied to departure. Scaling the Weibull hazard by (1 - share) is the same as
        # dividing the exposure by it; with share 0 this divides by exactly 1.0.
        proximity = self.world.demand.proximity
        wait = cancellation_time(
            passenger.cancel_exposure / (1.0 - proximity.share),
            shape=kind.weibull_shape,
            scale=scale,
            shock_time=passenger.shock_time,
            shock_multiplier=self.world.demand.shock.hazard_multiplier,
        )
        if kind.proximity_rate > 0:
            near = proximity_cancellation_time(
                passenger.proximity_exposure,
                hours_left=ride.departure - self.env.now,
                rate=kind.proximity_rate,
                scale_hours=proximity.scale_hours,
            )
            if near is not None:
                wait = min(wait, near)  # whichever of the two hazards cancels first
        if self.env.now + wait >= ride.departure:
            return  # survives to departure
        booking.cancel_at = self.env.now + wait
        yield self.env.timeout(wait)
        if booking.status == "confirmed":
            self._cancel(booking, by="passenger", actor_id=passenger.id)

    # ---- interventions --------------------------------------------------------

    def _scoring_rounds(self):
        """Re-scores every live booking at a fixed interval and contacts the risky ones.

        Without a budget every risky booking is asked. With one, the scheduler chooses
        which of them to ask this round; the rest may be chosen in a later round.
        """
        policy = self.variant.intervention
        while self.env.now < SPAN_DAYS * HOURS_PER_DAY:
            yield self.env.timeout(policy.scoring_interval_hours)
            risky: list[tuple[Booking, float]] = []
            for booking in self.bookings:
                ride = booking.ride
                if booking.status != "confirmed" or ride.status != "open":
                    continue
                elapsed = self.env.now - booking.accepted_at
                remaining = ride.departure - self.env.now
                survival = self.model.conditional_survival(
                    booking.features, elapsed_hours=elapsed, horizon_hours=elapsed + remaining)
                self._emit(EventType.HAZARD_SCORED, {
                    "booking_id": booking.id,
                    "survival_probability": survival,
                    "elapsed_hours": elapsed,
                    "horizon_hours": elapsed + remaining,
                    "model_version": self.model.version,
                    "feature_version": self.model.feature_version,
                }, "platform", None)
                if (self._should_ask(booking, survival, policy) and not booking.contacted
                        and remaining >= policy.min_hours_before_departure):
                    risky.append((booking, survival))
            for booking, survival in self._within_budget(risky):
                booking.contacted = True
                self.env.process(self._ask_to_reconfirm(booking, survival))

    def _should_ask(self, booking: Booking, survival: float, policy) -> bool:
        if policy.selector == "oracle":
            # Ground truth: this booking will be cancelled, and less than a day before
            # departure. Only the upper-bound variant may look; see config.Intervention.
            return (booking.cancel_at is not None
                    and booking.ride.departure - booking.cancel_at < HOURS_PER_DAY)
        return survival < policy.survival_threshold

    def _within_budget(self, risky: list[tuple[Booking, float]]) -> list[tuple[Booking, float]]:
        """The risky bookings to ask this round. The scheduler sees what a platform would
        know about each: its ride, its seats, its score and the time left."""
        budget = self.variant.intervention.budget
        if budget is None or not risky:
            return risky
        if budget.chooser == "random":
            return self._at_random(risky, budget)
        chosen = set(plan(
            [Candidate(booking_id=booking.id, ride_id=booking.ride.id,
                       departure_day=int(booking.ride.departure // HOURS_PER_DAY),
                       seats=booking.seats, survival_probability=survival,
                       hours_to_departure=booking.ride.departure - self.env.now)
             for booking, survival in risky],
            Limits(contacts=budget.contacts_per_round,
                   contacts_per_ride=budget.max_contacts_per_ride,
                   seats_per_departure_day=budget.max_seats_asked_per_departure_day,
                   refill_horizon_hours=budget.refill_horizon_hours,
                   time_limit_seconds=budget.solver_time_limit_seconds)).booking_ids)
        return [(booking, survival) for booking, survival in risky if booking.id in chosen]

    def _at_random(self, risky: list[tuple[Booking, float]], budget) -> list[tuple[Booking, float]]:
        """The scheduler's limits, filled in a random order instead of by its choice."""
        order = list(risky)
        self._stream(f"budget:{self.env.now}").shuffle(order)
        chosen: list[tuple[Booking, float]] = []
        per_ride: dict[int, int] = {}
        seats_per_day: dict[int, int] = {}
        for booking, survival in order:
            if len(chosen) == budget.contacts_per_round:
                break
            ride = booking.ride.id
            day = int(booking.ride.departure // HOURS_PER_DAY)
            if per_ride.get(ride, 0) >= budget.max_contacts_per_ride:
                continue
            if seats_per_day.get(day, 0) + booking.seats > budget.max_seats_asked_per_departure_day:
                continue
            chosen.append((booking, survival))
            per_ride[ride] = per_ride.get(ride, 0) + 1
            seats_per_day[day] = seats_per_day.get(day, 0) + booking.seats
        return chosen

    def _ask_to_reconfirm(self, booking: Booking, survival: float):
        passenger = self._passenger_of[booking.id]
        response = self.world.demand.intervention_response
        self._emit(EventType.INTERVENTION_ISSUED, {
            "booking_id": booking.id,
            "passenger_id": passenger.id,
            "action": "reconfirm",
            "survival_probability": survival,
        }, "platform", None)

        yield self.env.timeout(passenger.intervention_delay)
        if booking.status != "confirmed" or booking.ride.status != "open":
            return  # already cancelled, or the ride left before they answered
        if booking.cancel_at is not None:
            releases = passenger.release_draw < response.early_release_probability
        else:
            releases = passenger.annoyed_draw < response.annoyed_cancel_probability
        self._emit(EventType.INTERVENTION_RESPONDED, {
            "booking_id": booking.id,
            "passenger_id": passenger.id,
            "response": "released" if releases else "confirmed",
        }, "passenger", passenger.id)
        if releases:
            self._cancel(booking, by="passenger", actor_id=passenger.id)

    def _reject(self, booking: Booking) -> None:
        booking.status = "rejected"
        self._give_back_seats(booking.ride, booking.seats)
        self._emit(EventType.BOOKING_REJECTED, {
            "booking_id": booking.id,
            "ride_id": booking.ride.id,
            "driver_id": booking.ride.driver_id,
        }, "driver", booking.ride.driver_id)
        self._maybe_retry(self._passenger_of[booking.id])

    def _cancel(self, booking: Booking, *, by: str, actor_id: int) -> None:
        ride = booking.ride
        booking.status = "cancelled"
        self._give_back_seats(ride, booking.seats)
        if by == "passenger":
            ride.released += booking.seats
        self._emit(EventType.BOOKING_CANCELLED, {
            "booking_id": booking.id,
            "ride_id": ride.id,
            "passenger_id": booking.passenger_id,
            "seats": booking.seats,
            # Required by the late-cancellation metric.
            "departure_time": self._iso(ride.departure),
            "cancelled_by": by,
        }, by, actor_id)
        if by == "driver":
            self._after_withdrawal(booking)

    def _after_withdrawal(self, booking: Booking) -> None:
        """A passenger whose driver withdrew: rebooked at once if they chose a flexible
        booking and a ride fits, as the platform does; otherwise they may search again.

        The choice is drawn from a stream of its own, so with no flexible share every other
        draw, and so every earlier result, is unchanged.
        """
        passenger = self._passenger_of[booking.id]
        flexible = self.world.demand.flexible_booking
        if flexible.share > 0 and self._stream(f"flexible-booking:{booking.id}").random() < flexible.share:
            withdrawn = booking.ride
            fitting = [
                ride for ride in self.rides
                if ride is not withdrawn and ride.status == "open"
                and ride.departure > self.env.now
                and abs(ride.departure - withdrawn.departure) <= flexible.window_hours
                and ride.seats_available >= booking.seats
            ]
            if fitting:
                # The closest in time, as core-api's FlexibleRebooking takes; ties by ride id.
                closest = min(fitting, key=lambda ride: (abs(ride.departure - withdrawn.departure), ride.id))
                self._request(passenger, closest)
                return
        self._maybe_retry(passenger)

    def _take_seats(self, ride: Ride, seats: int) -> None:
        ride.seats_available -= seats
        if ride.seats_available < 0:
            raise AssertionError(f"ride {ride.id} oversold")

    def _give_back_seats(self, ride: Ride, seats: int) -> None:
        ride.seats_available += seats
        if ride.seats_available > ride.seats:
            raise AssertionError(f"ride {ride.id} released more seats than it has")

    # ---- helpers --------------------------------------------------------------

    def _kind(self, booking: Booking) -> PassengerType:
        return self.world.demand.types[self._passenger_of[booking.id].kind]

    def _trip(self, booking: Booking) -> dict[str, Any]:
        return {
            "booking_id": booking.id,
            "ride_id": booking.ride.id,
            "passenger_id": booking.passenger_id,
            "driver_id": booking.ride.driver_id,
        }

    def _stream(self, name: str) -> random.Random:
        # A string seed is hashed with SHA-512, so streams are stable across runs
        # and platforms and independent of one another.
        return random.Random(f"{self.seed}:{name}")

    def _at(self, hours: float) -> datetime:
        return self.world.start + timedelta(hours=hours)

    def _iso(self, hours: float) -> str:
        return self._at(hours).isoformat()

    def _emit(self, event_type: EventType, payload: dict[str, Any], actor_type: str,
              actor_id: int | None) -> None:
        self.sink.write(
            event_type, payload, sim_time=self._at(self.env.now),
            actor_type=actor_type, actor_id=actor_id,
        )
        # The model's only view of the world is what has been logged.
        self.tracker.observe(event_type.value, payload)


def _poisson(rng: random.Random, mean: float) -> int:
    """Number of arrivals of a rate-``mean`` Poisson process in one unit of time."""
    count, elapsed = 0, rng.expovariate(mean)
    while elapsed < 1.0:
        count += 1
        elapsed += rng.expovariate(mean)
    return count


def _weighted(rng: random.Random, weights: Mapping[int, float]) -> int:
    values = sorted(weights)
    return rng.choices(values, weights=[weights[v] for v in values])[0]
