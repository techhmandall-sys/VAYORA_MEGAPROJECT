# AI and ML methodology

Everything here is trained and evaluated on **synthetic data from the simulator**. No
real booking data exists for this project. No result below says anything about real
passengers; each says what happens in a world built from the assumptions in
`experiments/configs/world.yaml`.

## 1. What is predicted

For a booking a driver has accepted, let T be the time from acceptance until the
passenger cancels it. The model estimates

    S(t | x) = P(T > t | x)

with t in hours since acceptance and x the features in section 3. The quantity the
platform uses is the probability the booking lasts until its ride departs:

- before a booking exists, for ranking: `S(h | x)`, with h the hours to departure;
- for a live booking, at each scoring round: `S(h | x) / S(e | x)`, with e the hours
  already survived and h the hours from acceptance to departure.

This is **not** the probability that the passenger boards or that the trip completes.
No-shows and driver withdrawals are separate processes and are not modelled by it.

## 2. Events and censoring

| Outcome of an accepted booking | Treatment |
|---|---|
| Passenger cancels | Event at the cancellation time |
| Booking is live at departure | Right-censored at departure |
| Driver withdraws the ride | Right-censored at the withdrawal time |

Censoring at departure is administrative and its time is known in advance: it equals
the booking's horizon, which is nearly the `lead_hours` feature. Section 5 explains why
that matters for one of the metrics.

Bookings never accepted (rejected, or unanswered at departure) are not in the data:
the clock starts at acceptance.

## 3. Features (version `f2`)

All are known when the booking is requested. They are computed in one place,
`intel/app/hazard/features.py`, by a tracker that only ever sees logged events; the
training set is built by replaying an event log through it and the simulator feeds it
the events it emits. So training and serving use the same code, and a feature can only
be something that was in an event.

| Feature | Meaning |
|---|---|
| `lead_hours` | Request to the ride's departure |
| `seats` | Seats in the booking |
| `departure_hour` | Local hour of day the ride leaves |
| `desired_gap_hours` | Distance between the ride's departure and the time asked for |
| `prior_accepted` | The passenger's earlier accepted bookings |
| `prior_cancellations` | Of those, cancelled by the passenger |
| `prior_completed` | Of those, travelled |
| `prior_no_shows` | Of those, never boarded |
| `prior_cancel_share` | `prior_cancellations / prior_accepted`, 0 with no history |
| `last_mile_distance_m` | Gap from the passenger's start to the boarding stop, as shown with the candidate they booked (feature 91) |
| `last_mile_mode_available` | Whether a non-walk access option (rickshaw or bus) was shown alongside that stop |

History is read before the current booking is observed, so a booking is never part of
its own history. A test (`test_history_features_only_ever_look_backwards`) checks it.

**Latent passenger type is not a feature and cannot become one.** It exists only inside
the simulator and is never written to an event. Tests fail if a type name or a `kind`
key appears in any payload or in a training row.

## 4. Data and seeds

| Set | Simulator seeds | Accepted bookings | Passenger cancellations |
|---|---|---|---|
| Training | 1001-1020 | 27,176 | 4,573 |
| Validation | 2001-2010 | 13,576 | 2,331 |
| Experiments | 1-30 | not used for fitting or model choice | |

Counts are for world h3 and model `h3` (`experiments/reports/hazard-h3.json`), the current
ones. Earlier worlds, kept in the repository's history, gave 25,272 / 3,196 (h1) and 26,583 /
3,581 (h2) training bookings / cancellations.

The three sets are disjoint and `experiments/hazard/train.py` refuses to run if they
are not. All are generated under variant B0, so the model learns from a world in which
no intervention has yet changed behaviour.

## 5. Models compared

Source: `experiments/reports/hazard-h3.json`, produced by
`python -m experiments.hazard.train`. Validation set, 13,327 bookings with a known
outcome for the departure measures (the 249 driver-withdrawn bookings are excluded
there because whether the passenger would have lasted is unknown).

| Model | Concordance | Brier score, survives to departure | Integrated Brier score |
|---|---|---|---|
| Kaplan-Meier, no features | 0.500 | 0.1228 | 0.1589 |
| Cox proportional hazards | 0.638 | **0.1169** | 0.1609 |
| Gradient-boosted survival | 0.621 | 0.1182 | 0.1631 |

Earlier models, same measures, in the repository's history: h1 Cox 0.589 / 0.0978 / 0.1375,
h2 Cox 0.595 / 0.1018 / 0.1391.

Reading these honestly:

