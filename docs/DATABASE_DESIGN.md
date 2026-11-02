# Database design

Three stores, each holding different things. The schema of record for PostgreSQL is the
Flyway migrations in `core-api/src/main/resources/db/migration/`; this document explains
them and must not be read in place of them.

## PostgreSQL 16 with PostGIS

Access is through `JdbcTemplate` with hand-written SQL. There is no ORM.

### Migrations

| Version | Adds |
|---|---|
| V1 | The PostGIS extension |
| V2 | `events`, the research log |
| V3 | `users`, `vehicles`, `rides`, `ride_stops`, `ride_segments`, `bookings` |
| V4 | Ride states `IN_PROGRESS`, `COMPLETED`; booking states `COMPLETED`, `NO_SHOW` |
| V5 | On bookings: `accepted_at`, `cancelled_by`, `hazard_features` |
| V6 | `payment_intents`, `ledger_entries`, `refunds`, `settlements`; an idempotency key on bookings |
| V7 | `ratings` |
| V8 | Account status on users; `reports`; `audit_log` |
| V9 | On rides: the route line, its distance, duration and source; a spatial index on stops |
| V10 | On users: phone and confirmation times; `profiles`, `verification_codes`, `emergency_contacts`, `sos_alerts` |
| V11 | On rides: `notes`, `max_two_in_back`, `series_id` |
| V12 | On vehicles: comfort, luggage, electric, battery, consumption |
| V13 | On rides: `women_only` |
| V14 | `passes` |
| V15 | On bookings: `rejected_by`, driver or platform |
| V16 | On bookings: `boarding_code` |
| V17 | On bookings: `passenger_confirmed`, `passenger_confirmed_at`, `rating_reminded_at` |
| V18 | `notification_preferences` |
| V19 | `referrals`; on users: `referral_code` |
| V20 | `bus_services` (entered by administrators; none shipped) |
| V21 | On users: `email` may be null if `phone` is set; `phone` unique, rewritten as +91 for Indian numbers |
| V22 | `stopovers` (rest stops and chargers, entered by administrators; none shipped) |
| V23 | `user_photos`, `vehicle_photos` (one re-encoded JPEG each, in PostgreSQL) |
| V24 | `push_subscriptions` (one row per browser; the address is unique) |
| V25 | On bookings: `flex_tier` (`EXACT`, `FLEXIBLE` or `ANY_TIME`) |
| V26 | On users: `google_sub`, the Google account a member signs in with (unique) |
| V27 | On rides: `started_at`, when the driver actually started it |
| V28 | On vehicles: `insurer` and `insured_until`, as the driver declares them (both or neither) |
| V29 | On passes: `reward_for_referee`; a reward pass is free with no payment method, one per person per referral |
| V30 | On bookings: `release_reminded_at`, so each seat is asked to be released once at most |
| V31 | On rides: `max_detour_minutes` (0 to 60, default 0); on bookings: `pickup_location`, `pickup_offset_minutes` and `detour_minutes`, all three or none |
| V32 | On users: `id_document`, the kind of identity document a driver says they hold (one of five). Never a number or a copy, and never checked |
| V33 | On sos_alerts: `contacts_missed`, the emergency texts a real provider could not send (0 with the simulated sender) |
| V34 | Unique indexes on payment_intents and passes by (provider, provider_ref): one real payment pays for one booking or one pass |
| V35 | On bookings: `last_mile_distance_m` and `last_mile_mode_shown`, the gap to the boarding stop and the access option shown, recorded once at request time for the durability model |
| V36 | Paying after the ride: `rides.pay_after_ride`; on payment_intents `deferred`, `amount_due` and `due_reason`, the statuses `DEFERRED`, `DUE` and `VOID`, the method `CASH`, and checks that only a deferred intent waits, owes or is paid in cash |
| V37 | `document_checks`: staff checks of what a driver declared |
| V38, V39 | Tax invoices and credit notes, removed by V40 |
| V40 | Paying the driver directly: drops `passes`, `ledger_entries`, `refunds`, `settlements`, the tax tables and `rides.pay_after_ride`; on `payment_intents` drops the fee, provider and deferred columns, allows only `CASH` and `UPI`; deletes simulated settled payments, moves simulated holds to `DEFERRED`; adds `driver_payment_details` |

### Tables

**People**

| Table | One row is | Notes |
|---|---|---|
| `users` | An account | Unique email, BCrypt password hash, one role, `ACTIVE` or `SUSPENDED`, optional phone, when email and phone were confirmed, the kind of identity document a driver declared |
| `profiles` | What a member says about themselves | Bio, birth year, gender, smoking, pets, music, chattiness. Every column optional; null means not said |
| `verification_codes` | A one-time code sent to an address | Only the hash is stored, with the address it was sent to, an expiry, and a count of wrong attempts |
| `emergency_contacts` | Someone to tell in an emergency | At most three per member, enforced in the service under a row lock |
| `sos_alerts` | An emergency button press | Optional ride and position; how many contacts a message was handed over for, and by which sender |

