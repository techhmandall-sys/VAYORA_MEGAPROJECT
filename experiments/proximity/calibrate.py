"""Sets each passenger type's hazard tied to departure for experiment X1, and writes the worlds.

    python -m experiments.proximity.calibrate

A share w of each type's Weibull hazard moves to a hazard ``rate_k * exp(-v / theta)`` in the
hours v left before departure (sim/hazard.py). rate_k is the one value for which type k keeps
its world-h3 chance of reaching departure:

    mean_i exp(-(1 - w) * H_i(L_i) - rate_k * theta * (1 - exp(-L_i / theta)))
        = mean_i exp(-H_i(L_i))

with the means over the bookings of type k that B0 accepts on the calibration seeds in world
h3, H_i a booking's Weibull cumulative hazard (with its last-mile gap and shock time) and L_i
its hours from acceptance to departure. Both sides average over the exposure draws exactly;
only the bookings are sampled. Reading the latent type here is the generator being set, as
world.yaml is: no model or variant sees it.

Writes, for each share in experiments/configs/proximity.yaml:

- experiments/configs/worlds/proximity_w<share>.yaml   world.yaml with the share and the rates
- experiments/reports/proximity-calibration.json        rates, targets and a check: the share of
  each type's accepted bookings whose drawn cancellation falls after departure, in world h3 and
  in the new world, under B0 on the calibration seeds
"""

from __future__ import annotations

import dataclasses
import json
import re
from pathlib import Path
from typing import Any

import numpy as np
import yaml

from experiments.hazard.train import EXPERIMENT_SEEDS, load_config, seeds
from sim.config import World, load_variant, load_world
from sim.frozen import LATENT_TYPES
from sim.hazard import cumulative_hazard, proximity_hazard_by_departure
from sim.simulator import MemorySink, Simulation

ROOT = Path(__file__).resolve().parents[2]
CONFIGS = ROOT / "experiments" / "configs"
REPORTS = ROOT / "experiments" / "reports"


def load_proximity(path: Path = CONFIGS / "proximity.yaml") -> dict[str, Any]:
    config = yaml.safe_load(path.read_text(encoding="utf-8"))
    hazard = load_config()
    used = EXPERIMENT_SEEDS | set(seeds(hazard["train_seeds"])) | set(seeds(hazard["validation_seeds"]))
    if set(seeds(config["calibration_seeds"])) & used:
        raise ValueError("calibration seeds must be disjoint from experiment, training and validation seeds")
    if not all(0 < share < 1 for share in config["shares"]):
        raise ValueError("every share must be above 0 and below 1; share 0 is world.yaml itself")
    return config


def accepted_bookings(world: World, variant_path: Path, which: list[int]) -> list[dict[str, Any]]:
    """Every booking accepted on these seeds, with what its cancellation hazards depend on."""
    variant = load_variant(variant_path)
    rows = []
    for seed in which:
        sim = Simulation(world, variant, seed, MemorySink())
        sim.run()
        for booking in sim.bookings:
            if booking.accepted_at is None:
                continue
            passenger = sim._passenger_of[booking.id]
            rows.append({
                "seed": seed,
                "kind": passenger.kind,
                "hours_left": booking.ride.departure - booking.accepted_at,
                "last_mile_km": passenger.last_mile_offset_m / 1000.0,
                "shock_time": passenger.shock_time,
                "survives": booking.cancel_at is None,
            })
    return rows


def weibull_hazard_by_departure(world: World, row: dict[str, Any]) -> float:
    """H_i(L_i): the booking's world-h3 cumulative hazard from acceptance to departure."""
    kind = world.demand.types[row["kind"]]
    return cumulative_hazard(
        row["hours_left"],
        shape=kind.weibull_shape,
        scale=kind.weibull_scale_hours / (1.0 + kind.last_mile_sensitivity * row["last_mile_km"]),
        shock_time=row["shock_time"],
        shock_multiplier=world.demand.shock.hazard_multiplier,
    )


def solve_rate(weibull: np.ndarray, proximity_unit: np.ndarray, share: float, *,
               upper: float, tolerance: float) -> float:
    """The rate at which mean survival with the share moved equals mean survival in world h3.

    `weibull` holds each booking's H_i(L_i); `proximity_unit` its hazard tied to departure at
    rate 1. Mean survival falls strictly as the rate rises, so bisection finds the one root.
    """
    target = float(np.mean(np.exp(-weibull)))

    def gap(rate: float) -> float:
        return float(np.mean(np.exp(-(1.0 - share) * weibull - rate * proximity_unit))) - target

    low, high = 0.0, upper
    if gap(high) >= 0:
        raise ValueError(f"no rate up to {upper} per hour brings survival down to {target:.4f}")
    while high - low > tolerance:
        middle = (low + high) / 2
        if gap(middle) > 0:
            low = middle
        else:
            high = middle
    return (low + high) / 2


