# API

Every endpoint the three services expose, who may call it, and what it is for. Field
names and limits are in the controller of each endpoint; this is the map, not the
territory.

## Conventions (core-api)

- Base URL `http://localhost:8080`. Everything except sign-up, sign-in, the health check
  and the API's description needs `Authorization: Bearer <token>`.
- core-api describes itself: the OpenAPI document at `/v3/api-docs` and Swagger UI at
  `/swagger-ui.html`, where **Authorize** takes the token sign-in returns. Both are
  generated from the controllers, so they give every field exactly; this page is the map.
- Bodies are JSON. Times are ISO-8601 instants. Money is a decimal number of rupees.
- Errors are RFC 9457 problem documents: `{"status": 409, "detail": "..."}`. `detail` is
  written to be shown to a person.
- A stranger's booking, ride or contact answers 404, not 403, so ids cannot be probed.

| Status | Means |
|---|---|
| 400 | The request is malformed or breaks a rule that needs no state to check |
| 401 | No token, or one that is expired or not ours |
| 403 | Signed in, but the wrong role, or the account is suspended |
| 404 | Not there, or not yours |
| 409 | Well-formed, but the state forbids it: no seats, already rated, already decided |
| 429 | Too many attempts: wrong passwords at sign-in, or confirmation codes. Sign-in's says in `Retry-After` how many seconds to wait |
| 503 | A dependency the request cannot do without is down (seat holds only) |

**Roles**: P passenger, D driver, A administrator, any = any signed-in account.

## core-api

### Accounts

| Method and path | Who | What |
|---|---|---|
| `POST /api/v1/auth/register` | public | Create a passenger or driver account with exactly one of `email` or `phone`, optionally with an invitation code; returns a token. A phone number already on an account is refused (409) |
| `GET /api/v1/auth/google` | public | `clientId`, or null when Google sign-in is off |
| `POST /api/v1/auth/google` | public | `idToken` from Google, and `role` only to create an account; returns a token. 409 when no account exists and no role was given |
| `POST /api/v1/auth/login` | public | Exactly one of `email` or `phone`, with `password`. Returns a token valid for 12 hours. After 5 wrong passwords for one address in 15 minutes, 429 until the window ends, even with the right password |
| `GET /api/v1/me` | any | The signed-in account |
| `GET /api/v1/me/referral` | any | Own invitation code, how many used it, and how many of them have completed a trip |
| `GET /api/v1/bus-alternatives?from=&to=&after=HH:mm` | any | Up to five administrator-entered buses between two towns, earliest first; not checked against the operator |
| `GET/POST /api/v1/admin/bus-services`, `DELETE /api/v1/admin/bus-services/{id}` | ADMIN | List, add and remove bus services; adding and removing are audited |
| `GET/POST /api/v1/admin/stopovers`, `DELETE /api/v1/admin/stopovers/{id}` | ADMIN | Rest stops and chargers; audited. The route preview (`POST /api/v1/rides/route-preview`) now also returns `alongRoute`: those near the route, in order, with `kmAlong`, `kmOffRoute` and `suggestedBreak` |
| `GET /api/v1/users/{id}/photo`, `GET /api/v1/vehicles/{id}/photo` | any | The photo as `image/jpeg`, or 404 |
| `GET /api/v1/me/payment-details` | D | Own `{upiId, hasQr}` |
| `PUT /api/v1/me/payment-details` | D | `{upiId}`: as name@bank; blank removes it, 400 if it does not look like one, an email address included |
| `GET`, `PUT`, `DELETE /api/v1/me/payment-details/qr` | D | Own UPI QR code. The body is the image itself (JPEG or PNG, up to 5 MB); kept as a PNG |
| `PUT /api/v1/me/photo`, `DELETE /api/v1/me/photo` | any | Own photo. The body is the image itself (JPEG or PNG, up to 5 MB) |
| `PUT/DELETE /api/v1/vehicles/{id}/photo` | DRIVER, owner | A vehicle's photo; someone else's vehicle is a 404 |
| `POST /api/v1/me/document-checks`, `GET /api/v1/me/document-checks` | D | `{kind, vehicleId}`: ask VAYORA staff to see the identity document declared (`IDENTITY`) or a car's declared insurance (`INSURANCE`, with its `vehicleId`); the current check of each. 409 when nothing is declared or one is already waiting or checked |
| `GET /api/v1/admin/document-checks`, `POST /api/v1/admin/document-checks/{id}/decide` | ADMIN | The queue, oldest first; `{outcome: CHECKED or REFUSED, note}` records what was seen, audited, and tells the driver. A refusal needs a note |
| `GET /api/v1/admin/supply-gaps` | ADMIN | Days in the coming week where at least three searches on one stretch found no ride, with how many drivers were told |
| `GET /api/v1/me/push` | any | `publicKey` (null when push is off) and whether any of the member's browsers is subscribed |
| `POST /api/v1/me/push-subscriptions`, `DELETE /api/v1/me/push-subscriptions?endpoint=` | any | A browser's push subscription, as `PushSubscription.toJSON()` gives it |
| `GET /api/v1/me/profile` | any | Own profile, including phone and confirmation status |
| `PUT /api/v1/me/profile` | any | Replace own profile. A changed phone must be confirmed again |
| `POST /api/v1/me/verification/{email\|phone}/request` | any | Send a 6-digit code (simulated sender). One a minute, and ten a day per channel (429) |
| `POST /api/v1/me/verification/{email\|phone}/confirm` | any | Confirm with the code |
| `PUT /api/v1/me/id-declaration` | D | `{document}`: which identity document the driver says they hold (`AADHAAR`, `PAN`, `DRIVING_LICENCE`, `PASSPORT` or `VOTER_ID`). Only the kind is taken; nothing is checked. Returns the own profile |
| `DELETE /api/v1/me/id-declaration` | any | Remove the declaration. Returns the own profile |
| `GET /api/v1/users/{id}/profile` | any | What anyone may know about a member: no contact details. Includes the experience level |
| `GET /api/v1/me/reliability` | D | The driver's own record |