- **The gain from features is small.** Cox improves the departure Brier score by about
  5% over a curve that uses no features. Most of what can be predicted about whether
  a booking lasts is how long it has to last, which the no-feature curve already uses.
  The rest is driven by latent type and unobservable shocks, which is the design.
- **Part of the gain since h2 was put there.** World h3 makes the last-mile gap, which the
  platform can see, shorten time to cancellation. Fitted without the two last-mile
  features, Cox reaches 0.621; with them 0.638 (`last_mile_ablation` in the report). The
  model finding an effect the generator was given is expected, not a discovery.
- **Concordance of 0.64 is weak discrimination.** It is above chance, and nowhere near
  what would let the platform single out individual bookings with confidence.
- **Gradient boosting did not beat Cox** on any measure, but the comparison favours Cox:
  boosting was trained on a 5,000-row sample, because scikit-survival's loss is quadratic
  in rows, with fixed settings. It is not served.
- **The integrated Brier score is not reliable here** and is reported only for
  completeness. It reweights by the censoring distribution assuming censoring is
  independent of the features; here censoring time is a feature. It ranks the
  no-feature curve first, the opposite of the departure Brier score.
- **Calibration is good for all three.** In ten equal-count bins of predicted survival,
  Cox's mean prediction and the observed rate differ by at most 0.021 (0.483 predicted,
  0.462 observed, in the lowest bin). Mean predicted survival is 0.829 against 0.825
  observed. The no-feature curve is the least calibrated at long horizons (0.580 against
  0.536 in its lowest bin): bookings made far ahead come mostly from the passenger types
  that cancel most, which a curve without features cannot see.

### Proportional-hazards check

Schoenfeld-residual test (lifelines, rank time transform) on the training set. The
assumption is rejected for `last_mile_distance_m` (p < 0.001), `prior_cancellations`
(p = 0.003) and `lead_hours` (p = 0.008); it is not rejected for the other eight features
(p from 0.07 to 0.97). The last-mile effect is built into each passenger type's Weibull
scale, and the types have different shapes, so it cannot be proportional.

A violation is expected. The generator is a mixture of Weibull hazards with different
shapes, so hazards for different passengers are not proportional over time, and
`lead_hours` correlates with type. Cox PH cannot represent this. That is research
integrity rule 2 working as intended, and it is a stated limitation of the served model,
not something that was fixed.

### Choice

**Cox PH (`h3-cox`) is served.** It has the best departure Brier score and concordance
of the three, sensible coefficient signs (prior cancellations and no-shows raise the
hazard, prior completed trips lower it, a longer last-mile gap raises it), and it exports
to a small file scored in pure Python. The Kaplan-Meier curve (`h3-km`) is exported too, as
the reference a variant can be run against. The choice was made the same way for `h1` and
`h2`.

### Against the truth

The simulator knows each booking's real chance of lasting: its hidden type, last-mile gap
and the shock process. Re-simulating the validation seeds and comparing
(`research_audit/scripts/truth_recovery.py`, output `research_audit/data/truth_recovery.json`):

| | Mean chance of lasting to departure | Brier score | AUC, lasted vs cancelled |
|---|---|---|---|
| What happened | 0.825 | | |
| The truth (no model could know it) | 0.826 | 0.0865 | 0.898 |
| Cox `h3-cox` | 0.829 | 0.1169 | 0.808 |
| Kaplan-Meier `h3-km` | 0.826 | 0.1228 | 0.785 |

- **Cox recovers the generating survival on average**, in its lowest tenth too (0.483
  predicted, 0.480 true, 0.462 observed), but not booking by booking: its predictions
  differ from the truth by 0.12 on average, and rank bookings with a Spearman correlation
  of 0.77 to it.
