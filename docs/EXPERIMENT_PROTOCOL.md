# Experiment protocol

## Question

Does modelling booking durability as a time-to-event process, and acting on the
estimate before departure, raise **completed rides per 100 searches** over a baseline
that does neither?

This is a hypothesis under test. Section 5 reports what the first full run found.

## 1. Fixed design

| Item | Value | Where it is fixed |
|---|---|---|
| Corridor | Kolhapur to Pune | `sim/frozen.py` |
| Booking horizon | 7 days | `sim/frozen.py` |
| Simulated span | 60 days | `sim/frozen.py` |
| Seeds per variant | 30 (seeds 1-30) | `sim/frozen.py` |
| Primary metric | completed rides per 100 searches | `metrics.sql`, `primary_metric` |
| World | `experiments/configs/world.yaml` | every value an assumption |
| Model seeds | train 1001-1020, validation 2001-2010 | `experiments/configs/hazard.yaml` |

## 2. Variants

| Variant | Ranking | Model | Intervention | Status |
|---|---|---|---|---|
| B0 | Closest to the preferred departure time | none | none | Run |
| B1 | Feasibility filter | | | Not built: the simulated corridor has one origin and one destination, so there is no geography to filter |
| B2 | Two-sided ranking | | | Not built |
| B3 | Predicted survival to departure | `h3-cox` | none | Run |
| B4 | As B3 | `h3-cox` | Reconfirmation request when estimated survival is below 0.8, at most once per booking, never within 24 h of departure, scored every 24 h | Run |
| B5 | As B3 | `h3-cox` | As B4, but at most 2 requests per daily round, 1 per ride, and 4 seats asked about per departure day, chosen by the contact scheduler | Run (section 8) |
| B3-KM | As B3 | `h3-km`, which uses no booking feature | none | Run (section 14) |
| B4-KM | As B3-KM | `h3-km` | As B4 | Run (section 14) |
| ASK-ONLY | As B0 | `h3-cox`, for choosing whom to ask only | As B4 | Run (section 14) |
| B5-RANDOM | As B3 | `h3-cox` | As B5, but the requests go to eligible bookings in a random order, not the scheduler's choice | Run (section 14) |
| ORACLE | As B3 | `h3-cox`, for ranking only | As B4, but asks exactly the bookings the simulator knows will cancel within 24 h of departure: an upper bound, not a method | Run (section 12) |
| EARLIEST | Soonest departure inside the passenger's window | none | none | Run (section 21) |
| B6-B11 | | | | Not built |

The models named are the current ones, of world h3 (section 20). Sections 5 to 19 record
runs made under earlier worlds with models `h1` (section 5 and 6) and `h2` (sections 7 to
19), as each section says; their numbers are kept as they were found, and section 20 gives
the current ones.

The platform never cancels a booking. An intervention only asks; the passenger decides.

## 3. How variants are compared

- **Paired by seed.** Supply, search arrivals and each passenger's random draws come
  from separate streams keyed by the seed, so a seed is the same world under every
  variant. Tests verify that every variant faces identical searches and identical rides.
- **Per-seed differences** against the baseline, with a 95% t interval on the mean
  difference and a Wilcoxon signed-rank test (`experiments/analysis/compare.py`).
- **Every figure is a SQL aggregate over the `events` table** through `metrics.sql`.
- No correction for multiple comparisons is applied. With three variants and seven
  measures, treat any single p-value near 0.05 as unremarkable.

## 4. Reproducing a run

**One command rebuilds every current result** and fails unless each file comes out
exactly as committed:

```sh
scripts/reproduce.sh              # tests, model, ladder, sweeps: about an hour
scripts/reproduce.sh --no-sweeps  # without the sweeps
```

It was run in full on 2026-10-16. The model files, the model report, the ladder report
and the departure-tolerance and publishing-lead sweeps came out byte for byte as
committed. The contact-budget sweep report came out with three more tables, because
sweep reports gained those measures after it was first written; every number already in
it was identical, and the fuller report is now the committed one. Ladders `...001` and
`...002` and sweeps `...001` and `...002` were made with earlier code and are kept as
history; the script does not rebuild them.

Since 2026-10-19 it also rebuilds the hotel comparison (section 18), downloading the
public file the first time. Run in full that day with the hotel step included, it
reproduced every committed number exactly.

To run a single comparison by hand:

```sh
docker compose up -d --wait postgres core-api
RUN=$(python -c "import uuid; print(uuid.uuid4())")
for v in B0 B3 B4 B5; do
  docker compose --profile research run --rm research \
    python -m sim.run --variant experiments/configs/variants/$v.yaml --run-id $RUN
done
docker compose --profile research run --rm research \
  python -m experiments.analysis.compare --run-id $RUN --baseline B0 B3 B4 B5
```

The simulator is deterministic given a seed, so a rerun reproduces the same events and
the same report. The model is retrained with `python -m experiments.hazard.train`, which
is also deterministic.

## 5. First full run

Run `7a1c0de0-0000-4000-8000-000000000001`, 30 seeds per variant. Source:
`experiments/reports/ladder-7a1c0de0-0000-4000-8000-000000000001.md`. Synthetic data.

| Measure | B0 | B3 | B4 |
|---|---|---|---|
| Completed rides per 100 searches | 29.59 | 29.89 | 29.89 |
| difference vs B0 (95% CI) | | +0.30 (+0.24 to +0.36) | +0.29 (+0.22 to +0.36) |
| seeds better / worse than B0 | | 29 / 1 | 28 / 1 |
| Late share of cancellations | 0.390 | 0.394 | 0.340 |
| difference vs B0 (95% CI) | | +0.004 (+0.000 to +0.008) | -0.050 (-0.058 to -0.042) |
| Released seats refilled, per seed | 157.4 | 157.8 | 168.6 |
| Reconfirmation requests per accepted booking | 0 | 0 | 0.190 |

### What this shows

1. **Survival-aware ranking gives a small, consistent gain**: +0.30 completed rides per
   100 searches, about 1% of the baseline, better on 29 of 30 seeds.
2. **The intervention works mechanically.** Cancellations move earlier (late share falls
   by 0.05, on all 30 seeds) and about 11 more released seats per seed are refilled.
3. **The intervention adds nothing to the primary metric.** B4 and B3 are
   indistinguishable on completed rides (29.89 and 29.89). At these parameter values the
   hypothesis that acting on the estimate before departure raises completed rides is
   **not supported** beyond what ranking alone achieves.

### Why the third point should not yet be taken as the answer

- **The response assumptions decide it.** B4's outcome depends on
  `intervention_response` in `world.yaml`: a passenger who would have cancelled releases
  early with probability 0.5, and one who would have travelled cancels out of annoyance
  with probability 0.02. Both numbers are guesses and a simulation cannot estimate them.
  About 19% of accepted bookings are contacted and most of those would have travelled,
  so even a 2% annoyance rate costs trips of the same order as the refills gain.
- **The model discriminates weakly** (concordance 0.59), so a threshold contacts many
  bookings that were never at risk.
- **Passengers search once.** One who is cancelled on, rejected or finds nothing never
  returns, so a released seat can only be taken by a new arrival.
- **One threshold, one interval, one world.** None has been swept.

## 6. Sweep: how passengers respond to being asked

Run `5eeb0000-0000-4000-8000-000000000001`, 30 seeds per cell. Source:
`experiments/reports/sweep-intervention-response-5eeb0000-0000-4000-8000-000000000001.md`.
Config: `experiments/configs/sweeps/intervention_response.yaml`. B4 on a world with the
two response parameters replaced, against B3 on the unmodified world, paired by seed.
Synthetic data.

