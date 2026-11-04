# Decisions

The decisions that shape VAYORA, each with the reason it was made and what it costs. Each
was recorded when it was made, in PROGRESS.md; this file gathers them by subject. A
decision listed here is to be changed on purpose, not by accident: change it here first.

The rules in CLAUDE.md (frozen parameters, the architecture rule, data placement, the
research integrity rules) are the project's own and are not repeated. Everything below
was decided while building within them.

## Research

| Decision | Why | Cost |
|---|---|---|
| Real data is used only past a stated amount, and without demo and test accounts (`real_data.yaml`, 2026-11-02) | So a calibration or a model cannot quietly come from a handful of bookings or from data somebody made up | The amounts are the authors' judgement. Real features 77 and 89 wait until they are reached |
| A model trained on real bookings is not served automatically; earlier outcomes train and later ones validate (2026-11-02) | Replacing the model in use is a decision to take on evidence. There are no seeds to keep apart in real data, and time is how a model would meet bookings it has not seen | Someone has to read the report and decide |
| The primary metric is completed rides per 100 searches, every other number secondary | CLAUDE.md fixes it; bookings can rise while rides do not | A variant that only moves cancellations earlier scores nothing, which is what happened |
| Cox proportional hazards is the served model | Best departure Brier score and concordance of the three fitted | Its proportional-hazards assumption is violated for lead time |
| The gradient-boosted survival model trains on a 5,000-row sample | Its loss is quadratic in rows; the full set ran for over ten minutes | It is compared on less data than Cox |
| Corridor demand is not calibrated (feature 89, 2026-10-21). How much the results depend on it is measured instead (2026-11-01) | No real demand figures for the corridor exist; a proxy from public bus and train timetables was offered and declined, since it would not be calibration. A sweep is not one either, and says so, but it shows whether the conclusions lean on the figure assumed | Every result still rests on demand the authors assumed, within a range the sweep has only tried from half to double |
| Variants B1 and B2 are not built | The simulated corridor has one origin and one destination: there is no geography to filter or rank two-sidedly | Two rungs of the ladder are missing |
| B5 keeps B4's threshold and adds only a budget | So the two differ in one thing | |
| The share of passengers with a flexible booking is swept, never assumed | Nothing in a simulation says how many would choose it | The result is a range, not one number |
| The simulator's setting is `flexible_booking`, not `flexible` | `flexible` is already a hidden passenger type, which must never be confused with anything observable | |
| The contact scheduler is a CP-SAT integer programme | A seat limit per departure day makes the choice one that sorting cannot solve | A dependency (OR-Tools) for a constraint that rarely binds at this scale |
| A sweep can vary a variant's parameters, not only the world's | The budget is a property of the variant | |
| Metric queries group rather than join on keys inside the JSON payload | A join on payload keys did not finish in ten minutes; grouping takes seconds | Queries are longer to read |
| SOS presses and seat holds write no event | The 22-event vocabulary is frozen and neither is a research measurement | They cannot be analysed from the log |
| A request closed for want of an answer is logged as `booking_rejected` by the platform, with a reason | Tells a lapse from a driver's refusal without a new event type | Queries must read the actor to tell them apart |
| The public hotel bookings are written into the event log under a run of their own | Every reported number must come from `metrics.sql` over `events`; one query then counts the hotels and the simulator the same way | Rows in `events` that are not VAYORA's; every query already selects by run |
| The hotel survival check trains on 2015 and 2016 arrivals and checks on 2017 | Years are that data's seeds; a later year tests the models on bookings they could not have seen | 2015 is only half a year |
| Its features are only what is known when a booking is made | Anything changed later would carry the future into the prediction | A refundable deposit is left out too: it separates outcomes |
| A Cox fit that does not converge stops the run | lifelines' default steps stop early on these data, and a fit that has not converged is not a result | Fit settings live in the config |
| Hotel dates are read as noon UTC | The data has days only; a real time zone would move some intervals by an hour at summer time | Day 0 is a calendar day for the hotels and 24 hours in the simulator |
| The hotel file is downloaded and checked by hash, not committed | 16 MB of someone else's data; the hash makes any copy provably the same | Reproducing needs a network the first time |
| A live what-if run is simulated by intel, which the administrator's browser calls | It keeps nothing, so by the placement rule it is intel's; core-api relaying it would forward a request for another | intel answers browsers on that path and checks tokens itself; the deployment must expose only that path |
| A live run gives means, the mean paired difference and seeds up and down, but no interval | It is an exploration, not a result; an interval would need scipy in intel and would look like a report figure | A small difference can be over-read; a sweep gives the interval |
| Each sweep says in its YAML how far a live run may take its setting | Bounds are tunables (rule 5); outside them a run may mean nothing or take long | A sweep with no bounds is not offered live |
| A live run builds its cell with the sweeps' own code (`sim.config.apply_cell`) | So a live run at a value a sweep covered reproduces it exactly, which a test checks | |
| Experiment X1's hazard tied to departure takes a share of each type's Weibull hazard rather than adding to it, and each type's rate is set so the type keeps its world-h3 chance of reaching departure (2026-11-04) | Added risk would change how many cancel as well as when, and the experiment asks only about when | The chance is held on the bookings B0 accepts in world h3 on ten calibration seeds; under other variants it holds only as nearly as their bookings resemble those |
| The draw for that hazard is made last of a search's draws, and share 0 divides by exactly 1.0 | So every run made before it exists is reproduced event for event, which X1 checks | |
| X3 classes each booking a policy asked by its twin in the run without requests: the same search, booking the same ride, accepted at the same moment (2026-11-04) | Common random numbers give the twin the same cancellation draw, so its fate is the asked booking's counterfactual, read from the log; the hidden cancellation time never enters the log | Asked bookings whose world had already diverged have no twin; the ceiling shares them out in proportion, and a conservative version counts them all as late cancellers |
| A ride counts as withdrawn when a driver cancelled a booking on it in either run of a pair | The log has no withdrawal event, and common random numbers make withdrawals the same in both runs | A ride withdrawn with no booking left on it cannot be told from one that departed empty |
| Experiment X2's cost of leaving away from the wanted time lowers only the chance of booking the ride offered, by exp(−cost × gap), with the same draw deciding (2026-11-04) | It is the smallest change that makes an earlier ride cost the passenger something, and at cost 0 it is the old rule exactly | A passenger still sees only the first ride; a cost cannot make them choose another one on the list |

