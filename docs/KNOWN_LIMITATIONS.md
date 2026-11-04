# Known limitations

What the project does not do, does only in part, or does in a way a reader could
mistake for more. Updated 2026-11-01.

## Nothing here is evidence about real people

- There is no real ride booking data. The model is trained, and every experiment is run,
  on simulator output.
- Every number in `experiments/configs/world.yaml` is an assumption chosen to be
  plausible. None is estimated from data.
- The only real data is a public set of hotel bookings (EXPERIMENT_PROTOCOL.md section
  18). The current world (h3) cancels far more in the last week than they do: of bookings
  standing six days out, 59% reach departure in the simulator against 80% (city) and 90%
  (resort). The world was not changed to match, because hotels are not evidence about
  passengers; instead the results were rerun with cancellations three times rarer, where
  the simulated week looks like the hotels', and they did not change (section 23).
- The last-mile effect of world h3 (a passenger far from the stop cancels sooner) is an
  assumption like the rest; its strength per passenger type has no evidence behind it.

## The research result so far

- **Demand is assumed, not measured.** No real figures for the corridor exist, so feature 89 cannot be
  finished. Halving and doubling the assumption left the central result as it was, but moved absolute
  completed rides per 100 searches from 38 to 19 (EXPERIMENT_PROTOCOL.md section 24): an absolute
  figure in the report means "at 60 searches a day", not a forecast. Real demand could lie outside
  the range tried. `experiments/real_data.py` will measure it once enough real searches exist; it has
  only ever run on made-up searches and on a log too small to use.
- The central hypothesis is not supported on the primary metric. The intervention moves
  cancellations earlier but adds nothing measurable at the assumed responses (+0.03,
  −0.02 to +0.07), and at most +0.10 completed rides per 100 searches even when every
  passenger destined to cancel releases the moment they are asked and nobody is put off.
  See EXPERIMENT_PROTOCOL.md sections 20 and 22 (sections 5 and 6 for earlier worlds).
- It held when passengers' responses were varied, when unserved passengers were allowed
  to search again, across supply densities of 6, 12 and 20 rides a day (an earlier world,
  section 7), at every survival threshold tried (section 14), and at every cancellation
  rate tried, down to one like the hotels' (section 23). Why refills add so little is
  section 11.
- **Counted in seats rather than bookings, asking does add a little** (+0.14 seats per 100
  searches, section 20). This was found after the fact and is not a result; the primary
  metric counts a booking once whatever its party size.
- A contact budget (B5) reduces the effect on the late share roughly in proportion to
  the requests withheld. The scheduler's choice of whom to ask concentrates nothing,
  and choosing at random does as well (section 14). Its worth formula is an
  assumption with no evidence behind it. See EXPERIMENT_PROTOCOL.md section 8.
- Why refills add no rides is not settled. The extra seats B4 frees are mostly taken by
  passengers who were offered another ride as well, but that count does not bound what
  released seats add (corrected 2026-11-04; EXPERIMENT_PROTOCOL.md section 8): a seat such
  a passenger leaves free can go to someone with no other option. Comparing seats standing
  at departure across variants measures it; that has not been run yet.
- Over half of all searches are offered no ride. Neither a wider window nor earlier
  publishing changes that much, so in this world most are full rides: about 31 seats a day
  are offered against about 84 wanted. Early releases are refilled far more often than
  late ones (92% against 62% in world h3), but B4 moves only about 16 of 98 late releases
  per seed (EXPERIMENT_PROTOCOL.md sections 9 to 11, 20, and docs/figures Figure 6).
