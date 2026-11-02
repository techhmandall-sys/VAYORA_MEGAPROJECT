# Running and deploying

How to run VAYORA on one machine, which is the only way it has ever been run. Nothing
here describes a production deployment, because there has not been one; the last
section lists what one would need.

## What you need

Docker Desktop (or Docker Engine with Compose v2). Nothing else: Java, Python and Node
all run inside containers. Node on the host is needed only to run the web tests or the
development server.

## Start everything

```sh
docker compose up -d --wait
```

The first start downloads an OpenStreetMap extract for western India (about 220 MB) and builds a
road graph for the corridor, which takes several minutes. Later starts reuse it.

| Service | Address | What it is |
|---|---|---|
| web | http://localhost:5173 | The app |
| core-api | http://localhost:8080 | The API; health at `/actuator/health` |
| gateway | http://localhost:3000 | Chat and live position; health at `/health` |
| intel | http://localhost:8000 | The model, the scheduler and live what-if runs; health at `/health` |
| osrm | http://localhost:5000 | Road routing |
| postgres | localhost:5432 | Database `vayora`, user `vayora` |
| mongo | localhost:27017 | |
| redis | localhost:6379 | |

To start without road routing (routes become straight lines, labelled as such):

```sh
docker compose up -d --wait postgres mongo redis core-api intel gateway web
```

## Configuration

Every setting has a working default in `docker-compose.yml`. To change one, copy
`.env.example` to `.env` and edit it. `.env` is ignored by git; do not commit one.