def world_text(base: str, share: float, scale_hours: float, rates: dict[str, float],
               header: str) -> str:
    """world.yaml's text with the proximity share, scale and rates set and nothing else changed."""
    text, n = re.subn(r"^(  proximity:\n    share: )[^\n]*\n(    scale_hours: )[^\n]*$",
                      rf"\g<1>{share!r}\n\g<2>{scale_hours!r}", base, flags=re.M)
    if n != 1:
        raise ValueError("world.yaml must have exactly one demand.proximity block")
    lines, kind, set_rates = text.split("\n"), None, set()
    for i, line in enumerate(lines):
        found = re.fullmatch(r"    (\w+):", line)
        if found and found.group(1) in LATENT_TYPES:
            kind = found.group(1)
        elif line.startswith("      proximity_rate:") and kind is not None:
            lines[i] = f"      proximity_rate: {rates[kind]!r}"
            set_rates.add(kind)
    if set_rates != set(LATENT_TYPES):
        raise ValueError("world.yaml must give every latent type a proximity_rate")
    return header + "\n".join(lines)


def expected_world(base: World, share: float, scale_hours: float, rates: dict[str, float]) -> World:
    types = {name: dataclasses.replace(spec, proximity_rate=rates[name])
             for name, spec in base.demand.types.items()}
    proximity = dataclasses.replace(base.demand.proximity, share=share, scale_hours=scale_hours)
    return dataclasses.replace(base, demand=dataclasses.replace(
        base.demand, types=types, proximity=proximity))


def survival_by_type(rows: list[dict[str, Any]]) -> dict[str, dict[str, float]]:
    out = {}
    for kind in LATENT_TYPES:
        mine = [r["survives"] for r in rows if r["kind"] == kind]
        out[kind] = {"bookings": len(mine), "survival": sum(mine) / len(mine)}
    return out


def calibrate(config: dict[str, Any], worlds_dir: Path = CONFIGS / "worlds") -> dict[str, Any]:
    world_path = CONFIGS / config["world"]
    variant_path = CONFIGS / config["variant"]
    base = load_world(world_path)
    if base.demand.proximity.share != 0 or any(t.proximity_rate for t in base.demand.types.values()):
        raise ValueError(f"{config['world']} must be world h3: proximity share 0 and every rate 0")
    which = seeds(config["calibration_seeds"])
    theta = float(config["scale_hours"])
    rows = accepted_bookings(base, variant_path, which)

    by_kind = {}
    for kind in LATENT_TYPES:
        mine = [r for r in rows if r["kind"] == kind]
        by_kind[kind] = (
            np.array([weibull_hazard_by_departure(base, r) for r in mine]),
            np.array([proximity_hazard_by_departure(r["hours_left"], rate=1.0, scale_hours=theta)
                      for r in mine]),
        )

    report: dict[str, Any] = {
        "config": config,
        "world_h3": {
            "target_survival": {k: float(np.mean(np.exp(-w))) for k, (w, _) in by_kind.items()},
            "realised": survival_by_type(rows),
        },
        "worlds": {},
    }
    base_text = world_path.read_text(encoding="utf-8")
    for share in config["shares"]:
        rates = {k: solve_rate(w, unit, share, upper=config["rate_upper"],
                               tolerance=config["rate_tolerance"])
                 for k, (w, unit) in by_kind.items()}
        name = f"proximity_w{share}.yaml"
        header = (
            "# ALTERNATIVE WORLD for experiment X1 (docs/EXPERIMENT_PROTOCOL.md, sections 26 and 27).\n"
            "# Generated by experiments/proximity/calibrate.py from experiments/configs/world.yaml and\n"
            "# proximity.yaml; do not edit by hand. Identical to world.yaml except: demand.proximity.share\n"
            f"# is {share!r} and each type's proximity_rate is set so that the type keeps its world-h3\n"
            "# chance of reaching departure (calibration seeds "
            f"{which[0]}-{which[-1]}, variant B0).\n\n"
        )
        path = worlds_dir / name
        path.write_text(world_text(base_text, share, theta, rates, header), encoding="utf-8")
        world = load_world(path)
        if world != expected_world(base, share, theta, rates):
            raise AssertionError(f"{name} differs from world.yaml in more than the proximity settings")
        realised = survival_by_type(accepted_bookings(world, variant_path, which))
        report["worlds"][name] = {
            "share": share,
            "rates_per_hour": rates,
            "analytic_survival": {
                k: float(np.mean(np.exp(-(1.0 - share) * w - rates[k] * unit)))
                for k, (w, unit) in by_kind.items()},
            "realised": realised,
        }
    return report


def main() -> None:
    report = calibrate(load_proximity())
    REPORTS.mkdir(exist_ok=True)
    out = REPORTS / "proximity-calibration.json"
    out.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(f"{'type':<16}{'target':>9}" + "".join(f"{n:>34}" for n in report["worlds"]))
    for kind in LATENT_TYPES:
        cells = "".join(
            f"   rate {w['rates_per_hour'][kind]:.6f}  realised {w['realised'][kind]['survival']:.4f}"
            for w in report["worlds"].values())
        h3 = report["world_h3"]
        print(f"{kind:<16}{h3['target_survival'][kind]:>9.4f}  (h3 realised "
              f"{h3['realised'][kind]['survival']:.4f}){cells}")
    print(f"wrote {out.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
