# VAYORA mobile

The Android app: a passenger's and a driver's VAYORA on a phone, in English, Hindi and Marathi.
Built with Expo and React Native, in the TypeScript the web app is written in, and talking to the
same core-api and gateway the web app talks to. Nothing here holds data of its own.

| Passengers | Drivers | Both |
|---|---|---|
| Search by town, day and seats | Add a vehicle | Sign up and sign in by email or phone |
| See a ride's route, stops, driver and fare | Publish a ride: stops, time, seats, the route's suggested prices | Notifications, in the reader's language |
| Book or request, and cancel | Accept or decline requests | Chat on a ride |
| A boarding code | Start, complete or cancel a ride | The driver's position on the map |
| Rate the driver | Share position while on the road | Language, sign out |

Administrators use the website. So do profiles, photos, emergency contacts, document checks, UPI
details and the assistant: the app says so and does not duplicate them.

## Run it on your phone, in a day

Nothing to install on the phone but **Expo Go** (free, Play Store). On this computer:

```sh
cd mobile
npm ci
npx expo start
```

A QR code appears. Scan it with Expo Go on a phone **on the same Wi-Fi**. The app opens, already
pointed at this computer's VAYORA (`http://<this computer's address>:8080`, read from the Expo
connection). VAYORA itself must be running: `run.bat`, or `docker compose up -d --wait` in the
repository's folder.

If the phone cannot reach the server, the sign-in screen's **Server** card says what address it is
trying; change it to this computer's Wi-Fi address and port 8080 (`ipconfig` shows the address). A
firewall prompt for Node on the computer must be allowed. Once VAYORA is online, enter its `https://`
address instead.

**In a browser**, for a quick look without a phone: `npx expo start --web` opens it at phone width.
The map and the chat work there too.

## An APK to install or hand out

Built in Expo's cloud, free for a student account, no Android Studio needed:

```sh
npx eas-cli@latest login       # an Expo account, made at expo.dev
npx eas-cli@latest build --platform android --profile preview
```

It prints a link to download the `.apk` when done (about 15 minutes). Install it on any Android
phone by opening the file. `eas.json` defines `preview` (an APK) and `production` (an app bundle
for the Play Store, which charges a one-time fee).

The APK is signed by Expo's cloud with a key it keeps for this project, so later builds install over
earlier ones.

## How it is put together

| Path | What |
|---|---|
| `app/` | The screens, one file each. Expo Router makes a route of every file: `(tabs)/` holds the tab bar's five screens, `book/[rideId]`, `ride/[id]` and `chat/[rideId]` take an id |
| `src/api.ts` | core-api over HTTP, as the web app calls it: bearer token, JSON, errors as the problem document's `detail` |
| `src/auth.tsx` | The session, kept in the phone's secure storage until the token expires |
| `src/settings.tsx` | The server address and the language, and `t()` for every word shown |
| `src/realtime.ts` | The gateway's Socket.IO events for chat and position |
| `src/RideMap.tsx` | A ride's route on OpenStreetMap tiles (Leaflet in a WebView, as the web app draws it): no map key |
| `src/shared/` | Copied from `web/src/lib`: the Hindi and Marathi tables and the list of places. `npm run sync-shared` refreshes them |
| `src/locales.ts` | The few words only the app uses, in Hindi and Marathi |
| `scripts/check-translations.mjs` | Fails if the app shows a sentence the tables cannot translate |

Times are shown in India's time zone whatever the phone's is, and money with Latin digits in every
language, as the web app does.

## Checks

```sh
npm run typecheck                      # TypeScript, strict
node scripts/check-translations.mjs    # every sentence shown has Hindi and Marathi
npx expo-doctor                        # Expo's own checks of the project
```

On 2026-11-12 the app's web build was driven end to end in a phone-sized Edge against the running
stack, as a driver and a passenger at once: sign-up, a vehicle, publishing, searching, booking, the
boarding code, starting, chat both ways, the driver's position reaching the passenger's map,
completing, rating, notifications, and Hindi. All 14 steps passed with no page errors. The same code
runs in Expo Go; the APK has not yet been built or run on a phone.

## What it does not do

- Google sign-in, photos, voice questions and push notifications: the website has them.
- A driver's position is shared only while the chat screen is open, as on the website.
- Pickups off the stops, flexible bookings, women-only rides and search filters: the website.
- `usesCleartextTraffic` is on so the app can reach a laptop over plain `http://` during a demo. It
  would be turned off for a release that talks only to the `https://` site.