Difference in completed rides per 100 searches, B4 minus B3 (B3 = 29.89), with 95% CI:

| Releases when asked | Annoyed: 0 | Annoyed: 0.02 | Annoyed: 0.05 |
|---|---|---|---|
| 0.25 | +0.02 (+0.00 to +0.04) | -0.02 (-0.04 to +0.01) | -0.06 (-0.10 to -0.02) |
| 0.5 | +0.03 (+0.00 to +0.06) | -0.01 (-0.04 to +0.02) | -0.05 (-0.09 to -0.02) |
| 1.0 | +0.06 (+0.02 to +0.10) | +0.02 (-0.02 to +0.06) | -0.02 (-0.07 to +0.02) |

Change in the late share of cancellations (B3 = 0.394) runs from -0.022 at (0.25, 0) to
-0.108 at (1.0, 0.05), lower than B3 on at least 29 of 30 seeds in every cell.

### What this shows

1. **The intervention is worth almost nothing on the primary metric anywhere on the
   grid.** In the best case there can be, where every passenger destined to cancel
   releases the moment they are asked and nobody is ever put off, the gain is +0.06
   completed rides per 100 searches: 0.2% of the baseline.
2. **It can do harm.** With 5% of contacted travellers put off, the difference is
   negative in all three rows and its interval excludes zero in two.
3. **It reliably makes cancellations earlier**, by up to a quarter of the late share.

So section 5's caveat is resolved in one direction: the null result on completed rides
is not an artefact of the assumed response. In this world, **earlier release does not
turn into more completed rides**, whatever passengers do when asked.

### Why that might be, and what would test it

These are hypotheses, not findings:

- **Nobody comes back.** A passenger who found nothing, was rejected or was cancelled on
  never searches again, so a released seat can only be taken by a fresh arrival whose
  preferred time is within two hours of that ride. Modelling repeat search is the most
  direct test.
- **Refill depends on excess demand at the right time.** Sweeping `searches_per_day`
  and `rides_per_day` would show whether the gain appears when seats are scarcer.
- **Most released seats were going to be released anyway.** The intervention moves a
  cancellation earlier; if the original time was already early enough to refill, the
  move buys nothing. The late share shows only 39% of cancellations are late to begin
  with.
- **The primary metric may be the wrong place to look for this effect.** The
  intervention's measurable effect is on *when* seats come back. Whether that has value
  the primary metric does not capture (driver certainty, less last-minute disruption)
  is a question for the team, and must be decided before looking at more results, not
  after.

### Still to run

- Repeat search by unserved passengers, then B3 against B4 again.
- A sweep of supply and demand density, and of the survival threshold.
- B4 with the no-feature model (`h1-km`), to separate the value of the features from
  the value of knowing time-to-departure.
- Component-removal: B4's intervention with B0's ranking.

## 7. Two more worlds: repeat search, and supply density

After section 6 the world was changed so that a passenger left without a seat may search
again (`demand.retry` in `world.yaml`: probability 0.6, up to two further attempts). The
model was retrained on that world as `h2` (`experiments/reports/hazard-h2.json`:
concordance 0.595, departure Brier 0.1018 against 0.1037 for the no-feature curve).
Sections 5 and 6 used the earlier world and model `h1`; their numbers are not comparable
with the ones below.

### Ladder with repeat search

Run `7a1c0de0-0000-4000-8000-000000000002`, 30 seeds per variant. Synthetic data.

| Measure | B0 | B3 | B4 |
|---|---|---|---|
| Completed rides per 100 searches | 30.77 | 31.11 | 31.10 |
| difference vs B0 (95% CI) | | +0.34 (+0.25 to +0.42) | +0.33 (+0.24 to +0.42) |
| Late share of cancellations | 0.373 | 0.376 | 0.321 |

### Supply density

Run `5eeb0000-0000-4000-8000-000000000002`, 30 seeds per cell, B4 against B3 **on the same
world** (`experiments/configs/sweeps/supply_density.yaml`). Synthetic data.

| Rides per day | B3, completed per 100 | B4 minus B3 (95% CI) | Change in late share |
|---|---|---|---|
| 6 | 17.79 | +0.00 (-0.03 to +0.03) | -0.058 |
| 12 | 31.11 | -0.01 (-0.04 to +0.03) | -0.056 |
| 20 | 40.94 | -0.04 (-0.07 to -0.01) | -0.054 |

The model was trained at 12 rides a day, so at 6 and 20 it is used outside the world it
learnt from.

### What this shows

Three things were varied that could each have explained the null result: how passengers
respond when asked (section 6), whether unserved passengers come back, and how scarce
seats are. In every case the answer is the same:

- **Survival-aware ranking gives a small, reliable gain**, about 1% of the baseline.
- **Asking bookings to reconfirm adds nothing to completed rides**, and is slightly
  harmful where seats are plentiful.
- **It reliably makes cancellations earlier**, by about 0.055 of the late share, on all
  30 seeds in every world tried.

The project's central idea, that an early cancellation is a success because the seat is
refilled and the journey completes, is **not supported by this simulator** as far as
completed rides are concerned. Earlier release happens; the extra completed rides do not
follow.

### What this does not show

- That the idea is wrong in reality. This is one synthetic corridor whose every parameter
  is an assumption. A world could be built in which it works; none of the three most
  obvious candidates did.
- Anything about value the primary metric does not measure, such as a driver knowing a
  seat is free a day earlier. Whether to measure that is the team's decision, and it
  should be made on its merits, not because the primary metric disappointed.

### Still to run

- Why refills do not convert: how many released seats are refilled at all, and whether
  the bookings that refill them would have found another ride anyway.
- A sweep of the survival threshold, and B4 with the no-feature model (`h1-km`).
- Component-removal: B4's intervention with B0's ranking.

## 8. A contact budget, and why refills do not add rides

Run on 2026-10-13. Synthetic data; 30 seeds per variant; model `h2-cox`; the world of
section 7 (repeat search on, 12 rides a day).

- Ladder: `experiments/reports/ladder-7a1c0de0-0000-4000-8000-000000000003.md`
- Sweep: `experiments/reports/sweep-contact-budget-5eeb0000-0000-4000-8000-000000000003.md`

B0, B3 and B4 reproduce section 7's ladder to every printed digit, which is the check
that adding the budget changed nothing for variants without one.

### B5 in the ladder (differences against B0)

| | B3 | B4 | B5 |
|---|---|---|---|
| Completed rides per 100 searches | 31.11 (+0.34) | 31.10 (+0.33) | 31.10 (+0.33) |
| Late share of cancellations | 0.376 | 0.321 | 0.357 |
| Requests per accepted booking | 0 | 0.207 | 0.083 |
| Released seats refilled | 186.2 | 197.4 | 191.5 |

### The budget swept (differences against B4, which asks everyone eligible)

| Requests allowed per round | Requests per accepted booking | Share of B4's requests | Late share | Share of B4's late-share reduction |
|---|---|---|---|---|
| 1 | 0.042 | 20% | 0.367 | 16% |
| 2 | 0.083 | 40% | 0.357 | 35% |
| 4 | 0.149 | 72% | 0.338 | 69% |
| 8 | 0.183 | 88% | 0.327 | 89% |
| no limit (B4) | 0.207 | 100% | 0.321 | 100% |

The last column is `(0.376 - late share) / (0.376 - 0.321)`, B3 being the same ranking
with no requests. It is arithmetic on the two reports' means, not a paired statistic.

