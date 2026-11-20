<div align="center">

<a name="top"></a>

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/readme/banner-dark.svg">
  <img src="docs/readme/banner-light.svg" alt="VAYORA: shared intercity rides across India. An early cancellation is a success." width="100%">
</picture>

<br>

![Status](https://img.shields.io/badge/status-final--year_project-16865A?style=for-the-badge)
![Tests](https://img.shields.io/badge/tests-1%2C029_passing-16865A?style=for-the-badge)
![Features](https://img.shields.io/badge/features-84_of_89_verified-10213A?style=for-the-badge)
![Languages](https://img.shields.io/badge/languages-English_%C2%B7_Hindi_%C2%B7_Marathi-F59E0B?style=for-the-badge)

![Java 21](https://img.shields.io/badge/Java-21-007396?style=flat-square&logo=openjdk&logoColor=white)
![Spring Boot 3](https://img.shields.io/badge/Spring_Boot-3-6DB33F?style=flat-square&logo=springboot&logoColor=white)
![React 18](https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white)
![Expo](https://img.shields.io/badge/Expo-React_Native-000020?style=flat-square&logo=expo&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-009688?style=flat-square&logo=fastapi&logoColor=white)
![Python 3.11](https://img.shields.io/badge/Python-3.11-3776AB?style=flat-square&logo=python&logoColor=white)
![PostgreSQL with PostGIS](https://img.shields.io/badge/PostgreSQL-PostGIS-4169E1?style=flat-square&logo=postgresql&logoColor=white)
![MongoDB 7](https://img.shields.io/badge/MongoDB-7-47A248?style=flat-square&logo=mongodb&logoColor=white)
![Redis 7](https://img.shields.io/badge/Redis-7-DC382D?style=flat-square&logo=redis&logoColor=white)
![Socket.IO](https://img.shields.io/badge/Socket.IO-4-010101?style=flat-square&logo=socketdotio&logoColor=white)
![Docker Compose](https://img.shields.io/badge/Docker-Compose-2496ED?style=flat-square&logo=docker&logoColor=white)

**Final-year B.Tech project · CSE (Data Science) · DYPCET Kolhapur · team of four**

[💡 Idea](#idea) &nbsp;·&nbsp;
[✨ What's different](#different) &nbsp;·&nbsp;
[🖼️ Tour](#tour) &nbsp;·&nbsp;
[🔬 Research](#research) &nbsp;·&nbsp;
[🏗️ Architecture](#architecture) &nbsp;·&nbsp;
[🚀 Run it](#quick-start) &nbsp;·&nbsp;
[🧭 Roadmap](#roadmap) &nbsp;·&nbsp;
[📚 Docs](#documents)

<br>

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/screenshots/landing-dark.jpg">
  <img src="docs/screenshots/landing.jpg" alt="VAYORA's front page: a search from Kolhapur to Pune over a photo of the Khandala ghat" width="100%">
</picture>

</div>

<br>

<a name="idea"></a>

<h2><picture><source media="(prefers-color-scheme: dark)" srcset="docs/readme/h-idea-dark.svg"><img src="docs/readme/h-idea-light.svg" alt="The idea" width="100%"></picture></h2>

> [!TIP]
> **An early cancellation is a success.** A seat released three days before departure gets refilled
> and the journey completes; the same seat released two hours before departure is destroyed capacity.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/readme/idea-dark.svg">
  <img src="docs/readme/idea-light.svg" alt="Seat A is released three days before departure, another passenger books it and the journey completes. Seat B is released two hours before departure and leaves empty." width="100%">
</picture>

VAYORA models how long a booking will last as a **survival curve over the seven-day booking horizon**,
and acts on it while action still helps: a reminder, sent to the bookings most likely to break, asks
whether plans have changed. The research runs on one corridor, **Kolhapur to Pune (~230 km)**; the
app itself serves routes anywhere in India.

The measure is **completed rides per 100 searches**, never bookings: a platform can take more bookings
and still move fewer people.

**🗺️ Explore the research corridor.** Drag and zoom: the road route the app computes with OSRM, 235.9 km
through Karad and Satara. Click a stop to see how far it is from Kolhapur.

```geojson
{"type":"FeatureCollection","features":[{"type":"Feature","properties":{"name":"Kolhapur to Pune by road","distance":"235.9 km, as OSRM routes it on OpenStreetMap","stroke":"#16865A","stroke-width":5,"stroke-opacity":0.9},"geometry":{"type":"LineString","coordinates":[[74.2433,16.705],[74.2517,16.7075],[74.2768,16.7081],[74.2795,16.7089],[74.2807,16.7113],[74.283,16.7212],[74.2817,16.7435],[74.2761,16.7716],[74.279,16.7887],[74.2833,16.7925],[74.2848,16.7966],[74.2862,16.8259],[74.2951,16.8514],[74.297,16.8634],[74.2962,16.8693],[74.2984,16.8737],[74.2972,16.8878],[74.2905,16.8944],[74.2852,16.9034],[74.2856,16.9057],[74.2909,16.9098],[74.2888,16.9263],[74.2795,16.9414],[74.2698,16.965],[74.2589,17.0097],[74.2429,17.0349],[74.2154,17.0933],[74.1928,17.123],[74.1879,17.1324],[74.1823,17.1721],[74.1774,17.2598],[74.1795,17.2734],[74.1706,17.2832],[74.1784,17.279],[74.1808,17.2811],[74.1798,17.2893],[74.1817,17.2892],[74.1798,17.2889],[74.1814,17.2801],[74.1784,17.279],[74.1706,17.283],[74.167,17.2971],[74.1601,17.3092],[74.1483,17.3243],[74.1449,17.3321],[74.1396,17.3376],[74.126,17.3616],[74.1078,17.3847],[74.1036,17.395],[74.1005,17.3976],[74.102,17.4094],[74.0995,17.4143],[74.0854,17.4823],[74.079,17.5059],[74.07,17.525],[74.0655,17.5296],[74.051,17.5605],[74.0503,17.5766],[74.048,17.5839],[74.0202,17.6186],[74.0129,17.6373],[74.0117,17.6456],[74.0139,17.6511],[74.0136,17.6555],[74.0215,17.6773],[74.0173,17.6801],[74.0189,17.6815],[74.0225,17.6811],[74.0241,17.6886],[74.0269,17.7132],[74.0259,17.7192],[74.0218,17.7258],[73.9947,17.7535],[73.9739,17.8059],[73.9551,17.8368],[73.9523,17.8525],[73.9527,17.8621],[73.9569,17.8682],[73.9656,17.8716],[73.9713,17.8784],[73.9725,17.9093],[73.9781,17.9461],[73.984,17.9575],[73.9884,17.9833],[73.9939,17.9964],[73.9998,18.021],[74.0032,18.026],[74.0125,18.0292],[74.0157,18.0442],[74.0076,18.0691],[73.9971,18.0886],[73.9954,18.0957],[73.9914,18.1002],[73.9901,18.1112],[73.9753,18.147],[73.9727,18.1501],[73.9568,18.1601],[73.9543,18.1638],[73.9527,18.1713],[73.9552,18.1767],[73.9481,18.1987],[73.9446,18.2026],[73.9387,18.2047],[73.9336,18.2092],[73.911,18.2339],[73.9032,18.2379],[73.8904,18.2546],[73.8851,18.259],[73.8722,18.2924],[73.8734,18.3006],[73.8682,18.3058],[73.8654,18.313],[73.8519,18.3265],[73.8534,18.3418],[73.8513,18.3466],[73.8564,18.3904],[73.8487,18.4011],[73.8459,18.4216],[73.8377,18.433],[73.8393,18.4407],[73.8168,18.4661],[73.82,18.4693],[73.8296,18.4884],[73.8456,18.5012],[73.8513,18.4991],[73.8538,18.4998],[73.854,18.5181],[73.8552,18.5209],[73.8565,18.5204]]}},{"type":"Feature","properties":{"name":"Kolhapur","km from Kolhapur":0,"marker-color":"#F59E0B","marker-size":"large"},"geometry":{"type":"Point","coordinates":[74.2433,16.705]}},{"type":"Feature","properties":{"name":"Karad","km from Kolhapur":75,"marker-color":"#16865A","marker-size":"medium"},"geometry":{"type":"Point","coordinates":[74.1818,17.289]}},{"type":"Feature","properties":{"name":"Satara","km from Kolhapur":126.7,"marker-color":"#16865A","marker-size":"medium"},"geometry":{"type":"Point","coordinates":[74.0183,17.6805]}},{"type":"Feature","properties":{"name":"Pune","km from Kolhapur":235.9,"marker-color":"#F59E0B","marker-size":"large"},"geometry":{"type":"Point","coordinates":[73.8567,18.5204]}}]}
```

<a name="different"></a>

<h2><picture><source media="(prefers-color-scheme: dark)" srcset="docs/readme/h-different-dark.svg"><img src="docs/readme/h-different-light.svg" alt="What makes VAYORA different" width="100%"></picture></h2>

<table>
<tr>
<td width="33%" valign="top">

### 📉 Survival, not yes/no
Cox proportional hazards and gradient-boosted survival models estimate **how long** each booking will
last across the week, not just whether it cancels. Every score comes with the reasons behind it.

</td>
<td width="33%" valign="top">

### 🎯 Rides, not bookings
One number decides everything: **completed rides per 100 searches**. A feature that adds bookings but
moves fewer people counts as a loss.

</td>
<td width="33%" valign="top">

### 🧪 An honest answer
The project tested its own idea and found that, in this simulated world, asking people to release
early **does not add rides**. It reports that plainly, with 95% intervals, instead of hiding it.

</td>
</tr>
<tr>
<td width="33%" valign="top">

### 🧾 Every number is a query
One append-only event log, a frozen vocabulary of 24 event types, and
[`metrics.sql`](experiments/analysis/metrics.sql). `reproduce.sh` rebuilds the results and fails
unless they match to the digit.

</td>
<td width="33%" valign="top">

### 🛡️ Built not to cheat
Cancellations come from a Weibull hazard with hidden shocks that no fitted model can represent.
Hidden passenger types drive behaviour but never become features. Training and validation seeds
never overlap.

</td>
<td width="33%" valign="top">

### 🤝 Fair and local
Passengers pay the driver directly in cash or UPI, and **VAYORA charges nothing**. Every screen,
notification, error and PDF receipt works in English, Hindi and Marathi, in light and dark.

</td>
</tr>
</table>

<a name="glance"></a>

<h2><picture><source media="(prefers-color-scheme: dark)" srcset="docs/readme/h-glance-dark.svg"><img src="docs/readme/h-glance-light.svg" alt="At a glance" width="100%"></picture></h2>

<div align="center">
<table>
<tr>
<td align="center" width="16%"><h3>84 / 89</h3><sub>features verified,<br>5 partial</sub></td>
<td align="center" width="16%"><h3>1,029</h3><sub>tests, all passing</sub></td>
<td align="center" width="16%"><h3>126</h3><sub>Indian cities listed,<br>or any map point</sub></td>
<td align="center" width="16%"><h3>3</h3><sub>languages on<br>every screen</sub></td>
<td align="center" width="16%"><h3>24</h3><sub>event types in<br>one event log</sub></td>
<td align="center" width="16%"><h3>30 × 60</h3><sub>seeds × simulated<br>days per variant</sub></td>
</tr>
</table>
</div>

<details>
<summary><b>The detail behind each number</b></summary>

<br>

| | |
|---|---|
| **Features** | 84 verified and 5 partial of the 89 still in scope, the team having removed 6 of the original 95 on 2026-11-02: about 97% counting a partial feature as half. The five need accounts, a native speaker or real data, not more code ([feature matrix](docs/FEATURE_MATRIX.md)) |
| **Routes** | Any route in India in the app, from 126 listed cities or a point on the map. Road distances between Kolhapur and Pune; elsewhere a labelled straight line until a bigger map is built ([how](docs/DEPLOYMENT.md#road-routes-across-india)) |
| **Interface** | A side bar, or tabs on a phone, in light and dark, in the VAYORA brand. Each member starts on a home of their own; screens keep themselves current without a reload |
| **Languages** | English, Hindi and Marathi, on every screen, notification and error message |
| **Tests** | 328 Java, 334 web, 339 Python, 28 gateway, all passing ([what each covers](docs/TESTING.md)) |
| **Research** | On Kolhapur to Pune alone. A SimPy simulator of the corridor: 60 simulated days, 30 seeds per variant, train and validation on disjoint seeds |
| **Data** | All synthetic, plus one public dataset of real hotel cancellations used as a check |

</details>

<a name="tour"></a>

<h2><picture><source media="(prefers-color-scheme: dark)" srcset="docs/readme/h-tour-dark.svg"><img src="docs/readme/h-tour-light.svg" alt="A tour of the app" width="100%"></picture></h2>

Every screenshot below is the running app, filled with demo data from
[`scripts/demo-data.mjs`](scripts/demo-data.mjs). **Every person, ride, review and message in them is
made up.** Open each section to see it.

<p align="center">
  <img src="docs/readme/tour.svg" alt="An auto-playing tour of six screens: the front page, search results, a ride's road route, a booking with its ride chat, booking durability scores, and the live what-if simulator" width="100%">
</p>

> [!TIP]
> In the app, press <kbd>Ctrl</kbd> + <kbd>K</kbd> on any page to jump straight to another.

<details open>
<summary><h3>🧳 For passengers: search, hold, book, travel, pay the driver</h3></summary>

<br>

<table>
<tr>
<td width="50%" valign="top">
<img src="docs/screenshots/search-results.jpg" alt="Search results for Kolhapur to Pune with three rides">
<br><b>🔎 Search and compare</b><br>
<sub>By town or by exact points on a map. Each ride shows seats left, instant or approved booking, a staff-checked identity and the driver's rating. Sort five ways, including a match score for both sides.</sub>
</td>
<td width="50%" valign="top">
<img src="docs/screenshots/ride-route.jpg" alt="The ride's road route from Kolhapur to Pune on a map">
<br><b>🗺️ The real road route</b><br>
<sub>Stops and meeting points on OpenStreetMap, with distances worked out on real roads by OSRM.</sub>
</td>
</tr>
<tr>
<td width="50%" valign="top">
<img src="docs/screenshots/ride-details.jpg" alt="Ride details: every stop with its time, the driver and the fare">
<br><b>📋 Ride details</b><br>
<sub>Every stop with its time, where you board and get off, the driver's record of rides kept, the car and the fare.</sub>
</td>
<td width="50%" valign="top">
<img src="docs/screenshots/seat-hold.jpg" alt="A seat held for five minutes with a countdown">
<br><b>⏳ Hold while you decide</b><br>
<sub>Seats held for five minutes with a live countdown. It is not a booking, and the seats go back by themselves.</sub>
</td>
</tr>
<tr>
<td width="50%" valign="top">
<img src="docs/screenshots/bookings.jpg" alt="My bookings with a progress tracker for each trip">
<br><b>🧭 Every booking, live</b><br>
<sub>Requested, accepted, under way, arrived. Each booking says what cancelling costs right now, and when that changes.</sub>
</td>
<td width="50%" valign="top">
<img src="docs/screenshots/boarding-code.jpg" alt="A confirmed booking showing its four-digit boarding code">
<br><b>🎫 Boarding code</b><br>
<sub>Shown at pickup and checked by the driver. Call the driver through a masked number, or open the meeting point.</sub>
</td>
</tr>
<tr>
<td width="50%" valign="top">
<img src="docs/screenshots/chat.jpg" alt="A ride chat between a passenger and the driver">
<br><b>💬 Ride chat</b><br>
<sub>Real-time messages with everyone on the ride over Socket.IO, and the driver's live position once the ride is on the road.</sub>
</td>
<td width="50%" valign="top">
<img src="docs/screenshots/emergency.jpg" alt="The emergency panel: call 112, or alert the administrators">
<br><b>🚨 Emergency, one tap away</b><br>
<sub>Puts <b>112</b> first. Then, if you choose, an alert to VAYORA's staff queue and the people you added to tell.</sub>
</td>
</tr>
<tr>
<td width="50%" valign="top">
<img src="docs/screenshots/payments.jpg" alt="Payments: every trip and what is owed, paid by UPI or cash">
<br><b>💸 Pay the driver directly</b><br>
<sub>In cash or by UPI, after the ride. VAYORA moves no money and takes no commission.</sub>
</td>
<td width="50%" valign="top">
<img src="docs/screenshots/receipt.jpg" alt="A receipt for a completed booking">
<br><b>🧾 Receipts</b><br>
<sub>Printable, or as a PDF that writes names in nine Indian scripts.</sub>
</td>
</tr>
<tr>
<td width="50%" valign="top">
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/screenshots/passenger-home-dark.jpg">
  <img src="docs/screenshots/passenger-home.jpg" alt="The passenger's home: next trip, quick search and a setup checklist">
</picture>
<br><b>🏠 A home of your own</b><br>
<sub>The next trip with a countdown, a quick search, your numbers and a setup checklist.</sub>
</td>
<td width="50%" valign="top">
<img src="docs/screenshots/assistant.jpg" alt="The assistant answering what giving a seat back costs">
<br><b>✨ Assistant</b><br>
<sub>Answers how VAYORA works, typed or spoken, in all three languages. It cannot see your bookings or change anything.</sub>
</td>
</tr>
<tr>
<td width="50%" valign="top">
<img src="docs/screenshots/notifications.jpg" alt="Notifications about trips and payments">
<br><b>🔔 Notifications</b><br>
<sub>Live, in your language. Copies by SMS, email or browser push once those services are switched on.</sub>
</td>
<td width="50%" valign="top">
<img src="docs/screenshots/account.jpg" alt="The account page">
<br><b>👤 Your account, your data</b><br>
<sub>Profile and preferences, confirmed email or phone, emergency contacts. Download what VAYORA keeps, or delete the account.</sub>
</td>
</tr>
</table>

</details>

<details>
<summary><h3>🚗 For drivers: publish, approve, drive, get paid</h3></summary>

<br>

<table>
<tr>
<td width="50%" valign="top">
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/screenshots/driver-home-dark.jpg">
  <img src="docs/screenshots/driver-home.jpg" alt="The driver's home: next ride, seats booked and earnings">
</picture>
<br><b>🏠 Driver home</b><br>
<sub>The next ride, seats booked, requests waiting, money owed and paid in the last week.</sub>
</td>
<td width="50%" valign="top">
<img src="docs/screenshots/publish-route.jpg" alt="Publishing a ride: the route worked out on a map with a suggested price">
<br><b>➕ Publish in five steps</b><br>
<sub>Stops on the way, a route worked out on real roads, suggested per-stretch prices, a return trip and weekly repeats.</sub>
</td>
</tr>
<tr>
<td width="50%" valign="top">
<img src="docs/screenshots/driver-requests.jpg" alt="A passenger's request waiting for the driver to accept or decline">
<br><b>✅ Approve each request</b><br>
<sub>On rides that are not instant, accept or decline each passenger. Seats are counted per stretch of the route.</sub>
</td>
<td width="50%" valign="top">
<img src="docs/screenshots/driver-rides.jpg" alt="My rides with seats free on each stretch">
<br><b>🛣️ Seats on every stretch</b><br>
<sub>Kolhapur to Karad, Karad to Satara, Satara to Pune: each leg has its own seats and its own price.</sub>
</td>
</tr>
<tr>
<td width="50%" valign="top">
<img src="docs/screenshots/vehicles.jpg" alt="A Tata Nexon EV with its estimated range">
<br><b>🔋 Vehicles, electric too</b><br>
<sub>An electric car's range from its battery and consumption, which publishing respects. Insurance is declared, not assumed.</sub>
</td>
<td width="50%" valign="top">
<img src="docs/screenshots/earnings.jpg" alt="Earnings: total paid, a weekly chart and each payment">
<br><b>₹ Earnings</b><br>
<sub>A weekly chart and every payment. The driver keeps the whole fare and marks each passenger paid.</sub>
</td>
</tr>
<tr>
<td width="50%" valign="top">
<img src="docs/screenshots/driver-record.jpg" alt="The driver's reliability record">
<br><b>🏅 Reliability record</b><br>
<sub>Rides completed and withdrawn, passengers carried, no-shows and rating: what passengers see before they book.</sub>
</td>
<td width="50%" valign="top">
<br><b>📣 Told where demand is</b><br>
<sub>Drivers hear when passengers searched a stretch they drive and found nothing, at most once a week. Whether they then offer a ride is recorded, never reported as a result.</sub>
</td>
</tr>
</table>

</details>

<details>
<summary><h3>🛠️ For administrators: run the platform, watch the model</h3></summary>

<br>

<table>
<tr>
<td width="50%" valign="top">
<img src="docs/screenshots/admin-overview.jpg" alt="The administrators' live overview">
<br><b>📈 Live overview</b><br>
<sub>Members, rides, bookings and reports at a glance, current without a reload.</sub>
</td>
<td width="50%" valign="top">
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/screenshots/admin-durability-dark.jpg">
  <img src="docs/screenshots/admin-durability.jpg" alt="Booking durability: each booking's estimate and the main reasons">
</picture>
<br><b>🧠 Booking durability</b><br>
<sub>The model's estimate that each passenger will not cancel, with the main reasons. Used for one thing only: choosing whom the seat-release reminder asks.</sub>
</td>
</tr>
<tr>
<td width="50%" valign="top">
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/screenshots/admin-what-if-dark.jpg">
  <img src="docs/screenshots/admin-what-if.jpg" alt="What if: a saved sweep, and the simulator run live at a new value">
</picture>
<br><b>🧪 What if, run live</b><br>
<sub>Browse every saved sweep, or run the simulator now at a value no sweep covered. Exploratory, and labelled so.</sub>
</td>
<td width="50%" valign="top">
<img src="docs/screenshots/admin-unmet-demand.jpg" alt="Unmet demand: stretches where searches found no ride">
<br><b>📍 Unmet demand</b><br>
<sub>Days and stretches where at least three searches found no ride, and how many drivers were told.</sub>
</td>
</tr>
<tr>
<td width="50%" valign="top">
<img src="docs/screenshots/admin-document-checks.jpg" alt="Document checks waiting for staff">
<br><b>🪪 Document checks</b><br>
<sub>Staff record that a person saw the driver's document. No number and no copy is kept.</sub>
</td>
<td width="50%" valign="top">
<img src="docs/screenshots/admin-audit.jpg" alt="The audit log">
<br><b>📜 Audit log</b><br>
<sub>Every administrative action, newest first; entries cannot be edited or removed. Beside it: reports, the emergency queue, members, disputed trips, bus alternatives, rest stops and chargers.</sub>
</td>
</tr>
</table>

</details>

<details>
<summary><h3>📱 The Android app: VAYORA on a phone</h3></summary>

<br>

<div align="center">
<img src="docs/screenshots/app-search.jpg" alt="App: find a ride" width="23%">
&nbsp;
<img src="docs/screenshots/app-results.jpg" alt="App: rides found" width="23%">
&nbsp;
<img src="docs/screenshots/app-bookings.jpg" alt="App: my bookings" width="23%">
&nbsp;
<img src="docs/screenshots/app-chat.jpg" alt="App: ride chat with the route" width="23%">
<br><br>
<img src="docs/screenshots/app-sign-in.jpg" alt="App: sign in" width="23%">
&nbsp;
<img src="docs/screenshots/app-driver-rides.jpg" alt="App: a driver's rides" width="23%">
&nbsp;
<img src="docs/screenshots/app-publish.jpg" alt="App: publish a ride" width="23%">
</div>

<br>

Built with **Expo and React Native**, in all three languages. Passengers search, book, show boarding
codes, chat and follow the driver; drivers add vehicles, publish, answer requests and run the trip.
It talks to core-api and the gateway just as the web app does. <sub>Shown here through Expo's web
build at phone size.</sub>

</details>

<details>
<summary><h3>🌗 Light, dark and three languages</h3></summary>

<br>

<div align="center">
<img src="docs/screenshots/landing-phone.jpg" alt="Front page on a phone, light" width="23%">
&nbsp;
<img src="docs/screenshots/landing-phone-dark.jpg" alt="Front page on a phone, dark" width="23%">
&nbsp;
<img src="docs/screenshots/sign-in-phone.jpg" alt="Signing in on a phone" width="23%">
&nbsp;
<img src="docs/screenshots/search-phone-marathi.jpg" alt="Search on a phone, in Marathi" width="23%">
</div>

<br>

<table>
<tr>
<td width="50%" valign="top">
<img src="docs/screenshots/home-marathi.jpg" alt="A passenger's home in Marathi">
<br><b>मराठी</b> <sub>A passenger's home in Marathi.</sub>
</td>
<td width="50%" valign="top">
<img src="docs/screenshots/driver-home-hindi-dark.jpg" alt="A driver's home in Hindi, dark">
<br><b>हिन्दी</b> <sub>A driver's home in Hindi, in dark mode.</sub>
</td>
</tr>
</table>

Two tests keep the languages honest: one fails if the app shows text that is not translated, the
other if the server can send a message the app cannot translate.

</details>

> [!NOTE]
> The model never cancels, prices or refuses anyone: the only thing it decides is whom the
> seat-release reminder asks. What is simulated, mocked or missing is listed plainly in
> [KNOWN_LIMITATIONS](docs/KNOWN_LIMITATIONS.md).

<a name="research"></a>

<h2><picture><source media="(prefers-color-scheme: dark)" srcset="docs/readme/h-research-dark.svg"><img src="docs/readme/h-research-light.svg" alt="What the research found" width="100%"></picture></h2>

> [!IMPORTANT]
> The answer so far is **no, not in this simulated world**, and the project reports it that way.

<p align="center">
  <img src="docs/figures/fig1-ladder.png" alt="Completed rides per 100 searches for each variant, against the baseline" width="85%">
</p>

| Variant | What it does | Completed rides per 100 searches |
|---|---|---|
| 🟦 B0 | Shows rides closest to the passenger's preferred time | 30.22 |
| 🟩 B3 | Ranks rides by how likely each booking is to last | 30.54 (+0.32) |
| 🟩 EARLIEST | Shows the soonest-leaving ride first, with no model | 30.54 (+0.32) |
| 🟨 B4 | As B3, and asks passengers whose booking looks shaky to release it early | 30.56 |
| 🟨 B5 | As B4, within a contact budget, a CP-SAT scheduler choosing whom to ask | 30.53 |
| 🟪 ORACLE | Asks exactly the bookings that will cancel late | +0.13 over B3 |

<sub>Current world (h3, with a last-mile effect), 30 paired seeds. Switching that effect off reproduces
the earlier world's committed numbers (B0 30.77, B3 31.11) to every digit.</sub>

- **Asking works on timing but not on rides.** B4 cuts the share of late cancellations by 6.7 points,
  but completed rides do not move measurably (+0.03, 95% interval −0.02 to +0.07). Even if every
  passenger who would cancel released at once and nobody were put off, the gain would be +0.10.
- **Even perfect targeting adds little.** An oracle that knows who will cancel late gains only +0.13,
  because late releases are already refilled 62% of the time against 92% for early ones, and supply,
  not timing, is what runs out: over half of all searches find no ride.
- **The one gain needs no model.** Offering the soonest-leaving ride first does exactly what B3 does
  (−0.001 against B3); a model that knows nothing about the passenger does as well, and the scheduler
  does no better than choosing at random.

<details>
<summary><b>🧮 The durability model in two formulas</b></summary>

<br>

How long a booking lasts is modelled as a time to an event, $T$, from acceptance until the passenger
cancels; a booking still standing at departure is right-censored. The served model is a Cox
proportional-hazards model (h3-cox, fitted with lifelines) on 11 features known when the booking is
requested:

```math
S(t \mid \mathbf{x}) \;=\; P\left(T > t \mid \mathbf{x}\right) \;=\; S_0(t)^{\exp\left(\boldsymbol{\beta}^{\top}\mathbf{x}\right)}
```

For a booking that has already lasted $e$ hours and departs $h$ hours after acceptance, the score is
the chance it lasts the rest of the way:

```math
\text{score} \;=\; \frac{S(h \mid \mathbf{x})}{S(e \mid \mathbf{x})}
```

Bookings scoring below $0.8$ become candidates for the reminder 48 hours before boarding, and the
CP-SAT contact scheduler chooses among them within the contact budget. On the validation seeds it
reaches a concordance of 0.638 and a Brier score of 0.1169: well calibrated but weak at ranking, as
expected of a model that cannot represent the generator.

</details>

<details>
<summary><b>📈 The report's figures</b></summary>

<br>

<table>
<tr>
<td width="50%" valign="top">
<img src="docs/figures/fig2-refill-timing.png" alt="Share of released seats refilled, early against late releases">
<br><b>Early and late releases.</b> <sub>Under B0, 92% of early releases and 62% of late ones are refilled: the premise holds, but it bounds what moving releases earlier can gain.</sub>
</td>
<td width="50%" valign="top">
<img src="docs/figures/fig4-survival.png" alt="Kaplan–Meier curve of booking durability">
<br><b>Booking durability.</b> <sub>93% of bookings last a day, 73% three days, 56% six. A booking made a week ahead has close to an even chance of being released.</sub>
</td>
</tr>
<tr>
<td width="50%" valign="top">
<img src="docs/figures/fig5-calibration.png" alt="Predicted against observed survival">
<br><b>Calibration.</b> <sub>Both models sit close to the diagonal, so a predicted 80% means about 80%, yet neither ranks bookings well (concordance 0.64 and 0.62), by design of the generator.</sub>
</td>
<td width="50%" valign="top">
<img src="docs/figures/fig6-cancellation-timing.png" alt="Cancellations by how long before departure they came">
<br><b>When cancellations come.</b> <sub>Asking moves cancellations earlier, but also releases some bookings that would have travelled unasked.</sub>
</td>
</tr>
<tr>
<td width="50%" valign="top">
<img src="docs/figures/fig3-sweeps.png" alt="Sweeps of the effect of asking across settings">
<br><b>The sweeps.</b> <sub>No setting tried shows a gain from asking; two show a small loss.</sub>
</td>
<td width="50%" valign="top">
<img src="docs/figures/fig7-robustness.png" alt="Robustness variants against B3">
<br><b>Robustness.</b> <sub>A model with no booking feature changes nothing, and the scheduler does no better than random requests.</sub>
</td>
</tr>
</table>

Captions in full: [docs/figures](docs/figures/README.md).

</details>

<details>
<summary><b>🧬 Every experiment since, one finding each</b></summary>

<br>

- **It does not depend on the assumed cancellation rate.** With cancellations three times rarer, where
  the simulated week looks like real hotels', ranking still gains +0.34 and asking still nothing.
- **Tying cancellations to departure changes the picture only a little.** In worlds where most of the
  risk rises as departure nears, not from booking (experiment X1, protocol section 27):
  - the soonest-ride gain keeps 93% of its size, so it is not just shorter exposure;
  - asking starts to help a little, +0.07 (+0.02 to +0.13), against an oracle's +0.25.
- **The ranking gain depends on leaving early costing nothing, though less than predicted.** When
  passengers mind leaving away from their wanted time (experiment X2, protocol section 28), the
  soonest-ride gain shrinks steadily. At 0.03 per hour it is a sixth of its size and no longer
  distinguishable from zero. Shorter exposure explains only about a tenth of it, and survival ranking
  stays equivalent to soonest-first throughout.
- **A ceiling a platform can compute from its own logs holds.** In 41 of 43 settings tried, no
  reconfirmation policy added more standing seats than the paper's first-order ceiling allows
  (experiments X3 and X5, protocol sections 29 and 31). Both exceptions, at the heaviest demand, are
  settings where the ceiling's own assumption fails. Even the oracle reaches only 78% of its ceiling
  in the base world.
- **Moved one at a time, the supply, demand and cancellation rate assumed change none of this**
  (experiment X5): reconfirmation's effect stays within ±0.10 of zero in all nine settings tried, and
  survival ranking keeps its gain at 6, 12 and 20 rides a day.
- **Moved together, they make asking cost rides more often than not** (experiment X7, protocol
  section 32). Across 20 settings that also vary how passengers respond to being asked, B4's whole 95%
  interval lies below B3's in 13 and above it in one. In five it is not within ±0.10, at worst −0.28.
  An oracle never gains more than +0.18.
- **On real hotel cancellations, features do help.** The same kinds of model rank who cancels better
  than lead time alone (concordance 0.597 for Cox and 0.653 for gradient boosting, against 0.544),
  which suggests the simulated world understates what booking features can tell. At every lead time,
  not just the final week, they reach 0.715 to 0.742 (experiment X4, protocol section 30).

</details>

Every number above is a SQL query over the event log. The method is in
[AI_ML_METHODOLOGY](docs/AI_ML_METHODOLOGY.md), every run and its intervals in
[EXPERIMENT_PROTOCOL](docs/EXPERIMENT_PROTOCOL.md), and the seven report figures in
[docs/figures](docs/figures/README.md).

<a name="architecture"></a>

<h2><picture><source media="(prefers-color-scheme: dark)" srcset="docs/readme/h-architecture-dark.svg"><img src="docs/readme/h-architecture-light.svg" alt="Architecture" width="100%"></picture></h2>

```mermaid
flowchart TB
  subgraph clients["Clients: they render"]
    direction LR
    web["🖥️ web<br/>React"]
    mobile["📱 mobile<br/>Expo"]
  end
  subgraph services["Services"]
    direction LR
    gw["⚡ gateway<br/>Express + Socket.IO<br/>chat and live position"]
    core["☕ core-api<br/>Spring Boot<br/>transactions and truth"]
    intel["🧠 intel<br/>FastAPI<br/>model and scheduler, no state"]
  end
  subgraph stores["Data"]
    direction LR
    mongo[("🍃 MongoDB<br/>chat, GPS, notifications")]
    pg[("🐘 PostgreSQL + PostGIS<br/>users, rides, bookings,<br/>payments, events")]
    redis[("🟥 Redis<br/>seat holds, route cache")]
    osrm["🗺️ OSRM<br/>roads and footpaths"]
  end
  sim["🎲 simulator<br/>SimPy"]
  web --> core
  web --> gw
  web -->|what-if| intel
  mobile --> core
  mobile --> gw
  core -->|scores, contact plans| intel
  gw -->|membership check| core
  core --> pg
  core --> mongo
  core --> redis
  core --> osrm
  gw --> mongo
  sim -->|events| pg

  classDef ui fill:#E6F4EC,stroke:#16865A,color:#10213A
  classDef svc fill:#10213A,stroke:#10213A,color:#FFFFFF
  classDef ai fill:#16865A,stroke:#0B5035,color:#FFFFFF
  classDef store fill:#FFF8E6,stroke:#F59E0B,color:#10213A
  classDef research fill:#FFE4E2,stroke:#D70015,color:#10213A
  class web,mobile ui
  class core,gw,osrm svc
  class intel ai
  class pg,mongo,redis store
  class sim research
  style clients fill:transparent,stroke:#16865A,stroke-dasharray:4 4
  style services fill:transparent,stroke:#718096,stroke-dasharray:4 4
  style stores fill:transparent,stroke:#F59E0B,stroke-dasharray:4 4
```

**How the seat-release reminder is decided**, the one place the model touches a member:

```mermaid
sequenceDiagram
  autonumber
  actor P as 🧳 Passenger
  participant C as ☕ core-api
  participant I as 🧠 intel
  actor Q as 🧳 Another passenger
  P->>C: Book a seat
  C->>I: Score the booking
  I-->>C: Chance it survives to departure, and why
  Note over C: 48 hours before boarding
  rect rgba(22, 134, 90, 0.12)
    C->>C: Keep the bookings rated below the threshold
    C->>I: Whom to ask, within the contact budget?
    I-->>C: Contact plan (CP-SAT)
    C->>P: "If your plans have changed, releasing now lets someone else travel"
  end
  P->>C: Releases the seat early
  C-->>Q: The seat is back in search results
  Q->>C: Books it, and the journey completes
```

| Part | Built with | Owns |
|---|---|---|
| `web` | Vite, React 18, TypeScript, Tailwind | Rendering |
| `core-api` | Spring Boot 3, Java 21, Flyway | Every transaction and every fact |
| `intel` | FastAPI, Python 3.11 | Inference: the survival model and the contact scheduler; holds no state |
| `gateway` | Express 4, Socket.IO 4 | Live streams only: ride chat and the driver's position |
| `mobile` | Expo, React Native, TypeScript | The Android app for passengers and drivers; talks to core-api and the gateway like the web app |
| `sim`, `experiments` | SimPy, lifelines, scikit-survival, OR-Tools | The research: simulator, model training, variants and sweeps |

No entity lives in two stores, and no service forwards a request on another's behalf. Why each thing
lives where it does is in [ARCHITECTURE](docs/ARCHITECTURE.md).

<a name="quick-start"></a>

<h2><picture><source media="(prefers-color-scheme: dark)" srcset="docs/readme/h-quick-start-dark.svg"><img src="docs/readme/h-quick-start-light.svg" alt="Quick start" width="100%"></picture></h2>

> [!TIP]
> Requires only **Docker with Compose v2**. Nothing else needs to be installed.

**🪟 On Windows**, double-click **`run.bat`**. It starts Docker Desktop if needed, builds and starts
every service, and lists their addresses and the administrator. It then offers to add demo rides and
members, and opens the app. **`stop.bat`** stops everything and keeps the data.

**🐧 Anywhere else**, from the repository's folder:

```sh
docker compose up -d --build --wait
sh infra/check-health.sh
```

Then open **http://localhost:5173** and create an account as a passenger or a driver. The first run
downloads a ~220 MB OpenStreetMap extract and builds the road and footpath graphs; later runs reuse
the volume and start in seconds. `docker compose down` stops everything and keeps the data; adding
`-v` would delete it.

| Service | Role | Address |
|---|---|---|
| web | React app | http://localhost:5173 |
| core-api | Spring Boot 3, Java 21 | http://localhost:8080/actuator/health |
| intel | FastAPI, Python 3.11 | http://localhost:8000/health |
| gateway | Express 4 + Socket.IO 4 | http://localhost:3000/health |

Backing services: PostgreSQL 16 + PostGIS 3.4 (`5432`), MongoDB 7 (`27017`), Redis 7 (`6379`),
OSRM (`5000`).

**An administrator** cannot sign up. Copy `.env.example` to `.env` (or add to the `.env` you have), set
`ADMIN_EMAIL` and `ADMIN_PASSWORD` (12 characters or more), and run `docker compose up -d core-api`.

**The API** is described at http://localhost:8080/swagger-ui.html: every endpoint, with its fields,
tried from the page once **Authorize** has the token sign-in returns.

<details>
<summary><b>🎭 Demo data</b>, to see the platform with rides in it</summary>

<br>

`run.bat` offers it. By hand (needs Node 20):

```sh
DEMO_PASSWORD=<8 or more characters> node scripts/demo-data.mjs
```

Four drivers, six days of corridor rides each way, and two passengers with seats booked, all signing in
with that password, then a past to look at: trips completed and rated, earnings, a no-show,
cancellations, a request waiting and documents waiting for staff. Set `DEMO_ADMIN_EMAIL` and
`DEMO_ADMIN_PASSWORD` too and it marks some document checks, noted as demo, and runs the real durability
model over the bookings. Every account, review and ride note says it is made up, and nothing it does
reaches the research figures, which are computed per simulation run. It makes the app look used; it is
not evidence of anything. It refuses any API but this machine's.

</details>

<details>
<summary><b>🔌 A port already in use?</b></summary>

<br>

Every host port is a `*_PORT` setting in `.env` (for example `MONGO_PORT=27018` when another
MongoDB has 27017), and `check-health.sh` reads the same variables:

```sh
cp .env.example .env
set -a; . ./.env; set +a; sh infra/check-health.sh
```

</details>

<details>
<summary><b>📱 Run the Android app</b></summary>

<br>

The app in [`mobile/`](mobile/README.md) runs on any Android phone through the free Expo Go app, from
this computer, or as an APK built in Expo's cloud. Administrators, profiles and the assistant stay on
the website.

```sh
cd mobile && npm ci && npx expo start     # then scan the QR code with Expo Go on the same Wi-Fi
```

</details>

<details>
<summary><b>🌐 Putting it online</b></summary>

<br>

One command on a server with a domain name: `sh scripts/deploy.sh`. It adds HTTPS, closes every port
but 80 and 443, and refuses to start without real secrets. See
[DEPLOYMENT](docs/DEPLOYMENT.md#putting-vayora-online). It has been tried on one machine with a local
certificate, not yet on a real server.

</details>

<details>
<summary><b>🔑 Real services, off until you switch them on</b></summary>

<br>

Out of the box nothing leaves the platform: VAYORA moves no money, since passengers pay their driver
directly, codes and messages go to a simulated outbox an administrator can read, and calls are
simulated. Each real service below turns on when its settings are in `.env`, except email, whose
settings also go in core-api's `environment` in `docker-compose.yml`. Each is tested against a stand-in;
only Google has been tried against the real service.

| Service | What it switches on | Settings |
|---|---|---|
| Google | "Sign in with Google" | `GOOGLE_CLIENT_ID` |
| Twilio | Codes, notification copies and emergency texts by SMS; masked calls bridged through the platform's number | `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM` |
| Any SMTP server | Codes and notification copies by email | `SPRING_MAIL_HOST`, `SPRING_MAIL_PORT`, `SPRING_MAIL_USERNAME`, `SPRING_MAIL_PASSWORD`, `VAYORA_MAIL_FROM` |
| Web Push | Push notifications in the browser | `VAYORA_PUSH_PUBLIC_KEY`, `VAYORA_PUSH_PRIVATE_KEY` (`node scripts/vapid-keys.mjs` makes a pair) |

`.env` is never committed. Step-by-step setup for each is in
[DEPLOYMENT](docs/DEPLOYMENT.md#switching-on-real-services), with every setting and what breaks.

</details>

<a name="tests"></a>

<h2><picture><source media="(prefers-color-scheme: dark)" srcset="docs/readme/h-tests-dark.svg"><img src="docs/readme/h-tests-light.svg" alt="Tests" width="100%"></picture></h2>

```sh
docker compose --profile test run --rm core-api-tests      # core-api: Java 21, real PostGIS, MongoDB and Redis
docker compose --profile research run --rm research        # event log, simulator, model, scheduler, experiments, intel
(cd web && npm ci && npm test)                             # React screens, translations, money and dates
(cd gateway && npm ci && npm test)                         # real Socket.IO server and clients
```

```mermaid
%%{init: {"theme": "base", "themeVariables": {"pie1": "#16865A", "pie2": "#F59E0B", "pie3": "#10213A", "pie4": "#D70015", "pieSectionTextColor": "#FFFFFF", "pieTitleTextColor": "#8B949E", "pieLegendTextColor": "#8B949E", "pieStrokeColor": "#FFFFFF", "pieOuterStrokeWidth": "0px"}}}%%
pie showData title 1,029 tests, all passing in the team's run of 12 November
    "core-api · Java" : 328
    "Python · research and intel" : 339
    "web · React" : 334
    "gateway · Node" : 28
```

The Python suite needs PostgreSQL running (`docker compose up -d --wait postgres core-api`) and works in
a throwaway schema.

<a name="reproduce"></a>

<h2><picture><source media="(prefers-color-scheme: dark)" srcset="docs/readme/h-reproduce-dark.svg"><img src="docs/readme/h-reproduce-light.svg" alt="Reproducing the research" width="100%"></picture></h2>

```sh
scripts/reproduce.sh               # tests, model, ladder and sweeps, about an hour
scripts/reproduce.sh --no-sweeps   # tests, model and ladder only
```

It rebuilds the main results (the variant ladder, the robustness runs, the hotel comparison and the
earlier sweeps) from the configuration in `experiments/configs/`, and fails unless each one comes out
exactly as committed. The first run downloads the public hotel bookings and checks their SHA-256. The
soonest-first ladder and experiments X1 to X7 are not in it yet; the protocol gives each one's
commands.

<details>
<summary><b>Single steps</b></summary>

<br>

```sh
# Train and evaluate the durability model
docker compose --profile research run --rm research python -m experiments.hazard.train

# Run one variant on the 30 experiment seeds
docker compose --profile research run --rm research python -m sim.run --variant experiments/configs/variants/B4.yaml
```

</details>

Every threshold, budget and assumed value lives in `experiments/configs/*.yaml`, none in code. Latent
passenger types drive behaviour in the simulator and are never model features.

<a name="event-log"></a>

<h2><picture><source media="(prefers-color-scheme: dark)" srcset="docs/readme/h-event-log-dark.svg"><img src="docs/readme/h-event-log-light.svg" alt="The event log" width="100%"></picture></h2>

Every number in the report is a SQL aggregate over one table, `events`, through
[`experiments/analysis/metrics.sql`](experiments/analysis/metrics.sql). Two writers share it and a fixed
vocabulary of 24 event types, from `search_issued` and `booking_requested` through `hazard_scored` and
`intervention_issued` to `seat_refilled` and `trip_completed`: core-api's `EventLogService`, which never
throws into its caller, and the Python `vayora_events` writer, which fails loudly. The platform and the
simulator speak the same vocabulary; the platform's own rows sit outside every simulation run.

<a name="roadmap"></a>

<h2><picture><source media="(prefers-color-scheme: dark)" srcset="docs/readme/h-roadmap-dark.svg"><img src="docs/readme/h-roadmap-light.svg" alt="Roadmap" width="100%"></picture></h2>

What is built, and what is still open. Every open item needs something from outside the code: a
device, an account, a person, real data or a server. The details are in
[IMPLEMENTATION_ROADMAP](docs/IMPLEMENTATION_ROADMAP.md).

- [x] Web app for passengers, drivers and administrators, in English, Hindi and Marathi
- [x] Android app in Expo and React Native, sharing the web app's translations
- [x] Durability model, contact scheduler and live what-if simulator
- [x] Variant ladder, sweeps and robustness experiments X1 to X7, every number a SQL query
- [x] One booking for the last seat under concurrent requests, tested with real databases
- [ ] Run the Android app on a phone and build an APK
- [ ] Switch on the CI workflow for this repository
- [ ] Try SMS and masked calls with a real Twilio account
- [ ] A native speaker's review of the Hindi and Marathi text
- [ ] Train the durability model on real bookings, once there are some
- [ ] Measure real demand on the corridor
- [ ] Add the soonest-first ladder and X1 to X7 to `scripts/reproduce.sh`
- [ ] Put the platform online on a real server

<a name="documents"></a>

<h2><picture><source media="(prefers-color-scheme: dark)" srcset="docs/readme/h-documents-dark.svg"><img src="docs/readme/h-documents-light.svg" alt="Documents" width="100%"></picture></h2>

| Document | What it answers |
|---|---|
| 🏗️ [ARCHITECTURE](docs/ARCHITECTURE.md) | What the parts are and why things live where they do |
| 🗄️ [DATABASE_DESIGN](docs/DATABASE_DESIGN.md) | Every table, collection and key |
| 🔌 [API_DOCUMENTATION](docs/API_DOCUMENTATION.md) | Every endpoint and who may call it |
| 🔒 [SECURITY](docs/SECURITY.md) | What is protected, how it is checked, and what is missing |
| 🚀 [DEPLOYMENT](docs/DEPLOYMENT.md) | Running it, configuring it, and what breaks |
| ✅ [FEATURE_MATRIX](docs/FEATURE_MATRIX.md) | The state of each of the 95 features, and the evidence for it |
| 🧪 [TESTING](docs/TESTING.md) | What is tested, and what is not |
| ⚠️ [KNOWN_LIMITATIONS](docs/KNOWN_LIMITATIONS.md) | Everything that does not work, is simulated, or could be mistaken for more |
| 🧠 [AI_ML_METHODOLOGY](docs/AI_ML_METHODOLOGY.md) | The survival models, their explanations and the contact scheduler |
| 🔬 [EXPERIMENT_PROTOCOL](docs/EXPERIMENT_PROTOCOL.md) | How variants are compared, and every result with its interval |
| 📈 [Figures](docs/figures/README.md) | The report's seven figures, with captions |
| 📦 [DATASET_DOCUMENTATION](docs/DATASET_DOCUMENTATION.md) | Where every dataset comes from |
| ⚖️ [DECISIONS](docs/DECISIONS.md) | Every design decision, why, and what it costs |
| 🗺️ [IMPLEMENTATION_ROADMAP](docs/IMPLEMENTATION_ROADMAP.md) | What is left and what it needs |
| 📅 [PROGRESS](docs/PROGRESS.md) | What was built when |

The binding project rules (frozen parameters, the architecture rule, research integrity) are in
[CLAUDE.md](CLAUDE.md).

<details>
<summary><b>🗂️ Repository layout</b></summary>

<br>

| Path | What |
|---|---|
| `web/` | Vite + React 18 + TypeScript + Tailwind |
| `mobile/` | Expo + React Native + TypeScript: the Android app ([how to run it](mobile/README.md)) |
| `core-api/` | Spring Boot 3, Java 21, `com.dypcet.vayora`, Flyway migrations |
| `intel/` | FastAPI, Python 3.11: durability model, explanations, contact scheduler, live what-if, assistant |
| `gateway/` | Express 4 + Socket.IO 4, JWT verification |
| `sim/` | SimPy simulator of the corridor |
| `vayora_events/` | Python event-log writer and the event vocabulary |
| `experiments/` | Configs (every tunable number), runners, analysis queries and committed reports |
| `infra/` | OSRM corridor preparation, the online setup's edge server, stack health check |
| `scripts/` | `reproduce.sh`, demo data, deployment, backups, push key generation |
| `docs/` | Report material, figures, screenshots and the README's graphics (`docs/readme/`) |

OSRM serves a clipped bounding box: `infra/osrm/prepare.sh` downloads Geofabrik's western India extract
and clips it to the corridor (`OSRM_BBOX`, default `73.4,16.4,74.9,18.9`). A route outside that box
shows as a straight line and says so. To rebuild from scratch:
`docker compose down && docker volume rm vayora_osrmdata`.

</details>

<a name="credits"></a>

<h2><picture><source media="(prefers-color-scheme: dark)" srcset="docs/readme/h-credits-dark.svg"><img src="docs/readme/h-credits-light.svg" alt="Data and credits" width="100%"></picture></h2>

- Map data © [OpenStreetMap](https://www.openstreetmap.org/copyright) contributors (ODbL), routed with
  OSRM.
- Noto Sans, for names in nine Indian scripts on PDF receipts: © The Noto Project Authors, SIL Open Font
  License 1.1 (`core-api/src/main/resources/fonts/OFL.txt`).
- The README's artwork is set in Montserrat (SIL Open Font License 1.1, The Montserrat Project Authors),
  drawn as outlines, with icons from Lucide (ISC License).
- The photo of the Khandala ghat on the front page and in the screenshots: Sonika Agarwal, on Unsplash.
- Hotel bookings: Nuno Antonio, Ana de Almeida and Luis Nunes (2019), *Hotel booking demand datasets*,
  Data in Brief 22, 41–49, [doi:10.1016/j.dib.2018.11.126](https://doi.org/10.1016/j.dib.2018.11.126),
  CC BY 4.0.
- The screenshots show demo data from `scripts/demo-data.mjs`: every person, ride, review and message in
  them is made up.
- Everything else is synthetic, generated by the simulator under the assumptions in
  `experiments/configs/world.yaml`. Nothing here is evidence about real passengers.

<br>

<div align="center">

**VAYORA** · built by a team of four at DYPCET Kolhapur · CSE (Data Science)

<sub>An early cancellation is a success.</sub>

[⬆ Back to top](#top)

</div>
