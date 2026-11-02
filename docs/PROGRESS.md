# Progress

## 2026-11-02 (later) — Google sign-in works with Google itself

- **Feature 2 is verified.** With a real client ID in `.env`, a real Gmail account signed in and was
  linked to its existing account: the first time anything here has met the real Google.
- **A fault found before it could bite:** Google asks for `Referrer-Policy: no-referrer-when-downgrade`
  when testing over http on localhost, and the web server sent a stricter one. `localhost` now gets
  that policy, and every other address the strict one Google recommends.
- Features: 88 verified, 7 partial, about 96% counting a partial as half.
- No test suite was rerun: only the web server's headers and these docs changed, checked with curl.

## 2026-11-02 — ready for real data, and India's other scripts on the PDF

- **`experiments/real_data.py` says how far real activity is from being enough**, for demand (89) and the
  model (77), leaving out demo and test accounts. Once demand is enough it writes a world at that demand.
  On the real log today: 15 searches by 2 people over 6 days, and no accepted booking that has departed.
- **`experiments/hazard/train_real.py` trains on real bookings once there are enough**, and refuses until
  then. What it makes is not served. Only made-up history has been through it, which found a bug: a
  feature that never varies, as `desired_gap_hours` never does on the platform, stopped the Cox fit.
  Fixed, and the simulator's model retrained byte for byte the same, so no research result moved.
- **PDF receipts draw names in nine Indian scripts**, not Devanagari alone: Bengali, Gurmukhi, Gujarati,
  Odia, Tamil, Telugu, Kannada and Malayalam too. Other scripts, Urdu's among them, still print as "?".
- Features unchanged: 87 verified, 8 partial, about 96%. These make 77 and 89 ready for real data, the way
  2, 46 and 64 are ready for accounts. They do not finish them.
- core-api 349, web 296 and Python 224 tests pass. The gateway was not rerun: it did not change.

## 2026-11-01 (latest that day) — what code could still do for the unfinished features

- **Demand (89) moves from not started to partial, and is still not calibrated.** No real figures exist.
  A 30-seed sweep halved and doubled the assumed demand instead: asking adds nothing at any level, and
  cancellations come earlier at all of them, but absolute completed rides per 100 searches run from 38
  to 19 (EXPERIMENT_PROTOCOL.md section 24). 4.5 million events added under a run of their own.
- **Invoices (50): credit notes.** A fee returned after it was invoiced is reversed by a note with its
  own numbers, made in the refund's transaction. A fee kept when only the fare comes back is now
  invoiced, where before any refund stopped the invoice.
- **The PDF receipt draws names in Devanagari**, where it printed "???". PDFBox's own shaping was tried
  first and printed "कार्तिक" as "कातर्कि", so Java's text layout shapes them and the outlines are drawn.
  Other scripts still print as "?". Looked at, and checked to work in the image that actually runs.
- **The database now has a backup**, in `backups/`, which is not committed: 1.2 GB, and all 51,599,844
  events were read back out of it. It predates the sweep, whose run can be rebuilt from its config.
- **Left as they were, because code cannot finish them.** Google (2), Razorpay (46), Twilio (61, 64) need
  the team's accounts. Hindi and Marathi (71) need a native speaker. The model (77) needs real ride data.
- Features: 87 verified, 8 partial, none not started: about 96% counting a partial as half.
- core-api 349, web 296 and Python 210 tests pass. The gateway was not rerun: it did not change.

## 2026-11-01 (just before) — the old volumes deleted

- **`journex_pgdata`, `journex_mongodata`, `journex_osrmdata` and `journex_m2cache` are gone, at the
  team's request:** about 22 GB. No container used them, and the running database held 51,599,844 events
  before and after. Their contents were checked against the `vayora_*` copies when the data moved.
- **`vayora_pgdata` is now the only copy of the research events on this machine.** `scripts/reproduce.sh`
  deletes and rebuilds runs, so back it up before Gate E. No backup has been taken.

## 2026-11-01 (just before) — an interface that keeps itself current

- **A side bar in place of the row of pills:** icons alone on a tablet, names on a wider screen,
  administrators' pages grouped, a marker sliding between pages. On a phone, tabs along the bottom
  with language and theme in More. A change of theme spreads out from the button.
- **What is on screen stays current, for real.** A new notification floats in and has the lists read
  again; bookings, rides and an administrator's figures are re-read every 30 seconds; a booking's
  journey, its time to leaving and what cancelling returns all move by themselves; a seat hold counts
  down; chat and the driver's position come through the gateway as they happen, the marker gliding.
  Every "Live" label says when it last read, and stops saying Live when a read fails.
- **A search is never repeated by a timer.** `/rides/search` writes `search_issued` to the event log,
  so polling it would have bent completed rides per 100 searches. `GET /rides/availability` gives the
  same seat count, holds included, and records nothing. A test holds this, and it was measured against
  a real stack: a page left open read seats 4 times, searched once, and added no `search_issued`.
- **Choosing a place:** typed in any of the three languages, by city or state, with the arrow keys,
  recent places first and the nearest city to the device on offer. The ends swap, and the next seven
  days are a press each. A route chosen on the front page waits past signing up.
- **A made-up figure removed:** the front page showed an invented "Reliability 92%" that the app itself
  never shows anyone, as scores are not shown to members. It now shows an example result, labelled.
- Bugs this found, fixed: a map's panes rose over the sticky header; a list opening from one section
  passed under the next.
- core-api 347 and web 295 tests pass. Python and the gateway were not rerun: neither changed. Checked
  with several browsers against a throwaway stack with the real routing and gateway (TESTING.md).

## 2026-11-01 (before that) — any route in India, the research unchanged

- **The team decided the platform serves all of India and the research stays on Kolhapur to Pune.**
  CLAUDE.md now says which is which. No simulator, experiment, config or reported number changed.
- **Searching and publishing take any of 126 cities in 34 states and union territories**, in English,
  Hindi and Marathi, in either direction. A driver chooses the start and the end and adds up to eight
  stops on the way. Times are pre-filled roughly and prices are the driver's, as before.
- **Road routes remain on the corridor for now, by the team's choice.** Elsewhere a route is a labelled
  straight line; a bigger map is a setting away (DEPLOYMENT.md), not built or tried.
- **A bug this exposed, fixed:** OSRM answers for any point by moving it to its nearest road, so
  Chennai to Bengaluru came back as a confident 69.7 km. A point moved more than 2 km now counts as off
  the map. The tests had never asked, for no point off the map could be chosen.
- **Two more, fixed:** a search could only go towards Pune, so nobody could look for the way back; and
  a worked-out route stayed on screen, with its prices ready to use, after the stops changed.
- **A made-up figure removed:** the front page's tooltip gave "about N seats published here" from
  numbers invented for the drawing. The drawing itself remains, as decoration.
- Not done, recorded in KNOWN_LIMITATIONS.md: GST invoices still take Maharashtra as the place of supply,
  for a tax adviser to confirm before they are switched on. The durability model has only seen the corridor.
- core-api 343 and web 266 tests pass. Python and the gateway were not rerun: neither changed. Checked
  in a browser against a throwaway stack with the real OSRM (TESTING.md).

## 2026-11-01 (later again) — demo data with a past

- **`scripts/demo-data.mjs` now gives the app a past**, through the same calls real use makes: trips
  driven, rated and paid out, a no-show, an early and a late cancellation, a request waiting,
  documents checked and waiting, unmet demand, and with an administrator given, the real durability
  model over the bookings. Every account, review and ride note says it is made up.
- **It does not finish features 77 or 89, and they stay as they were.** Asked for dummy data in place
  of real data: 77 already rests on simulated data, which is why it is partial, and calibrating
  against made-up figures would only compare the simulator with itself. Recorded in DECISIONS.md.
- A sweep of `searches_per_day` has not been run. The supply sweep (6, 12 and 20 rides a day) varies
  how scarce seats are, not demand itself. It would be the honest stand-in for 89, and is for the
  team to decide.
- No test suite was rerun: only the script changed. Walked in a browser against a throwaway stack.

## 2026-11-01 (later still) — ready to go online, given a server

- **`docker-compose.prod.yml` and `scripts/deploy.sh`:** one command on a server with a domain
  name. Caddy serves HTTPS and passes each path to its owner; only ports 80 and 443 are open; it
  refuses to start without real secrets. `scripts/backup.sh` and a restore that was tried.
- **Tried on one machine only**, with a local certificate and without the road services. It has never
  run on a real server, which needs the team's own account (DEPLOYMENT.md, Putting VAYORA online).
- **Step-by-step setup for Google, Razorpay and Twilio** in DEPLOYMENT.md: those features are finished
  in code and wait only on the team's accounts.
- CI passed on `main` for the first time, with everything above it included except this entry's work.
- All the services together were measured idling at 1.3 GB of memory.
- No test suite was rerun for this: no application code changed.

## 2026-11-01 (last) — staff checks, tax invoices, and what code cannot finish

- **Features 7, 8, 35 and 58 are now real, as checks by a person.** A driver can ask, an
  administrator sees the original in person or on a video call and records the outcome, audited,
  and the driver is told. Only the outcome is kept: still no number and no copy. Profiles and
  search results say a person saw it, not that its issuer stands behind it, and passengers can
  filter for such drivers. No identity provider or insurer is connected. Driven end to end in
  headless Edge against a throwaway stack.
- **Tax invoices (50), off until a GST registration is configured.** For what VAYORA itself
  charges, on real payments only, numbered without a gap and unchangeable once issued. No price
  changes. It stays Partial: no registration exists, a tax adviser has to confirm the rate and
  SAC code, and there are no credit notes.
- **Left as they were, because code cannot finish them.** Google sign-in (2) and SMS (64) need
  the team's own accounts. Hindi and Marathi (71) need a native speaker: the review page was
  rebuilt with all 1,106 lines and no review has been submitted. The model (77) needs real ride
  data, which does not exist and will not be made up.
- Features: 87 verified, 7 partial, 1 not started of 95, about 95% counting a partial as half.
- A near miss worth keeping: the throwaway stack would have attached to the real database,
  because that volume has a fixed name, had `PG_VOLUME` not been set. Set it before starting any
  second copy of the stack.
- Tests: 340 Java, 255 web, 28 gateway, all passing. Python not rerun: nothing in it changed.

## 2026-11-01 (later) — CI's one failure found, warnings cleared, caches removed

- **CI had never passed.** The web tests could not start on GitHub's Node 20: jsdom's undici
  calls a compression function that version lacks, while the same tests pass on a developer's
  Node 24. Reproduced in a clean Linux copy and fixed by moving CI to Node 24 and the actions
  to v5. Proved in that same copy (246 web, 28 gateway), not yet on GitHub: it needs a push.
- **An empty reply from Razorpay** crashed into a bare 500; it now counts as no answer, with
  the message that says so, and books nothing. A new test covers it.
- **The Problems panel: no errors, 273 warnings, now 5.** 268 were the Java extension's null
  analysis, which meets Spring's non-null annotations with none of the project's own. It is
  off in `.vscode/settings.json` (local, and `automatic` brings it back). The riskiest "may be
  null" sites were read first; the Razorpay one was the only real fault. The other 5 were an
  unused import and field, a deprecated call and the test containers' two leak warnings, by
  design. A shadowed name was also renamed. The 5 left say that methods the framework calls
  are "never used".