| Variable | Default | Notes |
|---|---|---|
| `JWT_SECRET` | a public development value | At least 32 bytes. core-api signs with it; the gateway, and intel for live what-if runs, verify with it, so all three must have the same one. **Change it** |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | empty | Set both to have an administrator created when core-api starts. The password needs 12 characters or more. There is no other way to make one |
| `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD` | `vayora` | |
| `PG_VOLUME` | `vayora_pgdata` | The Docker volume holding the database. A database made before the project was renamed from JOURNEX is in `journex_pgdata`; set this to keep using it |
| `CORS_ALLOWED_ORIGINS` | `http://localhost:5173` | Where the browser app is served from, for core-api, the gateway and intel. Change it together with `WEB_PORT` |
| `*_PORT` | see the table above | Change one if the port is taken |
| `OSRM_PBF_URL`, `OSRM_BBOX` | western India, clipped to the corridor | [Road routes across India](#road-routes-across-india) |
| `VAYORA_PUSH_PUBLIC_KEY`, `VAYORA_PUSH_PRIVATE_KEY` | empty | Push notifications are off unless both are set. `node scripts/vapid-keys.mjs` prints a new pair. Keep the private key secret; a new pair makes every browser subscribe again |
| `GOOGLE_CLIENT_ID` | empty | "Sign in with Google" is off unless set: a Web application OAuth client ID from the Google Cloud console, with the web app's address as an authorised JavaScript origin. Add it to the core-api service's environment |
| `SPRING_MAIL_HOST`, `SPRING_MAIL_PORT`, `SPRING_MAIL_USERNAME`, `SPRING_MAIL_PASSWORD` | unset | An SMTP server for real email. Unset: nothing is emailed. Add them to the core-api service's environment |
| `VAYORA_MAIL_FROM` | empty | The sender address. Required once an SMTP server is set; core-api will not start without it |
| `VAYORA_PUSH_SUBJECT` | `mailto:vayora@example.invalid` | A contact push services can use about this server's messages. Set a real one before turning push on |
| `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` | empty | Payments through Razorpay. Both or neither; neither is the simulated provider. A test key (`rzp_test_...`) is Razorpay's test mode, where no real money moves; get one from the Razorpay dashboard in Test Mode, under API Keys. Keep the secret out of git |
| `VAYORA_GSTIN`, `VAYORA_LEGAL_NAME`, `VAYORA_LEGAL_ADDRESS` | empty | Tax invoices for what VAYORA itself charges, on real payments only. All three or none; none means receipts say they are not one. Needs a real GST registration, and a tax adviser to confirm the rate and SAC code in `application.yml` first. core-api will not start on half of them or on a GSTIN of the wrong form |
| `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM` | empty | Text messages and masked calls through Twilio. All three or none; none sends texts to the simulated outbox and simulates calls. `TWILIO_FROM` must be able to text and call. Twilio's test credentials with `TWILIO_FROM=+15005550006` are answered as if sent and send nothing. Real texts to Indian numbers need DLT registration |

The web app's addresses for core-api, the gateway and intel are fixed when its image is
built (`VITE_API_URL`, `VITE_GATEWAY_URL`, `VITE_INTEL_URL`). Changing `CORE_API_PORT`,
`GATEWAY_PORT` or `INTEL_PORT` means rebuilding it: `docker compose up -d --build web`.

intel's image is built from the repository root, as it carries the simulator and its
configurations for live what-if runs: `docker compose up -d --build intel` after changing
`sim/` or `experiments/configs/`.

Application settings that are not secrets (refund tiers, service fee, hold length, code
expiry, search radius) are in `core-api/src/main/resources/application.yml`. Research
settings are in `experiments/configs/`.

## The database

Flyway applies the migrations in `core-api/src/main/resources/db/migration/` when
core-api starts. There is nothing to run by hand. A migration that has been applied is
never edited; a change is a new numbered file.

Data lives in Docker volumes (`vayora_pgdata`, or whatever `PG_VOLUME` names;
`vayora_mongodata`; `vayora_osrmdata`) and survives `docker compose down`. To start from
nothing:

```sh
docker compose down -v
```

This deletes every account, ride, booking and experiment run, and the road graph.

## Developing the web app

```sh
docker compose up -d --wait postgres mongo redis core-api gateway
cd web
npm ci
npm run dev
```

## Tests

See TESTING.md. In short:

```sh
docker compose --profile test run --rm core-api-tests
docker compose up -d --wait postgres core-api
docker compose --profile research run --rm research
cd web && npm ci && npm test
cd gateway && npm ci && npm test
```

## Experiments

See EXPERIMENT_PROTOCOL.md section 4. Runs write to the same PostgreSQL as the
platform, in the `events` table, kept apart by `run_id`.

To see how far the platform's real activity is from being enough to calibrate demand and retrain the
model, which only reads the event log:

```
docker compose --profile research run --rm research python -m experiments.real_data
```

## When something does not start

| Symptom | Likely cause |
|---|---|
| `failed to connect to the docker API` | Docker Desktop is not running. Start it and wait for the engine |
| core-api exits at once | `JWT_SECRET` is shorter than 32 bytes, or `ADMIN_PASSWORD` is shorter than 12 characters |
| A port is already allocated | Something else is using it; change the matching `*_PORT` in `.env` |
| The app loads but every request fails | `CORS_ALLOWED_ORIGINS` does not match the address the app is opened at |
| Sign-in works but chat does not connect | The gateway has a different `JWT_SECRET` from core-api |
| Routes are straight lines | Outside the map, which as shipped covers Kolhapur to Pune, that is expected. On the corridor: OSRM is not running, or still building its graph. Check `docker compose logs osrm-build` |
| Walks say "in a straight line" | The walking graph (`osrm-foot`) is not running or still building. Check `docker compose logs osrm-build-foot` |
| No administrator | `ADMIN_EMAIL` and `ADMIN_PASSWORD` were not set when core-api started. Set them and restart it |

## Road routes across India

As shipped, the road graph covers a box around Kolhapur to Pune. The app takes routes anywhere in
India, and outside the box shows each as a straight line and says so. For roads everywhere, put this
in `.env`:

```
OSRM_PBF_URL=https://download.geofabrik.de/asia/india-latest.osm.pbf
OSRM_BBOX=68,6,98,38
```

then throw away the old graph and build the new one. `down` keeps the database:

```
docker compose down
docker volume rm vayora_osrmdata
docker compose up -d --wait
```

**This has not been tried here.** The file is several times the size of the western zone, and the
graph takes far more memory, disk and time to build, so expect to need a larger machine. The research
is not affected: the simulator and the experiments do not use OSRM.

## Switching on real services

The code for each of these is finished and tested against a stand-in; none has been tried with
the real service. Each needs an account of your own, and turns on when its settings are in
`.env`. Put keys only in `.env`, never in a chat, a commit or a screenshot. After changing
`.env`, run `run.bat` again. Pages and prices on these sites change, so follow what they show.

**Google sign-in (feature 2), free**

1. At console.cloud.google.com, create a project.
2. Set up the OAuth consent screen: external, named VAYORA, with your own Google address as a
   test user. While it is in testing, only test users can sign in.
3. Under Credentials, create an OAuth client ID of type "Web application". Add
   `http://localhost:5173` as an authorised JavaScript origin, and `https://<your address>` too
   once VAYORA is online.
4. Put it in `.env` as `GOOGLE_CLIENT_ID=...`. No secret is needed.
5. http://localhost:8080/api/v1/auth/google should now show it, and the sign-in page a Google
   button. Sign in once with a real account: that is the test no stand-in can do.

**Payments (feature 46), free in test mode, where no real money moves**

1. Sign up at razorpay.com and stay in Test Mode.
2. Under Account & Settings, API Keys, generate a test key.
3. Put both in `.env`: `RAZORPAY_KEY_ID=rzp_test_...` and `RAZORPAY_KEY_SECRET=...`.
4. Book a ride: Razorpay's checkout opens. Pay with one of its published test cards or test UPI
   IDs. Every screen and receipt says test mode.

**Texts and masked calls (features 64 and 61)**

1. Sign up at twilio.com, confirm your own phone number, and get a Twilio number.
2. Put all three in `.env`: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM`.
3. On My account, add your phone and ask for a code. It should arrive as a text.
4. A trial account can only reach numbers you have confirmed, and texts to Indian numbers need
   the sender registered under TRAI's DLT rules, so they may not arrive until that is done. A
   masked call costs two paid legs.

## Putting VAYORA online

`docker-compose.prod.yml` runs everything on one server behind Caddy, which gets and renews its
HTTPS certificate by itself. Only ports 80 and 443 are open: the databases and the model are
reachable only from inside, and core-api's health and metrics stay inside too. It refuses to start
without real secrets.

**You need**

- A Linux server with a public address, ports 80 and 443 open, about 2 CPUs, 4 GB of memory and
  40 GB of disk. All the services together were measured idling at 1.3 GB; the first run also
  builds images and the road graphs, which take more and have not been measured on a server.
  A student can often get credit: see the GitHub Student Developer Pack and Azure for Students.
- A domain name pointing at that server. A free subdomain such as DuckDNS's works. Without one,
  HTTPS cannot be set up.

The research database is not needed online and stays where it is: a new server starts empty.

**Steps, on the server**

```sh
curl -fsSL https://get.docker.com | sh
git clone https://github.com/techhmandall-sys/Vayora.git && cd Vayora
cp .env.production.example .env
nano .env                  # fill in the first block; openssl rand -base64 48 makes each secret
sh scripts/deploy.sh       # the first run downloads the road map and takes a while
```

Then open `https://<your address>` and sign in as the administrator you set in `.env`. To update
later: `git pull && sh scripts/deploy.sh`.

Before others use it: payments, texts and calls stay simulated until switched on, and the screens
say so. Administrators can read every confirmation code in the simulated outbox. Do not run
`scripts/demo-data.mjs` against a public server: its accounts share one password.

**Backups.** `sh scripts/backup.sh` writes the databases to `backups/<date>/`. Copy that folder off
the server, and run it from cron to make it a habit.

**Restoring a backup**, as tried on 2026-11-01 (an account was deleted and came back):

```sh
C="docker compose -f docker-compose.yml -f docker-compose.prod.yml"
$C stop core-api gateway
$C exec -T postgres sh -c 'pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists --no-owner' < backups/<date>/postgres.dump
$C exec -T mongo mongorestore --quiet --archive --gzip --drop < backups/<date>/mongo.archive.gz
$C up -d --wait core-api gateway
```

**How far this has been tried.** On one machine, with a local certificate and without the road
services: HTTPS, closed ports, each path reaching its service, a WebSocket through the edge, signing
up and searching, and a backup restored. **It has never run on a real server or with a real
certificate.** The service worker did not register against the local certificate, as browsers refuse
one; expect it to with a real one, unconfirmed.

## What a real deployment would need

The online setup above covers HTTPS, closed ports and backups. A deployment people rely on would
still need all of this, none of which exists:

- Secrets from a secret store, not from a file on the server.
- MongoDB and Redis with their own credentials. Today only their private network protects them.
- Backups taken and copied off the server automatically, with the restore practised.
- More than one core-api instance would need the simulated outbox gone (it is in
  memory) and has not been tried.
- More than one gateway instance would need a Socket.IO adapter so that a message
  reaches clients connected to another instance.
- Logs and metrics collected somewhere. Today they are container output.
- A build pipeline. Images are built on the machine that runs them.
- The work listed at the end of SECURITY.md.