### Vehicles and rides

| Method and path | Who | What |
|---|---|---|
| `POST /api/v1/vehicles` | D | Add a vehicle |
| `GET /api/v1/vehicles` | D | Own vehicles |
| `PUT /api/v1/vehicles/{id}/insurance` | D | Declare the insurer and `insuredUntil` (not checked, no policy number) |
| `DELETE /api/v1/vehicles/{id}/insurance` | D | Remove the declaration |
| `POST /api/v1/rides/route-preview` | D | Road route through some stops, with a suggested price per leg |
| `POST /api/v1/rides` | D | Publish a ride; optionally its return and up to 8 weekly repeats, all or nothing. An electric car is refused (400) if a stretch between two stops is longer than its stated range. |
| `GET /api/v1/rides/mine` | D | Own rides |
| `GET /api/v1/rides/{id}` | any | A ride with its stops, legs, route and notes, and `startsFrom`: the earliest its driver may start it (`vayora.trip.early-start` before departure) |
| `GET /api/v1/rides/{id}/membership` | any | Whether the caller is on the ride. Used by the gateway |
| `GET /api/v1/bookings` | P | Own bookings, each with the driver's `driverId`, `driverName` and the car (`vehicle`: make, model and colour as entered) |
| `GET /api/v1/rides/search` | any | Rides with a stop near each end on a day. `sort` is `TIME` (default), `PRICE`, `RATING`, `PROXIMITY` or `BEST_MATCH`; every result carries `matchScore` (0 to 100) and `matchReasons` (codes such as `SAME_CONVERSATION` or `DIFFERENT_SMOKING`). `walkOnFootpaths` says whether `pickupWalkMinutes` and `dropoffWalkMinutes` were worked out on footpaths or are straight-line estimates. `pickupRickshaw` and `dropoffRickshaw`, where the walk is a kilometre or more, estimate an auto-rickshaw: `minutes` and `km` (`byRoad` false when they are straight lines), and `fare` in rupees with `fareTown`, `fareSource` and `fareSince` where a published meter fare is known, else null. A result with `detourMinutes` set picks the passenger up at their start: `boardingTime` is the pickup's, and `detourMinutes` is what it costs the driver. Each result also carries the driver's `driverRidesCompleted` and `driverRidesWithdrawn`, a rough `pickupWalkMinutes` and `dropoffWalkMinutes`, `suggestFlexible`, `insurer` and `insuredUntil` as the driver declared them, only while they cover the trip's date, and `underWay` for a ride already on the road (offered only from a stop it is due at 30 minutes or more ahead, and only if it confirms instantly) |
| `GET /api/v1/rides/availability` | any | Seats left now on up to 30 stretches, each `stretch=rideId:fromSeq:toSeq`, counted as a search counts them, with the ride's `status`. For a screen keeping its results current: unlike a search it writes nothing to the event log, so it does not bend completed rides per 100 searches |