## Platform: correctness

| Decision | Why | Cost |
|---|---|---|
| The seat-release reminder asks only bookings the model rates below 0.8, within a budget the contact scheduler fills (from 2026-10-20; from 2026-10-17, everyone alike) | Chosen by the team, so the research's targeted intervention runs on the platform as the simulator's B5 | The reason it was first untargeted still stands: it acts on a guess about a real person, from a model trained on simulated data that ranks weakly. Only a neutral message rests on it, and the simulator found targeting adds no rides |
| The reminder states the refund the passenger would get at that moment | At 48 hours the whole-fare tier is ending; promising it would mislead | The figure is 50% for most who read it later |
| JdbcTemplate with hand-written SQL, no ORM | The existing code used it, and taking seats is one conditional `UPDATE` that reads more plainly without an ORM | More SQL to maintain |
| Seats are counted per leg of a ride | A passenger on one stretch must not take a seat from another stretch | Every booking touches several rows |
| Booking locks the ride row, then takes all legs in one conditional update | Concurrent requests for the last seat must produce exactly one booking | Bookings on one ride are serialised |
| Payment is held in the same transaction as the booking | A declined payment leaves no booking and no seat taken, and no hold-expiry machinery is needed | A slow provider would hold the ride lock |
| The money ledger and the audit log cannot be rewritten, enforced by database triggers | So the application cannot quietly correct history | Mistakes are fixed by new entries only |
| A seat hold lives only in Redis and never changes PostgreSQL's counts | No entity in two stores, and nothing to keep in step | A hold is a courtesy: it is not honoured while Redis is down |
| An unanswered request closes after 12 hours or 2 hours before boarding | So seats and money are not tied up until the ride leaves | A driver who answers late finds it gone |
| A ride, its return and its weekly repeats are published in one transaction | A driver is never left with half a series | Each is still a ride of its own, with no series-wide edit |

## Platform: money

