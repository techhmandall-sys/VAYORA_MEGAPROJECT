# Implementation roadmap

What is left of the 95-feature backlog, grouped by what it needs, in the order proposed to
build it. FEATURE_MATRIX.md is the record of each feature's state; this file is a plan,
and like any plan it is a proposal.

## Two things the team has not yet decided

- **Stage definitions.** CLAUDE.md says the work is built in eight stages. Stage 2 (booking
  core) and Stage 3 (the simulator) were named in the original prompts; what Stages 1 and
  4 to 8 contain has never been given. The order below is therefore not organised by
  stage.
- **Feature tiers.** The backlog's Tier column is `TBD` for every row. The original A, B
  and C tiers were never supplied, so "must have" and "nice to have" are not separated
  here either.

Both should be settled before this plan is taken as the team's. Until then the order
below is the authors' recommendation, with reasons.

## Where things stand

As of 2026-11-12: of the 89 features still in scope (the team removed 6 of the 95 on 2026-11-02),
**84 verified and 5 partial**, about 97% counting a partial feature as half. The five are masked
calling (61) and SMS (64), which need a Twilio account; Hindi and Marathi (71), which need a native
speaker's review; and the durability model (77) and demand calibration (89), which need real rides
and searches. Nothing remains that is only a matter of building.

Outside the 95, built on 2026-11-12: resetting a forgotten password, signing out so a session
ends at once, a member's copy of their data and deleting their account; and experiment X7
(EXPERIMENT_PROTOCOL.md section 32). Still open: rebuilding every current result in one run
(`scripts/reproduce.sh` covers only the earlier world's runs) and archiving it, and running the
online setup on a real server, which needs one and a domain.

The tables below are as written on 2026-10-21, with lines struck through as items were done.

## What is left, by what it needs

### A. Can be finished with what exists, no outside service

Ordered by value to the research question first, then by size.

| # | Feature | What is missing | Size |
|---|---|---|---|
| 89 | Corridor demand calibration | Needs real demand figures to calibrate against, which do not exist; left not started by decision on 2026-10-21, a timetable proxy declined | Blocked on data |
| ~~84~~ | ~~Mid-route seat allocation~~ | Done on the platform, 2026-10-17 | |
| ~~76~~ | ~~Two-sided match scoring~~ | Done on the platform, 2026-10-19; the simulator still has no geography for it (B1, B2) | |
| ~~87~~ | ~~Live what-if simulator~~ | Done, 2026-10-19: intel simulates a sweep's cell at any value within its bounds, for an administrator; exploratory, no interval | |
| ~~94~~ | ~~Driver commitment pricing~~ | Done, 2026-10-17: a lower passenger fee on rides by drivers who keep their rides | |

### B. Needs an outside service or account

None of these can be completed honestly without the service. Each can be built against a
mock that says so, as payments and SMS already are.

| # | Feature | Needs |
|---|---|---|
| ~~2~~ | ~~Google sign-in, tried for real~~ | Done, 2026-11-02: a real Gmail account signed in and was linked |
| 1, 6, 64 | Phone sign-up, real SMS codes and notifications | An SMS gateway account; built for Twilio on 2026-10-20, off until its settings are set, and untried |
| 63 | Email with a real provider | Built for any SMTP server; needs an account with one to try it |
| 61 | Masked calling | A telephony provider; built as a labelled mock on 2026-10-17, and as a Twilio call bridge on 2026-10-20, off until its settings are set, and untried |
| ~~46~~ | ~~Card, UPI and wallet doing something different~~ | Done as the team changed it on 2026-11-02: cash or UPI, paid to the driver directly; Razorpay was removed |
| 7, 8 | Government ID verification and a real verified badge | An identity verification provider, and a privacy review; built as a labelled mock (the driver's declaration of which document they hold) on 2026-10-19 |
| 58 | Insurance badge | An insurer; built as a labelled mock (the driver's declaration) on 2026-10-17 |
| ~~91~~ | ~~Last-mile access beyond walking~~ | Done, 2026-10-20: walks on footpaths, buses, and an auto-rickshaw estimate with Pune's published meter fare; other towns' fares are not published in full | |

### C. Research work

| Item | What it is | Why it matters |
|---|---|---|
| ~~Split "offered no ride"~~ | Done: two empty searches in three meet only full rides (EXPERIMENT_PROTOCOL.md section 16) | |
| ~~Time-tolerance sweep~~ | Done: a wider window does not help (EXPERIMENT_PROTOCOL.md section 9) | |
| ~~Publishing-lead sweep~~ | Done: late publishing explains little; most empty searches are full rides (EXPERIMENT_PROTOCOL.md section 10) | |
| ~~Refills by release timing~~ | Done: early releases are refilled 94%, late ones 68%; B4 moves too few (EXPERIMENT_PROTOCOL.md section 11) | |
| ~~Oracle variant~~ | Done: the ceiling is +0.10 per 100 searches (EXPERIMENT_PROTOCOL.md section 12) | |
| ~~Oracle across release probability~~ | Done: the ceiling is +0.05 to +0.22 as the release chance goes from 0.25 to 1.0 (EXPERIMENT_PROTOCOL.md section 15) | |
| ~~B5 with random choice~~ | Done: random choice does as well; the scheduler does not beat chance (EXPERIMENT_PROTOCOL.md section 14) | |
| ~~Survival-threshold sweep; B4 with the no-feature model; component removal~~ | Done: no threshold helps, the features add nothing, all the gain is the ranking (EXPERIMENT_PROTOCOL.md section 14) | |
| Variants B6 to B11 | Not defined anywhere in the repository | Need their definitions |
| ~~The public hotel dataset~~ | Done: it records the day of each cancellation, so it supports a check to the day; over the last week its bookings cancel at well under the simulator's rate, with similar timing (EXPERIMENT_PROTOCOL.md section 18) | |

### D. Not code

| Item | Who |
|---|---|
| Use every screen as a person would, on a phone | The team. A script drove every screen in headless Edge (2026-10-15 to 17) and found eight faults the tests had missed; nobody has yet used the app by hand |
| Native-speaker review of the Hindi and Marathi text | The team |
| Confirm or replace the assumed values in `world.yaml`, `B5.yaml`, pass prices | The team |
| Decide how to present a central hypothesis the simulator did not support | The team and the guide |

## Proposed order

1. ~~The browser check (D)~~: done by script, 2026-10-15 to 17. A person using it on a
   phone is still owed.
2. ~~The research items (C)~~: done except B6 to B11, which wait on their definitions.
3. ~~Small platform items from A~~: boarding code, completion confirmation, rating
   reminder, response rate and the reproducibility capsule are all built.
4. ~~The two reserved event families (81, 93)~~: flexibility tiers and supply-gap nudges
   are built.
5. **Group B, one service at a time**, only if the team gets the accounts. Otherwise
   leave them as clearly labelled mocks and say so in the report.
6. **Group A, each once its policy or placement is decided.**

## What will not be built

- Anything that cancels a booking or changes a price because of a predicted risk. The
  project's own rules forbid it.
- A sync layer between stores, a third data store or a fourth runtime. CLAUDE.md forbids
  them. Photos (3, 16) are kept in PostgreSQL for that reason, not in a file store.