Search takes `originLat`, `originLon`, `destLat`, `destLon`, `date`, and optionally
`seats` (default 1), `sort` (`TIME`, `PRICE`, `RATING`, `PROXIMITY`), and filters
`earliestHour`, `latestHour`, `maxPrice`, `instantOnly`, `confirmedDriver`, `smokeFree`,
`petsWelcome`, `maxTwoInBack`, `womenOnly`, `minPrice`, `musicWelcome`, `quietRide`,
`comfortAtLeast` (`BASIC`, `COMFORT`, `PREMIUM`), `luggageAtLeast` (`NONE`, `SMALL`,
`MEDIUM`, `LARGE`). A filter only ever narrows the result.
A women-only ride is never returned to a passenger whose profile does not say she is a
woman, filter or no filter.

### Booking

| Method and path | Who | What |
|---|---|---|
| `POST /api/v1/holds` | P | Hold seats for 5 minutes. Not a booking |
| `GET /api/v1/holds/mine` | P | Own hold, or 204 |
| `DELETE /api/v1/holds/mine` | P | Give the hold up |
| `POST /api/v1/bookings` | P | Request seats on a stretch of a ride; nothing is paid now. Optional `tier`: `EXACT` (default), `FLEXIBLE` or `ANY_TIME`, what happens if the driver withdraws. Optional `pickupLat` and `pickupLon`: be picked up there, on the leg after `fromSeq`, if the ride offers detours; its cost is worked out again here. 409 while the passenger owes a driver for an earlier booking |
| `POST /api/v1/bookings/{id}/payment-received` | D | `{method}`, `CASH` or `UPI`: the driver says the passenger paid them what is due. 409 if nothing is due |
| `GET /api/v1/bookings` | P | Own bookings |
| `POST /api/v1/bookings/{id}/cancel` | P | Cancel; what is then owed to the driver follows the published tiers |
| `GET /api/v1/rides/{rideId}/bookings` | D | Bookings on own ride |
| `POST /api/v1/bookings/{id}/accept` | D | Accept a pending request |
| `POST /api/v1/bookings/{id}/reject` | D | Decline it; everything is returned |
| `GET /api/v1/bookings/{id}/boarding-pass` | P | Own reference and boarding code |
| `POST /api/v1/bookings/{id}/check-code` | D | Whether a code shown at pickup belongs to the booking |

`POST /api/v1/bookings` accepts an `Idempotency-Key` header. Sending the same key again
returns the booking the first request made instead of making another.

### The trip