Completed rides per 100 searches does not move with the budget: every cell is within
0.01 of B4 and every interval includes zero.

### What this shows

- **The budget buys what it pays for and no more.** The effect on the late share is
  close to proportional to the number of requests sent, and slightly below proportional
  when the budget is tight. The scheduler's choice of whom to ask does not concentrate
  the effect on fewer requests.
- That is a finding about the worth formula and the model, not about the solver. The
  formula favours bookings far from departure with many seats; the model that scores
  them discriminates weakly (concordance 0.59). Neither points reliably at the bookings
  whose release would otherwise have come late.
- **A random choice of the same number of requests was not run.** Without it, "no better
  than proportional" cannot be sharpened to "no better than chance".
- The primary metric is as indifferent to how many are asked as it was to whether
  anyone is.

### Why refills do not add completed rides

A new measure, `refill_additionality` in `metrics.sql`, asks of every booking that took
a released seat: was the passenger's search offered any other ride? A passenger offered
another ride would have asked for one anyway, so only a refill by a passenger offered
nothing else can be a booking that would not otherwise exist.

| | B0 | B3 | B4 | B5 |
|---|---|---|---|---|
| Released seats refilled, per seed | 183.0 | 186.2 | 197.4 | 191.5 |
| of which by a passenger offered no other ride | 77.7 | 76.4 | 76.4 | 76.1 |
| Searches offered no ride at all | 0.550 | 0.545 | 0.542 | 0.544 |

- **B4 refills 11 more seats per seed than B3, and none of the extra go to a passenger
  who had no alternative.** The count of only-option refills is the same to one decimal
  with and without the intervention. The seats released early are taken by passengers
  who would have booked a different ride.
- This is an explanation that fits, not a proof. Only-option refills are an upper bound
  on added bookings, not a count of them; the B3-to-B4 comparison is of means, and no
  paired test of that difference was run.

  **Corrected on 2026-11-04.** Only-option refills are *not* an upper bound on added
  bookings. A refiller who had another ride on offer leaves that ride's seat free, and a
  later searcher with no other option can take it: a booking added without any only-option
  refill. The count describes who takes released seats; what a policy adds is measured by
  comparing seats standing at departure across variants, which change by refilled minus
  released minus otherwise-empty seats. The sentence above is kept so the record shows what
  was believed.
- **More than half of all searches are offered nothing.** Demand for seats is not what
  is missing. A search is offered nothing when no ride within the passenger's time
  tolerance has enough seats, and the event log does not say which of the two it was.
  If it is mostly timing, a seat released on Tuesday's 06:00 ride cannot help someone
  who needs Thursday evening, however early it is released.

That last point is the most useful thing the project has learnt about its own idea:
in this simulator an early release fails to add rides not because nobody wants a seat,
but because the people who want one mostly want a different departure.

**Corrected by section 9.** The paragraph above was a guess, and the sweep run to test
it does not support it: with an 8-hour window, which covers nearly every departure of
the day, 52% of searches are still offered nothing and early releases add no rides. It
is kept here so the record shows what was believed and why it changed.

### Still to run

- ~~Split "offered no ride" into no ride in the time window and no seats on the rides in
  it.~~ Approved and run: section 16.
- B5 with requests chosen at random within the same limits.
- ~~The time-tolerance sweep the finding above points to.~~ Run: section 9.
- Still open from section 7: a sweep of the survival threshold, B4 with `h1-km`, and
  B4's intervention with B0's ranking.

## 9. A wider departure window

Run on 2026-10-15. Synthetic data; 30 seeds per cell; model `h2-cox`; repeat search on.
Report: `experiments/reports/sweep-departure-tolerance-5eeb0000-0000-4000-8000-000000000004.md`

The question, from section 8: if passengers accept a departure further from the time they
asked for, do the seats B4 frees early start to add completed rides? Tolerance changes
what everyone is offered, so each cell compares B4 with its own B3 on the same world.

