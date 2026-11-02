# Architecture

How VAYORA is put together and why. For what each part can do today, see
FEATURE_MATRIX.md; for what it cannot, KNOWN_LIMITATIONS.md.

## The parts

```
                 browser
                 /     \
        HTTPS   /       \  WebSocket
               v         v
          core-api     gateway ----> MongoDB (chat, GPS)
          /  |  \  \       |
         /   |   \  \      +----> core-api   "is this user on this ride?"
        v    v    v  v
 PostgreSQL Redis intel OSRM
 + PostGIS         |
     ^             | (no store)
     |
 research code (sim, experiments) writes the same event log
```

| Part | Technology | Owns | Holds state? |
|---|---|---|---|
| `web/` | React 18, TypeScript, Vite, Tailwind | Rendering | A session token in the browser tab |
| `core-api/` | Spring Boot 3, Java 21, JdbcTemplate, Flyway | Every transaction and every fact | No; PostgreSQL does |
| `intel/` | FastAPI, Python 3.11 | Inference: the survival model and the contact scheduler; and for an administrator, a live run of the simulator that is kept nowhere | No |
| `gateway/` | Express 4, Socket.IO 4 | Live streams: ride chat and driver position | Only who is connected |
| PostgreSQL 16 + PostGIS | | Users, vehicles, rides, routes, bookings, payments, ratings, moderation, the event log | Yes |
| MongoDB 7 | | Chat messages, GPS points, in-app notifications | Yes |
| Redis 7 | | Seat holds and the route cache | Yes, all of it disposable |
| OSRM | | Road routes, on the corridor as shipped; elsewhere the app shows a labelled straight line | A prebuilt road graph |

## The rule that settles where things go

- core-api owns transactions and truth.
- intel owns inference and holds no state.
- gateway owns ephemeral streams only.
- web renders.
- **No service forwards a request on another's behalf.** The browser calls core-api for
  facts, the gateway for streams, and intel for one administrator's tool only: a live
  what-if run (feature 87). The gateway does not proxy to core-api and core-api does not
  proxy to intel for the browser; intel checks the administrator's token itself, as the
  gateway does.

Two places where one service calls another, and why neither breaks the rule:

- **core-api calls intel** to score a booking. core-api supplies the features and stores
  the result; intel computes and forgets. If intel is down, the booking still happens
  and simply has no score.
- **gateway calls core-api** with the user's own token to ask whether that user is on a
  ride. It asks a question core-api owns the answer to; it does not act for the user.

## Where each kind of data lives

No entity lives in two stores, so there is nothing to keep in step.

| Store | What | Why there |
|---|---|---|
| PostgreSQL | Anything that must be right: seats, money, who booked what | Transactions and row locks |
| PostGIS | Stop positions and route lines | Distance queries with a spatial index |
| MongoDB | Chat, GPS points, notifications | Written often, read by key, losing one hurts nobody's booking |
| Redis | Seat holds, cached routes | Expire on their own; the system is correct without them |

Things Redis does **not** hold: sessions. Sign-in is a signed token the browser keeps, so
there is no server-side session to store.

## How a booking stays correct

Seats are counted per leg of a ride (`ride_segments`), so a passenger travelling
Karad to Satara does not take a seat from someone travelling Satara to Pune.

A booking request runs in one database transaction:

1. Lock the ride row (`SELECT ... FOR UPDATE`).
2. Leave alone any seats another passenger is holding (asked of Redis; an outage means
   no holds, not no booking).
3. Take the seats with one conditional `UPDATE` on every leg at once. If any leg is
   short, the count comes up short and the transaction rolls back.
4. Insert the booking, place the payment hold, write the events.

Locks are always taken in the order ride, booking, segments, so two operations on the
same ride cannot deadlock. Eight simultaneous requests for one last seat produce exactly
one booking; a test does this on every run.

Money is simpler still, because none passes through the platform: passengers pay their driver
directly, and each booking records only what it owes when it ends and whether the driver says it was paid.

## The event log

Every research number is a SQL aggregate over one table, `events`, through
`experiments/analysis/metrics.sql`. Two writers fill it with the same 24 event types:

- core-api, from real use of the platform. Its writer never throws into its caller: a
  lost research row must not cost anyone a booking.
- the simulator, through `vayora_events`. Its writer fails loudly: a simulation with
  missing rows is worthless.

Because both write the same vocabulary, the queries that analyse a simulation would
analyse real use unchanged.

## The research side

`sim/` is a discrete-event simulator of the corridor. `experiments/` trains the survival
model, runs variants across 30 seeds each, and compares them seed by seed. The
simulator imports the model and the scheduler from `intel/` directly, so what is
simulated is the code that is served.

What the simulator knows and the model must not: each simulated passenger has a latent
type that drives their behaviour. It never appears in an event payload or a feature, and
tests check both.

## Sign-in and roles

core-api issues an HS256 token on sign-in. The gateway verifies the same token with the
same secret, so a user signs in once. Each account has one role (passenger, driver or
administrator); administrators cannot sign up and are created from configuration at
startup. Every request re-checks that the account is not suspended. See SECURITY.md.

## Routing

core-api asks OSRM for the road route through a ride's stops when the ride is published,
stores the line with the ride, and caches the answer in Redis. If OSRM is unavailable
the stops are joined with straight lines and the route is labelled `STRAIGHT_LINE`, so a
straight-line estimate is never shown as a road distance.

## What is simulated

Nothing in this list touches the outside world, and every screen that shows one says so.

| What | How it is simulated |
|---|---|
| Email and SMS | A mock sender that writes to the server log and an administrator-only outbox |
| SOS messages to emergency contacts | The same mock sender; nobody is contacted |
| Identity checks | None exist. "Confirmed" means a code from the mock sender was typed in |
| Passenger behaviour in experiments | The simulator; every parameter is an assumption |