- **Removed:** `.pytest_cache`, `.ruff_cache`, `core-api/target`, `web/dist`, the TypeScript
  build cache, `.github/modernize` (a Copilot extension's leftovers), and the six superseded
  `journex-*` Docker images, about 1.9 GB.
- **Kept on purpose:** `.env`, `experiments/data` (the hotel dataset the research needs),
  `node_modules`, Docker's build cache, and the `journex_*` volumes, including the 20.69 GB
  `journex_pgdata` kept when the database moved.
- Tests: 325 Java, 246 web, 28 gateway, all passing. Python not rerun: nothing in it changed.

## 2026-11-01 — one codebase in JOURNEX too, and the last old name gone from Docker

- **The code is copied into the `JOURNEX` repository**, as the team asked, with the rename:
  220 files added, 106 replaced, the old package folders removed, and `run.bat` and
  `stop.bat` now say VAYORA. Nothing was staged, committed or pushed.
- **`JOURNEX` turned out to hold an unfinished merge** from 2026-10-27, whose `MERGE_HEAD`
  is empty. The audit had misread it as a staged change. It is left as it was and needs the
  team's decision before any commit there (research_audit/REPRODUCIBILITY_NEXT_STEPS.md
  section 8).
- **The database volume is now `vayora_pgdata`.** C: had room for the copy this time. Every
  event row was fingerprinted per run before and after, and the results are identical:
  51,599,844 events. `journex_pgdata` is kept.
- **Both folders now drive the same containers and database.** The stack is running from
  `JOURNEX`; use one folder at a time.
- `npm audit` flags `minimatch` in the gateway, a new moderate advisory reached only through
  ESLint. Nothing the gateway or web app runs in production is flagged. npm's only offer is
  to force ESLint back to version 4, so it stays.
- Tests, run from `JOURNEX`: 324 Java, 210 Python, 246 web, 28 gateway, all passing; ruff,
  ESLint, the TypeScript check and the web build clean.

## 2026-10-29 (later) — the project is VAYORA everywhere

- **Renamed as the team decided.** The working name JOURNEX is gone from the code, the
  configuration and Docker:
  - the Java package is `com.dypcet.vayora` (`VayoraApplication`) and the settings are
    `vayora.*`;
  - the Python event writer is `vayora_events` and its database URL `VAYORA_DB_URL`;
  - the environment variables are `VAYORA_*`;
  - the token issuer is `vayora-core-api`;
  - the browser keeps its settings under `vayora.*`;
  - the Docker project, containers, images and network are `vayora`, and the database,
    its user and password and the Mongo database are `vayora`.
  CLAUDE.md's layout table follows. Entries below keep the names in use at the time.
- **No research result can move.** No random stream, configuration value, migration or
  report contains the name. Every migration validated unchanged against the renamed
  database.
- **No data was lost.** The 20.7 GB database could not be copied, since Docker's disk on C:
  has 12.5 GB free, so it was renamed in place and stays in its volume, `journex_pgdata`.
  This machine's `.env` points `PG_VOLUME` at it. New installs get `vayora_pgdata`. The
  Mongo, road-graph and Maven volumes were copied to `vayora_*`, and the originals were
  kept. The same 51,599,844 events in 16 runs, and the same users, rides and bookings,
  were counted before and after. Details: research_audit/REPRODUCIBILITY_NEXT_STEPS.md
  section 7.
- Anyone signed in has to sign in again, once: tokens from the old issuer and old browser
  keys are no longer read. Theme and language choices also reset once.
- **Found while testing the rename**: VS Code's Java extension rebuilt `core-api/target`
  while the Java suite ran, and 130 tests failed for classes that vanished mid-run. Run
  again once the editor had finished, all 324 passed. TESTING.md now warns about it.
- The `JOURNEX` folder is untouched and, until it receives these changes, cannot log in
  to the renamed database.
- Tests: 324 Java, 210 Python, 246 web, 28 gateway, all passing; ruff, ESLint, the
  TypeScript check and the web build clean.

## 2026-10-29 — every suite green, three bugs fixed, and the questions the audit raised

- **The open test is settled** as the research audit proposed and the team approved. The
  test that asked a typical booking to last 168 hours with a chance over 0.5 checked one
  cancellation among about 12 bookings left at that point, and the 0.5 came from nowhere.
  It now checks what must hold in any world (valid, decreasing curves, held flat past the
  data) and adds what matters: the shipped Cox file is the one reported, and both shipped
  models are calibrated on the held-out seeds, overall within 0.01 and every tenth within
  0.05. `world.yaml` is unchanged.
- **Found and fixed**: a tab left open across a release showed "Something went wrong" on
  its next screen, since it asked for code the new build had renamed. It now reloads once,
  and the error screen offers a real reload (TESTING.md, bugs the tests did not find). A
  what-if test still expected the h2 sweep. A newly published advisory flagged the
  gateway's `qs`; it moved to 6.16.2 and nothing is flagged. Two ruff findings in the audit
  scripts.
- **Is B3's gain prediction or timing?** A new variant, EARLIEST, offers the soonest-leaving
  ride first and uses no model. Against B3 it differs by −0.001 (−0.021 to +0.018) completed
  rides per 100 searches (run `7a1c0de0-…-010`). The gain is timing. EXPERIMENT_PROTOCOL.md
  section 21.
- **How much would passengers have to respond?** The response sweep (`5eeb…-009`) now
  crosses how often an asked passenger releases early with how often asking annoys someone
  into cancelling. The best cell gains +0.10 (+0.05 to +0.15) over B3, more than the +0.07
  predicted. The assumed cell gains +0.03 (−0.02 to +0.07). Annoying 5% of those asked did
  not make the full-release cell negative, as predicted, but +0.01. Late cancellations fall
  on every seed in every cell. Section 22.
- **Do the results depend on how often passengers cancel?** The world was rerun with every
  passenger type's cancellations stretched 1.5, 2 and 3 times later (runs `…-006` to
  `…-008`). B3 gains +0.28, +0.32 and +0.34. Asking (B4) never helps (−0.02, −0.04,
  −0.02). With the last-mile effect off (`…-009`), B0 reproduces the h2 result to the
  last digit. Section 23.
- **Is the simulated world plausible?** Of bookings still standing six days before
  departure, 59% reach it in world h3. In published hotel data, 80% (city) and 90%
  (resort) do. The ×3 world is at 82%, and the conclusions hold there.
- **How close do the models get to the truth?** The truth here is each booking's actual
  chance under the simulator. The Cox model reaches 77% of the ranking power that truth
  allows (AUC 0.808 against 0.898), and the no-feature curve reaches 71%. AI_ML_METHODOLOGY.md.
- One run (`…-005`) stopped part-way when Docker Desktop stopped. Its events are kept, no
  report was written, and the run was repeated as `…-010`.
- README, EXPERIMENT_PROTOCOL, AI_ML_METHODOLOGY, KNOWN_LIMITATIONS, TESTING and the figure
  notes now quote world h3. The h2 numbers stay in the sections that report them.
- Not done, pending the team's approval: syncing this copy into the JOURNEX repository and
  committing, running `scripts/reproduce.sh` end to end, and pushing.
- All synthetic, from the simulator.
- Tests: 324 Java, 210 Python, 246 web, 28 gateway, all passing.

## 2026-10-28 — pay after the ride, and the last-mile change finished

- **Pay after the ride**, as the team chose: a driver can let passengers book a ride without
  paying, ride by ride. When the booking ends it owes exactly what one paid up front would
  have kept (everything for a trip or a no-show; the fee and the fare the tiers keep for a
  cancellation; nothing if the driver declined, never answered or withdrew), paid in the app
  or in cash to the driver, who records it. Nobody with anything due can book again. A
  flexible booking paid after the ride is rebooked only on rides that allow it. Receipts come
  once it is paid; a driver's earnings show what was taken in cash and the platform's fee
  inside it. Migration V36; no new event type (`booking_requested` carries `pay_after_ride`).
  In English, Hindi and Marathi. Outside the 95-feature backlog, so the matrix is unchanged.
- **The last-mile change was half done**, and is now finished: the model it called for,
  `h3`, had never been trained, so the platform's durability scores failed with a server
  error and 31 Python, 2 Java and 2 web tests failed. `h3` is trained (Cox concordance
  0.638, against 0.595 for `h2`); tests that still expected nine features or `h2` were
  updated; the figures now draw `h3`. The web test setup gained stand-ins for two browser
  features the front page uses, which had failed one test since 2026-10-24 (CI was red).