| Decision | Why | Cost |
|---|---|---|
| Passengers pay their driver directly, in cash or by UPI, after the ride; VAYORA takes no money and charges nothing (2026-11-02, as the team chose) | With no money through the platform there is no fee to take, no refund to make and no gateway to set up | Features 42, 43, 44, 45, 85 and 94 are gone, with Razorpay, the mock provider, the ledger, passes and tax invoices. VAYORA can verify no payment |
| A payment is recorded on the driver's word alone, as cash or UPI | VAYORA sees neither, and recording it only helps the passenger | A driver can forget or refuse; see staff clearing below |
| A driver's UPI ID and QR code are shown only to a passenger with a booking of theirs, once it is confirmed or while it owes something | Someone searching for rides has no need of where a driver is paid | A passenger cannot tell from a search whether a driver takes UPI |
| A UPI ID is checked only by its shape, and refused if it looks like an email address; a QR code is not read at all | Checking either against anything real needs a bank or a new dependency, and the passenger's own UPI app shows the name before they pay | A driver can give a wrong ID or upload any picture. The passenger is told to check the name |
| A QR code is kept as a PNG, at up to 1,200 pixels, where a photo is a JPEG at 800 | It has to scan | More storage per driver |
| Cancelling late or not boarding owes the driver part or all of the fare, by the same timing tiers that decided refunds (2026-11-02, as the team chose) | It keeps what the research is about: releasing a seat early costs nothing, late costs more. The seat was held for them | Nothing collects it but the next rule |
| Nobody who owes a driver books again until the driver marks it paid | With no money held it is the only thing that makes a late cancellation cost anything | A driver who was paid and will not say so would block a passenger for ever; see the next rule |
| Staff can clear what a passenger owes, with a reason kept in the audit log (2026-11-02) | Without it a driver could stop someone booking for good | Staff cannot see a UPI payment either, and judge only what they are shown |
| Simulated payments were deleted when this changed; a booking on a simulated hold now pays after the ride (V40) | They recorded money that never moved, and leaving them would have kept card and provider values in the schema | Their history is gone from the database. It was all test accounts on the mock provider, and is in the dump taken first |
| `booking_requested` no longer carries `pay_after_ride`, and the column is gone from rides | Every booking now pays the same way, and neither a metric nor the simulator ever read it | Events already stored keep the key |
| Cancellation terms and booking deadlines are fetched from the server, not repeated in the app | One source of truth | One more request per page |
| Receipts state what the driver said they were paid, and are never tax invoices | VAYORA charges nothing, so it has nothing to invoice, and the fare is the driver's | A driver wanting a tax document has none from here |
| A referral is counted when the invited member completes a first trip, and earns nothing | The reward was a free pass, which waived a fee that no longer exists | Inviting has no incentive |

## Platform: identity, trust and safety