- Even an oracle that asks exactly the bookings that will cancel late gains only +0.13
  completed rides per 100 searches (section 20). The ceiling depends on the assumed
  response: +0.06 to +0.26 as the chance of releasing at once goes from 0.25 to 1.0
  (section 15's sweep, rebuilt in world h3).
- It is one synthetic corridor. It is not evidence that the idea fails in reality.
- **A live what-if run is an exploration, not a result.** It gives means and the mean
  paired difference with no interval, on as few as 5 seeds; only the saved sweeps carry
  intervals. intel checks the administrator's token but cannot see a suspension made
  after it was issued, and it answers browsers on that one path.
- Variants B1, B2 and B6 to B11 are not built. B7 and B8 price on a prediction, which the
  project's rules forbid; the others need a simulator with geography, prices and repeat
  drivers that does not exist.
- The one gain found, B3's ranking (+0.32), needs no model at all: offering the
  soonest-leaving ride first does exactly as well (−0.001, −0.021 to +0.018; section 21),
  and so does a model that knows only the time to departure (section 14). The scheduler
  does no better than sending the same requests at random, and no threshold for asking
  helps.
- The model discriminates weakly (concordance 0.64) and violates the
  proportional-hazards assumption for lead time, past cancellations and the last-mile gap.
  Its gain since h2 is largely the last-mile effect the simulator was given. It matches
  the generating survival on average but not booking by booking, and captures 77% of the
  discrimination any model could reach (AI_ML_METHODOLOGY.md section 5). On real hotel
  cancellations the same kinds of model do gain from booking features
  (EXPERIMENT_PROTOCOL.md section 19), which suggests the simulated world understates
  what features can tell; the served model is still trained on simulated data only.
- The survival curve's last days rest on few bookings (24 still standing at 160 hours in
  the validation seeds, 8 at 163), so a probability read beyond about 150 hours is fragile.

## Platform

- **Road routes stop at the edge of the map.** The app takes routes anywhere in India, but the road
  graph as shipped covers a box around Kolhapur to Pune. Anywhere else, distance, driving time,
  suggested prices, walks and pickups come from straight lines, and where a distance or a walk is
  shown it says so. A road is longer than a straight line, so outside the map an electric car's range
  check is lenient and a suggested price low. A whole-India graph has not been built or tried.
- **The research says nothing about other routes.** Every number in the report comes from the
  simulated Kolhapur to Pune corridor.
- **The places are a list:** 126 cities in 34 states and union territories, with Andaman and Nicobar
  and Lakshadweep left out for having no road link. Their coordinates are town centres entered by
  hand and checked only to lie in India, not against a survey. A town not listed is reached by a map
  point from the nearest city that is, and a driver's stop keeps that city's name.
- A stop can be at most 48 hours after departure, so the very longest routes in India have to be
  split into separate rides. The form says so when a time is too long.
- Rickshaw fares exist only where a fare is published and entered (Kolhapur and Pune as shipped).
  Elsewhere a rickshaw is shown with no fare.
- **Signing up with a phone number proves nothing about the number.** It is unconfirmed
  until a code proves it, and the code goes only to the simulated outbox. Someone can sign
  up with a number that is not theirs, and the real owner then cannot use it until an
  administrator steps in. A number without a country code is taken to be Indian (+91).
- Migration V21 makes phone numbers unique. A database where two members already share a
  number will refuse the migration until that is settled by hand.
- A member who signed up with a phone number cannot add an email address yet.
- **Push notifications are off by default and untried in a real browser.** The encryption
  matches RFC 8291's example exactly and a test decrypts what the server sends, but no push
  has been seen arriving through Google's, Mozilla's or Apple's service. Pushes are in
  English, as email and SMS copies are. Safari needs the app installed to the home screen
  before it allows push.
- Rest stops, chargers and bus services are whatever administrators enter; none ship with
  the platform and nothing checks them. The suggested break assumes an even pace.
- Photos are not moderated: nothing checks what a photo shows.
- **Real email has never been sent through a real provider.** It is tested against an
  SMTP server inside the tests. Messages are plain text, in English.
- A flexible rebooking is a new booking made without the passenger present. On a ride the driver
  approves it is a request the driver may decline.
- **Google sign-in has been tried with Google once**, on 2026-11-02, by a real Gmail account linking
  to its existing VAYORA account. Creating a new account through Google has only met a stand-in that
  signs tokens the way Google does. While the Google project is in testing, only its listed test users
  can sign in. A Google-only account has no password; it cannot sign in any other way, and there is
  no "set a password" yet.
- Supply gaps know a search's day but not the hour wanted: searches carry a date only. A
  nudge cannot be dismissed, and a search's ends are named by the nearest ride stop within
  5 km, so a stretch nobody has ever driven is never a gap.

- **VAYORA cannot see a payment.** Passengers pay their driver directly, so whether money moved
  rests wholly on the driver's word. A driver who forgets or refuses to mark it paid leaves the
  passenger unable to book until staff clear it, and staff cannot see a UPI payment either: they
  judge what they are shown, and nothing ties a report to a booking. A passenger who never pays
  loses nothing but the right to book again; there is no collection, reminder or write-off. A
  passenger who disputes a completed trip still owes it until an administrator acts, and the
  dispute page does not show what is owed. Money sent to the wrong person cannot be got back
  through VAYORA. The simulator does not model paying at all, so whether paying after the ride
  changes when people cancel is not known.
