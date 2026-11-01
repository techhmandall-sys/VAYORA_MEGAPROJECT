# VAYORA — Reproducibility and research integrity: next steps

Date: 2026-10-29. Scope: reproducibility and research integrity only; no manuscript changes. Everything below was established by **read-only inspection**:
- reading code, configuration and report files;
- `git` commands that change nothing;
- read-only SQL over the local `events` table;
- arithmetic on the exported model files.

**No file was changed, nothing committed, no experiment run.** The only file this step creates is this one.

Labels: **[VERIFIED]** checked by the auditor, with location; **[PROPOSED]** awaiting approval; **[RISK]**.

---

## 0. What needs your approval

| ID | Proposal | Changes | Cost |
|---|---|---|---|
| **A** | Correct the failing h3 sanity test as in §1.5: invariants and held-out calibration replace an arbitrary constant read off an extrapolated tail | `intel/tests/test_hazard_scoring.py` only; no model, result or simulator change | seconds |
| **B** | Preserve the current state before anything moves: git tags in `JOURNEX`, a dated copy of all result files, optional export of the h3 runs' events | new tags, new backup folder | minutes, ~1–2 GB |
| **C** | Bring `Vayora-main`'s changes into `JOURNEX` on a new branch, without committing | `JOURNEX` working tree | minutes |
| **D** | Commit in the order of §2.5 | `JOURNEX` history | minutes |
| **E** | Run `scripts/reproduce.sh` in `JOURNEX` to show byte-for-byte reproduction | rebuilds the same run ids' events identically | ~75 min |
| **F** | Minimum new experiments (§3), each under a **new run id**, overwriting nothing | one small simulator change (E1), new config files, new report files | ~35 min |
| **G** | Push to GitHub | outward-facing; separate decision | — |

---

## 1. The failing h3 sanity test

### 1.1 What it asserts [VERIFIED]

`intel/tests/test_hazard_scoring.py:142–151`:

```python
@pytest.mark.parametrize("name", ["h3-km", "h3-cox"])
def test_the_shipped_models_load_and_give_sane_decreasing_probabilities(name):
    model = HazardModel.load(MODEL_DIR / f"{name}.json")
    typical = {**ZERO, "lead_hours": 48.0, "seats": 1.0, "departure_hour": 8.0}
    curve = [model.survival(typical, hours) for hours in (0, 6, 24, 72, 168)]
    assert curve[0] == 1.0
    assert curve == sorted(curve, reverse=True)
    assert 0.5 < curve[-1] < 1.0          # fails for h3-km: 0.4905
```

The `0.5 <` bound was written with the first model, `h1`, in commit `43b6b2a` (2026-10-10, "Add booking-durability model…"), and never revisited (`git log -S'0.5 < curve[-1]'`). The staged h3 change only renamed `h1/h2` to `h3` in the parametrisation (compare `git show HEAD:intel/tests/test_hazard_scoring.py`, lines 127–136). No document derives the 0.5 from anything.

### 1.2 Current model outputs for the test's "typical" booking [VERIFIED]

Computed directly from the exported files: `h1`/`h2` via `git show HEAD:intel/app/hazard/models/…`, `h3` from `Vayora-main/intel/app/hazard/models/`.

| Model | S(24) | S(48) | S(72) | S(120) | S(144) | S(160) | S(168) | Last training event |
|---|---|---|---|---|---|---|---|---|
| h1-km | 0.946 | 0.880 | 0.805 | 0.665 | 0.606 | 0.566 | **0.566** | 159.5 h |
| h2-km | 0.945 | 0.877 | 0.802 | 0.655 | 0.597 | 0.552 | **0.552** | 159.5 h |
| h3-km | 0.925 | 0.831 | 0.733 | 0.603 | 0.557 | 0.535 | **0.491** | 163.3 h |
| h1-cox | 0.948 | 0.887 | 0.824 | 0.712 | 0.668 | 0.638 | 0.638 | 159.5 h |
| h2-cox | 0.948 | 0.887 | 0.824 | 0.708 | 0.664 | 0.630 | 0.630 | 159.5 h |
| h3-cox | 0.945 | 0.878 | 0.809 | 0.719 | 0.688 | 0.674 | 0.644 | 163.3 h |

### 1.3 Why it fails [VERIFIED]

There are three causes, and none of them is a code defect.

1. **The world changed on purpose.** h3 makes last-mile distance shorten time to cancellation, with a per-type `last_mile_sensitivity` (`experiments/configs/world.yaml`; `sim/simulator.py:447–450`). The no-feature curve fell by about 0.05 at 120 h (0.655 → 0.603), bringing its tail near the 0.5 line.
2. **The crossing happens in one statistically meaningless step.** Kaplan–Meier step sizes reveal the number at risk at each event, n ≈ 1/(1 − e^(−ΔH)). For h3-km the last step, at 163.3 h, rests on about **12 bookings**: one cancellation among 12 takes S from 0.535 to 0.491. Greenwood's approximate 95% intervals:

   | t | S(t) | 95% CI |
   |---|---|---|
   | 48 h | 0.831 | 0.825–0.836 |
   | 120 h | 0.603 | 0.590–0.616 |
   | 160 h | 0.535 | 0.513–0.558 |
   | 163.3 h | 0.491 | **0.411–0.585** |

   At the point that fails, 0.5 lies inside the interval. h1 and h2 had their last step at 159.5 h with ~48 and ~64 bookings at risk, which is why their extrapolated tails stayed above 0.5.
