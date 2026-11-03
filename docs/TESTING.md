# Testing

Counts are from the latest run of each suite, on 2026-11-01. Every suite passed with no failures,
and `ruff check`, ESLint, the TypeScript check and the production web build were clean.

Every push and pull request runs all of them on GitHub Actions (`.github/workflows/ci.yml`),
with the lint checks below: `npm run lint` in `web/` and `gateway/` (ESLint), and
`ruff check` for the Python code (rules in `pyproject.toml`).

| Suite | Command, from the repository root | Tests |
|---|---|---|
| core-api | `docker compose --profile test run --rm core-api-tests` | 349 |
| Python (events, simulator, model, scheduler, experiments, intel API) | `docker compose --profile research run --rm research` | 224 |
| web | `cd web && npm ci && npm test` | 296 |
| gateway | `cd gateway && npm ci && npm test` | 28 |

The first two need only Docker. The Python suite also needs PostgreSQL running:
`docker compose up -d --wait postgres core-api` (core-api's Flyway creates the tables).

The core-api suite compiles into `core-api/target`, which an editor's Java extension (VS
Code's, IntelliJ's) also builds into. If the editor rebuilds while the tests run, as it does
after many files change, classes vanish under the running tests and about a third of them
fail with `NoClassDefFoundError`. Let the editor finish, then run the suite again without
`clean`.

## What each suite covers

### core-api (JUnit 5; Testcontainers with real PostGIS, MongoDB and Redis)