- **Every simulator result was rebuilt** under the new world, as the team chose: the ladder,
  the robustness runs, the hotel comparison, all six sweeps and the figures. Every
  conclusion stands; the levels moved (B0 30.77 to 30.22 completed rides per 100 searches,
  B3's gain +0.34 to +0.32). The reports in `experiments/reports/` are the new ones; the
  README and EXPERIMENT_PROTOCOL still quote the old numbers until the team has read them.
- Open: one test asks that a typical booking's chance of lasting 168 hours be over 0.5, and
  the `h3` no-feature model gives 0.49, because the new world cancels more. Loosening the
  test or weakening `last_mile_sensitivity` in `world.yaml` is the team's choice.
- Tests: 324 Java, 207 of 208 Python, 241 web, 28 gateway.

## 2026-10-24 — engineering to industry practice, and a front door

- **Every suite runs on GitHub Actions** on each push and pull request: web (types, lint,
  tests, build), gateway (lint, tests), core-api (Java 21 with real databases) and Python
  (ruff, then the research suite against core-api's schema). ESLint now checks the web
  app (with React hooks and accessibility rules) and the gateway; it found two misused
  hooks, fixed.
- **The API describes itself**: Swagger UI at `/swagger-ui.html` and the OpenAPI document,
  generated from the controllers.
- **Password guessing is slowed**: five wrong passwords for one address in 15 minutes
  lock it for the rest of the window, counted in Redis. Confirmation codes are capped at
  ten a day per channel. Both messages translated.
- **Dependencies scanned again**: an advisory published since the last scan made zod 3
  vulnerable; the app moved to zod 4, and the gateway to body-parser 1.20.9. Nothing in
  the gateway or what the browser runs is flagged. Tailwind stays on 3 (DECISIONS.md).
- **Demo data**: `scripts/demo-data.mjs` fills a local stack through the public API, every
  account labelled as made up; nothing reaches the research figures.
- **A front page** for signed-out visitors, an **installable app** with an offline page,
  and a **command palette** (Ctrl+K). In English, Hindi and Marathi, seen in Edge at
  desktop and phone width, light and dark.
- **Found and fixed**: maps had never been dark at night (TESTING.md, bugs the tests did
  not find).
- Tests: 311 Java, 206 Python, 236 web, 28 gateway, all passing.

## 2026-10-23 — cleaned and hardened

- An audit of the whole repository: no failing test, no compile warning, no type error,
  no unused code or dependency. Ruff found 13 findings in the Python, all fixed; paired
  lists are now zipped strictly, so a length mismatch fails loudly instead of quietly
  dropping data.
- core-api and intel run as unprivileged users in their images; core-api's JVM sizes its
  heap to the container and exits on running out of memory.
- The web server compresses text, lets browsers keep the hashed build files for a year,
  checks the page itself on every visit, and sends security headers.
- React Router 7 and Vitest 5; the TypeScript build cache is no longer tracked.

## 2026-10-22 (later) — a production-style interface

- **As chosen, all four bundles**, built on the iOS look of the morning:
  - *Colour and brand*: each role in its own tint (teal, indigo, violet), icons on every
    section and action, coloured chips, an illustration on every empty list, and a light,
    dark or match-device switch in the header, applied before the first paint.
  - *Real-world patterns*: search results as timeline cards with the driver's avatar and
    rating; an iOS tab bar on phones with a More sheet; toasts; irreversible actions asked
    in a sheet that can be swiped down; a seat stepper; a success card whose tick draws
    itself after booking; a weekly payouts chart and counting figures on Earnings and the
    admin overview.
  - *React*: every screen in its own chunk, fetched ahead on hover or focus; an error
    screen per page; portals for sheets and toasts; re-sorting as a transition that keeps
    the results on screen; notifications marked read optimistically, rolled back on
    failure; theme and toasts as context.
  - *Motion*: panels glide open and closed; sheets and toasts leave as smoothly as they
    arrive; figures count up. Nothing moves for reduced motion.
- Two dependencies: `framer-motion` and `lucide-react`. The main bundle went from 730 KB to
  65 KB of app code, with libraries and translations in their own cached files.
- Not built: the step-by-step publish wizard and the command palette, the two large items.
- Seen in headless Edge in light and dark, desktop and phone width, for passenger, driver
  and administrator; one fault found and fixed there (the chart's text scaled with its
  width). One web test changed: the confirmation now opens in a dialog.
- Tests: 304 Java, 206 Python, 232 web, 28 gateway, all passing.

## 2026-10-22 — an iOS-style look, light and dark

- **The whole interface restyled**, as asked: iOS's grouped greys and system colours with
  VAYORA teal as the tint, a frosted header with the sections as pills, large titles,
  capsule buttons that give under the finger, rounded fields with a soft focus glow,
  iOS switches for every on-off setting, notices with icons, status pills, chat as
  message bubbles, a loading shimmer, and a drawn Kolhapur to Pune route on the sign-in
  pages. **Dark mode** follows the device. Screens arrive with a short rise, their sections
  one after another; nothing moves for those who ask their device for reduced motion.
- No new dependency: every colour is a CSS variable behind the existing class names, and
  motion is CSS. Seen in headless Edge in light and dark, desktop and phone width; one
  fault found there and fixed (the initials avatar was pale in dark mode).
- Tests: 304 Java, 206 Python, 232 web, 28 gateway, all passing.

## 2026-10-21 (last) — today's code reviewed

- Read back the day's code (reminder targeting, the scheduler client, the Twilio call
  bridge, receipts, server-message templates, dates in notifications). The reminder job
  cannot remind a seat twice, a failing scheduler asks nobody, receipts reach their owner
  only, and the TwiML is escaped. One small fault fixed: a status lookup that would also
  have answered for inherited names such as "constructor".
- Raised and decided: repeated masked calls are not limited. With Twilio on, each call
  rings the other side and costs two paid legs; recorded in DECISIONS.md and
  KNOWN_LIMITATIONS.md rather than limited.

## 2026-10-21 (later still) — the newer screens in Marathi on a phone-sized screen

- **21 pages driven in headless Edge at 390 px, in Marathi**: a passenger's search results
  (walks, rickshaws, a driver's record), bookings, payments, receipt, passes, notifications
  and account; a nudged driver's notifications, rides, publish form, earnings, record,
  vehicles and account; and the administrator's overview, what-if, unmet demand,
  durability, rides, buses and stopovers. No page scrolled sideways. The only English left
  was what is meant to stay: people's names, stop names as drivers typed them, the
  rickshaw fare's published source, and AM and PM, which the browser's Marathi date format
  writes in Latin letters. No fault found; checked by eye from the screenshots too.
- Not a phone: an emulated screen in a desktop browser. Using the app by hand on a phone
  is still the team's to do.

## 2026-10-21 (late night) — four features seen in a browser; two faults fixed

- **Seen in headless Edge against the running stack** for the first time: an identity
  document declared and shown as not checked (7); an electric car's 230 km stretch warned
  about and refused at 200 km (15); walks by footpath and rickshaws with Pune's meter fare
  on search results (91); and supply gaps end to end (93), with the detection job set to
  run every minute for the check and then put back: three empty searches made a gap the
  administrator saw, a driver who had driven the stretch was nudged, and their ride that
  day was logged as converted.
- **Two faults found and fixed.** The profile said "Says they hold a Driving licence", and
  would have said "a Aadhaar"; it now says "Declared: Aadhaar, not checked". And dates in
  notifications were the server's: the nudge showed "2026-10-27", and the seat-release
  reminder an English weekday and month in a Hindi or Marathi sentence. Both are now
  written as ISO-8601 and shown in the reader's language; the server's English, which email
  and text copies carry, is unchanged.
- Tests: 304 Java, 206 Python, 232 web, 28 gateway, all passing.
- Feature count unchanged: 83 Verified, 11 Partial, 1 Not started of 95.

## 2026-10-21 (night) — limitations corrected; two things left as they are

- **KNOWN_LIMITATIONS.md said ten things that later work had made untrue**: no detour
  pickups, no boarding code or passenger confirmation, no flexible rebooking, no
  withdrawing a series, no referral scheme, no codes, Google sign-in, profiles or photos,
  no explanation of a score, an emergency button that messages nobody in any setup, and
  nothing acting on scores. Each was checked against the code and corrected or removed;
  what stays true was kept.
- **Decided, as asked**: web pushes stay in English, and corridor demand calibration (89)
  stays not started, since no real demand figures exist and a timetable proxy would not
  be calibration. Both are recorded in DECISIONS.md.
- Feature count unchanged: 83 Verified, 11 Partial, 1 Not started of 95.

## 2026-10-21 (evening) — server errors built from numbers, translated

- **The last gap in 71 that was only building**: the five error messages core-api builds
  from values, such as "You can have at most 3 emergency contacts", are now shown in Hindi
  and Marathi with their values kept. The app matches each against a template; a booking
  status inside one becomes a word ("A cancelled booking cannot become confirmed", in
  English too). The API's messages are unchanged. A core-api test now finds every message
  the server builds from values and fails if the app has no template for it; removing one
  template made it fail, as it should.
- 71 stays Partial: the translations have had no native review.
- Tests: 303 Java, 206 Python, 231 web, 28 gateway, all passing.
- Feature count unchanged: 83 Verified, 11 Partial, 1 Not started of 95.

## 2026-10-21 (later) — receipts in Hindi and Marathi

- **Receipts in the reader's language (50)**, as chosen: besides the English PDF, each
  booking payment and pass has a receipt page in English, Hindi or Marathi, with names and
  stops as written in any script. "Print or save as PDF" hands it to the browser, whose
  fonts draw Devanagari, which the server's PDF cannot. Both forms come from one query, so
  they state the same facts, including that the payment was simulated (or Razorpay's test
  mode) and that neither is a tax invoice. The page has not been printed from a real
  browser, and its translations have had no native review. 50 stays Partial: no GST.
- Then seen in a browser against the rebuilt stack: a passenger named आशा पाटील booked
  two seats and cancelled, opened the receipt in Marathi from Payments, and pressed "Print
  or save as PDF", which asked the browser to print once. Headless Microsoft Edge printed
  the page to PDF: the Devanagari drawn and joined correctly, the navigation left off, the
  same amounts and times as the server's PDF, which prints the name as "??? ?????".
- Tests: 302 Java, 206 Python, 227 web, 28 gateway, all passing.
- Feature count unchanged: 83 Verified, 11 Partial, 1 Not started of 95.

## 2026-10-21 — targeted reminders on the platform; masked calls through Twilio

- **Targeted seat-release reminders (79, 80)**, as chosen on 2026-10-20, replacing the
  everyone-alike decision of 2026-10-17: the reminder now asks only bookings the durability
  model last rated below 0.8, and when more are due than the budget allows, intel's contact
  scheduler chooses which, with the simulator's B5 limits (in `application.yml`). One not
  chosen is due again next run; an unscored booking is never asked, and nobody is while the
  scheduler cannot be reached. Nothing is cancelled or priced, and the message never
  mentions the model. `targeting.enabled: false` asks everyone alike. Both are Verified; no
  gain is claimed, since in the simulator targeting adds no rides.
- **Masked calls through Twilio (61)**, as chosen: with the same three settings as texts, a
  call is a bridge. Twilio rings the caller from the platform's number, then dials the other
  side from it, so neither sees the other's number; a refusal is a 503 that says so. Without
  the settings calls stay simulated and say so. Tested against a stand-in, never tried with
  Twilio; 61 stays Partial. The settings moved from `journex.sms.twilio` to
  `journex.twilio`; the environment variables are unchanged.
- Found on the way: the new tests' extra Spring contexts ran the test database out of
  connections ("too many clients"), failing Razorpay's and walking search's tests. The test
  PostgreSQL now allows 400, above what Spring's context cache can hold.
- Tests: 300 Java, 206 Python, 223 web, 28 gateway, all passing.
- Feature count: 83 Verified, 11 Partial, 1 Not started of 95.

## 2026-10-20 (afternoon) — the survival models on real cancellations

- **A real-data check for the durability model (77)**, as chosen: the same three kinds of
  model fitted on the hotel bookings made within a week of arrival, on what was known when
  each was made, trained on 2015-16 arrivals and checked on 2017. Cox ranks who cancels at
  0.597 and gradient boosting at 0.653, against 0.544 for lead time alone, and both are
  calibrated (EXPERIMENT_PROTOCOL.md section 19). The opposite of the simulator, where the
  features added nothing: the simulated world may understate what features tell.
- Found on the way: lifelines' default Newton-Raphson steps stop before Cox converges on
  these data, which first gave 0.521. The fit settings are now in the config, and a fit
  that does not converge stops the run. Deterministic; reproduce.sh rebuilds it.
- 77 stays Partial: the served model is still trained on simulated data only.
- Tests: 292 Java, 206 Python, 222 web, 28 gateway, all passing.

## 2026-10-20 (later) — payments through Razorpay, off until keys

- **Razorpay (46)**, as chosen: with its two keys set, a passenger pays in Razorpay's
  checkout for an order core-api opens for the amount it works out, and the booking or pass
  checks the signature, the order, the amount and that the payment paid for nothing else,
  records the method Razorpay reports and takes the money. A cancellation refunds through
  Razorpay; a booking that fails after paying is refunded in full when it rolls back. A test
  key is recorded as RAZORPAY_TEST, so every screen and receipt says no real money moved.
  Drivers are not paid through it, and flexible bookings are off while it is on: both said
  on screen. Without keys nothing changes. Tested against a stand-in; never tried with
  Razorpay. 46 stays Partial.
- Two stale limitations corrected: walking is on footpaths, and the payments line now says
  what the mock and Razorpay each do.
- Tests: 292 Java, 204 Python, 222 web, 28 gateway, all passing.
- Feature count unchanged: 81 Verified, 13 Partial, 1 Not started of 95.

## 2026-10-20 — rickshaws to and from stops; texts through Twilio

- **Rickshaw access (91)**, as chosen: where a walk to or from a stop is a kilometre or more,
  a result also gives the time by auto-rickshaw, by road, and the meter fare where a
  published one is known in full. Only Pune's is (Rs 30 for 1.5 km, then Rs 20 a km, from
  1 September 2026, by the Pune RTA as Punekar News reported it); Kolhapur's 2025 revision
  was found reported without how far its minimum goes, so it is left out rather than guessed.
  Each fare names its source on screen. 91 is Verified, as an estimate.
- **Text messages (64)**, as chosen, off until keys: with a Twilio account's three settings,
  texts go through Twilio; without them, to the simulated outbox as before. Never tried with
  Twilio itself. The emergency button now texts each contact on its own, so a failed text
  can never stop an alert, and says how many contacts it missed (V33). 64 stays Partial.
- Two faults the tests caught (TESTING.md): a half rupee lost to floating point, and the
  first Twilio tests reaching the real Twilio with fake credentials. Both fixed.
- docker-compose.yml passes GOOGLE_CLIENT_ID and the Twilio settings from .env to core-api.
- Tests: 286 Java, 204 Python, 218 web, 28 gateway, all passing.
- Feature count: 81 Verified, 13 Partial, 1 Not started of 95.

## 2026-10-19 (end of day) — the live what-if simulator

- **Live what-if (87)**, as chosen: below the saved sweeps, an administrator can simulate any
  value of a question's setting within bounds each sweep's configuration sets, on 5, 10 or
  30 seeds, for the variant and its baseline. intel runs it in memory and keeps nothing;
  the answer is means, the mean paired difference and seeds up and down, with no interval,
  labelled an exploration and never a report figure. Its two measures are counted as
  metrics.sql counts them (tested on the same events), and a 30-seed run at a value a sweep
  covered reproduces that sweep exactly (tested). 87 is Verified.
- **Placement.** The browser calls intel for this alone: core-api relaying it would forward
  a request for another. So intel checks the administrator's token itself and allows the
  app's origin; DEPLOYMENT.md now says only `/v1/whatif/*` may be exposed. intel's image is
  built from the repository root, carrying the simulator. New in intel: SimPy, PyYAML, PyJWT.
- Through the running stack: in a browser, an administrator signed in through core-api
  simulated 3 hours either side on 10 seeds in a few seconds, and the form refused 30 hours
  before anything was sent; over HTTP, a passenger's token was refused and a value outside
  the bounds was refused with its reason.
- The sweeps and live runs now share how a cell is built and how a changed variant is
  checked; the contact-budget sweep rebuilt from nothing came out identical.
- Tests: 275 Java, 204 Python, 215 web, 28 gateway, all passing.
- Feature count: 80 Verified, 14 Partial, 1 Not started of 95.

## 2026-10-19 (later still) — real hotel cancellations beside the simulator

- **The public hotel bookings**, as chosen (Antonio et al. 2019, CC BY 4.0): the one real
  set of cancellations within reach. Earlier documents doubted it could support a
  time-to-event check; this dataset records the day each booking was cancelled, so it
  can, to the day. The 19,746 bookings made within a week of arrival are written into the
  event log under a run of their own, and a new metric query counts, day by day, the
  bookings standing and those cancelled; the same query runs on the simulator.
- **What it shows** (EXPERIMENT_PROTOCOL.md section 18): over the last week the hotels
  cancel at about a half (city) and a quarter (resort) of the simulator's rate. From six
  days out, 80% and 90% of their bookings reach arrival against 67% in the simulator.
  When cancellations come is much the same: half or more fall in the last two days in all
  three. It says nothing about refills or passengers, and the model's features do not
  exist in it. `world.yaml` is unchanged.
- `scripts/reproduce.sh` gains the step (it downloads the file the first time and checks
  its hash); rebuilt from nothing it came out byte for byte the same.
- TESTING.md's Python counts had fallen behind (the simulator's tests are 73, not 70; the
  experiments' were 35 before this, not 29); corrected.
- Tests: 275 Java, 194 Python, 213 web, 28 gateway, all passing.
- Feature count unchanged: 79 Verified, 15 Partial, 1 Not started of 95.

## 2026-10-19 (late night) — electric range enforced, an identity document declared

- **Electric range (75)**, as chosen after a correction: the option first offered refused
  any ride longer than the car's range, which would have stopped every trip that charges
  on the way, as the app tells drivers to. Instead a ride is refused only when one
  stretch between stops is longer than the range: the car can charge at a stop, not
  between two. The publish screen names the stretch first. 75 is Verified.
- **Government ID (7)**, as chosen, a labelled mock like the insurance badge: a driver
  says which identity document they hold. Only the kind is kept, never a number or a
  copy; the profile says "not checked", and it counts towards no level and no filter.
  7 is Partial; nothing is checked.
- Tests: 275 Java, 187 Python, 213 web, 28 gateway, all passing.
- Feature count: 79 Verified, 15 Partial, 1 Not started of 95.

## 2026-10-19 (night) — the detour work read back

No new features. Reading the detour pickups (28) back against the rest of the platform
found three faults, all fixed (TESTING.md, "Bugs the tests did not find"):

- The meeting-point map sent a passenger picked up at their own point to the stop before
  it. It now marks the pickup and its time.
- When a driver withdrew, a passenger picked up near Karad was rebooked, or told of other
  rides, from Kolhapur, 66 km away. Both now look from the pickup point, and a ride that
  offers detours is booked with it.
- Booking a pickup asked the routing service while holding the ride lock. It is now asked
  first, and only the check against the minutes left is under the lock, as DECISIONS.md
  now says. (The entry below says the cost was worked out under the lock; it was, then.)
- The first two have tests that were seen to fail without the fix. The third has none:
  the tests have no routing service to slow down.
- TESTING.md's per-file counts had fallen behind (the web app's main test file has 133,
  not 108); they are corrected, and the 14 core-api classes the table never described are
  listed.