- **UPI has never been tried with a real UPI app or real money.** A UPI ID is checked only by
  its shape, so one that does not exist is accepted, and a QR code is not read, so a driver can
  upload any picture. A passenger is told to check the name their own app shows. On a phone the
  app offers a link that opens a UPI app with the amount filled in: it follows the UPI link
  format, but has never been opened on a phone, and UPI apps may refuse such a link to a personal
  ID, so the ID and the QR code are the ways that matter.
- Receipts are never tax invoices: VAYORA charges nothing, and has nothing to invoice. The PDF is in
  English only; the receipt page is in the reader's language.
- **A seat hold is a courtesy, not a guarantee.** It lives only in Redis. If Redis is
  down, holds are neither placed nor honoured and anyone may book the seats. A hold and
  another passenger's booking arriving in the same instant are not ordered against each
  other: the booking can win. One passenger holds seats on one ride at a time, and
  nothing limits how often a passenger renews a hold.
- **An unanswered request holds its seats for up to 12 hours**, closed by a job that runs
  every five minutes, so a request can outlive its deadline by up to five minutes. Most
  tests turn the 2-hour rule off so that rides leaving within the hour can be booked and
  started; one test class runs with it on.
- **Search matches stops in a straight line**: a stop must be within 5 km of each end, one
  fixed limit for everyone. The walking time shown is then worked out on footpaths.
- A ride's stored route is OSRM's simplified line (19 points for the whole corridor). It
  is right for distance and for an overview map, and too coarse to follow turn by turn.
- If OSRM is down when a ride is published, the ride keeps a straight-line route for
  good; nothing recomputes it later.
- **One role per account.** A person cannot be both passenger and driver.
- **The 7-day booking horizon is not enforced** when publishing or booking.
- **Completion is the driver's word.** A boarding code lets the driver check that a
  passenger is the one booked, but nothing requires it, and the driver completes the ride
  alone. Only afterwards can a passenger confirm the trip or say it did not happen, which
  reaches the administrators.
- **A driver withdrawing a ride rebooks only those who chose it.** A passenger who chose a
  flexible booking is booked on the closest ride that fits; everyone else is told and shown
  up to three other rides, and nothing is booked for them.
- Reviews cannot be edited or removed, and a report is about a member, not a review.
- A suspended member's future rides and bookings are left as they are; nobody is told.
- A reporter is never told what was decided.
- Ratings are visible at once; one side can see the other's rating before giving theirs.
- **By default no message leaves the platform.** Confirmation codes, notification copies
  and emergency texts go to the simulated outbox unless an SMTP server or a Twilio account
  is configured, and neither has been tried with a real provider. "Email confirmed" then
  means only that someone read a code out of the administrator outbox; it proves nothing
  about the address. Texts to Indian numbers through a real Twilio account would need the
  sender registered under TRAI's DLT rules, which has not been done.
- **By default the SOS button contacts nobody outside the platform.** It records an alert
  for administrators, who are not an emergency service and are told only by an in-app
  notification and a queue that refreshes every 15 seconds. A text for each emergency
  contact goes to the simulated outbox, and the member is told nobody was messaged; with a
  Twilio account the texts are sent, which has never been tried.
- The simulated outbox is in memory: it is lost on restart and would not be shared
  between two core-api instances.
- **A pickup's time is an estimate.** It is the stop's time plus the drive to the point,
  and every pickup before it on the same leg adds to the delay without changing the
  times shown. Reminders and calls still count from the stop, a few minutes earlier.
  Drop-offs away from the stops are not offered. Without the routing service, costs are
  straight lines at 50 km/h, which understates them.
- **Walking times need the walking graph.** Without it, or while it is building, walks are
  straight lines at 4.5 km/h and say so.
- **A rickshaw is an estimate.** Its time is by road for a car, not an auto-rickshaw in
  traffic, and nothing knows whether one is there. A fare is given only where a published
  meter fare is known in full: Pune's, read from a newspaper's report of the RTA's
  decision, not from the notification itself. Kolhapur's 2025 revision is reported
  without its minimum's distance, so Kolhapur gets no fare.