| Class | Tests | Covers |
|---|---|---|
| `BookingStatusTest` | 6 | Allowed and forbidden status transitions |
| `BookingFlowIntegrationTest` | 11 | Per-leg inventory, a full middle leg, **8 concurrent requests for the last seat**, approval hold, release on reject and cancel exactly once, ownership, search, events |
| `TripFlowIntegrationTest` | 6 | Start, no-show, complete, driver withdrawal; started = completed + failed |
| `ReleaseReminderIntegrationTest` | 4 | **One reminder per seat inside the window, with what cancelling would owe then**, logged as an intervention with no survival probability, nothing done to the booking, not before the window nor for a booking made inside it, only confirmed seats, **with targeting off, everyone asked alike whatever the model says** |
| `TargetedReminderIntegrationTest` | 2 | **Only bookings the model rates below 0.8 are offered to the contact scheduler, and only those it chooses are asked**, with the limits from configuration; the safe and the unscored never; logged with the score and who chose; **the message says nothing about a model or a risk**; one not chosen is due again next run; nothing cancelled; **nobody asked while the scheduler cannot be reached**, and they stay due |
| `DetourIntegrationTest` | 8 | **A passenger off the stops is offered a pickup where the road passes, at its cost and time, and books it**, a ride offering no detour neither found nor booked away, a point too far from the road never offered, **the allowance shared across bookings and never overspent**, a cancellation gives its minutes back, more than the most refused, a passenger near a stop still boards there, **when the driver withdraws, a flexible passenger rebooked and every passenger told of other rides from their own point, not the stop before it** |
| `ElectricRangeIntegrationTest` | 3 | **An electric car with a stretch between stops longer than its range is refused and nothing is published**, the same road with a stop to charge at is published with its return, a car with no stated range never refused |
| `IdDeclarationIntegrationTest` | 3 | A driver declares which identity document they hold and **it verifies nothing**: same level, nothing confirmed; only a driver may; **over HTTP only the kind is taken, and a number sent along is kept nowhere** |
| `WalkingSearchIntegrationTest` | 2 | Footpath times replace the straight-line estimate and say so; without an answer the straight line stays and says so |
| `MatchScoreTest` | 6 | **Agreeing on everything near and at the best price is 100**, each disagreement costs its whole weight and is named, what either left unsaid counts half, conversation one step apart, distance, price and record each scale their own part, **weights that do not add up to 100 are refused** |
| `MatchScoringIntegrationTest` | 3 | **Best match puts the driver the passenger agrees with first, and says why**, every other order untouched but scored, a passenger who said nothing matched on distance, price and record alone |
| `MidRouteIntegrationTest` | 6 | **A ride under way sold from a stop it is not yet near and from no other**, **a ride started early judged from its start**, only if it confirms instantly, **a no-show's seat sold again from a later stop**, the late booking's trip counted from start to finish, holds by the same rule |
| `CallIntegrationTest` | 5 | Either side may call the other and the other is told, **the answer over HTTP carries no phone number**, nobody else may call, only while confirmed and shortly before the trip, only between confirmed numbers |
| `CallBridgeIntegrationTest` | 2 | With a Twilio account, Twilio replaced: **a call bridged between the two confirmed numbers, which go to Twilio and appear in no answer**, the other side told who is calling; a call Twilio refuses is a 503 that says so, and nobody is told |
| `DocumentCheckIntegrationTest` | 7 | **Staff see what a driver declared and the profile then says a person saw it**, audited and the driver told, no level earned; a refusal needs a reason and may be asked again; **changing or removing the declaration withdraws the check**; something must be declared, one live check of it; insurance for the driver's own car only, shown on results; **the filter finds only drivers staff have checked**; over HTTP, drivers ask and administrators decide, and **a number sent along is kept nowhere** |
| `InsuranceIntegrationTest` | 3 | Declared and removed by the owner only, an ended insurance refused, **shown to passengers only while it covers the trip's date** |
| `RefundPolicyTest` | 5 | What cancelling owes at tier boundaries, rounding, invalid tier configurations |
| `RatingFlowIntegrationTest` | 8 | One rating per side per completed trip, who may rate, averages, profiles expose no contact details |
| `NotificationIntegrationTest` | 6 | Who is told what, **nothing is sent for a rolled-back booking**, per-member access, **a MongoDB outage does not fail the caller** |
| `ModerationIntegrationTest` | 8 | Who may report whom, dismiss / warn / suspend, **a suspended member's existing token is refused**, reinstatement, **the audit log cannot be rewritten**, back office is administrators only |
| `AccountIntegrationTest` | 12 | Profile replace and clear, **the public profile never shows phone, birth year or gender**, **a code is stored only as a hash, works once, expires, and is spent by wrong guesses**, **ten codes a day per channel however long the wait between them**, a changed number undoes its proof, three contacts at most, **an SOS answer says nobody was really messaged**, repeat presses, acknowledgement audited, administrators only |
| `VehicleIntegrationTest` | 6 | Comfort, luggage and EV figures kept, **the range is the driver's two figures divided and rounded down**, battery figures refused on a non-electric vehicle, a search result names its car, validation, a driver sees only their own |
| `SeatHoldIntegrationTest` | 8 | Held seats are left alone on the legs held and nowhere else, a hold takes nothing from PostgreSQL, **8 simultaneous holds on the last seat: exactly one is placed**, replacing and releasing, one ride at a time, **a hold lapses on its own**, search shows others only what is not held, **with Redis unreachable nothing is held and nothing is blocked** |
| `BookingExpiryIntegrationTest` | 5 | An unanswered request closes after 12 hours or 2 hours before boarding, **owing nothing, logged as the platform's action**, closed once, an answered or instant booking is never closed, a request too late to be answered is refused, the terms endpoint |
| `WomenOnlyRideIntegrationTest` | 5 | Only a driver who says she is a woman can offer one; **shown to, bookable and holdable by women only**, a filter cannot get round it, the rule follows the profile as it is now |
| `ReceiptIntegrationTest` | 7 | **Each receipt read back as text**: what was paid to the driver and on whose word, not a tax invoice; part of the fare after a late cancellation; no receipt until the driver says they were paid; nobody gets another's; characters the fonts cannot draw become "?"; the endpoint serves a PDF; **the same receipt as JSON, in the passenger's own script** |
| `ResponseRateIntegrationTest` | 3 | **Only the driver's own answers count**: lapsed requests and those closed when the ride starts are unanswered, withdrawn ones do not count; the median time; nothing for passengers or instant rides |
| `BoardingIntegrationTest` | 4 | **The driver can check a code but is never sent it**, nobody else gets the pass, none for a cancelled booking, codes vary |
| `AfterTripIntegrationTest` | 3 | A passenger confirms once and a denial reaches the administrators; only the trip's own passenger, only once completed; **one rating reminder per side, however often the job runs** |
| `LevelIntegrationTest` | 3 | The highest level whose every condition is met; a profile carries it; **a driver's own record counts each kind of event correctly** |
| `NotificationPreferenceIntegrationTest` | 3 | **Nothing leaves the app until asked for, and only to confirmed addresses**; no copy for a rolled-back change; the endpoints |
| `CascadeRecoveryIntegrationTest` | 2 | A withdrawn ride names other rides within 3 hours with seats for the party, not logged as a search; or says there are none |
| `BackOfficeBrowserIntegrationTest` | 3 | A whole series withdrawn and no passenger owing anything; nothing to withdraw twice; rides and bookings by status, administrators only |
| `TransactionBoundaryTest` | 2 | **Every public trip and booking action is transactional**, added after one was found not to be |
| `ReferralIntegrationTest` | 2 | A code made once; a sign-up with it counted, then qualified by a first trip; **a wrong code creates no account** |
| `RickshawsTest` | 6 | **The meter charges the minimum up to its distance, then the rate, to the rupee** (in decimal: a half rupee was lost to doubles), a long walk in a town with a published fare gets the time, the fare and its source, a town without one a time and no fare, **a fare not yet in force is not charged**, a short walk gets no rickshaw, a fare without a source refused |
| `TwilioSmsTest` | 4 | A text posted to the account's Messages API with its credentials, **against a stand-in the tests check is the only thing asked**, a refusal surfaced as a 503 with a message, the account set whole or not at all, texts to the outbox when none is set |
| `TwilioVoiceTest` | 2 | Against a stand-in for Twilio: **the caller rung from the platform's number, then the other side dialled from it**; nothing configured without an account |
| `SosDeliveryIntegrationTest` | 1 | **With a real provider, a text that fails never stops the alert**, and the answer and the queue say how many contacts were missed |
| `WalkingRoutesTest` | 3 | Asks the walking service longitude first and caches apart from driving, **an outage or no route gives nothing rather than a guess**, nothing to ask when none is configured |
| `RouteServiceTest` | 7 | OSRM request and response, caching, **an outage gives straight lines labelled as such**, great-circle distance |
| `RoutingIntegrationTest` | 13 | Price floor, music, quiet ride, comfort and luggage minimums, **A ride, its return and their weekly repeats are published together or not at all**, the return reverses stops, intervals and prices, the back-seat promise and its filter, **Each search filter narrows and none widens; a driver who has not said is not assumed smoke-free**, impossible filters are a 400, route stored on a ride, **the access distance is a hard limit**, direction, the four sort orders, coarse positions in the event log, route preview and price suggestion, the Redis cache |
| `HazardScoringIntegrationTest` | 5 | Feature snapshot and history, one score per booking per day, which bookings are scored, **model outage changes nothing**, administrators only |
| `IntelContactSchedulerTest` | 2 | Request contract with intel's contact scheduler, field by field; a failing scheduler is no answer, not an error |
| `IntelHazardScorerTest` | 4 | Request contract with intel; outage, wrong feature version and invalid probability all yield no score |
| `ApiIntegrationTest` | 7 | 401 without a token, hashed passwords, bad credentials, role checks, another user's booking is invisible, **a bad query is a 400, not a 500**, full journey over HTTP, CORS |
| `SignInThrottleIntegrationTest` | 4 | **Five wrong passwords lock that address's sign-in, the right password included**, with `Retry-After` and the window from the first; however the address is written; Redis keeps a digest, not the address, and forgets; nobody else affected; the right password forgives earlier misses; an address nobody has counted alike |
| `ApiDocsIntegrationTest` | 2 | The OpenAPI description and Swagger UI are public and name real endpoints and the bearer sign-in; the endpoints still demand a token |
| `EventLogService*` | 11 | The event writer never throws into its caller; events commit with the business change |