- `scripts/reproduce.sh` run in full on the reinstalled machine, the flexible-booking sweep
  included: every committed number reproduced exactly.
- Tests: 269 Java, 187 Python, 209 web, 28 gateway, all passing.
- Feature count unchanged: 78 Verified, 15 Partial, 2 Not started of 95.

## 2026-10-19 (evening) — recovery simulated, and walks on footpaths

- **Cascade-aware recovery (88), simulated**: the simulator now rebooks a passenger who
  chose a flexible booking at once when their driver withdraws, as the platform does; the
  share who choose it is swept, not assumed. With nobody flexible it reproduces section 7
  exactly. Rebooking rescues +0.03, +0.07 and +0.14 completed rides per 100 searches as the
  share goes 0.25, 0.5 and 1.0 (EXPERIMENT_PROTOCOL.md section 17): of what the platform
  does once a seat is booked, the only thing tried that adds rides. The setting is called
  `flexible_booking`, never `flexible`, which is a hidden passenger type. The sweep is in
  reproduce.sh and the what-if explorer. 88 is Verified.
- **Walking on footpaths (91)**: a second routing graph, built from the same map for
  walking, gives the walk to the pickup and from the drop-off; the result says whether a
  walk was routed or is a straight-line estimate. Seen through the running stack: from a
  kilometre off a stop, 15 minutes on footpaths against 14 in a straight line. 91 stays
  Partial: there is no rickshaw data.
- Tests: 267 Java, 187 Python, 208 web, 28 gateway, all passing.
- Feature count: 78 Verified, 15 Partial, 2 Not started of 95.

## 2026-10-19 (later) — detour tolerance

- **Detour tolerance (28)**, as chosen: a driver says how many minutes in all they will go
  out of their way on a ride (0 to 30, default none). A passenger whose start has no stop
  nearby, but whom the ride's road passes within 8 km, is offered a pickup at their own
  point when the road via it costs no more than the minutes left. Search works the cost
  out by road; booking works it out again under the ride lock, so two passengers cannot
  both spend the last minutes. The pickup's time is the stop's plus the drive to it; the
  driver sees each pickup's cost and the point on a map. Pickups only, not drop-offs.
- Driven in a browser on the real road map: a ride with no Karad stop picked a passenger
  up in Karad for 7 of its 20 minutes. It found one fault, fixed: the result's heading
  named the stop before the pickup at the pickup's time.
- The seat-release reminder (79) was seen arriving from the running job in a browser:
  once, with the half-fare refund it would get then, in English and Marathi.
- Tests: 262 Java, 181 Python, 207 web, 28 gateway, all passing.
- Feature count: 77 Verified, 16 Partial, 2 Not started of 95.

## 2026-10-19 — tools reinstalled; two-sided match scoring

- Git, Docker Desktop, Node.js and WSL had gone from the machine. They were reinstalled
  (winget), the whole stack rebuilt from nothing, the road map prepared again, and every
  suite passed before any new work: nothing had been lost but the local test data.
- **Two-sided match scoring (76)**, as chosen: every search result is scored out of 100
  for both people, from how near the pickup and drop-off are, the price against the
  cheapest result, the driver's record of rides kept, and whether the two agree on
  smoking, pets, music and conversation as each said on their profile. What either left
  unsaid counts half. "Best match for both of you" orders by it and shows the score with
  its reasons; the other orders are untouched. It never reads the durability model or
  anything predicted. The weights (25, 20, 15, and 10 for each preference) are
  assumptions, in `application.yml`, and must add up to 100.
- Tests: 256 Java, 181 Python, 203 web, 28 gateway, all passing.
- Feature count: 76 Verified, 16 Partial, 3 Not started of 95.

## 2026-10-17 (late night) — a reminder to release a seat

- **Seat-release reminder (79, platform side)**, as chosen: every passenger with a
  confirmed seat, booked before the window, is asked once, 48 hours before boarding, to
  cancel now if their plans have changed, so someone else can take the seat. The message
  states the refund they would get at that moment (half the fare, just inside 48 hours),
  not the whole-fare tier that is ending. Everyone is asked alike: nothing reads the
  durability model, and nothing is cancelled for anyone. Logged as `intervention_issued`
  with action `release_reminder`, a platform row outside every run. No gain is claimed.
- 79 stays Partial: the backlog's version targets by prediction, which the platform does
  not do.
- Tests: 247 Java, 181 Python, 202 web, 28 gateway, all passing.

## 2026-10-17 (late night) — a reward for invitations

- **Referral reward (72)**, as chosen: once an invited member completes a first trip, each
  of the pair who is a passenger gets a free weekly pass, once, and is told. It starts
  when any pass already running ends, waives the service fee like a bought one, and its
  receipt says nothing was paid. Drivers get none: a pass only waives a passenger's fee.
  A first trip rather than a sign-up earns it, so made-up accounts earn nothing. The pass
  kind is set in `application.yml`, and NONE turns the reward off.
- Tests: 243 Java, 181 Python, 202 web, 28 gateway, all passing.
- Feature count: 75 Verified, 16 Partial, 4 Not started of 95.

## 2026-10-17 (night) — insurance and calling, as labelled mocks