| Decision | Why | Cost |
|---|---|---|
| Texts go through Twilio when its three settings are set, to the simulated outbox otherwise | Its API is plain HTTP, and its test credentials allow a try that sends nothing and costs nothing | Real texts to Indian numbers need DLT registration, not done |
| The emergency button texts each contact on its own and records those it missed | A real text can fail; an alert must never fail because of one, and the member must know whom to call | A missed text is reported, not retried |
| A driver's identity document and insurance can be checked by a person: the driver shows the original to an administrator, who records the outcome (from 2026-11-01) | No identity provider or insurer is connected, and connecting one needs a registered business. This is a real check available today that keeps no number and no copy, so the earlier position on personal data stands | It says a person saw a document, not that its issuer stands behind it, and every place says so: a good forgery would pass. Each check takes an administrator's time |
| Insurance is the driver's declaration unless staff have seen the policy, with no policy number kept | No insurer is connected, so nothing can be checked with one; a policy number would be personal data for no purpose | Until then a passenger has only the driver's word |
| A masked call is allowed only between confirmed numbers, from 24 hours before boarding while the booking is confirmed, and the other side is told | A real relay must never ring a number nobody proved | |
| Repeated masked calls are not limited (2026-10-21) | Chosen by the team when a review raised it | With Twilio on, someone can ring the other side again and again, at two paid legs a call |
| With Twilio, a masked call is a bridge: the caller is rung from the platform's number, then the other side is dialled from it | Neither ever sees the other's number, and Twilio's ordinary call API does it with no number pool | Two paid legs per call; untried. Without Twilio the call is simulated and says so |
| One role per account: passenger, driver or administrator | Simpler permissions | A person cannot be both passenger and driver |
| Administrators cannot sign up; they are created from configuration | So nobody can make themselves one | |
| Another member's booking, ride or contact answers 404, not 403 | Ids cannot be probed | Debugging is a little harder |
| Suspension is checked on every request | A token cannot be recalled before it expires | One extra query per request |
| A report needs a booking shared with the member reported | Strangers cannot file against each other | |
| "Confirmed", never "verified", for an email or phone proved by code | A code proves an address, not a person | |
| Confirmation codes are stored as hashes, expire in 10 minutes, work once, die after 5 wrong guesses; one a minute and ten a day per channel (the daily cap from 2026-10-24) | Codes are credentials. The wait alone allowed 1,440 codes a day, each with five guesses | |
| Wrong passwords are counted per email address or phone number, in Redis, for 15 minutes from the first; five lock that address's password sign-in until the window ends (from 2026-10-24) | A count that expires is ephemeral, like a seat hold, so it is Redis's and in no other store; counting per address stops guessing one password from any number of machines, and needs no trust in forwarded client addresses. The key is a digest, so no address is copied out of PostgreSQL. Google sign-in is not counted: nothing in it can be guessed | Anyone can lock a member's password sign-in for 15 minutes; one client can still try a few passwords on each of many addresses. Without Redis nothing is counted, so an outage stops nobody signing in |
| Women-only rides rest on the gender a member declares, which nobody checks | It is the only information the platform has | The rule can be got round by anyone willing to lie |
| Experience levels need a confirmed email from the second level and a confirmed phone from the fourth | Levels should reward what can be checked, however weakly | The thresholds are assumptions |
| Gender is used but never shown | It decides women-only access; it is not other members' business | |
| The emergency panel puts calling 112 before alerting VAYORA | VAYORA is not an emergency service, and its messages are simulated | |
| Durability scores are shown to administrators only | A prediction about a person must not change how they are treated by other members | |
| Predicted risk never cancels a booking or changes a price | The project's own rules forbid treating a prediction as proof of intent | The intervention can only ask |

## Platform: search and routing