`DirectPaymentIntegrationTest` (19) covers paying the driver: **a booking takes nothing and owes
nothing yet**; **a completed trip owes the fare and nothing else can be booked until the driver
marks it paid**; only that driver can mark it, and only once; **cancelling owes by the timing
tiers, and early costs nothing** (nothing, half, all, nothing if never accepted); nothing owed when
the driver declines, withdraws or never answers; a no-show owes the fare; a free ride owes nothing;
a flexible booking rebooked and paid after the new ride; **a repeated request with the same key
books once**; **staff can clear what is owed, with the reason in the audit log**; a UPI ID checked
and tidied, an email address refused; **a passenger sees where to pay only for their own confirmed
or owing booking**; **a QR code kept as a fresh PNG, sharp, and served only to those who may see
it**; a big one scaled down; each passenger sees only their own; the HTTP API for each side, and
the terms as the server applies them.

Also in the suite, not described above (39 tests): `PhoneSignUpIntegrationTest` (5),
`EmailDeliveryIntegrationTest` (4), `TextTest` (5), `FlexTierIntegrationTest` (3),
`BusIntegrationTest` (3), `GoogleSignInIntegrationTest` (3), `PhotoIntegrationTest` (3),
`WebPushTest` (3), `StopoverIntegrationTest` (3), `PushIntegrationTest` (2),
`ServerMessagesTest` (2), `NotificationTemplatesTest` (1), `DriverRecordIntegrationTest` (1),
`SupplyGapIntegrationTest` (1).

### Python (pytest, Python 3.11)

