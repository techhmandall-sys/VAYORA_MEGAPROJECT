"""What the platform's own event log can say about the real world, and whether it is enough yet.

    python -m experiments.real_data                 how far each is from enough
    python -m experiments.real_data --write-world   once demand is enough, a world at that demand

Features 77 and 89 are unfinished for want of real data, none of which may be made up. This reads
the live events, leaving out demo and test accounts, and says plainly how far they are from
enough by experiments/configs/real_data.yaml. It only ever reads the event log: simulated runs,
which have a run id, are never touched or counted.

Once demand is enough, --write-world makes experiments/configs/worlds/calibrated_demand.yaml, which
is world.yaml at the demand observed. Run the experiments with --world to see what it changes. The
model has its own step: experiments/hazard/train_real.py.
"""

from __future__ import annotations

import argparse
import dataclasses
import math
import os
import re
import statistics
import sys
from collections import Counter
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Iterable, Mapping
from zoneinfo import ZoneInfo

import psycopg
import yaml
from scipy import stats
from sqlalchemy import make_url

from experiments.hazard.dataset import survival_rows

ROOT = Path(__file__).resolve().parents[1]
CONFIGS = ROOT / "experiments" / "configs"
WORLD = CONFIGS / "world.yaml"
CALIBRATED_WORLD = CONFIGS / "worlds" / "calibrated_demand.yaml"
INDIA = ZoneInfo("Asia/Kolkata")
EVENT_TYPES = ["search_issued", "booking_requested", "booking_accepted", "booking_cancelled",
               "trip_started", "trip_completed", "trip_failed"]


@dataclasses.dataclass(frozen=True)
class LiveEvent:
    event_type: str
    payload: Mapping[str, Any]
    sim_time: datetime


def load_config(path: Path = CONFIGS / "real_data.yaml") -> dict[str, Any]:
    return yaml.safe_load(path.read_text(encoding="utf-8"))


def read_live_events(conn: psycopg.Connection, config: Mapping[str, Any]) -> list[LiveEvent]:
    """The platform's events in time order, without those of demo and test accounts."""
    excluded = {row[0] for row in conn.execute(
        "SELECT id FROM users WHERE split_part(email, '@', 2) = ANY(%s)",
        (config["excluded_email_domains"],)).fetchall()}
    rows = conn.execute(
        "SELECT event_type, payload, sim_time FROM events WHERE run_id IS NULL "
        "AND event_type = ANY(%s) ORDER BY sim_time, id", (EVENT_TYPES,)).fetchall()
    return without_accounts([LiveEvent(*row) for row in rows], excluded)


def without_accounts(events: Iterable[LiveEvent], excluded: set[int]) -> list[LiveEvent]:
    """Drops what the given people did: their searches, and everything about their bookings."""
    dropped_bookings: set[int] = set()
    kept = []
    for event in events:
        booking = event.payload.get("booking_id")
        if event.event_type == "booking_requested" and event.payload["passenger_id"] in excluded:
            dropped_bookings.add(booking)
        if booking in dropped_bookings:
            continue
        if event.event_type == "search_issued" and event.payload["passenger_id"] in excluded:
            continue
        kept.append(event)
    return kept


def _km(lat_a: float, lon_a: float, lat_b: float, lon_b: float) -> float:
    a, b = math.radians(lat_a), math.radians(lat_b)
    h = math.sin((b - a) / 2) ** 2 + math.cos(a) * math.cos(b) * math.sin(math.radians(lon_b - lon_a) / 2) ** 2
    return 2 * 6371 * math.asin(math.sqrt(h))


def _town_at(lat: float, lon: float, corridor: Mapping[str, Any]) -> int | None:
    """Where on the corridor a point is, as a place in its list of towns; None if it is off it."""
    for place, town in enumerate(corridor["towns"]):
        if _km(lat, lon, town["lat"], town["lon"]) <= corridor["radius_km"]:
            return place
    return None


def corridor_demand(events: Iterable[LiveEvent], config: Mapping[str, Any]) -> dict[str, Any]:
    """Searches a day along the corridor, in the simulator's direction, over the days observed.

    Every day from the first such search to the last counts, a day with none as a zero.
    """
    per_day: Counter[date] = Counter()
    people: set[int] = set()
    returning = 0
    for event in events:
        if event.event_type != "search_issued":
            continue
        p = event.payload
        start = _town_at(p["origin_lat"], p["origin_lon"], config["corridor"])
        end = _town_at(p["destination_lat"], p["destination_lon"], config["corridor"])
        if start is None or end is None or start == end:
            continue
        if end < start:
            returning += 1
            continue
        per_day[event.sim_time.astimezone(INDIA).date()] += 1
        people.add(p["passenger_id"])

    estimate: dict[str, Any] = {"days": 0, "searches": sum(per_day.values()), "passengers": len(people),
                                "per_day": None, "interval": None, "other_direction": returning}
    if not per_day:
        return estimate
    first, last = min(per_day), max(per_day)
    counts = [per_day[first + timedelta(days=i)] for i in range((last - first).days + 1)]
    estimate["days"] = len(counts)
    estimate["per_day"] = statistics.fmean(counts)
    if len(counts) > 1:
        half = stats.t.ppf(0.975, len(counts) - 1) * statistics.stdev(counts) / math.sqrt(len(counts))
        estimate["interval"] = (max(0.0, estimate["per_day"] - half), estimate["per_day"] + half)
    return estimate