| Decision | Why | Cost |
|---|---|---|
| The app serves any route in India; the research stays on Kolhapur to Pune (team's decision, 2026-11-01) | The frozen parameters bind the simulator, the experiments and the report, not who may use the platform | Nothing in the report speaks for any other route, and the durability model has only seen this one |
| Roads only where the map reaches for now; elsewhere a labelled straight line (team's decision, 2026-11-01) | A whole-India road graph needs far more memory and time to build than this project has needed, and is a setting away when wanted | Distances, times, suggested prices and an electric car's range check are rough outside the map |
| A point OSRM moved more than 2 km to reach a road is off its map (`vayora.osrm.max-snap-metres`) | OSRM answers "Ok" for any point by moving it to its nearest road: Chennai to Bengaluru came back as 69.7 km, the points moved 705 km and 508 km. Corridor points move metres | A real stop more than 2 km from any mapped road shows a straight line |
| The places are a list of 126 cities, not free text | A search needs coordinates, a name has to be translated, and the stack has no geocoding service | A town not listed is reached by a map point from the nearest city that is |
| A rickshaw fare is given only where a published fare says both how far its minimum goes and the rate after | A fare worked out from half a rule would be a guess shown as a price | Kolhapur, where the corridor starts, gets a time but no fare |
| A rickshaw's time is the car route's | It is the only road time the platform has; an auto-rickshaw's pace in traffic is unknown | Labelled an estimate, it may still read as too quick |
| Search is by location; town names are presets for coordinates | Passengers rarely start at a stop | A straight-line access limit, not a walking distance |
| The 5 km access distance is a hard limit | A far-away ride ranked low is still not one a passenger can take | |
| A road route unavailable from OSRM is drawn as straight lines and labelled so | A straight-line estimate must never pass for a road distance | |
| A filter only ever narrows a search | Predictability | |
| Smoking and pets filters leave out drivers who have not said | Silence is not a promise | Today they leave out nearly everyone |
| Search positions are rounded to about 100 m in the event log | Research needs the area, not the doorstep | |
| A driver's detour allowance is one total for the ride, spent pickup by pickup | A driver cares how late they arrive, not how the minutes are split | One far pickup can use up the allowance for everyone after |
| A pickup is weighed again by road at booking, just before the ride lock, and checked against the minutes left under it | The search's figure could be stale, and two passengers must not both spend the last minutes; a slow routing service must not hold the lock, and the cost depends on nothing it protects | One more routing call per booking |
| Pickups only, not drop-offs | Half the work for the case that matters most: getting to a ride is the hard part | A passenger still walks from the last stop |
| Match scoring uses only what both people said, distance, price and the driver's record of rides kept | Ranking real people by a model's guess about them is not done anywhere on the platform | It knows nothing about people who leave their profile empty |
| A preference either person left unsaid counts half | Silence should neither help nor hurt | Saying nothing scores the same as half agreeing |
| "Best match" is one order among five, not the default | A passenger should be able to see results by time without a score in the way | |
| A ride under way is sold only from a stop it is due at 30 minutes or more ahead, by its timetable or by its actual start if that was earlier | The timetable and the start are all core-api knows of a ride's progress; live position is the gateway's and is not kept as truth. A ride may start up to an hour early | A ride that gains time on the road can still beat a late booker to the stop; the margin is in `application.yml` |
| A ride under way is sold only if it confirms instantly | A driver at the wheel must not be answering requests | Rides that need approval lose these seats |
| A no-show gives the seat back | The seat is empty for the rest of the ride, and an empty seat refilled is the project's whole idea | The no-show passenger has still paid, so the seat may earn twice |
| A booking on a ride under way writes `trip_started` when it is made | Every `trip_completed` or `trip_failed` must have a start, and there is no boarding event | Its start is when it was booked, not when the passenger got in |

## Interface

| Decision | Why | Cost |
|---|---|---|
| A search is never re-run by a timer; `/rides/availability` keeps results current instead (2026-11-01) | Each search writes `search_issued` and `candidates_returned`, and the primary metric divides by searches: a screen refreshing itself is not someone asking | One more endpoint. A filter or sort still only applies when asked for, because that is a search |
| "Live" lists are re-read on a timer; only chat and the driver's position are pushed (2026-11-01) | The gateway owns ephemeral streams and core-api owns the truth, and no service forwards for another. Pushing bookings would have needed a path between them. The unread count, read every 15 seconds, tells every other list when to look again | News takes up to about 15 seconds, seats up to 20. Every "Live" label says when it last read |
| An iOS-style look, light, dark or matching the device as the reader chooses in the header, VAYORA teal as the tint (2026-10-22, as the team chose) | Every colour class reads a CSS variable, so one set of dark values restyles every screen; the shared components carry the rest | |
| Each role in its own tint: passengers teal, drivers indigo, administrators violet | A person always knows which side of the platform they are on | The brand colour is the passengers' only |
| Entrances in CSS; exits, height changes and drag in Framer Motion (`framer-motion`) | CSS cannot animate an element leaving the page, a height to "auto", or a swipe | One more dependency, about 110 KB, in its own cached file |
| Icons from `lucide-react` | One consistent set, each icon imported on its own | One more dependency |
| Each screen is its own chunk, loaded when opened and fetched ahead when its link is pointed at | The first page arrives sooner; the build no longer warns of a 700 KB bundle | A screen opened for the first time on a slow line shows a shimmer briefly |
| English text is the translation key, and tests fail if a string lacks Hindi or Marathi | A missing translation is caught by the build, and still shows English rather than nothing | The English wording cannot change without the tables |
| Money and times use the same digits in every language | Passenger and driver read the same fare | |
| A chat message is shown when the gateway relays it, not when it is typed | What a sender sees is what everyone received | |
| Irreversible actions need a second, explicit press | Cancelling, completing and marking a no-show cannot be undone | One more click |
| The PDF receipt is in English, with names in Latin or India's nine main scripts (2026-11-02) | The platform serves all of India. Java's own text layout shapes them, and the outlines are drawn into the PDF, because PDFBox's shaping printed "कार्तिक" as "कातर्कि": a wrong name on a receipt is worse than none | Such a name cannot be selected in the PDF, and other scripts print as "?". The receipt page has neither limit |
| A receipt in Hindi or Marathi is a page in the app that the browser prints or saves as PDF (from 2026-10-21) | The browser already has fonts that shape Devanagari; PDFBox does not shape it, and embedding fonts would add files and licences | Two forms of one receipt. Both come from one query, so they cannot disagree on the facts |
| Flexibility tiers are a time window, chosen by the passenger | The team's choice: the passenger agrees in advance to be moved, and the price never changes, so nothing is priced or decided on a prediction about them. "Hazard-informed" means only that Flexible is suggested on a driver whose own record shows withdrawals | A rebooked passenger may land on a ride the driver approves, so they hold a request, not a seat |
| A rebooking runs after the withdrawal commits, in its own transaction | So a rebooking that fails cannot undo the withdrawal or anyone's refund. Found in testing: a notification sent from an after-commit step must have its own transaction too, or it waits for a commit that has already happened and is never written | |
| Email goes through any SMTP server, chosen by configuration | No particular provider is assumed; text messages stay simulated. Each channel reports separately whether it really sends, so the SOS record stays honest when email is real and SMS is not | |
| Photos are kept in PostgreSQL | CLAUDE.md allows no third data store, and a photo belongs to the member or vehicle it shows. Each is a small re-encoded JPEG | The database grows with them; there is no CDN, and every view goes through core-api |
| Web Push written with the JDK, not a library | The protocol is three small pieces of standard cryptography; the libraries for it bring their own HTTP client and crypto provider. Checked against RFC 8291's example to the byte | Code to maintain that a library would have kept up to date |
| Google sign-in uses Google's ID token, checked by core-api | No server-side redirect flow and no client secret to keep; the browser gets a signed token and core-api verifies it with the JWT library it already uses | Needs Google's script on the sign-in pages, loaded only when a client ID is set |
| Supply gaps are read from the event log; nudges are few and plain | Searches and their results are already logged, so no new table. A nudge says only what passengers looked for, goes to drivers who drove the stretch, and is limited to one a week per driver and five per gap (all in `application.yml`) | `nudge_converted` shows only that a driver later offered the stretch, not that the nudge caused it; it is never reported as a result |
| Server error messages are translated by the app, not the server | The server stays in one language and the app already keys its tables by the English; a core-api test keeps the two lists in step | The server's wording cannot change without the app's tables |
| Online, one edge in front of everything: a separate overlay file, not changes to the local setup (from 2026-11-01) | A local run stays one command with no secrets. The edge holds no logic and is not a service in CLAUDE.md's sense: nothing forwards a request on another's behalf except this one door, and each path goes to the service that owns it | One more thing to run, online only. Never tried on a real server |
| Demo data makes the app look used and is labelled as made up; it never stands in for real data (2026-11-01) | The team asked for dummy data in place of real data. The survival model already rests on simulated data, which is why feature 77 is partial; more made-up data would not change that, and calibrating demand (89) against made-up figures would only compare the simulator with itself. Both stay as they are | The app shows activity no real person produced, so anything presented from it must say so |
| Web pushes stay in English (2026-10-21) | Translating them would need the background worker to carry the tables and know the reader's language: a build step for text that links to the notifications page, which is translated | A push in a Hindi or Marathi reader's browser is in English |
| A server error built from values is matched by the app against a template, such as "You can have at most {n} emergency contacts" (from 2026-10-21) | The API's messages stay as they were, and a core-api test fails if the server builds one the app has no template for | A booking status inside one is a code (`CANCELLED`), which the app turns into a word |
| A date or time inside a notification is written as ISO-8601 (from 2026-10-21) | The server's English renders it as before, so copies read the same, and the app shows it in the reader's language | A value that is exactly an ISO instant is always read as a moment |
| Notifications are stored as a template and its values | So the app can show them in the reader's language; the English is rendered from the same template, so copies and older notifications read as before. A core-api test reads the web app's list, so a template the app cannot translate fails the build | Every new notification needs its template added to the web app and translated |
| A front page for signed-out visitors, in the main bundle (from 2026-10-24) | `/` used to send everyone to the sign-in form, which says nothing about what VAYORA is; every claim on the page is one the code makes good, and its footer says what is simulated | About 10 KB more in the first download |
| Installable, with an offline page and no other caching (from 2026-10-24) | A phone can keep VAYORA on its home screen; a page that cannot load says so in all three languages instead of the browser's error. Caching the app itself would risk serving a stale build against a newer API | Nothing works offline beyond that one page |
| A command palette (Ctrl+K) beside the navigation, not instead of it (from 2026-10-24) | Fast for anyone at a keyboard, and invisible to everyone else | |
| Dark maps are OpenStreetMap's tiles inverted and hue-rotated, not a dark tile provider (from 2026-10-24) | No second map provider to agree terms with or send readers' addresses to | Colours are approximate: parks and water keep their hue only roughly |
| Text is Apple's San Francisco where the device has it, otherwise Inter, served with the app, Latin only, shown only once cached (from 2026-11-03) | The team asked for an iOS look; San Francisco may only be used on Apple systems, and Inter is the usual open stand-in drawn to the same brief | A first visit on a slow phone shows the system font, which keeps the first paint from waiting; the rupee sign is always the system font's |
| Hindi and Marathi tables, the map and the sign-in screen load only when used (from 2026-11-03) | They were 72, 63 and 39 KB of compressed code every reader downloaded first, for screens most never open | A Hindi or Marathi reader's first screen waits for their table; sign-in is fetched while the front page is idle |
| Large titles that move into the bar once scrolled away, and a bar that is clear at the top and frosted once content is under it, as on iOS (from 2026-11-03) | The screen's name stays in sight without taking room | On a phone the small title sits beside the logo, not centred, so it never runs under the emergency button |
| A new driver sees a checklist of what is left, until it is all done (from 2026-11-03) | A car, a way to be paid, a confirmed contact and a first ride, in that order, each one tap away | Drawn from what the app already knows; nothing on the server requires it |
| The what-if page shows saved sweeps; it runs nothing | Running the simulator from a screen needs a service to run it: intel holds no state and core-api owns transactions, and a fourth runtime is ruled out. The web image is built from `web/` alone, so `export_web.py` copies the sweep figures into `web/src/data/whatif.json`, and `reproduce.sh` and a test fail if the copy drifts | Only settings already swept can be chosen; a new question needs a sweep run by hand |

## Dependencies

Each was justified in one sentence when it was added, as CLAUDE.md requires.

| Dependency | Where | Why |
|---|---|---|
| Noto Sans, one font file for each of nine Indian scripts, 1.4 MB | core-api | So a name in any of them reads correctly on a PDF receipt |
| OR-Tools | intel, research | CP-SAT for the contact scheduler |
| Apache PDFBox | core-api | Writes receipts; tests read them back |
| lifelines, scikit-survival | research only | Fitting the survival models; serving needs neither |
| Leaflet, react-leaflet | web | Maps for routes and meeting points |
| socket.io-client | web | Chat and live position |
| matplotlib | research only | Draws the report's figures from the committed results |
| SimPy, PyYAML | intel (already research) | Run the simulator and read its configurations for a live what-if run |
| PyJWT | intel, research | intel checks an administrator's token for a live what-if run, as the gateway does; the tests sign the tokens they present |
| @fontsource-variable/inter | web | Inter's font files, served by the app itself, for devices without San Francisco |
| framer-motion, lucide-react | web | Exits, height changes and swipes that CSS cannot animate; one consistent icon set (see Interface) |
| ESLint, typescript-eslint, eslint-plugin-react-hooks, eslint-plugin-jsx-a11y | web, gateway (development only) | Catch misused hooks, unused code and accessibility faults that the type checker and the tests do not |
| Caddy | online setup only | Gets and renews HTTPS certificates by itself, from one small file |
| springdoc-openapi | core-api | Generates the API's OpenAPI description and Swagger UI from the controllers, so the reference cannot drift from the code |

Tailwind stays on version 3 (2026-10-24). Version 4 would clear the last three moderate
advisories, but they are in build tools that only ever parse the project's own CSS, and
version 4 needs Safari 16.4, Chrome 111 or Firefox 128 or later: older phones, common
among the passengers the corridor serves, would get an unstyled app.