| Path | Tests | Covers |
|---|---|---|
| `sim/tests` | 77 | **EARLIEST needs no model, faces the same world as B0 and offers the soonest-leaving ride first**, **A flexible passenger rebooked at once, on a ride within the window, and only the flexible share**, nobody rebooked with no share, trips still all accounted for, the new settings refused out of range, **An empty search says whether no ride ran then or every one was full, and an unpublished ride is not counted**, **The oracle asks exactly the late cancellers and leaks nothing**, **A contact budget is never exceeded and, when too large to bind, reproduces the threshold policy exactly**, **the scheduler is given no ground truth**, reproducibility by seed, frozen vocabulary, **no latent type in any payload**, legal booking paths, no overselling, paired environments, each variant's rules, repeat search, strict config, the hazard sampler |
| `intel/tests` | 76 | **A live what-if run only for an administrator with a token core-api signed** (none, another role, another secret, another issuer, expired, no secret set), the sweeps offered and their bounds, refusals outside them, a small run answering means with no interval, Exact per-feature explanations that reproduce the score, Feature tracker, model maths, **shipped models give valid, decreasing probabilities within the data's support, held flat beyond it**, **the shipped Cox file is the one reported, and both shipped models are calibrated on the held-out seeds (overall within 0.01, every tenth within 0.05)**, scoring API and its validation; the contact scheduler: each limit, **the plan equals the best of every subset on 25 random instances**, ties, order-independence, a 400-booking round, its API |
| `experiments/tests` | 46 | **Hotel bookings as survival data: times, outcomes and only what is known at booking**, years disjoint, **A live run's measures equal the metric queries on the same events**, **a 30-seed live run at a value a sweep covered reproduces that sweep exactly**, **Real hotel bookings read as seat bookings, and the file refused unless its hash matches**, the daily cancellation hazard against hand-computed values, Why searches find nothing against hand-computed values, Refill share by release timing against hand-computed values, The refill-additionality metric against hand-computed values, sweeps over a variant's parameters, metric queries against hand-computed values, the training set, **disjoint seeds**, exported Cox model against lifelines, paired comparison statistics, parameter sweeps |
| `vayora_events/tests` | 11 | Event writer and vocabulary |

### web (Vitest, Testing Library)