3. **168 h lies outside the data.** A ride is a candidate only if it leaves within the 7-day horizon of the search (`sim/simulator.py:333–338`: `now < ride.departure <= now + horizon`). The clock starts at acceptance, after the driver's response delay (exponential, mean 2 h; `sim/simulator.py:269`, `434`). No booking can be observed for 168 h. `S(168)` is the last training event's value carried forward (`intel/app/hazard/model.py`, `_baseline`). The test reads an extrapolation.

### 1.4 What the failure does reveal

The tail value is **not wrong about the world the model was trained on**. On the disjoint validation seeds 2001–2010 (`experiments/reports/hazard-h3.json`) [VERIFIED]:

| Model | Mean predicted vs observed survival to departure | Longest-horizon tenth (n = 1,333): predicted vs observed |
|---|---|---|
| Kaplan–Meier | 0.826 vs 0.825 | 0.580 vs **0.536** |
| Cox (served) | 0.829 vs 0.825 | 0.483 vs 0.462 |

Long-lead bookings in the h3 world really do cancel nearly half the time, and the no-feature model, if anything, overstates their survival.

That points at a **research question, not a test question**: is the world's cancellation intensity plausible? The only real benchmark in the project, the public hotel bookings (EXPERIMENT_PROTOCOL.md §18), shows that **h3 moved the simulator further away from it** [VERIFIED; `JOURNEX/…/hotel-407e…-001.md` vs `Vayora-main/…/hotel-407e…-001.md`]:

| Measure | City hotel | Resort hotel | Simulated B0, h2 | Simulated B0, h3 |
|---|---|---|---|---|
| Standing 6 days out and still standing at departure | 80.0% | 89.7% | 66.9% | **59.0%** |
| Daily cancellation rate, days 6 to 0 | 1.6–4.3% | 1.1–2.8% | 4.4–6.3% | **5.1–8.7%** |

Hotels are not passengers, and the project rightly refuses to calibrate to them (`world.yaml` comments; EXPERIMENT_PROTOCOL.md §18). But a unit test must not be the place where this is decided, in either direction. It belongs to experiment E3 (§3).

### 1.5 Proposed correction [PROPOSED, approval A]

Test what the code must guarantee in any world. Tie plausibility to **held-out evidence with stated tolerances**, not to a constant chosen for the first world.

```python
import json
from pathlib import Path

REPORTS = Path(__file__).resolve().parents[2] / "experiments" / "reports"


@pytest.mark.parametrize("name", ["h3-km", "h3-cox"])
def test_the_shipped_models_load_and_give_valid_decreasing_probabilities(name):
    model = HazardModel.load(MODEL_DIR / f"{name}.json")
    typical = {**ZERO, "lead_hours": 48.0, "seats": 1.0, "departure_hour": 8.0}
    # Up to the last cancellation seen in training, and past it, where the curve is held flat.
    hours = (0, 6, 24, 48, 72, model.times[-1], 168)

    curve = [model.survival(typical, h) for h in hours]

    assert curve[0] == 1.0
    assert curve == sorted(curve, reverse=True)
    assert all(0.0 < s < 1.0 for s in curve[1:])
    assert curve[-1] == curve[-2]
    # Booked two days ahead, a typical booking is more likely than not to last until it leaves.
    assert model.survival(typical, typical["lead_hours"]) > 0.5


@pytest.mark.parametrize("version", ["h3"])
def test_the_shipped_models_are_calibrated_on_the_held_out_seeds(version):
    report = json.loads((REPORTS / f"hazard-{version}.json").read_text(encoding="utf-8"))
    cox = HazardModel.load(MODEL_DIR / f"{version}-cox.json")
    # The report describes the shipped files: the served model has the reported coefficients.
    assert dict(zip(cox.features, cox.coef, strict=True)) == pytest.approx(report["cox"]["coefficients"])
    for result in (r for r in report["models"] if r["model"] in ("kaplan_meier", "cox_ph")):
        departure = result["departure"]
        assert departure["mean_predicted_survival"] == pytest.approx(departure["observed_survival"], abs=0.01)
        # A tenth of the validation bookings is ~1,330: 0.05 is over three standard errors of its rate.
        assert all(abs(b["mean_predicted"] - b["observed"]) <= 0.05 for b in departure["calibration"])
```

Why this is a correction and not a weakening:

| Old assertion | New assertions |
|---|---|
| One point, 168 h, outside the data's support; decided by one event among ~12 bookings; would flip on any retraining | Every point inside the support; the extrapolation is pinned to be flat, which is what the code does by design |
| A world-specific constant (0.5) written for h1, encoding "fewer than half cancel in a week" as if it were a property of the code | No world constant at the tail. The one remaining plausibility bound is at the typical booking's own departure, where S = 0.831 (95% CI 0.825–0.836), not on a knife edge |
| Says nothing about whether the model matches data | **New**: the shipped Cox file is the reported one (coefficients equal), and both shipped models are calibrated on held-out seeds: overall within 0.01 (≈3 SE for ~13,300 bookings), each tenth within 0.05 (≈3.6 SE for ~1,330). A miscalibrated or mismatched model now fails, which the old test could not detect. |

Current values against the new tolerances [VERIFIED, `hazard-h3.json`]:

| Model | Overall gap | Largest tenth gap |
|---|---|---|
| Kaplan–Meier | 0.001 | 0.044 |
| Cox | 0.004 | 0.021 |

The KM's longest-horizon tenth (0.044) is closest to its tolerance. That is reported here, not hidden, and E3a examines it.

