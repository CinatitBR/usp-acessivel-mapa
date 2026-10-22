# Buses

Bus stops, lines, live arrivals and live buses.

## Bus data and live arrivals

Stops and line routes come from the SPTrans GTFS and are committed in `public/data/`:

```sh
npm run data:transit              # reuses data/raw/gtfs.zip if present
npm run data:transit -- --refresh # downloads the GTFS again
```

The lines drawn on the map (and tracked live) are listed in `FULL_LINES` at the top of `scripts/build-transit.ts`. Every other line that stops inside the campus still shows up in the arrivals of its stops.

The same script writes `line-colors.json`: the colour and text colour the feed gives each line that calls at these stops (`route_color`, `route_text_color`). A line's badge in a stop's arrivals uses them, and so does the badge in a journey by public transport, which gets the same colours from Transitous. They are the colours on the buses, and most lines share one (orange for the 8xxx lines), so the lines drawn on the map keep the distinct colours of `FULL_LINES`.

Live arrivals come from SPTrans Olho Vivo through the Cloudflare Worker in `worker/`, which keeps the token secret. When the Worker or Olho Vivo is unavailable, the app shows timetable times from Transitous, labelled "Horário programado".

```sh
cp worker/.dev.vars.example worker/.dev.vars   # then put your Olho Vivo token in it
npm run worker:dev                             # Worker on http://localhost:8787
npm run dev -- --host                          # in another terminal
```

In dev the app reaches the Worker through Vite's `/api` proxy, so nothing else needs configuring and it also works from a phone on the same Wi-Fi. A production build takes the Worker's URL from `VITE_API_BASE` in `.env.production`; without it the app skips live data and shows timetable times.

With the token in place, run `npm run data:transit` once more: it also looks up each line's Olho Vivo code, needed for live bus positions. A loop line (8084, 8085) is one direction in the GTFS but two codes in Olho Vivo, and its buses change code on the way round, so both are stored (`code` and `loopCode`) and polled.

Live data is kept through short failures. The Worker asks Olho Vivo for each line code separately and answers with the ones that worked (a failed code gets a `null` body), and when Olho Vivo fails altogether it returns its last good answer for up to 90 seconds. In the app, a failed request for bus positions is tried once more and the buses stay where they were last seen; "Ônibus ao vivo indisponíveis" only shows after a minute without a good answer (`feedLost` in `src/features/transit/useVehicles.ts`). The Worker allows each address 300 requests a minute on these routes.

Olho Vivo does not predict the tracked lines everywhere: some campus stops get no prediction, and a bus that still has to turn round at the end of its line is left out. A stop's list therefore adds the tracked buses that are on the map and heading to it, with a time estimated from their distance along the route (`src/features/transit/trackedArrivals.ts`). These rows are marked with ≈. The tracked lines come first in the list, before the other lines.

## Following a bus

A live arrival of a tracked line is a button: it opens the bus's panel, following it, with "Todas as chegadas" as the way back. The panel shows the line's stops as a timeline down to the stop the person came from: "Passou" behind the bus, "Ônibus aqui", "≈ N min" ahead and "Seu ponto". The time at the person's stop is the live prediction already polled for the stop; the stops between get that time shared out by distance, marked with ≈. Opened by tapping a bus on the map, the timeline shows the whole line with no times.

- `lines.geojson` gives each direction its ordered `stops`; `locateStops` (`src/features/transit/lineStops.ts`) places them along the shape without going backwards, which matters on the 8085 loop that passes the same street twice.
- Only the selected bus's direction is drawn as a coloured line; with no bus selected no line shape is on the map.
- `FollowCamera` keeps the bus centred and pauses when the person drags the map; the button resumes it.
- Positions: each fix is projected onto the line shape and animated from the previous distance along it over the poll interval, never past the latest fix; a jump over 600 m or a fix more than 60 m off the shape snaps instead.
- Scheduled arrivals and lines not in `FULL_LINES` cannot be followed: there is no vehicle or shape behind them.
- Drawing: the 3D models move every frame; the flat markers (and the invisible tap targets) are moved once a second, every 500 ms while a bus is open so its ring keeps up with the camera. They wait while a finger moves the map, and a refresh in which no bus moved a metre is skipped: each one re-tiles the GeoJSON source on the workers that also parse basemap tiles (`src/features/transit/LiveBuses.tsx`, `busFeatures.ts`).

## Decisions

| Decision | Reason |
|---|---|
| Flat bus markers refresh at most once a second (500 ms with a bus open), never during a gesture | A refresh every 500 ms kept the map's workers busy and slowed tile loading while panning on phones |

## Known gaps

- Olho Vivo gives no prediction at some campus stops; the ≈ rows from tracked buses on the map stand in for them.
- Compared with the official Olho Vivo app at a real stop: not done.