- **Match scoring treats any difference as a mismatch.** One person fine with smoking and
  the other not counts against the match, though the ride would simply be smoke-free.
  The weights (25 distance, 20 price, 15 record, 10 for each preference) are assumptions,
  and nothing measures whether matched rides go better.
- Search filters for smoking and pets leave out every driver who has not said either
  way, which today is nearly all of them. Filters are not recorded in the event log.
- Identity documents are checked only by a person. A driver may say which one they hold and
  ask VAYORA staff to see the original; nothing is checked with its issuer, a good forgery
  would pass, and it counts towards no level. Until then the profile shows it as declared and
  not checked. How carefully staff look is up to them: the app records only the outcome.
- With MongoDB down, a booking still succeeds but its response waits about two seconds
  for the notification write to time out.
- **Chat is one room per ride.** Every booked passenger sees every message; there is no
  private conversation between one passenger and the driver.
- A passenger who cancels can lose chat access up to 15 seconds late: membership is
  re-checked on that interval, not pushed.
- Live position is the latest point only. There is no trail, no estimated arrival, and
  nothing tells passengers when the driver stops sharing.
- The driver's device sends at most one position every 5 seconds, and a reading that
  comes sooner is dropped, not sent later. A device that reports only when it moves can
  leave passengers with a point up to 5 seconds of travel old until it moves again.
  Never tried on a phone's GPS; the browser check used an emulated location.
- Chat messages are kept indefinitely; only GPS points expire (after 7 days).
- Trip state is not pushed. A passenger's screen does not change when the driver starts
  the ride until they reload or reopen the chat.
- **A ride under way is sold by its timetable, moved earlier if it started early.** A
  ride that gains time on the road can still pass a stop before a passenger who booked
  it there arrives, and nothing warns either of them; the 30-minute margin only makes it
  less likely. Displayed times stay the timetable's, with a note that it may be early. Like everyone on a ride under way, such a
  passenger cannot cancel.
- **Whom the seat-release reminder asks rests on a model that has never seen a real
  passenger.** It ranks weakly (concordance 0.59 on simulated data); someone it rates
  safe is never reminded, and neither is anyone it has not scored. Nothing else rests on
  it. `vayora.reminders.targeting.enabled: false` asks everyone alike.
- **The seat-release reminder is untested as an incentive.** Nothing measures whether
  anyone releases a seat because of it, and the simulator suggests releases come earlier
  but add no rides. Sent at 48 hours, it lands where free cancelling ends, so most
  who act on it owe half the fare; it says so. There is no way to turn it off
  for oneself.
- **A referral earns nobody anything.** It is only counted: the reward was a free pass, and passes
  are gone.
- **Calling is a labelled mock by default, and insurance is checked only by a person.** A
  driver's insurance is their own declaration unless staff have seen the policy, and is never
  checked with an insurer. A policy cancelled after staff saw it would still show as checked.
  Without a Twilio account a call is never
  placed and the other side only gets a notification saying someone tried; both say so
  wherever they appear. With an account, calls are bridged through Twilio, which has never
  been tried: each call is two paid legs, and calls to Indian numbers from a Twilio number
  are international and may need registration. **Nothing limits how often someone calls**:
  with Twilio on, each press rings the other person's phone again and costs two more legs.
- **The PDF receipt is in English, with names in Latin or India's nine main scripts only.** Those are
  drawn as shapes, so they read correctly but cannot be selected or searched in the PDF, and no native
  reader has checked them. Any other script, Urdu's among them, prints as "?". The receipt page shows
  the same receipt in the reader's language with names as written, and the browser prints
  it or saves it as PDF. That was printed to PDF by headless Microsoft Edge, never on
  paper or through a person's own print dialog, and its Hindi and Marathi have had no
  native review. Drivers get no statement of what they were paid beyond the earnings page.
- **Women-only rides rest on what members say about themselves.** Anyone can choose
  "Woman" on their profile, and nothing checks it. Changing the profile later changes
  what they can see and book, but does not touch a booking already made.
- **Everything about a vehicle is the driver's word**: comfort, luggage, battery and
  consumption. The range shown is those two figures divided, not a measurement; a ride
  is refused only when one stretch between stops is longer than it, and nothing checks
  that the time allowed at a stop is enough to charge. A vehicle cannot be edited or
  removed.