def demand_is_enough(estimate: Mapping[str, Any], config: Mapping[str, Any]) -> bool:
    return estimate["days"] >= config["demand"]["min_days"] and estimate["passengers"] >= config["demand"]["min_passengers"]


def finished_booking_rows(events: Iterable[LiveEvent], now: datetime) -> list[dict[str, Any]]:
    """Survival rows from live events, for bookings whose departure has passed.

    A booking still to come has no outcome yet. Keeping it would count its cancellations and not
    its survival, and overstate how many cancel. Departure is read in India's time, as core-api
    reads it when it scores a booking (HazardFeatures).
    """
    still_to_come: set[int] = set()
    ready = []
    for event in events:
        payload = event.payload
        if event.event_type == "booking_requested":
            departure = datetime.fromisoformat(payload["departure_time"]).astimezone(INDIA)
            if departure > now:
                still_to_come.add(payload["booking_id"])
            payload = {**payload, "departure_time": departure.isoformat()}
        if payload.get("booking_id") not in still_to_come:
            ready.append(dataclasses.replace(event, payload=payload))
    return survival_rows(ready)


def model_counts(rows: list[dict[str, Any]]) -> dict[str, int]:
    return {"accepted_bookings": len(rows), "passenger_cancellations": sum(1 for row in rows if row["cancelled"])}


def model_is_enough(counts: Mapping[str, int], config: Mapping[str, Any]) -> bool:
    return (counts["accepted_bookings"] >= config["model"]["min_accepted_bookings"]
            and counts["passenger_cancellations"] >= config["model"]["min_passenger_cancellations"])


def calibrated_world_text(world_text: str, estimate: Mapping[str, Any]) -> str:
    """world.yaml with the demand observed in place of the demand assumed, and nothing else changed."""
    changed, replaced = re.subn(r"(?m)^(\s*searches_per_day:\s*)\S+", rf"\g<1>{estimate['per_day']:.1f}", world_text)
    if replaced != 1:
        raise ValueError("expected exactly one searches_per_day in the world")
    header = (
        "# Generated by experiments/real_data.py from world.yaml; identical to it except searches_per_day,\n"
        f"# which is the demand observed: {estimate['searches']} real searches by {estimate['passengers']} people "
        f"over {estimate['days']} days.\n"
        "# Everything else in this world is still assumed.\n\n")
    return header + changed


def describe(estimate: Mapping[str, Any], counts: Mapping[str, int], config: Mapping[str, Any]) -> str:
    demand, model = config["demand"], config["model"]
    per_day = "no searches yet" if estimate["per_day"] is None else f"{estimate['per_day']:.1f} a day"
    lines = [
        "Real data in the event log, leaving out demo and test accounts:",
        "",
        f"Demand (feature 89): {'ENOUGH' if demand_is_enough(estimate, config) else 'not enough yet'}",
        f"  {estimate['searches']} searches towards Pune, {per_day}; "
        f"{estimate['other_direction']} the other way, which the simulator does not model",
        f"  days observed:   {estimate['days']} of the {demand['min_days']} needed",
        f"  people:          {estimate['passengers']} of the {demand['min_passengers']} needed",
        "",
        f"Model (feature 77): {'ENOUGH' if model_is_enough(counts, config) else 'not enough yet'}",
        f"  accepted bookings that have departed: {counts['accepted_bookings']} of the {model['min_accepted_bookings']} needed",
        f"  of which the passenger cancelled:     {counts['passenger_cancellations']} of the {model['min_passenger_cancellations']} needed",
    ]
    return "\n".join(lines)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--write-world", action="store_true")
    args = parser.parse_args()
    url = os.environ.get("VAYORA_DB_URL")
    if not url:
        parser.error("VAYORA_DB_URL is not set")
    config = load_config()
    dsn = make_url(url).set(drivername="postgresql").render_as_string(hide_password=False)
    with psycopg.connect(dsn) as conn:
        events = read_live_events(conn, config)
    estimate = corridor_demand(events, config)
    counts = model_counts(finished_booking_rows(events, datetime.now(timezone.utc)))
    print(describe(estimate, counts, config))
    if not args.write_world:
        return 0
    if not demand_is_enough(estimate, config):
        print("\nNo world written: there is not enough real demand to calibrate from.", file=sys.stderr)
        return 1
    CALIBRATED_WORLD.write_text(calibrated_world_text(WORLD.read_text(encoding="utf-8"), estimate), encoding="utf-8")
    print(f"\nWrote {CALIBRATED_WORLD.relative_to(ROOT)}. Run the experiments with --world to use it.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