**Rejected alternatives**:
- Lowering the bound (e.g. 0.45): arbitrary weakening.
- Moving it to 160 h: still on a knife edge (0.535, CI 0.513–0.558), still a world constant.
- Truncating the KM export where few remain at risk: changes the served models and every B3-KM/B4-KM result.
- Reducing `last_mile_sensitivity` until the test passes: tuning the world to a unit test, which would change every result.

**Effect**: one test file changes. No model, report, configuration or simulator changes; every result stays byte-identical. The Python suite goes from 207/208 to 209/209 (one test replaced, one added), which unblocks `scripts/reproduce.sh` step 1.

---

## 2. One authoritative version

### 2.1 The five states that exist [VERIFIED]

| State | Where | What it is | Models | Results |
|---|---|---|---|---|
| S1 | `JOURNEX` local `main` `7fc8a1f` (2026-10-22) | older platform | h1, h2 | h2 |
| S2 | GitHub `origin/stage-2-3-…` `2df443d` (2026-10-24) | the commit whose CI web job failed | h1, h2 | h2 |
| S3 (corrected in section 8: an unfinished merge) | `JOURNEX` local `stage-2-3-…` `0cbeafb` (2026-10-27) + **staged, uncommitted** h3 change (93 modified, 1 added, 4 deleted: the h1/h2 model files) | current committed history plus `run.bat`/`stop.bat` | h1, h2 deletion staged; **no h3** | h2 (committed in `30653cf`) |
| S4 | GitHub `origin/main` `176dc9c` "Initial commit" (2026-10-27), remote `github.com/techhmandall-sys/Vayora` | the staged h3 change committed **without any model file** | **none** | h2 |
| S5 | `E:\B.Tech DS\MEGAPROJECT\Vayora-main` (no git) | S4 + the 2026-10-28/29 work | h3 | h3 (regenerated) |

Checks:
- `git diff --cached --stat origin/main` in `JOURNEX` shows only `run.bat`, `stop.bat` and the `*.bat` line of `.gitattributes`, so **S3's staged tree = S4 + the two batch files**.
- `git archive origin/main` compared with `Vayora-main`, ignoring line endings, shows S5 = S4 + the changes in §2.2. The `Vayora-main` folder is a download of S4.
- GitHub `main` (S4) is **unreproducible as published**: it names model `h3` in every variant and ships no model file.
- The README badge points at `shivampatil4972/VAYORA-`, a different repository from `JOURNEX`'s remote. Reconcile which one is canonical.

### 2.2 Exact differences, S4 → S5 [VERIFIED]

65 changed and 7 added paths, ignoring line endings.

| Group | Paths | Belongs in the authoritative version? |
|---|---|---|
| **R — research code and tests** | `intel/app/hazard/models/h3-cox.json`, `h3-km.json` (added); `intel/tests/test_hazard_scoring.py` (h2→h3 names; plus approval A); `core-api/src/test/java/com/dypcet/journex/hazard/HazardScoringIntegrationTest.java` (9→11 features); `experiments/analysis/figures.py` (`MODEL = "h3"`) | Yes: without them S4 cannot run |
| **O — regenerated outputs** | `experiments/reports/hazard-h3.json` (added); `ladder-7a1c0de0-…-003.{json,md}`, `…-004.{json,md}`; `sweep-*-5eeb0000-…-003` to `-008` `.{json,md}`; `hotel-407e1000-…-001.{json,md}`; `timing-7a1c0de0-…-003.json`; `docs/figures/fig1…fig7.png`; `web/src/data/whatif.json` | Yes, after reproduction (approval E) confirms them |
| **W — web test setup** | `web/src/test/setup.tsx`; the last-mile expectation lines in `web/src/App.test.tsx` | Yes: CI's web job has failed since 2026-10-24 |
| **F — pay-after-ride feature** (unrelated to research) | `core-api/src/main/java/com/dypcet/journex/{booking/BookingController,booking/BookingService,booking/FlexibleRebooking,booking/TripService,notification/NotificationService,payment/CheckoutController,payment/PaymentController,payment/PaymentService,receipt/ReceiptService,ride/RideController,ride/RideService}.java`; `core-api/src/main/resources/db/migration/V36__add_pay_after_ride.sql` (added); `core-api/src/test/java/com/dypcet/journex/payment/PayAfterRideIntegrationTest.java` (added), `PaymentFlowIntegrationTest.java`, `booking/TransactionBoundaryTest.java`; `web/src/{components/payment.tsx,lib/locales/hi.ts,lib/locales/mr.ts,lib/notificationText.ts,lib/payments.ts,lib/schemas.ts,lib/schemas.test.ts,lib/serverMessages.ts,lib/types.ts,pages/DriverPages.tsx,pages/PassengerPages.tsx,pages/PaymentsPage.tsx,pages/ReceiptPage.tsx}`; the remaining hunks of `web/src/App.test.tsx`; `docs/{API_DOCUMENTATION,DATABASE_DESIGN,DECISIONS,KNOWN_LIMITATIONS}.md` | Yes, but as **separate commits** from the research |
| **D — documentation corrections** | `README.md`, `docs/ARCHITECTURE.md` (22 → 24 event types); `docs/PROGRESS.md` (2026-10-28 entry, mixes F and research) | Yes; the research numbers in README / EXPERIMENT_PROTOCOL / AI_ML_METHODOLOGY still need updating to the chosen world after team review |
| **A — audit** | `research_audit/**` | Recommended. Note: `.gitignore` has `data/`, which **would silently drop `research_audit/data/`**; add `!research_audit/data/` |
| **Local only — exclude** | `.vscode/settings.json` (already ignored), `.github/modernize/java-upgrade/` (empty folders from a VS Code Java extension), `experiments/data/hotels.csv` (ignored by design; SHA-pinned download) | No |
| **Keep from JOURNEX** | `run.bat`, `stop.bat`, `.gitattributes` `*.bat text eol=crlf` | Yes (in S3, not in S5) |

