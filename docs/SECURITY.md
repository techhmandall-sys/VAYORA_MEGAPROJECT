# Security

What protects the platform today, how each protection is checked, and what is missing.
This is a student project that has had no external security review and no penetration
test. It must not be put on the public internet as it stands; the last section says why.

## What is in place

### Passwords and sign-in

| Control | Detail | Checked by |
|---|---|---|
| Passwords are hashed | BCrypt; 8 to 72 characters accepted | `ApiIntegrationTest` reads the stored value |
| A forgotten password is reset with a code, and neither step says whether an account exists | A six-digit code goes to the account's email or phone, to the simulated outbox unless a real sender is set. It is kept as a BCrypt hash in `password_reset_codes`, lasts 10 minutes, is spent by 5 wrong guesses and is replaced by a new one. Asking always gets the same answer: when the address is unknown, the account suspended, or a code went out too recently or too often. Every failed reset gets one answer too. Passengers and drivers only. A reset lifts the lock that wrong passwords set. Response times are not made fully equal: a real email or SMS service takes longer to send than to send nothing | `PasswordResetIntegrationTest` |
| Signing out ends the session | `POST /api/v1/auth/logout`, and deleting the account, keep the token's SHA-256 digest in Redis until the token would have expired. core-api then answers it with a 401, "Your session has ended. Sign in again." Without Redis nothing is revoked, and signing out only forgets the token in the browser | `TokenRevocationIntegrationTest` |
| A wrong password says nothing about the account | Same 401 whether or not the email exists, and whether or not the account is suspended | `ApiIntegrationTest`, `ModerationIntegrationTest` |
| Password guessing is slowed | After 5 wrong passwords for one email address or phone number in 15 minutes, signing in with it is refused, the right password included, until the window ends (429 with `Retry-After`). An address nobody has is counted the same, so the answer still says nothing. Redis keeps a digest of the address, not the address. Without Redis nothing is counted | `SignInThrottleIntegrationTest` |
| Tokens are signed | HS256, 12 hours, secret of at least 32 bytes; core-api refuses to start with a shorter one | Startup validation |
| Administrators cannot sign up | Created only from `ADMIN_EMAIL` and `ADMIN_PASSWORD` at startup; password of 12 characters or more | `ApiIntegrationTest` |

### Who may do what

| Control | Detail | Checked by |
|---|---|---|
| Every endpoint needs a token | Except sign-up, sign-in, the health check and the API's description (`/v3/api-docs`, `/swagger-ui.html`), which lists endpoints but opens none | 401 tests on each controller, `ApiDocsIntegrationTest` |
| Roles are enforced on the server | `@PreAuthorize` on each endpoint; the screens hiding a button is not the control | 403 tests on each controller |
| Ownership is enforced on the server | A booking, ride, vehicle, contact or notification that is not the caller's answers 404 | Per-feature integration tests |
| A suspended account is stopped at once | Checked on every request, so a token issued before the suspension stops working | `ModerationIntegrationTest` |
| A deleted account is stopped at once | Every session ends at its next request, not only the one that asked (401). An administrator cannot reinstate the account, and it is not listed or counted as a member | `AccountDeletionIntegrationTest` |
| Chat is members only | The gateway asks core-api, with the user's token, whether they are on the ride, and asks again every 15 seconds | `realtime.test.js`, live check |

### Data people would not want shared