- **Insurance badge (58).** A driver declares the insurer and the date the cover runs to,
  on the vehicles page. Passengers see it on a search result while it covers the trip's
  date, as "declared by the driver ... Not checked". No insurer is connected and no
  policy number is asked for.
- **Masked calling (61).** The passenger and the driver of a confirmed booking can "call"
  each other from 24 hours before boarding, only between confirmed phone numbers, as a
  real relay would need. Nothing is dialled: the caller is told so in full, the other side
  gets a notification that someone tried, and no phone number is ever returned (a test
  checks the HTTP answer).
- Both seen in a browser, in English and Marathi, including a call refused for want of a
  confirmed phone.
- Both are Partial: each needs an outside service to be real.
- Tests: 240 Java, 181 Python, 200 web, 28 gateway, all passing.
- Feature count: 74 Verified, 17 Partial, 4 Not started of 95.

## 2026-10-17 (evening) — a lower fee on rides by drivers who keep their rides

- **Driver commitment pricing (94)**, in the form chosen today: passengers on rides by a
  driver with at least 10 completed rides and none withdrawn among rides due to leave in
  the last 90 days or later pay a 7% service fee instead of 10%. Drivers already keep the
  whole fare, so the platform's own fee is the only price it can move. The rule reads
  the driver's record only, never the durability model, and the setting is refused if
  the lower rate would exceed the standard. Search and the payment hold use the same
  check, so the fee shown is the fee held; the result says why it is lower.
- Whether it makes drivers withdraw less is not measured, and simulation could not
  identify it: drivers in the simulator do not respond to prices.
- Tests: 232 Java, 181 Python, 194 web, 28 gateway, all passing.
- Feature count: 74 Verified, 15 Partial, 6 Not started of 95.

## 2026-10-17 (later) — why searches find nothing; seats on a ride under way

Both approved on 2026-10-17.

- **Why searches find nothing, measured.** The simulator now logs, with each answer, how
  many published rides left in the passenger's time window before the seat check
  (`rides_in_window` on `candidates_returned`; no new event type, no random draw). The
  ladder and robustness runs were rebuilt: no existing figure changed. In B0, 35.5% of
  searches meet only full rides and 19.6% find no ride in their window: two empty
  searches in three are full rides, now measured rather than worked out from the
  configuration. Every variant's effect on empty searches is on full rides.
  EXPERIMENT_PROTOCOL.md section 16.
- **Seats on a ride under way (84).** A ride already on the road stays on sale from stops
  it is due at 30 minutes or more ahead, by its timetable, and only if it confirms
  instantly. A no-show's seat goes back on sale for the stops ahead. Search, booking and
  seat holds share the rule, and a result says the ride is on the road and that its time
  at the stop is the timetable's. A booking made on the road writes its `trip_started`
  at once, so started = completed + failed still holds. Decisions in DECISIONS.md.
- **Driven in a browser, it found a hole**: a ride started early (allowed up to an hour
  ahead) was still sold from the stop it had just left, because its timetable put that
  stop beyond the margin. Rides now record when they started (V27), and a stop is
  judged by the earlier of the timetable and the start. Rerun, the browser check passed:
  booked from Karad on a ride under way, refused from Kolhapur, and a no-show's seat
  back on sale. A result now says the ride may reach the stop before the time shown.
- KNOWN_LIMITATIONS had said there was no profile photo and no price, music or
  conversation filter; all exist. Corrected.
- Tests: 227 Java, 181 Python, 193 web, 28 gateway, all passing.
- Feature count: 73 Verified, 15 Partial, 7 Not started of 95.

## 2026-10-17 — live position seen between two browsers

- A third browser pass drove live position (feature 68) with two browsers: a driver whose
  browser reports an (emulated) location starts a ride and shares it; the passenger opens
  the chat and sees the driver on the real map; the driver stops. It now works end to end,
  and 68 is marked Verified, with "never tried on a phone's GPS" stated on the row.
- **It found four faults the tests had missed**, all fixed:
  - the gateway gave up on MongoDB for good if MongoDB started after it ("Topology is
    closed" on every chat call until a restart). It now keeps trying, and compose starts
    it after MongoDB is healthy;
  - a driver who opened the chat before starting the ride was never offered sharing;
  - one moment without a GPS fix turned sharing off; now only a refused permission does;
  - leaving a page while its map was still animating threw a Leaflet error.
  Each web fault has a test that fails without the fix; the gateway has a reconnect test.
- Documents brought up to date where they had fallen behind: email codes go by real
  email when SMTP is configured (feature 5), and KNOWN_LIMITATIONS no longer says no
  screen was seen in a browser or that the driver's pages have no page test.
- Tests: 221 Java, 177 Python, 192 web, 28 gateway, all passing.
- Feature count: 72 Verified, 15 Partial, 8 Not started of 95.

## 2026-10-16 — the rest of the app seen in a browser

- A second browser pass covered a whole trip (an electric car's range warning, publishing,
  booking, starting, completing, the passenger confirming and rating), payments and a
  receipt, passes, a driver's public profile, the emergency panel, Marathi, phone width and
  every administrator page. Every page rendered.
- **It found a real bug the tests had missed**: sending a rating showed "Unexpected end of
  JSON input" although the rating was saved, because the API helper read the empty 201
  answer as JSON. Fixed in the helper, for every such answer, with a test that fails
  without the fix.
- **And a gap**: a passenger's booking never named the driver or the car. Each booking now
  shows both, the driver linked to their profile (core-api and web tests).
- The members search says it takes a phone number too, as it has since phone sign-up.
- Tests: 221 Java, 190 web.

## 2026-10-15 — the app seen in a browser

- The whole stack was started with Docker and driven in headless Microsoft Edge through
  `playwright-core`: driver sign-up, vehicle, publishing over OSRM's real road route
  (230 km, 3 h 11 min), passenger search and booking, the driver's notification, the
  account page, Hindi, sign-in at phone width, and the administrator overview, what-if and
  unmet-demand pages. Every step worked; the browser logged only the expected 404s for
  members with no photo.
- It found two display faults, fixed: an empty box on the sign-in pages where the Google
  button goes when Google sign-in is off, and a minutes field on the first stop of the
  publish form that can only ever be the starting point.

## 2026-10-15 — review of the recent work

A review of the code added today found three bugs; each is fixed, two with a test that
fails without the fix (checked by removing it).

- **A failed confirmation email locked the member out.** `requestCode` had no
  transaction: when the email failed, the new code stayed saved and the old one was
  cancelled, so asking again was refused with "a code was sent a moment ago". Now nothing
  changes if the code cannot be sent. `EmailDeliveryIntegrationTest`.
- **The morning supply-gap check ran without its transaction**, because the timer called
  a method on its own class, bypassing Spring's proxy. It now runs from a job class of its
  own, as the booking-expiry job does.
- **Photos broke in development**: React's StrictMode remounts once, and the photo's
  temporary address was revoked on the first unmount and not made again. It is now made
  and revoked by the same effect.
- Tests: 221 Java, 189 web.

## 2026-10-15 — Google sign-in, ready to configure

- **Feature 2** moves to Partial: "Sign in with Google" on the sign-in and sign-up pages,
  shown only when `GOOGLE_CLIENT_ID` is set. core-api checks Google's ID token (signature,
  issuer, audience, expiry, confirmed email), links an account with the same address, or
  creates one once the person says whether they travel or drive. Tested against a stand-in
  for Google; never tried with Google itself. Its four new error messages are translated.
- Tests: 220 Java, 189 web.

## 2026-10-15 — supply gaps and nudges

- **Feature 93.** Each morning core-api reads the event log for searches in the coming
  week that were offered no ride, groups them by day and stretch, and logs a
  `supply_gap_detected` for each with three or more. Up to five drivers who drove that
  stretch in the last 90 days are told, none more than once a week, and `nudge_issued` is
  logged. A nudged driver who then offers the stretch that day is logged as
  `nudge_converted`, for the record only. Administrators see the coming gaps on an
  "Unmet demand" page. Verified by `SupplyGapIntegrationTest` and `App.test.tsx`.
- Tests: 217 Java, 187 web.

## 2026-10-15 — server error messages translated