| Window (hours either side) | B3 completed per 100 | B4 − B3 | B4 − B3, late share | Searches offered no ride (B3) | Extra refills by passengers with no other ride |
|---|---|---|---|---|---|
| 1 | 29.07 | +0.00 (−0.04 to +0.04) | −0.052 | 0.585 | +2.0 (−0.2 to +4.1) |
| 2 (the world's value) | 31.11 | −0.01 (−0.04 to +0.03) | −0.056 | 0.545 | +0.1 (−2.3 to +2.4) |
| 4 | 31.87 | −0.00 (−0.04 to +0.04) | −0.056 | 0.534 | −1.2 (−3.3 to +1.0) |
| 8 | 33.11 | −0.05 (−0.10 to −0.01) | −0.058 | 0.519 | −2.9 (−4.9 to −0.8) |

### What this shows

- **A wider window does not make early release pay.** At every width B4 adds nothing to
  completed rides, and at 8 hours it costs a little (−0.05, interval excluding zero; 20
  seeds down, 7 up).
- **B4 still moves cancellations earlier** by about the same amount at every width.
- **A wider window helps everyone**, with or without intervention: B3 rises from 29.07 to
  33.11 completed per 100 searches. That is the effect of passengers being more flexible,
  not of anything the platform does.
- **The guess in section 8 was wrong.** With 8 hours either side, 52% of searches are
  still offered no ride. Departure times cannot be what is missing for most of them.

### What is left to explain

Over half of all searches find no ride even when almost any departure would do, and yet
seats freed early do not reach the people who found nothing. Two explanations remain, and
neither has been tested:

- **The rides are full.** Then an early release should help someone who found nothing,
  unless those searches happened before the seat was freed and the passenger did not come
  back. Repeat search is on, but only some passengers retry.
- **The ride did not exist yet.** Rides are published 1 to 7 days ahead. A search for a
  day whose rides have not been published finds nothing, however many seats will exist.

Telling these apart needs `candidates_returned` to say why a search found nothing, the
payload change already awaiting the team's approval.

### Still to run

- ~~The split above, once approved.~~ Run: section 16.
- A sweep of how far ahead rides are published, which tests the second explanation
  without any payload change.

## 10. How far ahead rides are published

Run on 2026-10-15. Synthetic data; 30 seeds per cell; model `h2-cox`; repeat search on.
Report: `experiments/reports/sweep-publish-lead-5eeb0000-0000-4000-8000-000000000005.md`

Section 9 left two explanations for why over half of all searches find no ride. This
sweep tests one: that the ride wanted had not been published yet. Rides are published
between `publish_lead_days_min` and 7 days ahead; at 7, every ride is visible for the
whole booking horizon.

| Rides published at least | Searches offered no ride (B3) | B3 completed per 100 | B4 − B3 | Extra refills by passengers with no other ride |
|---|---|---|---|---|
| 1 day ahead (the world's value) | 0.545 | 31.11 | −0.01 (−0.04 to +0.03) | +0.1 |
| 4 days ahead | 0.525 | 31.31 | −0.03 (−0.07 to +0.00) | −9.4 |
| 7 days ahead | 0.501 | 31.53 | −0.05 (−0.09 to −0.01) | −13.5 |

### What this shows

- **Late publishing explains little.** Publishing every ride a full week ahead lowers the
  share of searches finding nothing by under 5 points, from 54.5% to 50%.
- **So most empty searches are full rides.** The configuration agrees, by arithmetic on
  its own assumptions rather than by measurement: 12 rides a day at an average of 2.56
  seats offer about 31 seats a day, while 60 searches a day at an average party of 1.4 ask
  for about 84. Since measured (section 16): two empty searches in three meet only full
  rides.
- **Early release still adds nothing, and costs a little where everything is published
  early** (−0.05 at 7 days). It moves cancellations earlier at every setting.

### The question this leaves

Seats are scarce in this world, which is the condition under which an early release
ought to pay: someone is always waiting. It does not. B4 produces about 11 to 14 more
refills per seed than B3, yet no more completed rides, and with early publishing the
refills by passengers who had no other option go *down*.

The candidates, none yet measured:

- **Late releases are refilled too.** If seats are scarce, a seat freed a few hours
  before departure may still be taken, so freeing it days earlier gains little. This is
  measurable from the existing log: the share of released seats refilled, split by how
  long before departure they were released.
- **Asking costs travellers.** Some passengers asked to reconfirm cancel because they were
  asked (the "annoyed" response in `world.yaml`), losing trips that would have run.
- **Refills move passengers between rides.** An early release lets one passenger take a
  seat another would have taken a little later.

The first is the one to measure next; it needs only a new metric query.

## 11. Why early release adds so little

Measured on 2026-10-15 over the existing ladder run of section 8
(`experiments/reports/ladder-7a1c0de0-0000-4000-8000-000000000003.md`, regenerated with the
new measures); no new simulation. Synthetic data, 30 seeds.

### Are late releases refilled anyway? No.

A new query, `refill_by_release_timing`, compares rides whose passenger releases were all
early (24 hours or more before departure) with rides whose releases were all late. Seats
on a ride are interchangeable, so this is measured per ride, not per seat; rides with both
kinds, or with a driver cancellation, are left out.

| | B0 | B3 | B4 | B5 |
|---|---|---|---|---|
| Seats refilled, rides with only early releases | 0.928 | 0.935 | 0.944 | 0.938 |
| Seats refilled, rides with only late releases | 0.665 | 0.695 | 0.685 | 0.694 |

An early release is refilled about 94% of the time, a late one about 68%. **The project's
premise holds in this simulator: an early release is worth more than a late one**, by
roughly a quarter of a seat.

### Then why no gain? Because B4 moves very few releases.

Per seed, averaged over the 30 seeds:

| | B3 | B4 | B4 − B3 |
|---|---|---|---|
| Passenger cancellations | 186.2 | 193.0 | +6.8 |
| of which late (under 24 hours) | 67.1 | 57.0 | −10.1 |
| Completed trips | 1122.9 | 1122.6 | −0.3 |
| Searches | 3611 | 3611 | |

- B4 turns about 10 late releases into early ones. At a quarter of a seat each that is
  worth about **2.6 completed trips per seed, or 0.07 per 100 searches**, before anything
  is subtracted. The experiment's interval on the difference is about ±0.035 per 100, so
  a gain this size would just about show.
- Against it: B4 also produces about 7 cancellations B3 does not. In the simulator a
  passenger who was going to travel cancels only if put off by being asked (2% of them,
  an assumed value), and some refilled seats are booked by passengers who later cancel
  in turn. Each extra cancellation is a seat that must be refilled just to break even.
- And a refill is a completed trip only if whoever took it would not have travelled
  anyway. Section 8 found that the extra refills go to passengers who had another ride on
  offer, so part of the gain is a passenger moving between rides.

The arithmetic says the effect should be small and positive; the measurement says zero
within ±0.04. The two are not far apart, and the difference is in the direction the
second and third points predict. That account fits but has not been tested piece by
piece.

### What this means for the project's idea

The idea is right about seats and wrong about this intervention. An early release does
help, but **asking risky bookings to reconfirm moves too few releases to matter**: of
about 67 late releases per seed, B4 brings forward 10. That follows from a model that
discriminates weakly (concordance 0.59) and from assuming half of those asked who were
going to cancel would say so.

### What would test it next

- A sweep of `early_release_probability` already exists (section 6) and showed at most
  +0.06; this section explains why that is the ceiling.
- The lever that matters is how many late releases can be found and moved. A better model
  is the obvious one; an oracle variant that asks exactly the passengers who will cancel
  late would show the most any reconfirmation policy could gain in this world.

## 12. The ceiling: an oracle that knows who will cancel late

Run on 2026-10-15, added to the ladder run of section 8 (same world and seeds).
Synthetic data, 30 seeds. Variant `ORACLE` (`experiments/configs/variants/ORACLE.yaml`).

**ORACLE is an upper bound, not a method.** It is B4 with one change: instead of asking
the bookings the model scores as risky, it asks exactly the bookings the simulator knows
will be cancelled less than a day before departure. No platform could know this. It reads
the hidden cancellation time, never a latent type, and writes no event B4 would not.

| Against B3, seed by seed | B4 | ORACLE |
|---|---|---|
| Completed rides per 100 searches | −0.01 (−0.04 to +0.03) | **+0.10 (+0.07 to +0.13)**, 26 seeds up, 4 down |
| Late share of cancellations | −0.055 | −0.112 |
| Requests per accepted booking | 0.207 | 0.037 |

### What this shows

- **Perfect targeting does help, and measurably.** With 30 seeds the oracle's gain is
  clear of zero.
- **But the ceiling is low: +0.10 completed rides per 100 searches**, about a third of one
  percent, while asking only 4 in every 100 bookings. That is the most a reconfirmation
  request can do in this world, given the assumed responses: half of those asked who would
  cancel do so straight away, and 2% of those who would travel are put off.
- B4 reaches none of it. It asks five times as many bookings as the oracle and moves half
  as many late cancellations, because the model cannot pick the late cancellers out
  (concordance 0.59).

### Conclusion of the research so far

In this simulated corridor:

1. An early release is worth more than a late one: early releases are refilled about 94%
   of the time, late ones about 68% (section 11). The project's premise is right.
2. Asking bookings to reconfirm is a weak lever even when aimed perfectly: at best +0.10
   completed rides per 100 searches (this section).
3. Aimed with the model that exists, it gains nothing measurable (sections 5 to 8).
4. Ranking rides by predicted durability (B3) is the only variant that has helped by
   itself: about +0.34 per 100 searches over B0, three times the oracle's ceiling.

Every number is from one synthetic corridor whose parameters are the authors'
assumptions. None is evidence about real passengers.

### Still to run

- The oracle across `early_release_probability`: the ceiling scales with how readily
  passengers who will cancel say so when asked, which is an assumption.

## 13. When cancellations come

A new named query, `cancellation_timing`, counts each seed's cancellations in bands of
hours before departure; its four bands under 24 hours add up to `late_cancellation_share`'s
`late`, which a test checks on hand-made events. `experiments/analysis/timing.py` runs it
over the ladder run and writes `experiments/reports/timing-7a1c0de0-…-003.json`, paired by
seed against B3. Figure 6 and its table are in [figures/README.md](figures/README.md).

Against B3, B4 cuts late cancellations by 10.0 per seed and cancellations 24–48 hours out by
10.1, and adds 22.7 four or more days out (+21.1 to +24.4): about 6 more cancellations in
all. ORACLE cuts late cancellations by 23.5 and moves them mostly into the one to four days
before departure. This is the mechanism behind sections 8 and 12: asking moves many
releases from "early" to "earlier", which gains nothing, and a few from late to early, which
gains little because late seats are mostly refilled anyway (section 11).

## 14. Robustness: each component removed or replaced

Run `7a1c0de0-0000-4000-8000-000000000004`, 30 seeds per variant, every variant against
**B3**, paired by seed. B0, B3, B4 and B5 reproduce run `...003` to every digit of every
measure, which is the check that nothing else changed.

| Variant | Completed per 100 | vs B3 (95% CI) | Late share vs B3 (95% CI) | Requests per accepted booking |
|---|---|---|---|---|
| B0 | 30.77 | -0.34 (-0.42 to -0.25) | -0.003 (-0.008 to +0.001) | 0.000 |
| ASK-ONLY | 30.78 | -0.33 (-0.41 to -0.25) | -0.057 (-0.062 to -0.053) | 0.209 |
| B3-KM | 31.09 | -0.01 (-0.04 to +0.01) | +0.001 (-0.001 to +0.003) | 0.000 |
| B4 | 31.10 | -0.01 (-0.04 to +0.03) | -0.056 (-0.060 to -0.051) | 0.207 |
| B4-KM | 31.08 | -0.03 (-0.08 to +0.03) | -0.056 (-0.061 to -0.051) | 0.215 |
| B5 | 31.10 | -0.01 (-0.03 to +0.01) | -0.019 (-0.023 to -0.016) | 0.083 |
| B5-RANDOM | 31.11 | -0.00 (-0.03 to +0.02) | -0.022 (-0.025 to -0.018) | 0.084 |

B3 itself: 31.11 completed per 100 searches, late share 0.376.

- **B3's gain over B0 needs no booking features.** B3-KM ranks rides with a model that knows
  nothing about the passenger or the booking, only how far off departure is, and keeps all
  of B3's gain (−0.01, −0.04 to +0.01). In this simulator the survival-aware ranking works
  because of timing, not because the model reads anything about individual passengers. The
  Cox model's features add nothing measurable to the primary metric.
- **Asking adds nothing however it is done.** Choosing whom to ask by features (B4) or by
  timing alone (B4-KM) gives the same result. Asking on B0's ranking (ASK-ONLY) does no
  better than B0 (−0.33 against B0's −0.34): all of the gain is the ranking.
- **The scheduler does not beat chance.** With the same limits, sending B5's requests to
  eligible bookings in a random order (B5-RANDOM) does as well on the primary metric and
  slightly better on the late share (−0.022 against −0.019).
- **No threshold rescues B4.** Sweep `5eeb0000-0000-4000-8000-000000000006` asks below
  0.6, 0.7, 0.8 and 0.9 against B3. The late share falls steadily, from −0.011 to −0.097,
  as more bookings are asked (0.045 to 0.375 requests per accepted booking), and released
  seats refilled rise from +3.0 to +17.6 per seed. Completed rides per 100 searches move by
  −0.02 to +0.00, with every interval spanning zero.

Read with sections 11 to 13, this closes the question the simulator can answer: on this
corridor, under these assumptions, moving cancellations earlier is real but does not turn
into completed rides, and the part of the platform that helps is a ranking that needs no
prediction about the passenger. It says nothing about real passengers, whose behaviour
the simulator only assumes.

## 15. The ceiling across passengers' response

Sweep `5eeb0000-0000-4000-8000-000000000007`: ORACLE against B3, 30 seeds, with the chance
that an asked passenger who would cancel late releases the seat at once set to 0.25, 0.5
(the assumed value) and 1.0.

| Release chance | Completed per 100, ORACLE − B3 (95% CI) | Released seats refilled, vs B3 |
|---|---|---|
| 0.25 | +0.05 (+0.02 to +0.07) | +4.0 |
| 0.5 | +0.10 (+0.07 to +0.13) | +8.2 |
| 1.0 | +0.22 (+0.17 to +0.27) | +16.2 |

The ceiling grows roughly in proportion to the release chance, and at 0.5 matches section
12. Even the best case there can be, a policy that knows exactly who will cancel late and
passengers who all release the moment they are asked, gains under a quarter of a completed
ride per 100 searches. The chance of putting off a passenger who would have travelled is
not swept: the oracle asks no such passenger, and a 3 × 3 grid run first gave identical
rows for every value of it.

## 16. Why a search is offered nothing

Run on 2026-10-17. Synthetic data; 30 seeds per variant; the ladder (`...003`) and the
robustness runs (`...004`) rebuilt with `candidates_returned` now carrying
`rides_in_window`: the published rides leaving inside the passenger's time window, counted
before the seat check. A search offered nothing then met either no ride at that time or
only full ones. Logging the count draws no random number, and the rebuild changed no
figure already in either report: it only added rows. Query: `empty_search_reasons` in
`metrics.sql`. Reports: `experiments/reports/ladder-7a1c0de0-0000-4000-8000-000000000003.md`
and `...004.md`.

| Share of all searches | B0 | B3 | B4 | B5 | ORACLE |
|---|---|---|---|---|---|
| Offered no ride | 0.550 | 0.545 | 0.542 | 0.544 | 0.543 |
| of which every ride at that time was full | 0.355 | 0.349 | 0.346 | 0.347 | 0.346 |
| of which no published ride was left at that time | 0.196 | 0.196 | 0.196 | 0.196 | 0.196 |

The two parts add to the first row up to rounding.

### What this shows

- **Two empty searches in three meet only full rides.** Section 10 reached this by
  arithmetic on the world's assumptions; it is now measured. One in three finds no
  published ride in the window at all, and no variant moves that share by more than
  0.001: none changes when rides run or are published.
- **Every variant's effect on empty searches is on full rides.** B3's lower empty share
  than B0's (−0.006) is entirely fewer searches meeting full rides, and B4 lowers that a
  little more (−0.003 against B3, 27 of 30 seeds), consistent with seats released early
  coming free while someone is still looking.
- **So seats are what is scarce, and early release frees too few of them to matter.**
  About 35 searches in every 100 meet full rides; B4 turns about 0.3 of them into
  searches offered a seat. This fits section 8: the extra refills go to passengers who
  would have booked another ride anyway, and the completed-ride gain stays within noise.
  It is an explanation that fits, not a proof.

The live platform does not log `rides_in_window`: its seat check is one of many filters in
the same query, so "full" has no single meaning there.

## 17. Rebooking flexible passengers when a driver withdraws

Run on 2026-10-19. Synthetic data; 30 seeds per cell; ranking B3. Sweep
`5eeb0000-0000-4000-8000-000000000008`; report
`experiments/reports/sweep-flexible-booking-5eeb0000-0000-4000-8000-000000000008.md`.

The platform rebooks a passenger who chose a flexible booking at once when their driver
withdraws, on the closest other open ride with the seats within two hours (features 81
and 88); everyone else may search again, as before. The simulator now does the same,
drawing who chose flexible from a stream of its own. How many passengers would choose it
cannot be learnt from simulation, so the share is swept. With a share of 0, the world's
value, B3 gives 31.11 completed rides per 100 searches, exactly section 7's figure: adding
the behaviour changed nothing else.

| Share with a flexible booking | Completed per 100, change (95% CI) | Seeds up / down | Searches offered no ride, change |
|---|---|---|---|
| 0.25 | +0.03 (+0.02 to +0.05) | 21 / 1 | +0.001 |
| 0.5 | +0.07 (+0.05 to +0.10) | 25 / 0 | +0.002 |
| 1.0 | +0.14 (+0.11 to +0.17) | 28 / 1 | +0.003 |

### What this shows

- **Rebooking rescues trips in proportion to how many choose it,** up to +0.14 completed
  rides per 100 searches if everyone did. Only 4% of rides are withdrawn, which bounds it.
- **Of what the platform does once a seat is booked, it is the only thing tried that adds
  rides.** Asking passengers to reconfirm adds none (sections 7 to 14), and even an oracle
  gains +0.10 at the assumed release chance (section 12). Recovery matches the oracle
  somewhere between half and all passengers being flexible. Ranking at search time (B3)
  remains the larger gain, +0.34.
- **Part of it is taken from others.** A rebooked passenger takes a seat a later searcher
  would have found, so searches offered nothing rise slightly. The gain shown is net of
  that.
- Who chooses flexible is drawn independently of the hidden passenger types. If, as is
  likely, committed passengers chose it more, the rescued trips would last better and the
  gain could be larger; that is not measured.

## 18. Real cancellations: the public hotel bookings

Run on 2026-10-19. **Real data, but not ride-sharing**: Nuno Antonio, Ana de Almeida and
Luis Nunes (2019), Hotel booking demand datasets, *Data in Brief* 22, 41–49,
doi:10.1016/j.dib.2018.11.126, licence CC BY 4.0. It holds 119,390 bookings at two hotels
in Portugal, arriving from July 2015 to August 2017. Hotel run
`407e1000-0000-4000-8000-000000000001`; report
`experiments/reports/hotel-407e1000-0000-4000-8000-000000000001.md`; set beside the
ladder's B0 (run `...003`), the simulator with no intervention at all.

**Can it support a time-to-event check?** Yes, to the day. Earlier documents doubted it,
expecting only a cancellation flag and a lead time. This dataset also records the date
each cancelled booking was cancelled (`reservation_status_date`), and none falls before
its booking was made or after arrival, so a survival curve can be counted.

**How it is counted.** `experiments/hotel/load.py` downloads the file once, refuses it
unless its SHA-256 matches `experiments/configs/hotel.yaml`, and writes the bookings made
at most 7 days before arrival (the platform's horizon; 19,746 of them) into the event log
as a seat booking is logged: requested and accepted when made, cancelled when cancelled,
a no-show at arrival. Each hotel is a variant, each year of arrival a seed. A new named
query, `daily_cancellation_hazard`, counts for each day before departure the bookings
standing and those their passenger cancelled; the same query is run on the simulator,
and a test checks it on hand-made events. Dates are read as noon UTC, so day 0 is the day
of arrival, whatever the hour; in the simulator a day is 24 hours counted back from
departure.

| Days before departure | City hotel | Resort hotel | Simulated B0 |
|---|---|---|---|
| 7 | 2.64% | 2.79% | nobody standing |
| 6 | 4.26% | 1.37% | 4.42% |
| 5 | 3.50% | 1.37% | 6.32% |
| 4 | 2.85% | 1.12% | 5.75% |
| 3 | 3.32% | 1.46% | 5.77% |
| 2 | 1.55% | 1.41% | 5.99% |
| 1 | 3.14% | 1.52% | 5.25% |
| 0 | 3.36% | 2.49% | 5.54% |

Each figure is the share of the bookings standing that day that were cancelled then.

| Over the week | City hotel | Resort hotel | Simulated B0 |
|---|---|---|---|
| Bookings accepted | 10,808 | 8,938 | 40,512 |
| Standing 6 days out and still standing at departure | 80.0% | 89.7% | 66.9% |
| Of the week's cancellations, on day 0 | 31.5% | 44.9% | 36.1% |
| On day 0 or 1 | 52.5% | 62.4% | 61.2% |
| No-shows, per booking accepted | 2.3% | 1.1% | 2.0% |

### What this shows

- **The simulated world cancels far more in the last week than these hotels do.** A
  simulated booking is cancelled at 4.4% to 6.3% a day; a city-hotel booking at 1.6% to
  4.3%, a resort booking at 1.1% to 2.8%. Of bookings standing six days out, 67% reach
  departure in the simulator, against 80% and 90% at the hotels. Year by year the hotels
  move by no more than three points (78.5% to 81.3%, 87.9% to 90.7%), so this is not one
  year's accident.
- **When cancellations come is much the same.** Half or more of the week's cancellations
  fall on the last two days in all three (52%, 62%, 61%), because that is when the most
  bookings stand. The city hotel's daily rate does not rise towards arrival, the resort's
  rises only on the day itself, and the simulator's not at all.
- **No-shows are of the same size**, 1% to 2% of bookings.
- **What it means for the results.** Every simulated result rests on a world that, in the
  final week, cancels about twice as often as the city hotel and nearly four times as often
  as the resort. How the results move with a lower rate is not measured here; `world.yaml` has not
  been changed to match hotels, which are not evidence about passengers.
- **What it cannot show.** Hotels are not rides: other people, prices, deposits and
  cancellation rules. Nothing records whether a cancelled room was let again, so nothing
  here speaks to refills. The durability model cannot be tried on it, since none of its
  features exist in this data.

## 19. The survival models on real cancellations

Run on 2026-10-20. **Real data, but not ride-sharing**: the hotel bookings of section 18,
made at most 7 days before arrival. `experiments/hotel/survival.py`, configured in
`experiments/configs/hotel_survival.yaml`; report `experiments/reports/hotel-survival.json`,
rebuilt by `scripts/reproduce.sh`.

The same three kinds of model as the platform's (AI_ML_METHODOLOGY.md), fitted on the
13,925 bookings arriving in 2015 and 2016 (1,120 cancelled) and checked on the 5,821
arriving in 2017 (435 cancelled): the years are disjoint, as seeds are. The features are
only what is known when a booking is made: lead time, hotel, party, nights, repeat guest,
previous cancellations and stays, a non-refundable deposit, transient customer, online
agent and price. Anything that can change afterwards is left out. Time is days from the
booking; a cancellation on day k counts at k + 0.5, and a booking still standing at
arrival is censored at the end of that day. A Cox model knowing only the lead time stands
beside the full one.

| Model | Concordance | Integrated Brier, days 1-6 | Brier at arrival |
|---|---|---|---|
| Kaplan-Meier (no features) | 0.500 | 0.0765 | 0.0692 |
| Cox, lead time only | 0.544 | 0.0748 | 0.0689 |
| Cox, all features | 0.597 | 0.0699 | 0.0652 |
| Gradient-boosted survival | 0.653 | 0.0717 | 0.0654 |

Of the validation bookings 92.5% were still booked at arrival; Cox and gradient boosting
both predict 92.6% on average, and each tenth of the calibration table is within five
points of what happened.

### What this shows

- **The method works on real cancellations.** What is known at booking ranks who will
  cancel better than timing alone (0.597 against 0.544), a non-linear model better still
  (0.653), and the predictions are calibrated.
- **That is the opposite of the simulator**, where the features added nothing to timing
  (section 14). In the simulated world the hidden passenger types drive cancelling and
  are only weakly reflected in what the platform can see; these real bookings carry more.
  It says the simulator's world may understate what booking features can tell, not that
  the platform's features would do as well.
- **Nothing here is served.** The platform's model is still the simulator's Cox model,
  on ride features these data do not have. Hotels are not passengers.
- The Cox fits needed more Newton-Raphson steps than lifelines' default to converge; a
  fit that does not converge now stops the run rather than reporting numbers. A
  refundable deposit is left out: so few bookings in the week have one that it separates
  the outcomes.

## 20. World h3: the last-mile effect, and every result rebuilt

Rebuilt on 2026-10-28, checked on 2026-10-29. Synthetic data; 30 seeds per variant; model
`h3-cox`. Reports: `ladder-7a1c0de0-…-003`, `…-004`, the six sweeps `5eeb0000-…-003` to
`-008`, `hotel-407e1000-…-001`, `hazard-h3.json`.

**What changed.** `world.yaml` gained a last-mile gap for each search (log-normal, mean
1,200 m) and, per passenger type, a `last_mile_sensitivity` that divides the type's Weibull
scale by (1 + sensitivity × gap in km): a passenger far from the stop cancels sooner, by an
amount only the hidden type decides. The platform sees the gap, so the model gained two
features (version `f2`) and was retrained as `h3` (AI_ML_METHODOLOGY.md section 5). The gap is
drawn after every earlier random draw, so nothing else in the world moves.

**That is checked exactly.** Run `7a1c0de0-…-009` uses `experiments/configs/worlds/last_mile_off.yaml`,
world.yaml with every sensitivity set to 0. Its B0 reproduces section 8's committed B0 (world
h2) to every digit of every measure: 30.773058933333278 completed rides per 100 searches, the
late share, refills, empty searches, additionality and refill by timing all identical. So
world h3 differs from world h2 by the last-mile effect and nothing else, and the simulator
reproduced results committed ten days earlier in a rebuilt container. B3 with the h3 model
in that world gains +0.30 (+0.22 to +0.39) over B0, close to the +0.34 of section 7 with
model `h2`.

**The ladder** (`…-003`, differences against B0):

| Measure | B0 | B3 | B4 | B5 | ORACLE |
|---|---|---|---|---|---|
| Completed rides per 100 searches | 30.22 | 30.54 | 30.56 | 30.53 | 30.66 |
| difference vs B0 (95% CI) | | +0.32 (+0.22 to +0.42) | +0.35 (+0.25 to +0.44) | +0.32 (+0.22 to +0.41) | +0.44 (+0.36 to +0.53) |
| Late share of cancellations | 0.361 | 0.368 | 0.301 | 0.351 | 0.261 |
| Requests per accepted booking | 0 | 0 | 0.273 | 0.083 | 0.043 |
| Seats refilled, rides with only early / only late releases | 0.920 / 0.623 | 0.932 / 0.661 | 0.940 / 0.669 | 0.936 / 0.667 | 0.937 / 0.674 |
| Searches offered no ride (every ride full / none at that time) | 0.537 (0.340 / 0.197) | 0.532 | 0.527 | 0.530 | 0.529 |

**Component removal** (`…-004`, differences against B3, whose figure is 30.54):

| Variant | Completed per 100 vs B3 (95% CI) | Late share vs B3 (95% CI) | Requests per accepted booking |
|---|---|---|---|
| B0 | −0.32 (−0.42 to −0.22) | −0.006 (−0.011 to −0.001) | 0 |
| ASK-ONLY | −0.31 (−0.41 to −0.21) | −0.072 (−0.079 to −0.064) | 0.279 |
| B3-KM | −0.00 (−0.03 to +0.02) | −0.001 (−0.002 to +0.001) | 0 |
| B4 | +0.03 (−0.02 to +0.07) | −0.067 (−0.074 to −0.059) | 0.273 |
| B4-KM | +0.01 (−0.04 to +0.06) | −0.069 (−0.077 to −0.062) | 0.316 |
| B5 | −0.00 (−0.03 to +0.02) | −0.017 (−0.020 to −0.014) | 0.083 |
| B5-RANDOM | +0.00 (−0.02 to +0.02) | −0.019 (−0.023 to −0.016) | 0.083 |

**What this shows**

- **Every conclusion of sections 7 to 19 holds in world h3.** Ranking by predicted survival
  gains about 1% (+0.32); asking passengers to reconfirm adds nothing measurable on top of it
  (+0.03, −0.02 to +0.07) while moving cancellations earlier (late share −0.067 against B3);
  even the oracle adds only +0.13 over B3; the features add nothing (B3-KM); the scheduler
  does no better than chance (B5-RANDOM). The six sweeps keep their conclusions too.
- **The levels moved, as the change intends.** Passengers far from a stop cancel sooner, so
  fewer bookings last (B0 30.77 to 30.22 completed per 100 searches) and late releases are
  refilled less often (0.665 to 0.623).
- **Statistics.** The research audit (`research_audit/statistical_analysis.md`) recomputed
  these comparisons from the event log: the means equal the reports to every digit, and
  Holm-adjusted p-values and bootstrap intervals change no conclusion. Section 3's warning
  about multiple comparisons stands for the measures it does not cover.
- **One finding the primary metric hides** (exploratory, chosen after seeing the data):
  counted in seats travelled rather than bookings completed, asking does add a little, +0.14
  seats per 100 searches (+0.09 to +0.18) for B4 against B3, and +0.16 for B4-KM. The primary
  metric counts a booking once whatever its party size; asking slightly favours larger
  parties. Not pre-specified, so not a result: a question for the next study.

## 21. Earliest departure: the ranking gain needs no model

Run on 2026-10-29. Synthetic data; 30 seeds; world h3. Run `7a1c0de0-…-010`; report
`experiments/reports/ladder-7a1c0de0-0000-4000-8000-000000000010.md`. (Run `…-005` was the
first attempt; Docker stopped part-way through it, it has no report and is not used. It was
left in the database rather than deleted.)

B3-KM ranks rides by a survival curve that depends on nothing but the hours to departure, so
it offers the soonest-leaving ride first. Variant EARLIEST (`experiments/configs/variants/EARLIEST.yaml`,
ranking `earliest_departure` in `sim/simulator.py`) does that directly, with no model.
Written down before the run (`research_audit/REPRODUCIBILITY_NEXT_STEPS.md` section 3):
EARLIEST within ±0.03 of B3-KM, and about +0.32 over B0.

| Against B3 (30.54), seed by seed | Completed per 100 (95% CI) | Seeds up / down |
|---|---|---|
| B0 | −0.32 (−0.42 to −0.22) | 4 / 26 |
| B3-KM | −0.00 (−0.03 to +0.02) | 10 / 12 |
| EARLIEST | −0.00 (−0.02 to +0.02) | 11 / 11 |

EARLIEST is 30.536, B3-KM 30.534, B3 30.537: the prediction held. B0, B3 and B3-KM in this run
equal run `…-004` to every digit.

**What this shows.** The one gain the project found, B3's +0.32, is the gain from offering the
soonest-leaving ride first. A booking for a ride that leaves sooner has less time in which to
be cancelled, and that is all the survival model's ranking adds in this world. It needs no
prediction about the passenger and no model. Whether booking features would add something
on real data is section 19's question, and there the answer was yes.

## 22. How passengers respond to being asked, in the current world

Run on 2026-10-29. Synthetic data; 30 seeds per cell; world h3; model `h3-cox`. Sweep
`5eeb0000-0000-4000-8000-000000000009`, same configuration as section 6
(`experiments/configs/sweeps/intervention_response.yaml`); report
`experiments/reports/sweep-intervention-response-5eeb0000-0000-4000-8000-000000000009.md`.
Section 6's run (`…-001`, world h1) is kept as history; its events no longer exist.

Difference in completed rides per 100 searches, B4 on the changed world minus B3 on the
unchanged one (B3 = 30.54), 95% CI; section 6's figure in brackets:

| Releases when asked | Annoyed: 0 | Annoyed: 0.02 (assumed) | Annoyed: 0.05 |
|---|---|---|---|
| 0.25 | +0.04 (+0.02 to +0.07) [+0.02] | +0.00 (−0.03 to +0.03) [−0.02] | −0.05 (−0.09 to −0.02) [−0.06] |
| 0.5 (assumed) | +0.06 (+0.02 to +0.11) [+0.03] | +0.03 (−0.02 to +0.07) [−0.01] | −0.02 (−0.08 to +0.03) [−0.05] |
| 1.0 | +0.10 (+0.05 to +0.15) [+0.06] | +0.06 (+0.00 to +0.12) [+0.02] | +0.01 (−0.06 to +0.07) [−0.02] |

The late share is lower than B3's on all 30 seeds in every cell, by 0.030 to 0.131.

**Against what was written down before the run** (`research_audit/REPRODUCIBILITY_NEXT_STEPS.md`
section 3): the late share held. Two predictions did not:

- "B4 − B3 at most about +0.07 in every cell" was wrong in one cell: +0.10 where every
  passenger who would cancel releases at once and nobody is put off.
- "Negative wherever 5% are put off" was wrong at a release chance of 1.0 (+0.01, interval
  across zero). At 0.5 the estimate is negative (−0.02) but its interval also crosses zero,
  so only the 0.25 cell is clearly negative.

The world now cancels more (section 20), so there is more for an early release to save.

**What this shows.**
- At the assumed responses asking still adds nothing measurable (+0.03, −0.02 to +0.07).
- The best case there can be is now +0.10 completed rides per 100 searches, a third of one
  percent, about the oracle's ceiling at the assumed response (+0.13, section 20).
- Putting off 5% of travellers still costs about what asking gains.

Section 6's conclusion stands in the current world: earlier release does not turn into a
material number of completed rides, whatever passengers do when asked.

## 23. Is the world's cancellation rate believable, and does it matter?

Run on 2026-10-29. Synthetic data; 30 seeds per variant.

### 23.1 The rate

Section 18 found the simulator cancels far more in the final week than two real hotels.
World h3 cancels more again. Three worlds were built with every passenger type's Weibull
scale multiplied by 1.5, 2 and 3 (`experiments/configs/worlds/cancellation_scale_*.yaml`,
nothing else changed): a larger scale means cancellations come later, so fewer before
departure.

The share of bookings standing 6 days out still standing at departure, counted as section 18
counts it (`research_audit/scripts/cancellation_benchmark.py`, the same named query and
pooling as `experiments/hotel/report.py`, which was not run because it always writes the
committed hotel report):

| | Standing day 6 → departure | Daily cancellation rate, days 6 to 0 |
|---|---|---|
| City hotel | 0.800 | 1.6% to 4.3% |
| Resort hotel | 0.897 | 1.1% to 2.5% |
| Simulated B0, world h2 (last-mile off) | 0.669 | 4.4% to 6.3% |
| Simulated B0, world h3 | 0.590 | 5.1% to 8.7% |
| Simulated B0, scale × 1.5 | 0.692 | 4.2% to 5.6% |
| Simulated B0, scale × 2 | 0.753 | 3.3% to 4.3% |
| Simulated B0, scale × 3 | 0.821 | 2.5% to 3.3% |

At three times the scale the simulated week looks like the hotels'. That is a description,
not a calibration: hotels are not passengers, and world.yaml is unchanged.

### 23.2 Whether the results depend on it

B0, B3 and B4 in each world (runs `7a1c0de0-…-006`, `-007`, `-008`; differences seed by seed):

| Scale | B0 | B3 − B0 (95% CI) | B4 − B3 (95% CI) | Late share, B4 − B3 |
|---|---|---|---|---|
| × 1 (section 20) | 30.22 | +0.32 (+0.22 to +0.42) | +0.03 (−0.02 to +0.07) | −0.067 |
| × 1.5 | 31.02 | +0.28 (+0.20 to +0.37) | −0.02 (−0.07 to +0.02) | −0.073 |
| × 2 | 31.37 | +0.32 (+0.24 to +0.40) | −0.04 (−0.08 to −0.004) | −0.074 |
| × 3 | 31.74 | +0.34 (+0.27 to +0.42) | −0.02 (−0.06 to +0.01) | −0.081 |

Written down before the run: B3 − B0 positive at every scale, B4 − B3 no gain. Both held.
At × 2 asking costs a little (p = 0.033 before correction; across the three new worlds,
Holm gives 0.10). The model was trained at × 1 and is used outside its world here, as in
section 7's supply sweep.

**What this shows.** The two findings do not depend on how often passengers cancel, across
a range from the current world to one that cancels like the hotels:
- ranking gains about +0.3;
- asking gains nothing.

The levels change (B0 rises from 30.22 to 31.74 as cancellations fall); the conclusions do
not.

### 23.3 Does the model recover the truth?

AI_ML_METHODOLOGY.md section 5, "Against the truth":
- The Cox model's average survival matches the generating survival (0.829 predicted, 0.826
  true, 0.825 observed).
- It captures 77% of the discrimination any model could reach; timing alone captures 71%.

## 24. How much the results depend on the demand assumed

Feature 89 asked for demand calibrated to the corridor. It cannot be: no real figures for the
corridor exist, so the 60 searches a day in `world.yaml` is the authors' assumption. **This is not a
calibration.** It measures how much the conclusions lean on that assumption, by halving and doubling
it, and it says nothing about what real demand is.

Run `5eeb0000-0000-4000-8000-000000000010`, 30 seeds per cell, B4 against B3 **on the same world**
(`experiments/configs/sweeps/demand_density.yaml`). Supply stays at 12 rides a day. Synthetic data.

| Searches per day | Searches offered no ride (B3) | B3, completed per 100 | B4 minus B3 (95% CI) | Change in late share | More seats refilled (95% CI) |
|---|---|---|---|---|---|
| 30 | 0.373 | 38.26 | -0.02 (-0.08 to +0.04) | -0.063 | +10.8 (+9.2 to +12.4) |
| 60 | 0.532 | 30.54 | +0.03 (-0.02 to +0.07) | -0.067 | +16.3 (+13.6 to +19.1) |
| 120 | 0.733 | 18.78 | -0.04 (-0.07 to -0.01) | -0.068 | +24.8 (+20.9 to +28.7) |

Every figure is read from the event log through `metrics.sql`. The late share fell on all 30 seeds at
every level, and more seats were refilled on all 30.

### What this shows

- **The central result does not depend on the demand assumed.** A released seat is only worth something
  if somebody is waiting to take it, so this was the assumption most likely to be hiding a benefit. It
  is not: across a four-fold range, asking bookings to reconfirm adds nothing to completed rides, and at
  double the demand it costs a little, even with 73% of searches offered no ride at all.
- **Earlier release is just as reliable at every level**, by about 0.065 of the late share.
- **More seats are refilled the more demand there is, without more completed rides.** The extra refills
  are mostly not by people with no other choice: those refills moved +1.5 (+0.6 to +2.4), +1.0 (-1.7 to
  +3.7) and -6.9 (-11.7 to -2.1). This agrees with what section 8's refill measure found: a refill is a
  completed trip only if whoever took it would not have travelled anyway.
- **Absolute figures do depend on it.** Completed rides per 100 searches halve as demand quadruples,
  because supply is fixed. Any such figure in the report means "at 60 searches a day", not a forecast.

### What this does not show

- What real demand is, or that it lies between 30 and 120 searches a day.
- Anything where demand and supply move together. Supply has its own sweep (section 7).
- How the model does in a world it knows: it was trained at 60 searches a day, so at 30 and 120 it is
  used outside the world it learnt from, as in the supply sweep.

When a real figure is known, the result can be read off this table, or the sweep widened to reach it.
`python -m experiments.real_data` says how far the platform's own searches are from giving one, and
with `--write-world` makes a world at that demand once they are enough. Only that would finish feature 89.