| Control | Detail | Checked by |
|---|---|---|
| A simulated call returns no phone number | The answer names the other side and nothing else; only confirmed numbers may be put through, as a real relay would require | `CallIntegrationTest` |
| Public profiles carry no contact details | No email, phone, birth year or gender. Gender is used, unshown, to decide who may see and book a women-only ride | `RatingFlowIntegrationTest`, `AccountIntegrationTest` |
| Confirmation codes are stored only as hashes | Expire in 10 minutes, work once, are spent after 5 wrong guesses; one a minute and ten a day per channel | `AccountIntegrationTest` |
| Search positions are coarsened in the research log | Three decimals, about 100 metres | `RoutingIntegrationTest` |
| The model never sees a passenger's latent type | And scores are visible to administrators only | `sim/tests`, `HazardScoringIntegrationTest` |
| GPS points expire | 7 days, by a database TTL | Gateway live check |
| Staff checks of a document keep no number and no copy | The driver shows the original to an administrator, who records only the outcome: there is no field for either, and a number sent along is kept nowhere. Every decision is audited. It is a person's check, not the issuer's | `DocumentCheckIntegrationTest` |
| A photo keeps only its pixels | Every upload is decoded and written again as a JPEG, which drops metadata such as where a phone photo was taken. Files over 5 MB, or claiming over 40 million pixels, are refused before decoding | `PhotoIntegrationTest` |
| A member can take a copy of their data | `GET /api/v1/me/export`, one JSON document: the account (without the password), profile, emergency contacts, notification choices, vehicles, UPI details, document checks, rides offered, bookings, ratings given and received, emergency alerts and notifications | `AccountDeletionIntegrationTest` |
| A member can delete their account | `DELETE /api/v1/me` removes these: name, email, phone, password, Google link, referral code and declared document; profile, photo, emergency contacts and codes; notification choices, push subscriptions and UPI details; vehicle photos and notifications. It also withdraws document checks. The address and number are free for a new account. Refused while the member drives or holds a seat on a ride still to come. What stays, and why, is in KNOWN_LIMITATIONS | `AccountDeletionIntegrationTest` |

### Integrity

| Control | Detail | Checked by |
|---|---|---|
| The audit log cannot be rewritten | The same | `ModerationIntegrationTest` |
| Every administrative action is audited | Report decisions, reinstatements, SOS acknowledgements | Same |
| A retried booking cannot book twice | Idempotency key with a unique index | `DirectPaymentIntegrationTest` |
| A driver's UPI details reach only their own passengers | Only for the passenger's own booking, once confirmed or while it owes something; someone else's looks like none. The QR code is never cached | `DirectPaymentIntegrationTest` |
| No payment credentials are held | A UPI ID is an address to pay into, not a secret. There are no cards, PINs or provider keys, and VAYORA never touches the money | There is nothing to test |
| A QR code is only ever pixels | Decoded and written again as a PNG, with the same limits as a photo, so nothing else in the file is kept | `DirectPaymentIntegrationTest` |
| Seats cannot be oversold | Row lock and a conditional update | 8-way concurrency test |

### Input and output

| Control | Detail |
|---|---|
| SQL is parameterised | No caller text is ever spliced into a query. Where a query is assembled (search sort and filters) the pieces are constants chosen by a flag |
| Requests are validated | Bean validation on every body and parameter; a bad query is a 400, not a 500 |
| Text people type is shown as text | Reviews, bios, notes, chat and report details are rendered by React as text nodes, never as HTML. Tests feed markup in and check it comes out as characters for reviews, ride notes and chat; bios and report details rely on the same mechanism untested |
| A search wildcard is text | `%` typed into the member search matches nothing |
| A Google sign-in is checked before it is trusted | The ID token's signature against Google's published keys, its issuer, that it was issued for our client ID, that it has not expired, and that Google confirmed the email. An existing account is linked only through such a confirmed address. `GoogleSignInIntegrationTest` signs tokens with another key, for another app, from another issuer, expired and unconfirmed, and each is refused |
| Push goes only to push services | A browser names the address its push service accepts messages at. Only HTTPS addresses at the configured push services (Google, Mozilla, Microsoft, Apple) are accepted, so a member cannot make the server send requests to an internal or chosen address. `PushIntegrationTest` tries localhost, a cloud metadata address, a look-alike host and a user-info trick |
| Push messages are encrypted for the browser | RFC 8291: only the subscribing browser can read one; the push service cannot |

### Browsers

- CORS allows only the configured origins, and only GET, POST, PUT and DELETE.
- No cookies are used, so there is no cross-site request forgery surface; CSRF protection
  is off for that reason, not by oversight.