Line endings [VERIFIED]: `JOURNEX` has `core.autocrlf=true` and `* text=auto` (`.gitattributes`). Copying LF files from `Vayora-main` therefore creates no content change in git. Confirm with `git diff --stat` after copying; only the files above should appear.

### 2.3 Data that must be preserved [VERIFIED]

- **The h2 evidence exists only in git.** Committed reports and models at `30653cf`/`0cbeafb`. Their event rows were replaced in the local database when the h3 runs were rebuilt on 2026-10-28 (`scripts/reproduce.sh`, `forget`).
- **The historical runs** (ladders `…001`/`…002`, sweeps `…001`/`…002`) have **no events left** in the database. They survive only as report files.
- **The h3 runs' events** (read-only count): ladder `…003` 3.54 M, `…004` 5.71 M, sweeps `…003`–`…008` 23.2 M, hotel 0.04 M; `events` table 16 GB in total. They are reproducible by rerunning, but are the only copy until approval E succeeds.

### 2.4 Risks of consolidation

| Risk | Mitigation |
|---|---|
| **[RISK]** Both folders use compose project `journex`, so **one shared database and set of volumes**. Experiments started from both folders write to the same `events` table under the same run ids. | Run research from one folder only; after consolidation, only from `JOURNEX`. |
| **[RISK]** The database is at Flyway v36 (applied from `Vayora-main`). `JOURNEX`'s code lacks V36 until synced. `run.bat` rebuilds core-api from `JOURNEX`; Flyway's default treats an applied migration missing locally as "future" and ignores it, but this has not been tested. | Sync (approval C) before starting anything from `JOURNEX`. |
| **[RISK]** `scripts/reproduce.sh` deletes and rebuilds the events of runs `…003`, `…004`, `407e…001` and sweeps `…003`–`…008` | Back up first (approval B); runs are deterministic, so the rebuild should be identical. |
| **[RISK]** `App.test.tsx` and `PROGRESS.md` mix research and feature changes | Split hunks in VS Code's staging view (interactive `git add -p` is not available to the assistant), or accept one combined commit and say so in its message. |
| **[RISK]** Docker images are pinned by tag, so a rebuilt `python:3.11-slim` may differ by patch version | Expected not to change floating-point results (packages are pinned exactly). If reproduction is not byte-identical, compare `pip freeze` first. |
| **[RISK]** GitHub `main` (S4) is published in a broken state | Do not push until approval G; then push the authoritative branch and fix `main`. |

### 2.5 Proposed commit sequence in `JOURNEX` [PROPOSED, approvals B–D]

| Step | Content | Verification |
|---|---|---|
| T0 | Tag the current committed state: `archive/h2-results-2026-10-27` at `0cbeafb` (keeps h1/h2 models and h2 reports reachable forever) | `git show archive/h2-results-2026-10-27:experiments/reports/ladder-7a1c0de0-0000-4000-8000-000000000003.md` |
| Branch | `git switch -c h3-authoritative` (the staged change comes along) | `git status` |
| C1 | "Finish the last-mile change: model h3, and tests that expect it": staged change + group R + approval A | Python suite 209/209; Java `HazardScoringIntegrationTest` |
| C2 | "Stand in for two browser features in web tests": group W | web 236/236 at this commit |
| C3 | "Rebuild every result under world h3": group O | `scripts/reproduce.sh` reproduces them byte for byte (approval E) |
| C4 | "Pay after the ride": group F | Java 324/324, web 241/241 |
| C5 | "Correct the event count; record 2026-10-28": group D | — |
| C6 | "Research audit": group A, with the `.gitignore` exception | — |
| Tag | `results-h3-2026-10` on C3 or C6 | — |

---

## 3. Minimum additional experiments [PROPOSED, approval F]

Rules for all of them:
- a **new run id** each, so no existing report or event is overwritten;
- predictions written down **before** running;
- results added as new rows to `verified_results.csv`.

The team should fix the equivalence margin (manuscript plan decision D4) before E1 and E2.

### E1 — Earliest-departure baseline

- **Why**: B3-KM ranks by a survival curve that depends only on hours to departure, so it equals "earliest departure in the window" up to ties within a step (`intel/app/hazard/model.py`; `sim/simulator.py:_rank`). The paper needs the explicit heuristic to say the ranking gain is timing, not prediction.
- **Change**: in `sim/simulator.py`, add `"earliest_departure"` to `RANKINGS` and a key `(ride.departure, gap(ride), ride.id)` in `_rank`. Add `experiments/configs/variants/EARLIEST.yaml` (`ranking: earliest_departure`, no model). Add a test in `sim/tests/test_simulator.py` that EARLIEST faces the same searches and rides as B0. Existing variants are untouched, and their results stay byte-identical (the new branch is never taken by them).
- **Run**: id `7a1c0de0-0000-4000-8000-000000000005` with B0, B3, B3-KM, EARLIEST, then `compare --baseline B3 B0 B3-KM EARLIEST`. Writes a new `ladder-…-005.*`.
- **Prediction**: EARLIEST − B3-KM within ±0.03 per 100 searches (the paired MDE for B3-KM − B3 was 0.031); EARLIEST − B0 ≈ +0.32.
- **Cost**: ~4 min.

