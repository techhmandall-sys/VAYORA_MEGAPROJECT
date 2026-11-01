# VAYORA — binding project rules

AI-powered intercity shared mobility platform. Final-year B.Tech project, CSE (Data
Science), DYPCET Kolhapur, team of 4.

This file is binding. If a prompt, an issue or a convenient shortcut conflicts with it,
this file wins and the conflict gets reported, not silently resolved.

## The one idea this project tests

An early cancellation is a success. A seat released three days before departure gets
refilled and the journey completes; the same seat released two hours before departure
is destroyed capacity. We model booking durability as a survival curve over the
seven-day horizon and act on it while action still helps.

The metric is **completed rides per 100 searches**, never bookings. Every stage either
serves this or is cut.

## Frozen parameters — do not change

| Parameter        | Value                              |
|------------------|------------------------------------|
| Corridor         | Kolhapur to Pune, ~230 km          |
| Booking horizon  | 7 days                             |
| Simulated span   | 60 days                            |
| Seeds            | 30 per variant                     |
| Primary metric   | completed rides per 100 searches   |

These bind the research: the simulator, the experiments and every number in the report. The
platform itself serves routes anywhere in India, as the team decided on 2026-11-01; that changes
nothing about the research, which stays on this corridor.

## Architecture rule — settles every placement question

- **Spring Boot** (`core-api/`) owns transactions and truth.
- **FastAPI** (`intel/`) owns inference and holds no state.
- **Express** (`gateway/`) owns ephemeral streams only.
- **React** (`web/`) renders.
- No service forwards a request on another service's behalf.

## Data placement

- **PostgreSQL + PostGIS**: users, vehicles, rides, route geometry, bookings, payments,
  passes, trips, and the event log.
- **MongoDB**: chat, GPS traces, notifications.
- **Redis**: seat holds, OSRM cache, sessions.

No entity lives in two stores. There is no sync layer and there must never be one.
No third data store, no fourth runtime.

## Research integrity rules — non-negotiable

1. Latent passenger types (`committed` / `flexible` / `opportunistic` /
   `deadline_bound`) drive real behaviour in the simulator and are NEVER exposed as
   model features. If you are about to pass latent type into a feature vector, stop.
2. Ground truth is deliberately misspecified: cancellations generate from a Weibull
   hazard with unobservable shocks; we fit Cox PH and gradient-boosted survival,
   neither of which can represent the generator. This is intentional.
3. No seed leakage. Train and validate on disjoint seed sets, always.
4. Driver nudge conversion is a swept parameter, never a reported result — supply
   elasticity cannot be identified from simulation.
5. Every threshold, budget and elasticity lives in `experiments/configs/*.yaml`.
   No tunable number hard-coded in Python.

## Event log

- Every number in the report is a SQL aggregate over the `events` table, through
  `experiments/analysis/metrics.sql`.
- The 24-event vocabulary is frozen (extended from 22 on 2026-10-26 to add
  `last_mile_shown` and `last_mile_option_selected`, with explicit approval). A new
  event type needs explicit approval first.
- Payload keys are snake_case and timestamps ISO-8601 with offset, from both writers.
- `booking_cancelled` payloads carry `departure_time`; the late-cancellation metric
  depends on it.
- The Java writer never throws into its caller. The Python writer fails loudly.

## How we work

- Eight stages, built in order. Each ends with its acceptance test, a short status and
  a stop for approval. No skipping ahead, no scaffolding for a later stage.
- Small commits, one concern each.
- Tests alongside code for anything in `core-api/booking`, `core-api/refund`,
  `intel/hazard` or `intel/scheduler`.
- Ambiguous design decision after checking the rules above: ask, do not guess.
- Every new dependency must be justifiable in one sentence.

## Repository layout

| Path           | What                                                        |
|----------------|-------------------------------------------------------------|
| `infra/`       | Docker support: OSRM corridor preparation, health check     |
| `core-api/`    | Spring Boot 3, Java 21, `com.dypcet.vayora`, Flyway        |
| `intel/`       | FastAPI, Python 3.11, pinned requirements                   |
| `gateway/`     | Express 4 + Socket.IO 4, JWT verification                   |
| `web/`         | Vite + React 18 + TypeScript + Tailwind                     |
| `vayora_events/` | Python event-log writer; same table and vocabulary as core-api |
| `sim/`         | SimPy simulator (Stage 3)                                   |
| `experiments/` | Configs and experiment runners; all tunables in `configs/`  |
| `docs/`        | Report material and `figures/`                              |
