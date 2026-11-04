# sim

SimPy simulator for the Kolhapur to Pune corridor. It writes the same events, with the
same meaning, as core-api, so `experiments/analysis/metrics.sql` reads simulated and live
rows alike.

## Run it

```sh
docker compose up -d --wait postgres core-api    # core-api's Flyway creates `events`
docker compose --profile research run --rm research \
    python -m sim.run --variant experiments/configs/variants/B0.yaml
```

Defaults to seeds 1-30 and `experiments/configs/world.yaml`. `--seeds 1-3` runs fewer;
`--run-id <uuid>` adds a variant to an existing run so variants can be compared. The
command prints the `run_id` the metric queries need.

Tests: `docker compose --profile research run --rm research` (runs `pytest`).

## What is modelled

| Piece | How |
|---|---|
| Supply | Poisson rides per day; each has a departure hour, seats, a publish time 1-7 days ahead, and a chance the driver withdraws it |
| Demand | Poisson searches; each passenger has a preferred departure, a party size and a latent type |
| Matching | Open rides inside the booking horizon, within the passenger's time tolerance, with enough seats; ordered by the variant's ranking |
| Booking | The top candidate is requested with the type's booking probability; the seat is held; the driver answers after a delay |
| Cancellation | Weibull hazard per latent type over hours since acceptance, multiplied after an unobservable shock (`hazard.py`). A world may move a share of it to a second hazard that rises as departure nears (`demand.proximity`, experiment X1); the booking is cancelled by whichever comes first. world.yaml moves none |
| Refill | A seat released by a passenger can be taken by a later search; that booking logs `seat_refilled` |
| Trip | At departure unanswered requests are rejected and each confirmed booking starts a trip; it ends as `trip_completed` or, for a no-show, `trip_failed` |

Trip events are per passenger booking, as in core-api.

## Rules this code keeps

- **Latent type stays inside.** `Passenger.kind` drives behaviour and never enters an event
  payload. `test_latent_type_never_appears_in_any_event` enforces it.
- **No tunable in Python.** Rates, probabilities and hazard parameters come from
  `experiments/configs`; loading is strict, so a typo is an error, not a default. Only the
  frozen parameters live in code (`frozen.py`).
- **Paired environments.** Supply, arrivals and each passenger's draws use separate random
  streams keyed by the seed. Two variants with the same seed face the same rides and the
  same passengers; tests check that changing supply leaves demand untouched and the
  reverse.

## Simplifications to know about

- Every trip is the full corridor. Intermediate stops and per-leg inventory exist in
  core-api but not here.
- One driver per ride; repeat drivers and driver reputation are not modelled.
- A passenger searches once. A rejected, cancelled or empty-handed passenger does not
  come back, so there is no recovery (`recovery_search`, `recovery_booked` never occur).
- Only variant B0 exists. `hazard_scored`, tiers, interventions, supply gaps and nudges
  are not emitted yet.
- A search may ask for a date no later than the last simulated day, which thins demand
  slightly in the final week.
- The numbers in `world.yaml` are assumptions, not estimates from data.