| Method and path | Who | What |
|---|---|---|
| `POST /api/v1/rides/{id}/start` | D | Start the ride, up to an hour early |
| `POST /api/v1/bookings/{id}/call` | P, D | A masked call to the other side of a confirmed booking, from 24 hours before boarding, between confirmed phone numbers: bridged through Twilio when an account is configured (`provider: "twilio"`; 503 if Twilio refuses), simulated otherwise (`provider: "mock"`). Returns `{provider, calleeName}` and never a number; the other side is notified |
| `POST /api/v1/bookings/{id}/no-show` | D | Mark a passenger who did not board; their seat goes back on sale for later stops |
| `POST /api/v1/rides/{id}/complete` | D | Complete the ride and pay out |
| `POST /api/v1/rides/{id}/cancel` | D | Withdraw the ride; passengers owe nothing and are told of other rides |
| `POST /api/v1/rides/{id}/cancel-series` | D | Withdraw every ride still to run in this ride's series |

### Money

| Method and path | Who | What |
|---|---|---|
| `GET /api/v1/payment-terms` | any | `cancellationTiers`: `{atLeastHoursBefore, owedShare}`, earliest first; later than the last, the whole fare is owed |
| `GET /api/v1/bookings/{id}/pay-driver` | P | `{driverName, upiId, hasQr}` for own booking, once it is confirmed or while it owes something; 404 otherwise |
| `GET /api/v1/bookings/{id}/pay-driver/qr` | P | The driver's QR code under the same rule; never cached |
| `GET /api/v1/payments` | P | Own bookings as what each costs and owes: `{status, amountDue, dueReason, method, paidAt}`. `status` is `DEFERRED`, `DUE`, `SETTLED` or `VOID` |
| `GET /api/v1/earnings` | D | What passengers owe the driver (`status: "DUE"`) and what the driver said they paid (`SETTLED`, with `method`) |
| `GET /api/v1/bookings/{id}/receipt` | P | PDF receipt once the driver says they were paid |
| `GET /api/v1/bookings/{id}/receipt-data` | P | The same receipt as JSON, names and stops as written, for the app to show in the reader's language: `{bookingId, passenger, driver, fromStop, toStop, seats, boarding, status, paidAt, method, fare, paid, reason}` |

### After the trip, and safety

| Method and path | Who | What |
|---|---|---|
| `POST /api/v1/bookings/{bookingId}/rating` | P, D | Rate the other side of a completed booking, once |
| `GET /api/v1/ratings/pending` | any | Completed trips the caller has not rated |
| `POST /api/v1/reports` | P, D | Report a member one has shared a booking with |
| `POST /api/v1/bookings/{id}/trip-confirmation` | P | Say whether a completed trip happened, once |
| `GET /api/v1/admin/disputed-trips` | A | Completed trips their passenger says did not happen |
| `GET /api/v1/me/emergency-contacts` | any | Own emergency contacts |
| `POST /api/v1/me/emergency-contacts` | any | Add one, up to three |
| `DELETE /api/v1/me/emergency-contacts/{id}` | any | Remove one |
| `POST /api/v1/sos` | P, D | Raise an alert. The answer says whether anyone was really messaged (not by default: only with a Twilio account configured), how many contacts were told, and `contactsMissed`: how many texts could not be sent |

### Notifications

| Method and path | Who | What |
|---|---|---|
| `GET /api/v1/notifications` | any | The newest 50 |
| `GET /api/v1/notifications/unread-count` | any | How many are unread |
| `POST /api/v1/notifications/{id}/read` | any | Mark one read |
| `POST /api/v1/notifications/read-all` | any | Mark all read |
| `GET /api/v1/notifications/preferences` | any | Whether copies go by email and SMS |
| `PUT /api/v1/notifications/preferences` | any | Change that |

### Administration