| File | Tests | Covers |
|---|---|---|
| `App.test.tsx` | 188 | **a new driver's checklist: what is left, each a link, what is done counted, gone once all is done**, **paying the driver: one way to book with nothing to pay, where to pay shown only once confirmed or owing, copied, opened in a UPI app on a phone, cash when none is given, marked paid by the driver only after confirming, a UPI ID refused with the reason, a QR code sent as the picture itself, cleared by staff only with a reason**, **a driver asks staff to see a document, told no number or copy is kept**, where it stands, why not when refused, the right car's insurance, **a profile and a result saying a person saw it, not its issuer**, the filter, **an administrator's refusal needing a note and a check confirmed first**, **a tax invoice for the service fee only, replacing the line saying there is none**, IGST from another state, **booking to pay after the ride where the driver allows it, with nothing taken and no payment method sent**, none offered elsewhere, **what is due shown and paid by the method chosen**, **cash recorded by the driver only after confirming**, **the front page for a signed-out visitor, its footer saying what is simulated, and sign-up with driver already chosen from it**, a member taken past it to their own page, **the command palette opened with Ctrl+K, narrowed by typing, offering only the member's own pages, and choosing with Enter**, a theme chosen from it, focus returned on Escape, **an irreversible action asked in a dialog titled with what is being done**, **A receipt opened from the payments page, said to be simulated and no tax invoice**, **a receipt in Marathi with a Devanagari name as written, printed from the browser**, a reward pass said not to be paid for and naming no provider, why a receipt cannot be shown, **A call through a real phone service says the phone will ring from the platform's number, and shows no number**, **Paying at Razorpay's checkout before booking and sending its proof**, test mode said, no method or tier offered; **a checkout closed unpaid books nothing**; a pass bought through it; drivers told payouts are recorded, not sent; **An auto-rickshaw offered where the walk is long, with a fare only where one is published, and whose**, none where none was estimated, **the emergency panel tells the member to call any contact a real text missed**, A value no sweep covered simulated live and labelled an exploration, sent to intel, **a refusal from intel shows its reason and signs nobody out**, **An electric car's stretch longer than its range named as unpublishable**, a longer route whose stretches fit only warned, An identity document declared by kind only and taken back, none offered to a passenger, **shown on a profile as not checked, never as confirmed**, A walk said to be on footpaths only when it was, The detour allowance sent, a pickup offered and booked with its point, none sent for a stop, a pickup shown on the booking, **a pickup's own point marked on the map as where the passenger boards**, Best match asked for and its reasons shown only then, What an invitation earns, a reward pass shown as free, Declared insurance sent, shown as not checked and removed, a simulated call that says no call was placed and shows no number, Why a fee is lower, A ride already on the road said so, Invitations, Withdrawing a series, browsing rides and bookings, Notification preferences, Levels on profiles, the driver's record page, more search filters, Confirming or disputing a trip, disputed trips for administrators, Boarding codes for passenger and driver, A driver's response rate on the profile, The two main reasons for a durability estimate, Downloading a receipt with the session token, Buying a pass, running, waiting and ended passes, Women-only rides offered and filtered only where the profile allows, A passenger's payments and refunds, Publishing a ride through the page, a driver accepting and declining requests, starting, marking a no-show and completing, each irreversible step only after confirming, The deadline shown on a pending request, Holding seats and being told it is not a booking, Adding a vehicle through the page, the car named on a search result, How many rides a form will publish, driver notes shown as text, Search filters sent only when set and only on Search, the account page, confirmation by code, emergency contacts, **the emergency panel puts 112 first and says the contacts were not messaged**, the administrator emergency queue and simulated outbox, route protection by role, sign-in, search and booking with fee and payment method, idempotency key reuse, refund terms, earnings, ratings and profiles, notifications, reporting and moderation, the back office, maps and location search, the route planner, failure and retry states |
| `components/ErrorBoundary.test.tsx` | 5 | **A tab left open across a release reloads once to fetch the new one, and not again straight away**, again for a later release, a screen whose code failed to load told from one that failed to render, **a real reload offered for missing code**, try again offered for anything else |
| `lib/schemas.test.ts` | 27 | Vehicle details and their request mapping, A return that leaves before arrival is refused, repeat and notes limits, Form validation and the publish request mapping |
| `components/pageTitle.test.tsx` | 3 | **The large title moves into the bar once scrolled under it**, fades out without blanking, and leaves the bar alone for a title merely below the screen |
| `components/RideChat.test.tsx` | 17 | Joining with the session token, history, sending, **a message shown once and only when relayed**, text rendered as text, refusal and outage states, rejoining after a dropped connection, position shown to passengers, sharing offered to the driver only while under way, including a chat opened before the ride started, **a moment without a fix does not end sharing**, a refused permission does |
| `lib/i18n.test.tsx` | 30 | **a date and a time inside a notification given in the reader's language**, **Every marked string has a Hindi and a Marathi entry with the same placeholders**, **a message the server builds from a number shown translated with the number kept**, a booking status in one named as a word in English too, fixed and unknown messages unchanged, no unused entries, **no screen has text that bypasses translation**, fallback to English, switching and remembering the language, the same digits for money in every language |
| `lib/api.test.ts` | 7 | Token header, problem-document errors, unreachable server, sign-out on a rejected token, **no sign-out on a stale rejection** |

### gateway (node:test, real Socket.IO server and clients)

| File | Tests | Covers |
|---|---|---|
| `test/realtime.test.js` | 19 | Connection refused without a valid token, **a non-member cannot join and a missing ride looks the same**, **a message never reaches another ride**, the sender is named by the server, validation, rate limit, history on join, **someone who cancels stops receiving even if silent**, only the driver may send a position and only under way, rejoin after a dropped connection, a failing store, the membership call to core-api |
| `test/auth.test.js` | 6 | Token verification |
| `test/connect.test.js` | 3 | **Keeps trying to reach MongoDB until it answers**, a capped pause between attempts, index setup tried again if it fails |

No web test can reach a real server: `fetch` is replaced before every test. The map
library is replaced by a stand-in that renders what the map was given as plain elements,
because Leaflet needs a real browser to draw.

## Reproduction

`scripts/reproduce.sh` (EXPERIMENT_PROTOCOL.md section 4) was last run in full on
2026-10-19, after the tools were reinstalled and the flexible-booking sweep was added:
tests, the durability model, both ladders, every sweep, the what-if explorer's data and
the figures were rebuilt and every committed number reproduced exactly. It was run in full
again the same day with the hotel comparison (EXPERIMENT_PROTOCOL.md section 18) added,
and again every number came out exactly as committed.

## Checked by hand against the running stack

