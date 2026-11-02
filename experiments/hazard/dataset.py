"""Turns an event log into one survival row per accepted booking.

Time origin is acceptance. The event is a cancellation by the passenger. A booking is
right-censored when it reaches departure, or earlier if the driver withdraws the ride:
in both cases all we know is that the passenger had not cancelled by then.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any, Iterable

from intel.app.hazard.features import FeatureTracker


def survival_rows(events: Iterable[Any]) -> list[dict[str, Any]]:
    """`events` need `event_type`, `payload` and `sim_time`, in time order.

    Each row holds the model features as they stood when the booking was requested, plus:

    - ``duration_hours``     acceptance to cancellation or censoring
    - ``cancelled``          True if the passenger cancelled
    - ``horizon_hours``      acceptance to scheduled departure
    - ``reached_departure``  True if the booking was still live at departure
    """
    tracker = FeatureTracker()
    desired: dict[int, datetime] = {}
    requested: dict[int, tuple[dict[str, float], datetime]] = {}
    live: dict[int, tuple[dict[str, float], datetime, datetime]] = {}
    rows: list[dict[str, Any]] = []

    for event in events:
        kind, payload = event.event_type, event.payload
        booking = payload.get("booking_id")

        if kind == "search_issued" and "search_id" in payload:
            desired[payload["search_id"]] = datetime.fromisoformat(payload["desired_departure"])
        elif kind == "booking_requested":
            departure = datetime.fromisoformat(payload["departure_time"])
            # Read before this event is observed: a booking is not its own history.
            # The last-mile gap and mode, unlike history, are on this event itself.
            # A platform search names a day and no time, so a live booking has no search id here
            # and the gap is 0, as core-api serves it (HazardFeatures).
            features = tracker.features(
                passenger_id=payload["passenger_id"], seats=payload["seats"],
                now=event.sim_time, departure=departure,
                desired_departure=desired[payload["search_id"]] if "search_id" in payload else departure,
                last_mile_distance_m=payload.get("last_mile_distance_m", 0.0),
                last_mile_mode_available=payload.get("last_mile_mode_available", False))
            requested[booking] = (features, departure)
        elif kind == "booking_accepted" and booking in requested:
            features, departure = requested.pop(booking)
            live[booking] = (features, event.sim_time, departure)
        elif kind in ("booking_cancelled", "trip_started") and booking in live:
            features, accepted_at, departure = live.pop(booking)
            rows.append({
                **features,
                "duration_hours": _hours(event.sim_time - accepted_at),
                "cancelled": kind == "booking_cancelled"
                and payload.get("cancelled_by") == "passenger",
                "horizon_hours": _hours(departure - accepted_at),
                "reached_departure": kind == "trip_started",
            })

        tracker.observe(kind, payload)
    return rows


def _hours(delta) -> float:
    return delta.total_seconds() / 3600.0