- **Of the discrimination any model could reach** (the truth's AUC above 0.5), Cox has 77%
  and the no-feature curve, timing alone, 71%. The other 23% is the hidden type and the
  shocks, by design.
- The no-feature curve overstates long-horizon survival (0.580 predicted, 0.543 true).
- **The curve's last days rest on few bookings.** Of 13,576 validation bookings, 171 were
  still standing 144 hours after acceptance, 24 at 160 hours and 8 at 163. A probability
  read off the curve beyond about 150 hours is fragile; no booking can stand 168 hours,
  since rides are booked at most 7 days ahead and the clock starts at acceptance.

## 6. Serving

`POST /v1/hazard/score` on the intel service takes the eleven features, `elapsed_hours`
and `horizon_hours`, and returns the conditional survival probability with the model
version, feature version and `trained_on: synthetic`. The service holds no state: the
caller supplies the features.

The exported model holds the baseline cumulative hazard as a step function. lifelines
interpolates between event times; the difference is about 0.001 in probability.

**What the platform does with a score.** As the team chose on 2026-10-20, one thing:
the seat-release reminder asks only bookings whose latest score is below 0.8 to release
their seat if plans changed, and when more are due than the budget allows, the contact
scheduler (section 7) chooses which, as the simulator's B5. Nothing is cancelled, priced or
refused on a score, and the message says nothing about it. Someone the model rates safe is
never reminded; an unscored booking is not either. Turning targeting off asks everyone
alike, as before.

## 6a. Explaining a score

Every score intel returns carries each feature's share of the log relative risk,
`coef × (x − mean)`. The shares add up to the log relative risk exactly, so for a Cox
model they are the whole explanation and SHAP is unnecessary: SHAP would approximate what
is here computed. A test checks that the shares reproduce the survival estimate. core-api
logs the shares with each `hazard_scored` event, and the administrators' durability page
names the two features that moved each estimate most, and in which direction. Scores
logged before this existed show no reasons rather than invented ones. For the
Kaplan-Meier baseline every share is zero.

## 7. The contact scheduler

`intel/app/scheduler` chooses which bookings to ask to reconfirm when not all of them
can be asked. It is an optimiser, not a learned model, and it holds no state.

**Input.** For each booking that could be asked: its ride, the day the ride leaves, its
seats, the model's survival estimate and the hours left. It is given nothing else, and
in the simulator a test checks that it is given no ground truth.

**Objective.** Maximise the summed worth of the bookings asked, where

    worth = (1 - survival) x seats x min(1, hours_to_departure / refill_horizon_hours)

That is: the seats expected to be lost, discounted as departure approaches because a
seat released late is unlikely to be refilled. **This formula is an assumption.** It is
not fitted to anything, and the linear discount in particular has no evidence behind it.

**Constraints.** At most `contacts_per_round` requests; at most `max_contacts_per_ride`
on one ride; at most `max_seats_asked_per_departure_day` seats asked about among rides
leaving on the same day.

**Why a solver.** With only the first two limits every request costs one, and sorting by
worth while skipping full rides is optimal. The third counts seats, so a party of three
and three parties of one use it differently, and the choice becomes an integer programme.
It is solved with CP-SAT (OR-Tools) on one worker with a fixed seed, and exact ties go
to the lower booking ids, so the same input always gives the same plan.

**How it was checked.** On 25 random instances small enough to try every subset, the
plan's worth equals the best subset's. A 400-booking round solves to optimality well
inside the time limit.

**What it is not.** At this corridor's scale the seat limit rarely binds, so on most
rounds the plan is what sorting would have given. The solver is correct; it is not what
drives any result in EXPERIMENT_PROTOCOL.md. It never recommends cancelling anything.
Sending the same number of requests to eligible bookings in a random order (variant
B5-RANDOM) does as well (EXPERIMENT_PROTOCOL.md section 14): in this simulator the
scheduler does not beat chance.

## 8. Known limitations

There is no real ride data to train on. `python -m experiments.hazard.train_real` will train on the
platform's own bookings once `experiments/configs/real_data.yaml` says there are enough, on earlier
outcomes with later ones held out, and reports without serving anything. It has only run on a made-up
history.

- Synthetic data only. Nothing here is evidence about real cancellation behaviour.
- **The features add nothing measurable to the primary metric.** Ranking with the
  Kaplan-Meier curve, which uses no booking feature and depends only on time to
  departure, keeps all of B3's gain over B0 (EXPERIMENT_PROTOCOL.md section 14). The
  ranking helps because of timing; the Cox model's reading of the passenger does not.
- The public hotel bookings (EXPERIMENT_PROTOCOL.md section 18) record the day of each
  cancellation, so they support a time-to-event check, but not of this model: none of
  its features exist there. Over the last week they cancel at about a half (city) and a
  quarter (resort) of the simulator's rate, with similar timing. The same kinds of model
  fitted on their own features (section 19) rank real cancellations better than timing
  alone (Cox concordance 0.597, gradient boosting 0.653, lead time alone 0.544), the
  opposite of what the simulator showed.
- Features are fixed at the request. Nothing that happens after it (a reconfirmation,
  a message, a changed profile) updates them; only elapsed time does.
- Explanations describe the model, not the person. "How far ahead it was booked makes
  a cancellation likelier" says what the fitted coefficients do with that value; it does
  not say why anyone cancels.
- One model version, trained once. There is no drift monitoring or retraining schedule.
- The model is trained on B0 behaviour. Once interventions change when people cancel,
  the data it was trained on no longer describes the world it is used in.