- **Sign in with Google, with Google itself** (2026-11-02): with a real client ID, the page loaded Google's real button at http://localhost:5173/login with no origin error, in headless Edge. A team member then signed in with a real Gmail account. The account's `email_verified_at` was set at that moment and `google_sub` is filled, which only the linking step does. That person said only "next", so the screen after signing in was not reported.
- **Names in Devanagari on the PDF receipt** (2026-11-01): drawn to an image and looked at, with conjuncts and vowel signs such as प्रिया, क्षितिज, ज्ञानेश्वर and कार्तिक. That look is what found PDFBox's own shaping printing कार्तिक as कातर्कि, which a test could not have said was wrong. A small program then loaded the font and shaped text in the image that actually runs (`eclipse-temurin:21-jre`, no desktop). A whole receipt through the running app with a Devanagari name was not tried, to keep test accounts out of the real database.
- **The interface staying current** (2026-11-01, several headless Edge browsers against a throwaway stack with real routing, gateway and databases, nothing reloaded): a seat booked by someone else showed on another's results in 19.4 s; left open 45 seconds more, that page searched once, read seats 4 times, and `search_issued` stayed at 1. A request reached the driver's screen in 11.7 s and counted in the tab's title; the answer turned the booking Confirmed in 14.7 s. With a ride under way the driver's position reached the passenger, the marker moved 7.5 s after the driver did and glided, and a chat message arrived at once. Each screen was looked at in light and dark at 1280, 820 and 390 pixels with no sideways scroll. The stack and its volumes were then removed.
- **Any route in India** (2026-11-01, headless Edge against a throwaway stack with its own database, using the real OSRM and model): Chennai to Bengaluru previewed as a 290.2 km straight line, where before the snapping check OSRM's answer gave a false 69.7 km road, having moved the points 705 km and 508 km. Kolhapur to Pune stayed a 230 km road route and Pune to Kolhapur a 233.6 km one. Mumbai to Panaji through Ratnagiri was published through the form, labelled a 412 km straight line; it was found from Mumbai and from Ratnagiri and not in the opposite direction, and a seat was booked and confirmed. Chennai to Bengaluru and Pune to Kolhapur were published and found. The same place twice was refused. The publish form fits a 390-pixel phone; the front page reads in Hindi and Marathi. The stack and its volumes were then removed.
- **The online setup** (2026-11-01, headless Edge, one machine with a local certificate, without the road services): only ports 80 and 443 published; refuses to start without its secrets; HTTPS with HSTS and no server name; each path reaching its owner; core-api's health and intel's model and scheduler not reachable from outside; a WebSocket to the gateway through the edge; signing up and searching with nothing over plain HTTP; `scripts/backup.sh`, then an account deleted and brought back by the documented restore, the app healthy afterwards. Never on a real server.
- **Staff checks** (2026-11-01, headless Edge against a throwaway stack with real PostgreSQL, MongoDB and Redis): a driver declared a licence and insurance and asked; a passenger still saw "not checked"; an administrator refused the insurance with a reason and checked the licence; the driver saw both outcomes and both notifications and asked again; the passenger then saw the badge, the chip and the insurance line on a real search, and the filter kept the driver; changing the document took the badge away; both decisions were in the audit log. No page errors.
- **Demo data, with its past** (2026-11-01): against a throwaway stack with the real model, 4 trips driven and rated, a no-show, two cancellations, a request waiting, documents checked and waiting, and 4 bookings scored; run again it added nothing; 15 screens walked in headless Edge as drivers, a passenger and an administrator, with no page errors and the booking counts adding up.
- **Demo data** (2026-10-24): `scripts/demo-data.mjs` against a throwaway stack made 36
  rides and 4 bookings; run again it added none; a passenger's search for the next day
  found its three Kolhapur to Pune rides. The stack and its volumes were then removed.
- **The installable app** (2026-10-24, Edge against the production build): no
  installability or manifest errors, the service worker active, and with the server
  stopped a page opened as the offline page.
- Flyway migrations V1 to V14 applied to an existing database.
- **A receipt** (before payments changed on 2026-11-02): one downloaded from the running API and
  opened; it read correctly.
- **A women-only ride**: published by a driver who said she is a woman, found by a woman
  passenger and not by a man, booked by her and refused to him.
- **An unanswered request**: aged by 13 hours in the database, it was closed by the
  scheduled job within five minutes, with nothing owed, and logged as the
  platform's action. A request 90 minutes before an approval ride left was refused.
- **A seat hold**: one passenger held both seats of a ride; a second was refused a hold
  and refused a booking, each with a reason; the first then booked and the hold was gone.
- **A vehicle**: an electric vehicle added over HTTP came back with a 270 km range from
  40.5 kWh at 15 kWh per 100 km; battery figures on a non-electric vehicle were refused.
