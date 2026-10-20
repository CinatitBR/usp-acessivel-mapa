# Mapa USP Butantã

Mobile-first map of the USP Butantã campus: buildings, institutes, bus lines with live arrivals, and accessibility information (ramps, elevators, accessible entrances, toilets and parking). Live at <https://usp-campus-map.pages.dev>.

## Run locally

```sh
npm install
npm run dev -- --host   # open the "Network" URL on a phone in the same Wi-Fi
```

Live buses, step-free routes and reports also need the Worker (`npm run worker:dev`) and its secrets in `worker/.dev.vars`: see [docs/transit.md](docs/transit.md), [docs/routing.md](docs/routing.md) and [docs/reports.md](docs/reports.md).


## Checks

```sh
npm run typecheck
npm test
npm run build
```


## Documentation

| File | What it covers |
|---|---|
| [docs/architecture.md](docs/architecture.md) | Stack, data flow, code rules, provider fallbacks, the Worker, performance and lite mode, decisions, risks |
| [docs/data.md](docs/data.md) | Campus data scripts, editing the accessibility overlay, addresses and Wikipedia, trees, roofs and monuments |
| [docs/transit.md](docs/transit.md) | Bus stops and lines, live arrivals through the Worker, following a bus |
| [docs/routing.md](docs/routing.md) | Walking, step-free and public transport routes |
| [docs/reports.md](docs/reports.md) | Reports of barriers, the D1 database, the review page, reports on routes |
| [docs/indoor.md](docs/indoor.md) | Floor plans, editing rooms, adding a building |
| [docs/ui.md](docs/ui.md) | Visual identity, the bottom sheet, 3D and lite mode, offline, visual routes |
| [docs/basemap.md](docs/basemap.md) | The basemap style and its anchor layers |
| [docs/journey/journey.md](docs/journey/journey.md) | The app screen by screen, for a presentation; see "Journey screenshots" below |

## Deploy

The site is on Cloudflare Pages at <https://usp-campus-map.pages.dev> and the Worker at `https://usp-campus-map-api.rochinha.workers.dev`.

```sh
npx wrangler login      # once
npm run deploy:worker   # after changing worker/
npm run deploy:pages    # builds and publishes dist/
```

First-time setup, already done for this project:

- `npx wrangler pages project create usp-campus-map --production-branch main --force` (`--force` keeps it on classic Pages, with a `*.pages.dev` address).
- `npx wrangler deploy -c worker/wrangler.jsonc --secrets-file worker/.dev.vars` uploads the Olho Vivo token as a secret along with the first deploy. To change it later: `npx wrangler secret put OLHOVIVO_TOKEN -c worker/wrangler.jsonc`.
- The Worker only answers browsers on the origins in `ALLOWED_ORIGINS` (`worker/wrangler.jsonc`). Add any new address of the site there and redeploy the Worker. Pages preview addresses (`<hash>.usp-campus-map.pages.dev`) are not on the list, so live data only works on the main address.


## Journey screenshots

`docs/journey/journey.md` describes the app screen by screen, one slide for each screen and action, for a presentation. Its screenshots, in `docs/journey/screenshots/`, are taken by a Playwright suite in `scripts/journey/`, one test per slide:

```sh
npm run journey:screenshots               # all the slides
npm run journey:screenshots -- -g s13     # one slide
npm run journey:screenshots -- -g "s13|s14"
```

It uses the Google Chrome installed on the computer, as a 390×844 phone, and needs the three secrets in `worker/.dev.vars`. It starts its own app (port 5183) and Worker (port 8797) over a database of its own in `.wrangler/journey/`, made again on each run with the reports in `scripts/journey/seed.ts`, so `npm run dev`, `npm run worker:dev` and their database are left alone.

The slides show live data: the bus slides (s13, s14) need buses running, the step-free route (s18) needs openrouteservice, and the visual routes (s11, s12) the campus backend. A slide whose state cannot be reached fails or is skipped; nothing is faked.

When a screen changes, change its slide in `journey.md` and its test in `scripts/journey/slides.spec.ts` together. The places the tests use (a building, a stop, a spot on a sidewalk) are constants at the top of that file.

## Attribution

Map rendering by [MapLibre GL JS](https://maplibre.org/). Tiles by [OpenFreeMap](https://openfreemap.org/), schema © [OpenMapTiles](https://openmaptiles.org/), data © [OpenStreetMap](https://www.openstreetmap.org/copyright) contributors. Basemap style based on Katu-Maps (MIT License, © 2026 Karri Ojala); the bus stop icon is drawn for this project in the same style. Building addresses by [Nominatim](https://nominatim.org/) (© OpenStreetMap contributors). Descriptions from [Wikipedia](https://pt.wikipedia.org/) (CC BY-SA) and photos from [Wikimedia Commons](https://commons.wikimedia.org/), each credited to its author in the app. Floor plan of the Edifício Vilanova Artigas derived from the drawings of the Serviço Técnico de Infraestrutura, FAUUSP (2025). Interface font [Manrope](https://github.com/sharanda/manrope) (SIL Open Font License) and icons from [Material Symbols](https://fonts.google.com/icons) (Apache License 2.0). Walking routes by [Valhalla](https://valhalla1.openstreetmap.de/) (FOSSGIS) and [openrouteservice](https://openrouteservice.org/). Public transport journeys and timetable times by [Transitous](https://transitous.org/) ([sources](https://transitous.org/sources/)).