| Method and path | Who | What |
|---|---|---|
| `GET /api/v1/admin/overview` | A | Counts of users, rides and bookings by state |
| `GET /api/v1/admin/users?q=` | A | Find members by name or email; at most 100 |
| `POST /api/v1/admin/users/{id}/reinstate` | A | Lift a suspension |
| `GET /api/v1/admin/reports?status=` | A | The reports queue |
| `POST /api/v1/admin/reports/{id}/resolve` | A | Dismiss, warn or suspend |
| `GET /api/v1/admin/sos` | A | Unacknowledged emergency alerts |
| `POST /api/v1/admin/sos/{id}/acknowledge` | A | Acknowledge one |
| `GET /api/v1/admin/mock-outbox` | A | What the simulated sender was asked to send, including confirmation codes |
| `POST /api/v1/admin/hazard/score` | A | Score confirmed bookings now |
| `GET /api/v1/admin/hazard/scores` | A | The newest durability estimate of each live booking |
| `GET /api/v1/admin/audit` | A | The newest 100 administrative actions |
| `GET /api/v1/admin/rides?status=` | A | The newest 100 rides |
| `GET /api/v1/admin/bookings?status=&owing=` | A | The newest 100 bookings, with `paymentStatus` and `amountDue`; `owing=true` for those still owing a driver |
| `POST /api/v1/admin/bookings/{id}/clear-due` | A | `{reason}`: lets the passenger off what is owed, when a driver who was paid will not mark it. The reason goes in the audit log; both sides are told it was cleared |

### Health

`GET /actuator/health`, public.

## intel

Base URL `http://localhost:8000`. Holds nothing. The model and the scheduler have no
authentication: they are called by core-api and by research code and are not meant to be
reachable from a browser. The what-if runs are: an administrator's browser calls them
with the session token core-api issued, which intel checks itself (HS256, issuer
`vayora-core-api`, not expired, role `ADMIN`).

| Method and path | Who | What |
|---|---|---|
| `GET /health` | any | Liveness |
| `POST /v1/hazard/score` | core-api | The probability a booking lasts to a horizon, given its nine features and the time elapsed. Says `trained_on: synthetic` |
| `POST /v1/scheduler/plan` | core-api, research | Which bookings to ask to reconfirm, given candidates and limits. Never recommends cancelling |
| `GET /v1/whatif/sweeps` | ADMIN | The sweeps that can be run live, each with its setting and the values it may take |
| `GET /v1/assistant` | any signed-in member | `{enabled, provider, max_messages, max_message_chars}`: whether the assistant is on (intel has the key of the service in use, `GEMINI_API_KEY` or `ANTHROPIC_API_KEY`), which service answers (`gemini` or `claude`, so the page can say where questions go) and how much one question may carry |
| `POST /v1/assistant/reply` | any signed-in member | `{messages: [{role, content}], language}`, the conversation so far ending with the member's question, roles `user` and `assistant` only, language `en`, `hi` or `mr`: `{reply, declined}`, `reply` null when declined. Kept nowhere. 422 beyond the limits or for another role or language, 400 if the last message is not the member's, 503 when off or when no answer could be had, with the reason |
| `POST /v1/whatif/run` | ADMIN | `{sweep, value, seeds}` (2 to 30 seeds): the sweep's variant and baseline at that value, simulated now. Means and the mean paired difference of completed rides per 100 searches and the late share, with seeds up and down; no interval. Exploratory, kept nowhere. 400 outside the sweep's bounds, 404 for a sweep not offered live, 503 if intel has no `JWT_SECRET` |

## gateway

Base URL `http://localhost:3000`. `GET /health` over HTTP; everything else is Socket.IO.
A connection must present the same token core-api issued, as `auth.token`.

| Client sends | With | Answer |
|---|---|---|
| `ride:join` | `{rideId}` | The last 50 messages and the latest position, if the caller is on the ride |
| `ride:leave` | `{rideId}` | |
| `chat:send` | `{rideId, body}` | Refused if empty, over 500 characters, or more than 10 in 10 seconds |
| `location:update` | `{rideId, lat, lon}` | Drivers only, only while the ride is under way, at most once a second |

| Server sends | To | Carries |
|---|---|---|
| `chat:message` | Everyone on the ride | The message, with its sender and time |
| `location` | Everyone on the ride | The driver's latest position |

Membership is asked of core-api and re-checked every 15 seconds, so a passenger who
cancels stops receiving the ride's messages shortly after.