- **A repeated ride is a batch, not a schedule.** Up to 8 further weeks are published at
  once as separate rides. There is no open-ended repeat, a series can be withdrawn as a
  whole but not edited, and nothing checks that a vehicle is not on two rides at once.
- Rides can be published weeks ahead although the booking horizon is 7 days; the
  horizon is still not enforced.
- "At most two in the back" is the driver's word. Seats offered are not checked
  against it.

## Model in the platform

- `experiments/hazard/train_real.py` can train on real bookings once there are 500 of them with 110
  cancellations, numbers the authors judged, not ones measured. It has only run on a made-up history.
  People testing with ordinary email addresses cannot be told apart from real passengers. A model it
  makes is not served: replacing the one in use is a decision for the team, on its report.
- **The durability model has only seen the corridor.** Its features do not name a route, so it scores
  a booking anywhere, but it was trained on a simulated Kolhapur to Pune and whether its scores mean
  anything elsewhere is not known. As everywhere, they only decide whom the seat-release reminder asks.
- **Train and serve differ on one feature.** The simulator has a preferred departure
  time, so `desired_gap_hours` varies in training. A platform search names a day only,
  so the platform always sends 0.
- Scores are appended to the event log and shown to an administrator. One thing acts on
  them: whom the seat-release reminder asks (above). Nothing is cancelled, priced or
  refused on a score.
- Scores are deliberately not shown to drivers or passengers.

## Security

- The access token lives in the browser's `sessionStorage`, readable by any script on
  the page. There is no refresh token; a session lasts 12 hours and cannot be revoked.
- Only sign-in and confirmation codes are limited, and only per account: five wrong
  passwords in 15 minutes lock that address's password sign-in for the rest of the
  window, which anyone can set off on purpose; codes are one a minute, ten a day, five
  guesses each. Nothing is limited per client, so a few guesses at each of many accounts
  go unchecked.
- An administrator can read every confirmation code in the simulated outbox. That is
  the point of it, and it must not exist alongside a real sender.
- Registration reveals whether an email is already registered.
- The web server sends the basic security headers, but there is no content security
  policy and no HSTS.
- Every signed-in request costs one extra database lookup, to check the account is not
  suspended.
- The development defaults in `docker-compose.yml` (database password, JWT secret) are
  public. They must be replaced for any deployment.

## Simulator

- Every trip is the full corridor; the platform's intermediate stops are not simulated.
- A passenger searches once per need. Nobody who is rejected, cancelled on or finds
  nothing tries again.
- One driver per ride; drivers have no history or reputation.
- Trip events are per passenger booking, by decision; see PROGRESS.md.

## Interface

- **"Live" means re-read often, not pushed.** Only chat and the driver's position arrive as they happen.
  News takes up to about 15 seconds to show, seats up to 20, and lists up to 30. A driver's position is
  sent at most every 5 seconds, and only while they choose to share it.
- A driver's position is drawn on the map with the line it has taken since the chat was opened. There is
  no arrival estimate, because the app has no live traffic or road position to base one on.
- A search result's seats are kept current for the first 30 results on screen.
- **Screens were viewed in a browser only by a script, its screenshots checked by eye**
  (headless Edge, 2026-10-15 to 17, and single features since, last on 2026-10-21), not by a person using the app, and not on a phone. The map draws its tiles and pins there; the component tests still use
  a stand-in for it.
- **Maps in dark mode are the light tiles dimmed**, not a dark map. The theme choice in the
  header is kept per browser, not with the account.
- Map tiles come from OpenStreetMap's public servers, which is acceptable for a
  demonstration and not for sustained use.
- **The Hindi and Marathi translations have had no native review.** I wrote them. The
  wording on refunds, payments and the emergency notice matters most and should be
  checked first.
- Some text written by the server stays in English in every language: web pushes, and
  audit entries (shown as recorded).
- Plurals use one form for one and another for the rest, which is right for these three
  languages and would not be for others.
- No end-to-end browser test.

## Environment

- **VAYORA has never run on a real server.** The online setup was tried on one machine, with a local
  certificate and without the road services. Everything about its first run on a server, including
  how much memory building the road graphs needs, is unmeasured.
- The host has Java 26 and Python 3.14; the project targets Java 21 and Python 3.11.
  Builds and tests run in containers that pin the right versions.
- Something emptied the working tree before this work began. The cause is unknown.