### E2 — Intervention-response sweep in the current world

- **Why**: EXPERIMENT_PROTOCOL.md §6 rests its claim that "the null is not an artefact of the assumed response" on sweep `5eeb…-001`. That sweep ran in world h1 and is history; its events no longer exist.
- **Change**: none. `experiments/configs/sweeps/intervention_response.yaml` already uses B3/B4, which now load `h3-cox`.
- **Run**: id `5eeb0000-0000-4000-8000-000000000009`. Writes a new `sweep-intervention-response-…-009.*`; `…-001` stays as history.
- **Prediction**: B4 − B3 at most ≈ +0.07 in every cell; negative where `annoyed_cancel_probability` = 0.05; late share lower than B3 on ≥ 28 of 30 seeds in every cell.
- **Cost**: ~10 min (B3 once, B4 in 9 cells).

### E3 — Validating the cancellation assumptions

**E3a. Truth recovery and tail stability** (analysis only, no new run).

A new script, `research_audit/scripts/truth_recovery.py`:
- re-simulates validation seeds 2001–2010 under B0 **in memory**;
- for each accepted booking, computes the generating survival to departure from its hidden type, last-mile offset and the shock process;
- compares it with h3-cox and h3-km predictions: calibration against truth, concordance against true risk, and Kaplan–Meier risk sets with Greenwood intervals in the tail.

It answers the paper's own question (§V-A, "whether CommitmentDecay recovers the hazards") and the KM tail gap in §1.4. It writes only its own output file. Cost ~2 min.

**E3b. Cancellation intensity** (no simulator change; new world files only).
- Add `experiments/configs/worlds/cancellation_scale_1.5.yaml`, `_2.0.yaml` and `_3.0.yaml`: copies of `world.yaml` with every type's `weibull_scale_hours` multiplied by the factor (a larger scale means fewer cancellations). A header comment must say what changed and why.
- Run B0, B3 and B4 with `python -m sim.run --world … --variant … --run-id <new id>`, one run id per world: `7a1c0de0-…-006` (×1.5), `-007` (×2.0), `-008` (×3.0).
- `compare --baseline B0 B3 B4` per run.
- A read-only script runs the existing named query `daily_cancellation_hazard` on each run's B0 to report "standing 6 days out → departure" beside the hotels (80.0%, 89.7%). **Do not use `experiments/hotel/report.py` for this: it always writes `hotel-407e1000-…-001.*` and would overwrite the current report** (`experiments/hotel/report.py:151–153`).
- **Prediction**: B3 − B0 stays positive and B4 − B3 stays within the margin at every scale. The scale at which "standing 6 days → departure" reaches the hotel range is reported, not adopted.
- Caveat: the h3 model was trained at ×1.0 and is used outside its world, as in the supply-density precedent; say so.
- Cost: ~8–10 min.

**E3c. Last-mile bridge and determinism check.**
- One world file, `experiments/configs/worlds/last_mile_off.yaml`, with every `last_mile_sensitivity` set to 0. Run id `7a1c0de0-…-009`, B0 only (B3 and B4 optional).
- **Prediction (strong)**: B0 reproduces the committed h2 value **exactly**, 30.7731 completed per 100 searches (`JOURNEX/experiments/reports/ladder-7a1c0de0-0000-4000-8000-000000000003.json`). The h3 change appended its random draw after every earlier draw (`sim/simulator.py:127–135`, comment "Appended last"), and a zero sensitivity leaves each Weibull scale unchanged.
- If this fails, the h3 change altered more than intended, and that must be explained before any h3 result is reported. If it holds, it links the committed h2 evidence and the current h3 evidence by an exact identity.
- Cost: ~1–3 min.

Compute for E1–E3: about 35 minutes. Disk: about 9–12 GB more in the Docker volume (≈ 0.5 KB per event row; 229 GB free on `E:`).

---

## 4. Safe execution sequence

Nothing below has been run. Each gate waits for approval.

```text
Gate A   test correction                     -> Python suite 209/209 in Vayora-main
Gate B   preserve                             -> tags + dated backup (+ optional event export)
Gate C   sync into JOURNEX, branch, no commit -> all four suites green in JOURNEX
Gate D   commits C1..C6                       -> history as in §2.5
Gate E   reproduce.sh in JOURNEX              -> "Every result reproduced exactly"; checksums = reproducibility_guide.md §5
Gate F   experiments E1, E2, E3a-c            -> new reports only; verified_results.csv extended
Gate G   push (separate decision)
```

### Commands

Git Bash. Paths quoted for the space in `B.Tech DS`.

**Gate A**: after the edit in §1.5:

```sh
cd "/e/B.Tech DS/MEGAPROJECT/Vayora-main"
docker compose --profile research run --rm research pytest -q intel/tests/test_hazard_scoring.py
docker compose --profile research run --rm research pytest -q          # expect 209 passed
```

**Gate B** (preserve; nothing deleted):