**Rides**

| Table | One row is | Notes |
|---|---|---|
| `vehicles` | A driver's car | Seats include the driver's. Battery figures only if `electric`, by a check constraint |
| `rides` | One departure | Driver, vehicle, departure time, seats offered, status, the route as a PostGIS line, optional notes, `series_id` shared by rides published together, `started_at` once under way |
| `ride_stops` | A stop on a ride | Sequence number, name, position (`geography` point, GiST index), minutes after departure |
| `ride_segments` | The leg between two consecutive stops | Price per seat, total seats, seats available. **Seat inventory lives here** |
| `bookings` | A passenger's place on a stretch of a ride | From-stop and to-stop sequence numbers, seats, fare, status, the model features as they stood at the request |

**Money**

| Table | One row is | Notes |
|---|---|---|
| `payment_intents` | What one booking costs and owes its driver | One per booking, none for a free ride. `DEFERRED` while live, then `DUE` with `amount_due` and `due_reason`, or `VOID` if it owes nothing, then `SETTLED` with `method` (`CASH` or `UPI`) once the driver says they were paid |
| `driver_payment_details` | Where a driver takes UPI | One per driver: `upi_id`, and `qr_png`, a QR code written again from its pixels |

**Trust**

| Table | One row is | Notes |
|---|---|---|
| `ratings` | One side's rating of the other after a trip | Unique per booking and rater |
| `reports` | A member's report about another | One open report per pair, by a partial unique index |
| `audit_log` | An administrative action | Append-only by trigger |

**Research**

| Table | One row is | Notes |
|---|---|---|
| `events` | Something that happened, on the platform or in a simulation | `run_id`, `variant` and `seed` identify an experimental run; rows from ordinary use of the platform have none. Payload is JSONB with snake_case keys |

### Status values

| Column | Values |
|---|---|
| `rides.status` | `SCHEDULED`, `IN_PROGRESS`, `COMPLETED`, `CANCELLED` |
| `bookings.status` | `PENDING`, `CONFIRMED`, `REJECTED`, `CANCELLED`, `COMPLETED`, `NO_SHOW` |
| `payment_intents.status` | `DEFERRED`, `DUE`, `SETTLED`, `VOID` |
| `users.status` | `ACTIVE`, `SUSPENDED` |
| `reports.status` | `OPEN`, `RESOLVED`, `DISMISSED` |
| `sos_alerts.status` | `OPEN`, `ACKNOWLEDGED` |

Allowed booking transitions are defined in one place, `BookingStatus`, and tested.

### Design choices worth knowing

- **Seats per leg, not per ride.** A ride with stops A, B, C, D has three segments. A
  booking from B to C touches one of them. This is what makes stopover bookings correct.
- **A booking takes seats with one conditional `UPDATE`** across its legs, under a lock
  on the ride row. No application-level counting.
- **The audit log cannot be rewritten.** The database
  enforces it, not the application.
- **Idempotency is a unique index**, on (passenger, key) for bookings that carry a key.
  A retried request finds the first booking instead of making a second.
- **Positions are `geography`, not `geometry`.** Distances come back in metres without a
  projection, and the 5 km search limit is a `ST_DWithin` on an indexed column.
- **Features are snapshotted on the booking** (`hazard_features`) so a score can be
  reproduced later from what was known at the time.

### Not in the schema

- No table for seat holds: they live in Redis (below).
- No table for chat, GPS or notifications: MongoDB.
- No soft delete. Nothing a user creates can be deleted through the API except an
  emergency contact, which is deleted outright.

## MongoDB 7

| Collection | Written by | One document is | Kept |
|---|---|---|---|
| `notifications` | core-api | A message for one user, with a type, an optional booking, and when it was read | Indefinitely |
| `chat_messages` | gateway | One chat message on a ride | Indefinitely |
| `gps_traces` | gateway | One reported driver position | 7 days, by a TTL index |

core-api writes a notification only after the database transaction that caused it
commits, so nobody is told about something that was rolled back.

## Redis 7

Everything in Redis may be lost at any time without making anything wrong.

| Key | Type | Holds | Expires |
|---|---|---|---|
| `osrm:<the stops' coordinates>` | string | A cached road route | 7 days |
| `holds:<ride id>` | sorted set | Members `passenger:from:to:seats`, scored by when each lapses | With its last member |
| `hold:of:<passenger id>` | string | That passenger's one hold | 5 minutes |

A seat hold never changes a count in PostgreSQL. Booking and search subtract live holds
by other passengers from what PostgreSQL says is free; if Redis cannot be reached they
subtract nothing.