- **A series**: one request published a ride, its return and next week's pair; the
  return was found by a search in the other direction with the back-seat filter; a
  return leaving before arrival was refused with a reason.
- **Account and SOS**: a profile saved, a second code refused within the minute, the
  code read from the administrator outbox (refused to a member), a wrong then the right
  code, an SOS with a position, a repeat press returning the same alert, the alert in
  the queue, acknowledged once, and the public profile showing an age but no phone.
- A token issued by core-api verified by the gateway's own `verifyToken`.
- A full journey through the HTTP API with the browser's `Origin` header.
- A real booking scored by the real intel service, then the scoring job with intel stopped.
- A retried request returning the same booking, a late cancellation owing part of the fare and a
  completed trip owing all of it, read back from the database.
- A rating reaching the driver's profile, notifications reaching both sides, and a
  booking made with MongoDB stopped.
- **Chat and position** (`node gateway/scripts/live-check.mjs`): over real sockets, a
  stranger was refused, driver and passenger exchanged a message, a position was refused
  before the ride started and from the passenger, then relayed once under way, and both
  were found in MongoDB with the 7-day expiry on positions.
- **OSRM**: the Kolhapur-Karad-Satara-Pune route came back as 235.9 km by road, was
  served from the Redis cache on the second request, and a location search found a ride
  from 2 km away and not from 12 km away.

## Bugs the tests found

Kept here because each is a class of mistake worth remembering.

- **Two, on 2026-10-20, one of them by luck.** A rickshaw fare at exactly half
  a rupee came out a rupee short, as 2.275 - 1.5 in doubles is 0.77499...; the fare is now
  worked out in decimal. And the first Twilio tests reached the real Twilio: the sender's
  own request factory replaced the stand-in, so a send went out with fake credentials and
  came back 401, which two tests took for the refusal they expected. Nothing was sent. The
  tests now build the sender so the stand-in answers, and check it was the only thing asked.
- An unticked stop on the publish form was still validated, so a stray value in a hidden
  field blocked publishing with no visible error.
- An invalid query parameter returned 500 instead of 400.
- A late 401 for a request made by an earlier session signed out the session that had
  replaced it. Found because a test without a stubbed server reached the running API.

## Bugs the tests did not find

- **Found by a team member using the app** (2026-10-27): **a tab left open across a release
  broke on its next screen.** Every screen's code has a name that changes with each build;
  the open tab asked for the old one, got nothing, and showed "Something went wrong on this
  screen", and "Try again" could not help because a failed load is remembered. A tab now
  reloads once when that happens, and the error screen offers a real reload for it
  (`web/src/lib/staleBuild.ts`).
- **Found by an audit of the research** (2026-10-29), three test faults rather than code
  faults:
  - A model sanity test required a curve value at 168 hours above 0.5. No booking can stand
    that long, the value rested on a single cancellation among about 12 bookings, and the
    0.5 was never derived from anything. It failed once the last-mile change made cancelling
    likelier. It now checks what must hold in any world, plus calibration on held-out seeds
    (AI_ML_METHODOLOGY.md section 5).
  - A what-if test still expected the earlier world's sweep numbers.
  - Two booking tests still expected the request without its last-mile fields.

  All three failed silently for days because nobody ran the suites after the change; CI's
  web job had been red since 2026-10-24.

- **Found by looking at a map in dark mode** (headless Edge, 2026-10-24): **maps had never
  been dark**. The rules that dimmed the tiles sat inside a Tailwind layer, and Tailwind
  drops a layered rule whose class never appears in the source; Leaflet adds its classes
  itself, so the rules were left out of every build. The screenshots of 2026-10-22 were
  read without noticing. The rules now sit outside the layers, and every other custom
  class was checked to be in the built CSS.
- **Found by reading the detour work back** (2026-10-19), three faults. Every test with a
  pickup away from the stops stopped at the booking; none went on to the meeting point, a
  withdrawal or a slow routing service:
  - **The meeting-point map sent a passenger picked up at their own point to the stop
    before it**: "Board here" on Kolhapur and "Board at Kolhapur, leaving 7:30", though
    the driver comes to them near Karad 80 minutes later. The map now marks the pickup
    point and its time.
  - **When the driver withdrew, a flexible passenger picked up near Karad was rebooked
    from Kolhapur**, the stop before the pickup and 66 km from where they were, and every
    passenger picked up away was told of other rides from there. Both now look from the
    pickup point, and a ride that offers detours is booked with it.
  - **Booking a pickup asked the routing service while holding the ride lock**, so a slow
    routing service would have stalled every other booking on that ride. It is now asked
    first, and only the check against the minutes left is under the lock. No test covers
    this one: the tests have no routing service to slow down.

  The first two each have a test that fails without the fix.