```sh
cd "/e/B.Tech DS/MEGAPROJECT/JOURNEX"
git tag archive/h2-results-2026-10-27 0cbeafb
B="/e/B.Tech DS/MEGAPROJECT/archive/2026-10-29"; mkdir -p "$B/vayora-main" "$B/journex-worktree"
for d in experiments/reports intel/app/hazard/models docs/figures web/src/data; do
  mkdir -p "$B/vayora-main/$d" "$B/journex-worktree/$d"
  cp -r "/e/B.Tech DS/MEGAPROJECT/Vayora-main/$d/." "$B/vayora-main/$d/"
  cp -r "/e/B.Tech DS/MEGAPROJECT/JOURNEX/$d/." "$B/journex-worktree/$d/" 2>/dev/null || true
done
cp "/e/B.Tech DS/MEGAPROJECT/VAYORA_Research_Paper.pdf" "/e/B.Tech DS/MEGAPROJECT/VAYORA_Report.docx" "$B/"
# Optional: export the h3 ladder runs' events (about 9 M rows; compressed, a few hundred MB)
# (database and container renamed on 2026-10-29: section 7)
docker exec vayora-postgres-1 psql -U vayora -d vayora -c "\copy (SELECT * FROM events WHERE run_id IN ('7a1c0de0-0000-4000-8000-000000000003','7a1c0de0-0000-4000-8000-000000000004')) TO STDOUT WITH CSV HEADER" | gzip > "$B/events-ladder-h3.csv.gz"
```

**Gate C** (sync; no commit):

```sh
cd "/e/B.Tech DS/MEGAPROJECT/JOURNEX"
git switch -c h3-authoritative                 # keeps the staged change
V="/e/B.Tech DS/MEGAPROJECT/Vayora-main"
# Copy groups R, O, W, F, D, A from §2.2 file by file (never .vscode, .github/modernize, experiments/data)
git status --short                              # only the §2.2 paths may appear
git diff --stat                                 # line-ending noise must not appear
docker compose --profile research run --rm research pytest -q
docker compose --profile test run --rm core-api-tests
(cd web && npm ci && npx vitest run) && (cd gateway && npm ci && npm test)
```

**Gate E**:

```sh
cd "/e/B.Tech DS/MEGAPROJECT/JOURNEX" && scripts/reproduce.sh
sha256sum intel/app/hazard/models/*.json experiments/reports/*h3* experiments/reports/ladder-*-00000000000[34].json
```

