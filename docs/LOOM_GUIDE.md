# Loom walkthrough (target: 4 minutes)

Record yourself and your screen. Keep the hosted app and GitHub open beforehand.

## 0:00–0:25 | Problem and stack

“This is DutyRoute, a Django and React trip planner. It accepts the current, pickup and delivery locations plus cycle hours, and generates a road route, stops and daily duty logs for a property carrier on the 70-hour/8-day cycle.”

## 0:25–1:15 | Demonstrate a real trip

Click Load example, show the locations and departure, then Calculate trip & logs. Point out total mileage, driving time, trip time and delivery completion. Explain that the difference between driving and trip time is work and required rest. Click an overnight rest and fuel event to focus its location on the map.

## 1:15–2:00 | Logs and export

Open Daily log sheets. Explain the four status rows and connected transitions. Select the second day, show the midnight split, total 24 hours, daily mileage and location/activity remarks. Open driver/carrier details and show that unknown information is not invented. Print all logs / PDF opens the browser’s print workflow; CSV and JSON are schedule exports. Show Route instructions briefly.

## 2:00–3:10 | Code

Open `planner/scheduler.py`: the pure scheduler advances the timeline and constrains each driving segment by the remaining drive, shift, break, cycle and fuel budgets. Point out that pickup/fueling are on duty and can qualify as driving breaks. Show `daily_logs`, which intersects each event with midnight boundaries.

Open `planner/views.py` for input validation and orchestration. Open `planner/routing.py` for Photon/OSRM and route-position estimates. Show React `DutyGrid` in `src/main.jsx`: the SVG renders the same returned status segments used by the remarks and totals.

## 3:10–3:45 | Tests and assumptions

Show `tests/test_scheduler.py`, especially independent invariants and the seeded long-route test. Mention backend validation/provider failure tests and frontend rounding/CSV tests.

Explain: “A single cycle-hours input cannot reconstruct eight days of history. I use a conservative 34-hour restart when cycle availability is exhausted. The initial daily clocks are fresh, and the routing profile is a normal road profile, not a commercial truck restrictions engine. Stop pins are estimates, not verified truck-stop facilities.”

## 3:45–4:00 | Wrap up

Show the public hosted URL and GitHub repository. Note the README's local setup and design assumptions. End the recording, copy the Loom URL, and submit it alongside the GitHub and hosted links.

## Before recording

- Try the example once to warm the public map services.
- Keep browser zoom readable and close private tabs.
- Read the assumptions in your own words rather than claiming a certified ELD.
- Check the final verification count in QA.md before mentioning a test count.