- The web server sends `X-Content-Type-Options: nosniff`, a referrer policy,
  `X-Frame-Options: DENY` and a permissions policy that refuses the camera, and the microphone
  to anything but VAYORA's own pages (for a question asked out loud to the assistant, from
  2026-11-08), and does not name its version.
- Online, the edge server (`infra/edge/Caddyfile`) adds HSTS and a content security policy for
  the app's pages:
  - scripts only from VAYORA itself and Google's sign-in, and frames only Google's sign-in;
  - images only from VAYORA and the map's tile servers;
  - connections only to VAYORA's own address and Google's sign-in;
  - no plugins, and no framing by other sites.

  No script is written into a page, so none needs an exception. On 2026-11-12 the built app's
  public pages were loaded in Edge under exactly that policy, Google's button included, and
  nothing was refused. Pages behind sign-in have not been loaded that way.

### Containers

- core-api and intel run as unprivileged users inside their images, and core-api's JVM
  exits on running out of memory rather than limping on.

### Predictions about people

The durability model estimates how likely a booking is to last. The rules it is held to:

- A booking is never cancelled because of an estimate. The only action is to ask.
- An estimate is not shown to drivers or passengers and does not change a price.
- It is trained on simulated data and says so in every response.

## What is missing

Listed so nobody mistakes the section above for the whole picture.

| Gap | Consequence |
|---|---|
| **Rate limiting is per account only**, and only on sign-in and confirmation codes | One address cannot be guessed at quickly, but one client can try a few passwords against each of many addresses. Anyone can lock a member's password sign-in for 15 minutes by guessing wrong on purpose. Nothing else is limited |
| **Only core-api checks whether a token was revoked**, and only while Redis is up | The gateway and intel check a token's signature and expiry alone. A revoked token is put out of a ride's chat within 15 seconds, when the gateway asks core-api again. It still reaches the assistant, and an administrator's still reaches live what-if runs, for up to 12 hours. There is no refresh token: a session lasts 12 hours |
| **Resetting a password does not end other sessions** | A session signed in before the reset lasts until its token expires, up to 12 hours |
| **The token is in `sessionStorage`** | Any script running on the page can read it. Online, the content security policy limits which scripts can run; on a local run nothing does |
| **No HTTPS on a local run**, only in the online setup (`docker-compose.prod.yml`), which has never run on a real server | Locally, tokens and passwords cross the network in the clear |
| **Sign-up reveals whether an email is registered** | By its 409 |
| **One shared signing secret** between core-api and the gateway | A compromise of either lets an attacker mint tokens for both |
| **intel has no authentication** except on live what-if runs and the assistant | Anyone who can reach its port can call the model and the scheduler. It holds no data. The online setup keeps its port closed and passes on only `/v1/whatif/*` and `/v1/assistant`, which check a token themselves |
| **Databases have development passwords** and their ports are published to the host on a local run | In `docker-compose.yml` for convenience. The online setup demands a real PostgreSQL password and closes the ports, but MongoDB and Redis still have no password of their own |
| **Administrators can read every code the simulated sender sends**, password reset codes included | In the simulated outbox. With a reset code, an administrator could take over a member's account. The outbox must not exist alongside a real sender |
| **No content security policy and no HSTS on a local run** | Only the online setup's edge server adds them |
| **Deleting an account leaves the member's chat messages** | In the ride's chat, under the name they were sent with. core-api does not write to the gateway's chat |
| **Only the JavaScript dependencies have been scanned**, by `npm audit` (2026-10-24) | None in the gateway or in what the browser runs, after moving to zod 4 and body-parser 1.20.9. Three moderate remain in Tailwind 3's build tools, which parse only the project's own CSS. Java and Python dependencies and the images are unscanned |
| **Chat is not moderated** and is kept indefinitely | |

## Before any real use

At the least: the online setup (`docker-compose.prod.yml`), which gives HTTPS, closed ports and intel
and the databases on a private network, tried on a real server; real secrets from a secret store;
rate limiting by client as well as by account; revoked tokens refused by every service, and every
session ended by a password reset; the mock sender replaced and the outbox removed; and a review by
someone who does this for a living.