**Gate F** (after E1's code change is approved and committed):

```sh
R=7a1c0de0-0000-4000-8000-000000000005
for v in B0 B3 B3-KM EARLIEST; do
  docker compose --profile research run --rm research python -m sim.run --variant experiments/configs/variants/$v.yaml --run-id $R
done
docker compose --profile research run --rm research python -m experiments.analysis.compare --run-id $R --baseline B3 B0 B3-KM EARLIEST
docker compose --profile research run --rm research python -m experiments.sweep experiments/configs/sweeps/intervention_response.yaml --run-id 5eeb0000-0000-4000-8000-000000000009
```

E3b and E3c follow the same `sim.run --world … --run-id …` pattern, one new run id per world file.

---

## 5. What stays untouched in every step

- `VAYORA_Research_Paper.pdf`, `VAYORA_Report.docx` and every other manuscript file.
- Every existing report file, model file and figure, except that C3 commits the already-regenerated h3 files into `JOURNEX` after reproduction confirms them.
- The history runs' reports (`…-001`, `…-002`).
- `JOURNEX`'s current branch and its staged change: the work happens on a new branch, after a tag.
- The `events` rows of every run, except those `scripts/reproduce.sh` rebuilds at Gate E, after the Gate B backup.

---

## 6. Status after approval (2026-10-29, later)

*Gate C and the database volume moved on 2026-11-01: see section 8.*

Everything in this section was done in `Vayora-main` only. Nothing was committed, nothing was changed in `JOURNEX`, and no existing report, model, figure, manuscript file or event row was deleted or overwritten.

| Gate | Status | Evidence |
|---|---|---|
| **A** | **Done** as in §1.5 | Python suite 210/210 (209 + the E1 test). Calibration on seeds 2001–2010 passes for both shipped models. |
| **B** | **Partly done.** A dated file copy exists. No git tags, no event export. | `../archive/2026-10-29-before-fixes/`: 45 files, 3.1 MB. Holds the reports, the models, `web/src/data`, the figures, `VAYORA_Research_Paper.pdf` and `VAYORA_Report.docx`, as they were before any change. |
| **C, D** | **Not done; needs approval** | `JOURNEX` is untouched: still on `stage-2-3-booking-core-and-simulator` at `0cbeafb`, with the staged changes it already had. |
| **E** | **Not done; needs approval** | |
| **F** | **Done** (E1, E2, E3a–c) | See below. 64 new rows in `verified_results.csv` (342 in all). The previous table is kept in the session scratchpad. |
| **G** | **Not done; separate decision** | |

**One deviation from §3.** E1 was planned as run `…-005`. Docker Desktop stopped part-way through that run (B3-KM at 17 of 30 seeds), so it wrote no report. Its partial events are **kept, not deleted**. The run was repeated in full as `7a1c0de0-…-010`. `build_verified_results.cjs` reads `…-010` and says why `…-005` is left out.

**The team has not fixed the equivalence margin (D4).** The ±0.03 used below is the paired MDE named in §3, not an agreed margin.

### Results against the written predictions (all synthetic)

| Experiment | Prediction (§3) | Result | Held? |
|---|---|---|---|
| E1 EARLIEST (`…-010`) | EARLIEST − B3-KM within ±0.03; EARLIEST − B0 ≈ +0.32 | EARLIEST − B3 −0.001 (−0.021 to +0.018); EARLIEST − B3-KM +0.003; EARLIEST − B0 +0.32. B0, B3 and B3-KM equal run `…-004` exactly. | **Yes** |
| E2 response sweep (`5eeb…-009`) | B4 − B3 ≤ ≈ +0.07 in every cell | Best cell (release 1.0, annoyed 0.0) **+0.10 (+0.05 to +0.15)** | **No**: the ceiling is higher than predicted |
| | Negative where annoyed = 0.05 | Release 0.25: −0.05 (−0.09 to −0.02). Release 0.5: −0.02 (−0.08 to +0.03). Release 1.0: **+0.01** (−0.06 to +0.07). | **Partly**: only release 0.25 is clearly negative |
| | Late share lower on ≥ 28/30 seeds in every cell | 30/30 in every cell | **Yes** |
| E3b intensity ×1.5 / ×2 / ×3 (`…-006` to `…-008`) | B3 − B0 > 0 | +0.28 / +0.32 / +0.34, all intervals above 0 | **Yes** |
| | B4 − B3 within the margin | −0.02 / **−0.04 (−0.08 to −0.00, p = 0.033 unadjusted)** / −0.02 | **Partly**: ×2 is just outside ±0.03 on the harmful side. No setting shows a gain. |
| | Report the scale that reaches the hotel range | Standing 6 days out → departure: h3 0.590, ×1.5 0.692, ×2 0.753, **×3 0.821**; hotels 0.800 (city) and 0.897 (resort) | ×3 reaches it. Reported, not adopted. |
| E3c last-mile off (`…-009`) | B0 = 30.7731 exactly | 30.773058933333278, and every other measure equal to the committed h2 report | **Yes, exactly** |
| E3a truth recovery | (no numeric prediction) | True-risk AUC 0.898. Cox 0.808 (77% of what truth allows above chance). KM 0.785 (71%). Cox against true risk: Spearman 0.766. KM risk set from 144 h: 171; from 160 h: 24; from 163 h: 8. | Reported |

Where these results are written up:
- EXPERIMENT_PROTOCOL.md §§20–23;
- AI_ML_METHODOLOGY.md, "Against the truth";
- KNOWN_LIMITATIONS.md;
- README.md;
- docs/figures/README.md.

Output files:
- `research_audit/data/truth_recovery.json`;
- `research_audit/data/cancellation_benchmark.json`.

### Still open

1. **C/D**: bring `Vayora-main` into `JOURNEX` on a new branch and commit in the §2.5 order. Add a commit for this section's work: EARLIEST, the world files, the audit scripts, the docs, and the stale-build fix in `web/`.
2. **E**: `scripts/reproduce.sh` in `JOURNEX`. It does not know runs `…-006` to `…-010` or `5eeb…-009`. Add them to it or document them as separate runs; that is the team's choice.
3. **B (rest)**: git tags before C. Optionally, export the events of runs `…-003`, `…-004` and `…-010`.
4. **D4**: the team fixes the equivalence margin. E1's conclusion holds under any margin of 0.021 or more (interval −0.0205 to +0.0184). E3b's ×2 harm (−0.04) is significant only before Holm adjustment across the three worlds (≈ 0.10 after).
5. **G**: push, a separate decision.

---

## 7. The project renamed to VAYORA (2026-10-29, at the team's request)

*Section 8 replaces what this section says about `journex_pgdata`, `PG_VOLUME` and the `JOURNEX` folder.*

`journex` is now `vayora` in every identifier in `Vayora-main`:
- the Java package (`com.dypcet.vayora`, `VayoraApplication`) and the `vayora.*` settings;
- the Python package (`vayora_events`) and `VAYORA_DB_URL`;
- the `VAYORA_*` environment variables, the token issuer (`vayora-core-api`) and the browser storage keys;
- the Docker project (`vayora-*` containers, `vayora_default` network) and the database name, user and password.

No simulator random stream, configuration value, migration or report contains the name, so **no research result can change**. All four suites pass after the rename: 324 Java, 210 Python, 246 web, 28 gateway.

**What happened to the data.** Nothing was deleted, and counts were checked before and after:

| Before | After | How |
|---|---|---|
| Volume `journex_pgdata` (20.7 GB), database `journex`, role `journex` | The same volume. Database and role renamed to `vayora`. | `ALTER DATABASE … RENAME` and `ALTER ROLE … RENAME`, in place. Docker's disk is on C:, which has 12.5 GB free, so the volume could not be copied. 51,599,844 events in 16 runs, 38 users, 20 rides, 15 bookings and 36 Flyway migrations, the same before and after. |
| `journex_mongodata`, Mongo database `journex` | Copied to `vayora_mongodata`; collections moved into database `vayora` in the copy | 3 chat messages, 0 GPS traces, 25 notifications, with their indexes |
| `journex_osrmdata`, `journex_m2cache` | Copied to `vayora_osrmdata`, `vayora_m2cache` | Sizes and file counts match |

The original `journex_mongodata`, `journex_osrmdata` and `journex_m2cache` volumes, and the old `journex-*` images, are still there untouched. Removing them is the team's choice.

`docker-compose.yml` names the database volume with `PG_VOLUME`, which defaults to `vayora_pgdata`. This machine's `.env`, which is not committed, sets `PG_VOLUME=journex_pgdata` and `MONGO_PORT=27018`. Each start therefore warns that `journex_pgdata` "was created for project journex"; that is expected.

**Consequences for the gates.**
- **The `JOURNEX` folder cannot reach the database as it stands.** Its compose file still says project `journex` and user `journex`, but the database is now `vayora`, owned by `vayora`. Starting its stack would fail at login. Gate C brings the rename across.
- **At Gate C, `.env` must be created in `JOURNEX` too.** It needs `PG_VOLUME=journex_pgdata` and `MONGO_PORT=27018`, because `.env` is not committed. Without it, Gate E runs against a new, empty `vayora_pgdata`. That would still reproduce byte for byte, but outside the database holding the runs.
- **To undo the database rename:** create a temporary superuser role, then as that role run `ALTER DATABASE vayora RENAME TO journex` and `ALTER ROLE vayora RENAME TO journex`.

---

## 8. Code copied into `JOURNEX`, and the rename finished (2026-11-01, at the team's request)

### Correction: `JOURNEX` holds an unfinished merge

This audit described S3 as a "staged, uncommitted h3 change". It is an **unfinished merge**, opened on 2026-10-27:

- `.git/MERGE_MSG` reads "Merge branch 'main' of https://github.com/techhmandall-sys/Vayora into stage-2-3-booking-core-and-simulator". Every conflict is resolved and the result staged.
- `.git/MERGE_HEAD` exists but is **empty** (0 bytes, last written 2026-10-27 15:49:38). Git therefore knows a merge is open but not which commit was being merged. From the message and the staged content, that commit is `origin/main`, `176dc9c`.

Two steps of this plan were wrong because of it:
- `git switch -c h3-authoritative` (§2.5, §4) cannot run: git refuses to switch branch during a merge.
- The commits in §2.5 cannot simply be made in order: the first commit concludes, or abandons, this merge.

### What was done

| Step | Result |
|---|---|
| Tag | `archive/h2-results-2026-10-27` at `0cbeafb`. Local; no new commit. |
| Branch | **Not created**, for the reason above. `JOURNEX` is still on `stage-2-3-booking-core-and-simulator` at `0cbeafb`. |
| Copy (Gate C) | The working tree now matches `Vayora-main`: 220 files added, 106 replaced, 178 in the old package folders removed. Excluded as in §2.2: `.vscode`, `.github/modernize`, `experiments/data`, plus build output. `.env` was copied; git ignores it. |
| Kept from `JOURNEX` | `.gitattributes` and `run.bat`, `stop.bat`, whose text now says VAYORA. |
| `.gitignore` | `!research_audit/data/` added in both folders, as §2.2 asked. |
| Git | **Index, merge state and history unchanged**: 98 paths still staged. The copy shows as 108 modified, 178 deleted and 219 untracked, with no line-ending-only changes. **Nothing committed or pushed.** |

*A sequencing fault, on the record:* the copy was started in parallel with the branch step, so it ran even though that step failed. No harm resulted, since the copy never touches the index.

### Verification, run from `JOURNEX`

| Check | Result |
|---|---|
| core-api, clean build | 324 of 324 |
| Python | 210 of 210; ruff clean |
| web | 246 of 246; type check, ESLint and build clean |
| gateway | 28 of 28; ESLint clean |
| `docker compose up -d --build --wait`, the command in `run.bat` | Every service healthy, 36 migrations validated |
| Live durability score | HTTP 200 from `h3-cox`, the same 0.8737 as before |

`npm audit` on the gateway now reports 5 moderate findings, from a `minimatch` advisory (GHSA-g3hv-75wg-m249) reached only through ESLint. With `--omit=dev` the gateway and web both report 0. The only fix npm offers forces ESLint back to version 4, so it was not applied.

### The database volume is now `vayora_pgdata`

C: had about 102 GB free on 2026-11-01, so the copy §7 ruled out became possible.

- Postgres was started on `journex_pgdata`, where it recovered from an unclean shutdown, then stopped cleanly and copied.
- Before and after the copy, every `events` row was fingerprinted per run: count, lowest and highest id, and a sum of hashes over id, variant, seed, time, type and payload. Users, rides, bookings and migrations were counted too. **The two outputs are identical**: 51,599,844 events, 16 runs plus 125 platform events.
- Mongo is unchanged: 3 chat messages, 25 notifications.
- `.env` in both folders no longer sets `PG_VOLUME`, so the default applies. `journex_pgdata` is **kept, not deleted**. (Deleted later the same day, at the team's request: see "Still open".)

### What this changes

- **Both folders now drive the same `vayora-*` containers and the same database.** The stack is currently running from `JOURNEX`. Run it, and any experiment, from one folder only (§2.4).
- §7's warnings about `JOURNEX` no longer apply: it reaches the database, and its `.env` is in place.
- Gate E: `scripts/reproduce.sh` deletes and rebuilds its own runs in `vayora_pgdata`. `journex_pgdata` held the earlier copy of those events and has since been deleted, so **`vayora_pgdata` is the only copy on this machine: back it up before Gate E**.

### Still open

1. **Gate D, starting with the merge. The team's decision, and it creates a commit.** The history §2.1 needs is a merge commit with parents `0cbeafb` and `176dc9c`, which needs `MERGE_HEAD` to name `176dc9c` first. [NOT TESTED] Committing with `MERGE_HEAD` empty would probably record only one parent, leaving GitHub's `main` out of the history. Do not run `git commit` until this is decided.
2. **Gate E**, with the question in §6 about adding runs `…-006` to `…-010` and `5eeb…-009` to the script.
3. ~~Removing the old volumes~~ **Done 2026-11-01, at the team's request:** `journex_pgdata`, `journex_mongodata`, `journex_osrmdata` and `journex_m2cache`, about 22 GB. Checked first: no container used them, and the running database held 51,599,844 events, before and after. They can no longer serve as a fallback.
4. **Whether the `JOURNEX` folder itself is renamed.** The audit's paths and `verified_results.csv` name it.
5. **Gate G**, push.