- **Found by driving detour pickups in a browser** (headless Edge, real road map,
  2026-10-19): **a pickup's heading named the stop before it, at the pickup's time**
  ("8:25 am Kolhapur" for a pickup in Karad), and the search help still said only rides
  with a stop near each end are shown. The heading now says "Your start"; a test that
  fails without the fix covers it.
- **Found by driving seats on a ride under way in a browser** (headless Edge, 2026-10-17):
  **a ride started early was still sold from the stop it had just left.** Its timetable
  put that stop more than the 30-minute margin away, and a driver may start up to an hour
  early. The tests had started rides early too, but never asked about a stop the
  timetable put outside the margin and the early start put inside it.
  Rides now record when they started, and a stop is judged by the earlier of the
  timetable and the start; the test that covers it fails without the fix.
- **Found by driving live position between two browsers** (headless Edge, emulated
  location, 2026-10-17), four faults:
  - **The gateway never reached MongoDB if MongoDB was slower to start.** The driver's
    first automatic connection failed, kept the closed connection, and every chat and
    position call then failed with "Topology is closed" until the gateway restarted. Its
    tests use an in-memory store, and the live check ran with MongoDB already up. The
    gateway now keeps trying (`test/connect.test.js`).
  - **A driver who opened the chat before starting the ride was never offered sharing**:
    the chat learnt the ride's status only when it joined. It now also takes the status
    from the page.
  - **One moment without a fix ended sharing for good.** Every geolocation error turned
    sharing off, though only a refused permission is final; the test's stand-in only ever
    raised an error with no code. Only a refusal stops it now. Both web faults have a test
    that fails without the fix.
  - Leaving a page while its map was still animating threw a Leaflet error. The map now
    moves without animation.
- **Found by driving the app in a browser** (headless Edge, 2026-10-16): **sending a rating
  showed an error although the rating was saved.** core-api answers it with 201 and no
  body; the app's API helper read every non-204 answer as JSON and failed. The web test
  faked exactly that answer but checked only that the request went out, not what the
  passenger saw. The helper now treats any empty body as no content, and the test checks
  no error appears (it fails without the fix). Also: a passenger's booking never said who
  the driver was or which car to look for; it now names both, with a link to the profile.
- **Found by driving the app in a browser** (headless Edge, 2026-10-15): the sign-in and
  sign-up pages showed an empty box where the Google button goes when Google sign-in is
  off; and the publish form asked for "Minutes from Kolhapur to Kolhapur" on the first
  stop, a value that is always taken as the starting point. Both fixed.
- **A failed confirmation email locked the member out for a minute**, and the supply-gap
  timer ran outside its transaction; both found by reading the code, not by a test. The
  first now has a test that fails without the fix. A notification sent from inside an
  after-commit step was never written; the flexible-tier test found that one.
- **Withdrawing a ride ran without a transaction for one commit.** A patch inserted a
  helper method between `cancel()` and its `@Transactional`, so the annotation applied to
  the helper (where Spring ignores it) and the withdrawal ran statement by statement.
  Every test passed, because none fails partway through. It was noticed when the next
  patch put another method in the same place and the compiler objected to two
  annotations. `TransactionBoundaryTest` now checks every public trip and booking action.
- **Saving a profile, removing an emergency contact and releasing a seat hold would have
  failed in a browser.** The CORS configuration allowed only GET and POST, and those
  three use PUT and DELETE. Every test passed, because server tests sent no browser
  preflight for those methods and web tests replace the network. It was found by reading
  the configuration while writing SECURITY.md. A preflight test for each method now
  exists. It is the clearest evidence so far for the first item below.

## Not tested

- Confirming a phone number through the screen. The API path is tested; the screen is
  the same component as for email and is tested for email only.
- The device position on a real device: the emergency panel is tested with a stand-in,
  and live position was driven with a location the browser emulated, never a phone's GPS.
- **There is no browser end-to-end test in the repository.** Every screen was driven in
  headless Edge from 2026-10-15 to 17 and checked by eye from screenshots (see
  FEATURE_MATRIX.md); those scripts were throwaway and are not kept or rerun.
- No load, security-scan or accessibility-audit tooling has been run.
- Duplicate provider callbacks: the feature does not exist.
- A hold lapsing in real time. The test moves a clock; nobody waited five minutes.
- A gateway restart with clients connected. Rejoining after a single dropped connection
  is tested; the whole server going away and coming back is not.