- Every fixed error message core-api can send (88, with the client's own "cannot reach
  the server") is now shown in Hindi or Marathi: the error notice translates what it shows,
  and `web/src/lib/serverMessages.ts` registers them so the translation tests demand both.
  `ServerMessagesTest` in core-api fails if the server gains a fixed message the app does
  not list. Messages built from numbers stay in English, as does anything the app does
  not know. Two messages chosen by a condition were split into plain ones so they count.

## 2026-10-15 — real email, the driver's record, walking time, flexibility tiers

- **Real email (63)** through any SMTP server, set by configuration; without one nothing
  is emailed. Text messages stay simulated, and each channel says whether it really sends.
  Tested against an SMTP server inside the tests (GreenMail, test-only).
- **The driver's record in search (78)**: rides completed out of those completed or
  withdrawn, from past rides only.
- **Walking time (91, part)**: a rough walk to the pickup on each result, from the
  straight-line distance.
- **Flexibility tiers (81)**, as the team chose: this ride only, Flexible (rebooked
  automatically within 2 hours) or any time that day, at the same price. Flexible is
  suggested on a driver whose record shows withdrawals. `tier_selected` is now written,
  for every non-default choice.
- Testing found a real bug: a notification sent after a commit, from inside another
  after-commit step, was silently never written. The rebooking notice now has its own
  transaction.
- Tests: 215 Java (7 new), 185 web.

## 2026-10-15 — rest stops and chargers, translated notifications, photos, push

Built on the team's go-ahead for all four. Verified by 17 new Java tests (208 in all) and
the web tests (183), all passing.

- **Rest stops and chargers (82, 83).** Administrators enter them; none ship. A driver
  working out a route sees those within 2 km of it, in order, with the rest stop nearest
  the two-hour mark suggested for a break, and the electric-range warning says whether a
  charger is listed near the route.
- **Translated notifications (71).** A notification is stored as an English template and
  its values (a value can itself be a phrase, like "2 seats, Kolhapur to Pune", or a list of
  them), rendered to exactly the English it had before. The app translates it piece by
  piece; town names are translated, people's names and notes are not. Older notifications,
  and copies, stay in English. A core-api test fails if the server uses a template the app
  does not list.
- **Photos (3, 16).** Profile and vehicle photos in PostgreSQL. Each upload is re-encoded
  as a JPEG of at most 800 px, which drops metadata such as a phone photo's location.
- **Web push (62).** The standard protocol written with the JDK, checked against RFC
  8291's example to the byte. Only HTTPS addresses at known push services are accepted.
  Off until a key pair is configured (`scripts/vapid-keys.mjs`).
- Also: a member with no email who asks for an email code is now told so, instead of being
  asked to add a phone number.
- `scripts/reproduce.sh` was run in full after the robustness work, before this: every
  result reproduced exactly.

## 2026-10-15 — the ceiling across passengers' response

- ORACLE against B3 with the release chance at 0.25, 0.5 and 1.0 (sweep `...007`,
  EXPERIMENT_PROTOCOL.md section 15): +0.05, +0.10, +0.22. A first 3 × 3 grid also swept the
  chance of putting off a passenger who would travel; every row was identical, as it must
  be (the oracle asks no such passenger), so the sweep keeps only the release chance. On the
  what-if page and in reproduce.sh.

## 2026-10-15 — robustness

- Four new variants (B3-KM, B4-KM, ASK-ONLY, B5-RANDOM) and a threshold sweep, run against
  B3 (run `...004`, sweep `...006`); EXPERIMENT_PROTOCOL.md section 14 and figure 7.
- **B3's gain needs no booking features**: ranking with the no-feature Kaplan-Meier model
  keeps all of it. Asking adds nothing however it is chosen, without the ranking it is no
  better than B0, the contact scheduler does no better than random choice within the same
  limits, and no threshold from 0.6 to 0.9 helps. AI_ML_METHODOLOGY.md and
  KNOWN_LIMITATIONS.md now say so.
- The simulator gained one option, `budget.chooser: random`; left out, it is the
  scheduler, and B0, B3, B4 and B5 reproduce run `...003` on every measure.
- The threshold sweep is on the what-if page. reproduce.sh rebuilds the run, the sweep and
  figure 7.

## 2026-10-15 — when cancellations come

- New named query `cancellation_timing` in metrics.sql (no new event type), tested on
  hand-made events, and `experiments/analysis/timing.py`, which reports it for the ladder
  run against B3. Figure 6 and EXPERIMENT_PROTOCOL.md section 13: asking (B4) cuts about 10
  late cancellations per seed but adds about 23 four or more days out, about 6 more in all;
  the oracle cuts 23.5 late ones. reproduce.sh rebuilds the report and the figure.

## 2026-10-15 — report figures

- Five figures in `docs/figures/`, with captions in its README: the variant ladder, early
  against late refills, the three sweeps, the durability curve and model calibration.
  `experiments/analysis/figures.py` draws them from the committed reports and model only;
  `scripts/reproduce.sh` redraws them and fails on any difference. New research-only
  dependency: matplotlib.
- Looking at the first drafts caught two wrong ones: the durability curve's axis stopped at
  80%, cutting off the curve, and its title said most cancellations come in the first days,
  which the curve does not show (it falls steadily). Both corrected.

## 2026-10-15 — what-if explorer

- **Feature 87** moves from Not started to Partial. An administrator's "What if" page picks
  a question (passengers' departure window, how early rides are published, the contact
  budget) and a setting, and shows that saved run's figures against its baseline, with the
  95% interval and "no clear difference" where it spans zero. Only the three sweeps the
  current code reproduces are offered. Nothing is simulated on the page: the decision and
  its cost are in DECISIONS.md.
- `experiments/analysis/export_web.py` writes the page's data from the committed reports;
  `scripts/reproduce.sh` now rebuilds it and fails if it differs. Verified by
  `test_export_web.py` and `App.test.tsx`, which checks the 8-hour window shows
  −0.05 (−0.10 to −0.01), as in EXPERIMENT_PROTOCOL.md.

## 2026-10-15 — phone sign-up

- **Feature 1** moves from Partial to Verified. A member signs up with an email address or
  a phone number, and signs in with whichever they used: one field takes either. Phone
  numbers are written one way (+91 for Indian numbers, spaces and hyphens dropped) and now
  belong to one account. A member who signs in by phone cannot remove it from their
  profile. Verified by `PhoneSignUpIntegrationTest`, `schemas.test.ts` and `App.test.tsx`.
- KNOWN_LIMITATIONS said there were no receipts; corrected.

## 2026-10-14 — phone confirmation screen tested

- **Feature 6** moves from Partial to Verified: a UI test now confirms a phone number on the
  account page. No code changed; the screen was already shared with email. Still a
  simulated sender: no SMS is sent.

## 2026-10-14 — electric range warning

- **Range against route (features 15 and 75).** When a driver works out the route for an
  electric car, the publish screen compares the road distance with the range implied by the
  driver's own battery and consumption figures and, if the route is longer, tells them to
  plan a charging stop. A warning only: publishing is not blocked, and no charging stop is
  planned (feature 83 still needs charger data). Verified by `App.test.tsx`.

## 2026-10-14 — bus alternatives

- **Bus alternatives (features 73 and 92).** Administrators enter bus services (operator,
  towns, daily departure time, journey time, fare). A passenger whose search finds no ride
  sees the listed buses between those towns; a passenger whose ride is withdrawn with no
  other ride to offer is named up to three in the notice. No timetable ships with the
  platform: nothing was invented, and nothing checks the entries against MSRTC, which both
  screens and the notice say. Verified by `BusIntegrationTest` and `App.test.tsx`.

## 2026-10-16 (later) — reproducibility, completion confirmation, rating reminders

- **`scripts/reproduce.sh`** rebuilds the tests, the model, the ladder and the current
  sweeps, and fails unless every output matches the committed file. Run in full: every
  committed number reproduced exactly (EXPERIMENT_PROTOCOL.md section 4). The script was
  committed with the boarding-code change by mistake rather than on its own.
- **Two-sided completion (feature 69).** A passenger can confirm a completed trip or say
  it did not happen; a denial is listed for administrators and nothing is reversed
  automatically. API only so far.
- **Rating reminders (feature 70).** One reminder, a day after the trip, to each side that
  has not rated it.

## 2026-10-16 (later) — boarding codes

Each booking now has a reference (`JX-000090`) and a 4-digit boarding code. The passenger
can show theirs; the driver can check a code against a booking but is never sent it.
Checking changes nothing: a wrong code does not stop anyone travelling, and boarding is
still the driver's word. Verified by `BoardingIntegrationTest` and `App.test.tsx`.

## 2026-10-16 — the oracle ceiling

Committed on `stage-2-3-booking-core-and-simulator`.

An `ORACLE` variant asks exactly the bookings the simulator knows will be cancelled late:
an upper bound for any reconfirmation policy, labelled as not a method. Against B3 it gains
+0.10 completed rides per 100 searches (+0.07 to +0.13, 30 seeds), against B4's −0.01.
Section 12 of EXPERIMENT_PROTOCOL.md states the research conclusion so far: the premise
holds, the lever is weak even when aimed perfectly, and the model cannot aim it.

## 2026-10-15 (late night) — why early release adds so little

Committed on `stage-2-3-booking-core-and-simulator`.

A new metric, `refill_by_release_timing`, applied to the existing ladder run: seats
released early are refilled about 94% of the time, seats released late about 68%. So the
project's premise holds in this simulator. The intervention fails for a plainer reason:
B4 moves only about 10 of 67 late releases per seed earlier, worth at most about 0.07
completed rides per 100 searches, and adds about 7 cancellations of its own. The
measured effect (zero within ±0.04) is close to what that arithmetic allows. Section 11
of EXPERIMENT_PROTOCOL.md has the numbers and the proposed next test, an oracle variant.

## 2026-10-15 (night) — publishing lead, and driver response rate

Committed on `stage-2-3-booking-core-and-simulator`.

**Research, synthetic data.** A publishing-lead sweep (rides published at least 1, 4 or 7
days ahead) tested the other explanation left by section 9. Publishing everything a week
ahead lowers empty searches only from 54.5% to 50%, so most are full rides, which the
configuration's own numbers predict (about 31 seats a day offered, 84 wanted). Early
release still adds nothing, which in a seat-scarce world is the real puzzle. Section 10
lists three candidate reasons; the first can be measured from the existing log.

**Driver response rate (feature 53).** A driver's profile shows the share of requests
they answered themselves and their median time to answer. A new column records whether a
request was declined by the driver or closed by the platform, so lapsed requests and those
closed when the ride started count against the driver rather than as answers. Nothing is
shown below three settled requests.

## 2026-10-15 (late) — a wider departure window, and explained scores

Committed on `stage-2-3-booking-core-and-simulator`.

**Research, synthetic data.** A departure-tolerance sweep (1, 2, 4 and 8 hours either side,
each with its own B3 baseline, 30 seeds) tested the guess in section 8 that early release
fails because freed seats are on the wrong departure. It does not hold: a wider window
helps every variant equally, early release still adds nothing (and at 8 hours costs
0.05), and 52% of searches find no ride even at 8 hours. Section 8 is marked as
corrected; section 9 has the result and the two explanations still standing.

**Explanations.** Every durability score now carries each feature's exact share of the
log relative risk, from intel through the event log to the administrators' page, which
names the two features that moved each estimate most. For Cox these shares are the whole
explanation, so no SHAP library was added. Verified by intel, core-api and web tests.

Sweep reports now include refills and the share of searches offered no ride.

## 2026-10-15 (night) — the last three documents

DECISIONS, IMPLEMENTATION_ROADMAP and DATASET_DOCUMENTATION are written, so every
document the specification asked for now exists. DECISIONS gathers what PROGRESS
recorded, by subject. The roadmap says plainly that the team's stage definitions and
feature tiers were never given and that its order is a proposal. DATASET_DOCUMENTATION
was checked against the training code, which corrected three statements in the draft.

## 2026-10-15 (evening) — PDF receipts

Committed on `stage-2-3-booking-core-and-simulator`.

A passenger can download a PDF receipt for each booking payment and each pass, from the
payments and passes pages. Verified by `ReceiptIntegrationTest`, which reads each PDF
back as text, `App.test.tsx`, and a receipt downloaded from the running API and opened.

- Apache PDFBox is the one new dependency: Apache-2.0, pure Java, and able to read PDFs
  back, which is how the tests check what a receipt says.
- Every receipt states the provider and, while it is the mock, that no money moved. None
  is a tax invoice.
- The download goes through the API client with the session token; a plain link would go
  without it and be refused.

## 2026-10-15 (later) — travel passes

Committed on `stage-2-3-booking-core-and-simulator`.

Passengers can buy a weekly (₹99), monthly (₹299) or annual (₹2,499) pass through the
mock provider. While it runs, search prices and bookings carry no service fee. Verified by
`PassIntegrationTest`, `App.test.tsx` and a live run.

- **A pass waives only the service fee.** Drivers set their fares, so a platform discount
  can only come out of what the platform charges. The driver is paid the same either way.
- Whether a pass applies is decided when the booking is requested, and is not revisited.
- A pass bought while another runs starts when that one ends, so buying early wastes no
  days.
- Prices are in `application.yml` and are the authors' assumptions.

## 2026-10-15 — women-only rides

Committed on `stage-2-3-booking-core-and-simulator`.

A driver whose profile says she is a woman can offer a ride to women passengers only.
It is shown to, and can be booked or held by, passengers whose profile says the same,
and nobody else; a search filter lets a woman see only such rides. Verified by
`WomenOnlyRideIntegrationTest`, `App.test.tsx` and a live run.

- **The rule rests on a self-declaration.** Gender is what members choose on their
  profile, and nothing checks it. The account page now says so where the choice is made.
  A stronger rule needs identity checks the project does not have.
- The rule is enforced on the server three times: in search, booking and holds. The
  screens only decide what to offer.
- Gender is still never shown to anyone.

## 2026-10-14 (late night) — the driver's pages tested, and a payments page

Committed on `stage-2-3-booking-core-and-simulator`.

- **Page-level tests for publishing and running a ride.** The publish form is now tested
  through the page, from typing to the request sent and the list shown after, and the
  my-rides page through accepting, declining, starting, marking a no-show and completing.
  Seven features held at "partial" only for want of these tests are now verified. All
  four tests passed on their first run.
- **A payments page for passengers**: what was paid, by which method, what came back
  and why, under the notice that payments are simulated.

## 2026-10-14 (night) — a time limit on unanswered requests

Committed on `stage-2-3-booking-core-and-simulator`.

A request a driver does not answer is closed after 12 hours, or once boarding is 2 hours
away, whichever comes first. Its seats go back and the passenger gets everything back,
fee included. Both sides are told. A request for an approval ride that could not be
answered in time is refused when it is made. The passenger's bookings page says when a
pending request will close. Verified by `BookingExpiryIntegrationTest`, `App.test.tsx`
and a live run in which the scheduled job closed a request by itself.

- The closing is logged as `booking_rejected` with the platform as actor and
  `reason: not_answered_in_time`, so a driver's refusal and a lapse can be told apart.
  The vocabulary is unchanged; the payload gains a key.
- Each request is closed in its own transaction and re-checked under the ride lock, so a
  driver accepting at the same moment wins.

## 2026-10-14 (evening) — reference documents, and a bug found writing them

Committed on `stage-2-3-booking-core-and-simulator`.

Five documents were written from the code, not from memory: ARCHITECTURE,
DATABASE_DESIGN, API_DOCUMENTATION, SECURITY and DEPLOYMENT. The README now indexes
every document.

Writing SECURITY.md turned up a real fault: browsers were allowed only GET and POST, so
the profile, emergency-contact and seat-hold screens would have failed for every user
while all tests passed. Fixed, with a test that fails without the fix. See TESTING.md.

Still not written: DECISIONS, IMPLEMENTATION_ROADMAP and DATASET_DOCUMENTATION. The
roadmap needs the team's stage definitions and feature tiers, which have not been given.

## 2026-10-14 (later) — seat holds

Committed on `stage-2-3-booking-core-and-simulator`.

A passenger can hold the seats of a search result for five minutes while deciding. While
the hold lasts, other passengers cannot book or hold those seats on those legs, and their
searches show the ride with fewer seats. Verified by `SeatHoldIntegrationTest`,
`App.test.tsx` and a live run.

- **Holds live in Redis and only there.** PostgreSQL's seat counts never change for a
  hold, so no entity is in two stores and there is nothing to keep in step.
- **Redis is never in the way of a booking.** If it cannot be reached, holds are simply
  not honoured.
- Placing a hold is one Lua script, so two passengers asking for the last seat at the
  same moment cannot both get it.
- A passenger's own hold never blocks their own booking, and booking the ride releases it.
- No event is logged for a hold: the vocabulary is frozen, and a hold is not a booking.

## 2026-10-14 — vehicle details

Committed on `stage-2-3-booking-core-and-simulator`.

A driver can say a vehicle's comfort class, the luggage each passenger may bring, and,
for an electric vehicle, its battery and consumption. Search results name the car and
show what was said. Verified by `VehicleIntegrationTest`, `App.test.tsx` and
`schemas.test.ts`; the vehicles page now has a page-level test.

- All of it is self-described and labelled so on the form.
- The range is battery divided by consumption, rounded down, and is shown to the driver
  only, with the words "not a measured range". Nothing acts on it.
- Battery figures are refused on a vehicle not marked electric, by the form, the service
  and a database constraint.

## 2026-10-13 (after midnight) — notes, the back-seat promise, return and weekly rides

Committed on `stage-2-3-booking-core-and-simulator`.

| Slice | What | Verified by |
|---|---|---|
| Notes | Up to 500 characters from the driver, shown with the route | `RoutingIntegrationTest`, `App.test.tsx` |
| Back-seat promise | "At most two in the back" on a ride, on results, and as a search filter | same |
| Return ride | The same stops reversed, published with the ride out | same, `schemas.test.ts`, live run |
| Weekly repeats | Up to 8 further weeks, each a ride of its own | same |

- Everything a publish request asks for is written in one transaction. A return that
  cannot be driven publishes nothing.
- The return keeps each stretch's price and each interval between stops.
- Rides published together share a `series_id`, used so far only to say how many there
  were. Nothing acts on a series as a whole.
- A weekly repeat keeps the time of day on the corridor's clock.

## 2026-10-13 (late night) — search filters

Committed on `stage-2-3-booking-core-and-simulator`.

A passenger can narrow a search by time of day, maximum price per seat, instant booking,
a driver with a confirmed email or phone, and a driver who said no smoking or pets
welcome. Verified by `RoutingIntegrationTest`, `App.test.tsx` and a live call.

- A filter can only narrow. A driver who has not said is left out by the smoking and
  pets filters: silence is not a promise.
- Filters apply when Search is pressed, not as each box is ticked.
- The `search_issued` event is unchanged. Filters are a product convenience, and adding
  them to the research payload was not asked for.

## 2026-10-13 (night) — the contact scheduler, variant B5, and why refills add nothing

Committed on `stage-2-3-booking-core-and-simulator`.

| Slice | What | Verified by |
|---|---|---|
| Scheduler | `intel/app/scheduler`: whom to ask under limits per round, per ride and per departure day; CP-SAT; `POST /v1/scheduler/plan` | `intel/tests/test_scheduler.py`, live call |
| B5 | B4 under a contact budget, in the simulator | `sim/tests`, 30-seed ladder |
| Sweeps over a variant | A sweep can vary a variant's parameters, not only the world's | `experiments/tests/test_sweep.py`, 30-seed budget sweep |
| Refill metric | `refill_additionality` in `metrics.sql` | `experiments/tests/test_metrics.py` |

**Results** (EXPERIMENT_PROTOCOL.md section 8). The budget cuts the late-share effect
about in proportion to the requests withheld; completed rides do not move. The extra
seats B4 frees all go to passengers who had another ride on offer, which is the first
explanation the project has for why early release adds no completed rides.

**Decisions made here**

- OR-Tools is the one new dependency: the seat limit per departure day makes the choice
  an integer programme, which sorting cannot solve.
- B5 keeps B4's threshold, so the two differ only in the budget.
- The platform does not call the scheduler. It sends no interventions, and wiring one
  in would be a product decision, not a research one.
- The first version of the refill query joined on keys inside the JSON payload and did
  not finish in ten minutes on the full log. It now groups instead and takes seconds.

**For the team to decide**

- Whether the simulator may say why a search was offered nothing (no ride at that time,
  or no seats). It needs a new payload key on `candidates_returned`.
- Whether every number under `budget` in `B5.yaml` is acceptable as an assumption.

## 2026-10-13 (evening) — profiles, confirmation codes, emergency contacts and SOS

Committed on `stage-2-3-booking-core-and-simulator`.

| Slice | What | Verified by |
|---|---|---|
| Profile | Phone, bio, year of birth, gender, smoking, pets, music, conversation; an account page | `AccountIntegrationTest`, `App.test.tsx` |
| Confirmation | A 6-digit code proves an email address or a phone number | same, live run |
| Emergency contacts | Up to three per member | same |
| SOS | A button on every member's screen; an administrator queue with acknowledgement | same, live run |

**Nothing in this slice leaves the platform.** The only message sender is a mock. It
writes each message to the server log and keeps the newest 50 in memory, where an
administrator can read them. That outbox is how a confirmation code is obtained in a
demonstration. An SOS therefore tells an administrator queue and nobody else, and the
answer, the screen and the queue all say that the contacts were not messaged.

**Decisions made here**

- Codes are stored only as BCrypt hashes, last ten minutes, work once, and are spent
  after five wrong guesses. A new one can be asked for after a minute.
- A code proves the address it was sent to. Changing the phone number undoes the proof.
- "Confirmed" is the word used, never "verified": it says a code was received, not who
  someone is. The profile states that no identity document has been checked.
- The public profile shows an approximate age, never the birth year, and never the
  phone number or gender.
- The emergency panel puts calling 112 first, before the button that alerts VAYORA.
- Pressing SOS twice within a minute repeats nothing.
- SOS writes no event-log row: the 22-event vocabulary is frozen and this is not a
  research measurement.

## 2026-10-13 (later) — Hindi and Marathi, chat and live position

Committed on `stage-2-3-booking-core-and-simulator`.

| Slice | What | Verified by |
|---|---|---|
| Languages | Every screen in English, Hindi and Marathi; dates and money localised; a switcher in the header | `lib/i18n.test.tsx` |
| Chat | One room per ride through the gateway, stored in MongoDB; core-api decides membership | `gateway/test/realtime.test.js`, `RideChat.test.tsx`, live run |
| Live position | The driver shares a position while the ride is under way; passengers see the latest point | same |

**Decisions made here**

- English text is the translation key. A missing entry shows English; tests fail the
  build's test run if any marked string lacks an entry, so that should not happen.
- Money and times use the same digits in every language, so a passenger and a driver
  who chose different languages read the same fare.
- The gateway writes chat and GPS points to MongoDB itself, and asks core-api, with the
  user's own token, whether they are on a ride. It never reads PostgreSQL.
- A message appears on screen when the gateway relays it, not when it is typed: what a
  sender sees is what everyone received.
- Position sharing is off until the driver turns it on, and only possible while the ride
  is under way.
- GPS points expire after 7 days.

## 2026-10-13 — repeat search, density sweep, moderation, routing and maps

Committed on `stage-2-3-booking-core-and-simulator`.

| Slice | What | Verified by |
|---|---|---|
| Repeat search | Unserved passengers may search again, logged as `recovery_search`; model retrained as `h2` | `sim/tests`, `experiments/reports/hazard-h2.json` |
| Ladder and density sweep | B0, B3, B4 in the new world; B4 against B3 at 6, 12 and 20 rides a day | `experiments/reports/ladder-7a1c0de0-*-000000000002.md`, `sweep-supply-density-*.md` |
| Moderation | Reports, dismiss / warn / suspend, reinstatement, admin overview, members, audit log | `ModerationIntegrationTest`, web tests |
| Routing | OSRM road routes cached in Redis, stored in PostGIS; search by location with a hard access limit; four sort orders; price suggestion | `RouteServiceTest`, `RoutingIntegrationTest`, live run against OSRM |
| Maps | Route and stops, exact search points, meeting points, a route planner for drivers | web tests with a stand-in map |

**Research, synthetic data:** the result did not change. With repeat search, ranking gains
+0.34 completed rides per 100 searches and the intervention adds nothing; across supply
densities the intervention's effect is 0.00, -0.01 and -0.04. Late cancellations fall by
about 0.055 everywhere. EXPERIMENT_PROTOCOL.md section 7.

**Decisions made here**

- Search is by location, not by stop name. Town names in the UI are presets for
  coordinates. This replaced the name search outright.
- The access distance is a hard limit: a ride outside it is not returned at all.
- Search positions are rounded to about 100 m before they go in the event log.
- A report needs a shared booking. Strangers cannot file against each other.
- Suspension is checked on every request, because a token cannot be recalled.
- An invalid query parameter is now a 400. It was a 500.

## 2026-10-10 (later) — sweep, payments, ratings, notifications

Committed on `stage-2-3-booking-core-and-simulator`.

| Slice | What | Verified by |
|---|---|---|
| Parameter sweeps | Any world parameter can be swept against a baseline, paired by seed | `experiments/tests/test_sweep.py` |
| Intervention-response sweep | 9 cells x 30 seeds | `experiments/reports/sweep-intervention-response-5eeb0000-*.md` |
| Payments | Mock provider; fare plus 10% fee held at request; settled once; append-only ledger; tiered refunds; payouts; idempotency key | `PaymentFlowIntegrationTest`, `RefundPolicyTest`, live run |
| Ratings | Two-way, once per side per completed trip; reviews; profiles | `RatingFlowIntegrationTest`, live run |
| Notifications | In-app, in MongoDB, written after commit | `NotificationIntegrationTest`, live run with MongoDB stopped |

**Sweep result, synthetic data:** across the whole grid of assumed passenger responses the
intervention is worth at most +0.06 completed rides per 100 searches (0.2%), and is
harmful when 5% of contacted travellers are put off. It makes cancellations earlier in
every cell. The null result on the primary metric is therefore not an artefact of the
response assumptions. EXPERIMENT_PROTOCOL.md section 6.

**Decisions made here**

- Payment is taken in the same transaction as the booking. A declined payment leaves no
  booking, which avoids unpaid bookings and the hold-expiry machinery they would need.
- The service fee is not refunded once a driver has accepted; it is refunded in full if
  the driver declines, never answers or cancels.
- The part of the fare a late-cancelling passenger forfeits goes to the driver.
- Notifications use MongoDB, as CLAUDE.md places them, which gives core-api a second
  database client. core-api's health does not depend on it.
- The refund terms shown in the UI are fetched from the server, not written twice.

## 2026-10-10 — model, variants, first experiment, web app, model in the platform

Committed on branch `stage-2-3-booking-core-and-simulator`. On the user's instruction
this work ran through several stages without stopping for approval after each.

| Slice | What | Verified by |
|---|---|---|
| Simulator population | People search repeatedly and lead time depends on latent type, so type leaves a trace the platform can observe | `sim/tests` |
| Durability model | Features, Kaplan-Meier / Cox / gradient-boosted survival, evaluation on disjoint seeds, Cox served by intel as `POST /v1/hazard/score` | `experiments/reports/hazard-h1.json`, `intel/tests`, `experiments/tests` |
| Variants B3, B4 | Survival-aware ranking; threshold reconfirmation request | `sim/tests` |
| First experiment | B0, B3, B4 on seeds 1-30, paired comparison | `experiments/reports/ladder-7a1c0de0-*.md` |
| Web app | Sign-in, search and booking, vehicles, publishing and running rides, administrator's durability screen | 34 component tests, production build |
| Model in the platform | Feature snapshot at request, daily and on-demand scoring through intel, scores appended to the event log, administrators only | `HazardScoringIntegrationTest`, live run |

**Headline result, synthetic data:** survival-aware ranking raises completed rides per
100 searches from 29.59 to 29.89 (+0.30, 95% CI +0.24 to +0.36). The intervention moves
cancellations earlier and refills more seats but adds nothing further on that metric.
The hypothesis is not supported at the assumed parameter values; the assumptions that
decide it have not been swept. Details in EXPERIMENT_PROTOCOL.md.

**Decisions made here**

- Cox PH is served: best departure Brier score and concordance of the three models.
- Durability scores are shown to administrators only, not to drivers or passengers.
- B1 and B2 were skipped: the simulated corridor has no geography to filter on.
- The gradient-boosted model is trained on a 5,000-row sample because its loss is
  quadratic in rows.

Current limitations are in KNOWN_LIMITATIONS.md; test counts and commands in TESTING.md.
The sections below are the earlier entries, kept as written.

## 2026-10-10 — Stage 3, first slice: the B0 simulator

Uncommitted. Details and simplifications are in [sim/README.md](../sim/README.md).

### What was built

- `sim/`: SimPy simulator (`simulator.py`), ground-truth cancellation process
  (`hazard.py`), strict config loader (`config.py`), frozen parameters (`frozen.py`), CLI
  runner (`run.py`).
- `experiments/configs/world.yaml`: the synthetic world. `variants/B0.yaml`: the baseline.
- New pinned dependencies in `requirements-research.txt`: `simpy`, `PyYAML`.

### Verified

Python 3.11 research container: 56 tests, 0 failures (39 new in `sim/tests`, 17 existing).
The new tests cover reproducibility by seed, the frozen vocabulary, no latent type in any
payload, legal booking paths, started = completed + failed, no overselling, the booking
horizon, paired environments, each latent type behaving as configured, strict config
loading, the hazard sampler, and a run written to PostgreSQL and read back by the metric
queries.

### A smoke run, not a result

`python -m sim.run --variant .../B0.yaml --seeds 1-3`, read through `metrics.sql`, then
deleted from the database:

| Seed | Searches | Completed trips | Per 100 searches | Late share of cancellations |
|---|---|---|---|---|
| 1 | 3640 | 1089 | 29.9 | 0.42 |
| 2 | 3569 | 1097 | 30.7 | 0.43 |
| 3 | 3749 | 1041 | 27.8 | 0.41 |

About 42% of searches returned no candidate. These figures show the pipeline works and
the corridor is neither empty nor full. They are **not findings**: three seeds, one
variant, and every parameter in `world.yaml` is an assumption.

### Open questions for the team

- The values in `world.yaml`. Each is a guess at a plausible magnitude and needs a
  source or a deliberate choice before any number is reported.
- Whether a passenger who is rejected, cancelled on or finds nothing should search again.
  Recovery variants need this; B0 does not have it.

## 2026-10-10 — Stage 2, second slice: trips

Uncommitted, like the first slice.

### What was built

| Endpoint (driver only) | Effect |
|---|---|
| `POST /rides/{id}/start` | Ride `SCHEDULED` to `IN_PROGRESS`. Unanswered requests are rejected and their seats returned. One `trip_started` per confirmed booking. |
| `POST /bookings/{id}/no-show` | Booking `CONFIRMED` to `NO_SHOW` while the ride is in progress. `trip_failed` with `reason: passenger_no_show`. |
| `POST /rides/{id}/complete` | Ride to `COMPLETED`. Each booking still confirmed becomes `COMPLETED` with a `trip_completed`. |
| `POST /rides/{id}/cancel` | Withdraws a ride that has not started. Each live booking is cancelled with a `booking_cancelled` carrying `departure_time` and `cancelled_by: driver`. |

Schema: `V4__add_trip_states.sql` widens the ride and booking status checks.

### The decision that matters for the research

**Trip events are per passenger booking, not per vehicle.** The primary metric divides
`trip_completed` by `search_issued`, and a search belongs to one passenger; the existing
metric fixtures also put trip counts on the scale of accepted bookings. So every booking
that gets a `trip_started` gets exactly one `trip_completed` or `trip_failed`. The
simulator must follow the same rule or live and simulated numbers will not be comparable.

Other choices: a ride may be started up to one hour before departure
(`journex.trip.early-start`); once started it takes no new bookings and passengers cannot
cancel; a no-show keeps its seat, since mid-route refill is a separate feature.

### Verified

`docker compose --profile test run --rm core-api-tests`: 39 tests, 0 failures. New:
`TripFlowIntegrationTest` (6) covers the started = completed + failed accounting,
rejection of unanswered requests on start, a started ride refusing bookings and
cancellations, forward-only ride states, driver ownership, and driver withdrawal.
`BookingStatusTest` grew to 6. Live stack: V4 applied to the existing database.

With this slice the primary metric is computable from platform events for the first time.

### Still not done

- Completion is the driver's word alone: no boarding code, no passenger confirmation.
- `trip_failed` has one cause, a no-show. A ride abandoned mid-route has no endpoint.
- A driver withdrawing a ride triggers no recovery search and no refund.
- Everything in the first slice's list below, except trips and driver cancellation.

## 2026-10-10 — Stage 2, first slice: booking core in core-api

**Assumption to confirm.** The repository does not define Stage 2. This slice assumes it
is the transactional booking core, because the simulator (Stage 3) and every later stage
need bookings and their events to exist. Uncommitted until the team confirms.

### What was built

| Area | What |
|---|---|
| Schema | `V3__create_booking_core.sql`: `users`, `vehicles`, `rides`, `ride_stops` (PostGIS points), `ride_segments`, `bookings` |
| Identity | Register, login, `GET /me`; BCrypt hashes; HS256 access token with `sub` and `role`, verified by the gateway with the shared `JWT_SECRET` |
| Vehicles | Create and list own vehicles (drivers) |
| Rides | Publish with 2-10 ordered stops and a price per leg; get; search by origin stop, destination stop, date and seats |
| Bookings | Request, driver accept or reject, passenger cancel; list own; list per ride for its driver |
| Events | `search_issued`, `candidates_returned`, `booking_requested`, `booking_accepted`, `booking_rejected`, `booking_cancelled` (with `departure_time`); no new event types |

All endpoints are under `/api/v1`. Errors are RFC 7807 problem documents.

### How seats stay correct

- Inventory is per leg. Booking stop `a` to stop `b` decrements legs `a..b-1` only.
- A request locks the ride row, then runs one conditional `UPDATE` that only touches legs
  with enough seats. If it touched fewer legs than requested, the transaction rolls back.
- Accept, reject and cancel take the same locks in the same order (ride, booking, legs).
- `CHECK (seats_available BETWEEN 0 AND seats_total)` backs this up in the database.

### Verified

`docker compose --profile test run --rm core-api-tests`: 32 tests, 0 failures.

| Test class | Tests | Covers |
|---|---|---|
| `BookingStatusTest` | 5 | Allowed and forbidden state transitions |
| `BookingFlowIntegrationTest` | 11 | Overlapping stretches, full middle leg, 8 concurrent requests for the last seat (exactly one wins), approval hold, reject and cancel release seats once, ownership checks, search, event rows |
| `ApiIntegrationTest` | 5 | 401 without a token, password stored hashed, bad credentials, duplicate email, role checks (403), another passenger cannot see or cancel a booking, full publish-search-book-accept-cancel journey over HTTP |
| `EventLogService*` (existing) | 11 | Unchanged, still passing |

Live stack: Flyway applied V3 to the existing database; a token issued by core-api was
accepted by the gateway's `verifyToken`; `GET /api/v1/me` without a token returned 401.

### Decisions made in this slice

- **JdbcTemplate, not JPA.** The existing code uses it, and the seat update is a single
  conditional SQL statement that reads more plainly without an ORM.
- **`JWT_SECRET` must be at least 32 bytes.** HS256 requires it. The dev default grew from
  18 to 37 characters and core-api refuses to start on a shorter one.
- **One role per account** (`PASSENGER`, `DRIVER`, `ADMIN`); admins cannot self-register.
- **A stranger's booking returns 404, not 403**, so booking ids cannot be probed.

### Not done, by design of this slice

- No user interface. `web/` is still the empty shell.
- No payments, refunds, seat holds with expiry, or Redis use.
- Search matches stop names exactly (case-insensitive). No distance or detour check, and
  OSRM is not called.
- No refresh tokens, email verification or rate limiting.
- The 7-day booking horizon is not enforced on publishing or booking.
- Registration reveals whether an email is already registered (409).
