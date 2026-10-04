
# Prompt: Implementation Plan for the USP Butantã Campus Map

## Your role and goal

You are a senior front-end and mapping engineer. Your job is to produce a **detailed, phased implementation plan** for a new web app. You will **not** write app code yet. After I approve the plan, I will ask you (the same model) to implement it milestone by milestone, under my guidance. So the plan must be concrete enough to build from directly.

- **Project folder (currently empty):** `/home/cinatit/projects/usp-acessibility-map`
- **Reference project (read-only, never modify):** `/home/cinatit/projects/Katu-Maps`

## The app

The app is a map of the **USP Butantã Campus** (Universidade de São Paulo, São Paulo, Brazil). It has two goals with equal weight:

1. **Information-dense campus map.** It is a very specialized map that shows as much campus information as possible: buildings, institutes, POIs, bus stops, bus lines, and live bus arrivals and positions.
2. **Accessibility map** (in the disability sense). Ramps, elevators, accessible entrances, accessible toilets and accessible parking are a **top-level feature**, not an afterthought.

The UI language is **Portuguese (pt-BR) only**. Don't add an i18n library, but keep user-facing strings in one module so translation is possible later.

## Fixed decisions (do not reopen these)

These were decided after careful discussion. Treat them as constraints. You may flag a **serious** risk with one of them, but don't propose alternatives otherwise.

| Area | Decision |
|---|---|
| Framework | Vite + React + TypeScript (strict mode) |
| Map | MapLibre GL JS via `@vis.gl/react-maplibre` (https://visgl.github.io/react-maplibre/) |
| Basemap tiles | OpenFreeMap (no API key). Keep MapLibre, OpenFreeMap and OpenStreetMap attribution visible |
| 3D rendering | **Three.js** inside a **single MapLibre custom layer**. Use `InstancedMesh` for trees and low-poly models for buses. **No deck.gl** (bundle size) |
| Lite mode | 3D is turned off automatically on weak devices or when `prefers-reduced-motion` is set. The user can also switch it off manually |
| UI state | Zustand |
| Live data fetching | TanStack Query (polling, caching, retries) |
| Campus data | **Static, build-time data.** A script in `scripts/` pulls campus OSM data once (buildings, POIs, `wheelchair=*`, `entrance=*`, `toilets:wheelchair=*`, `ramp=*`, elevators, parking) via Overpass and writes compact GeoJSON committed to the repo. A **hand-curated GeoJSON overlay** that I maintain adds and corrects accessibility info and institute names. **The app makes no Overpass calls at runtime** |
| Real-time buses | Campus lines (Circulares 8012, 8022, 8032 and any others serving the campus) come from the **SPTrans Olho Vivo API**. Its token must stay secret and it doesn't send CORS headers. So use **one tiny Cloudflare Worker** that only stores secrets, handles Olho Vivo authentication, forwards a whitelisted set of read-only endpoints (Olho Vivo and OpenRouteService), adds CORS headers and caches briefly. No database and no other backend logic |
| Timetable fallback | **Transitous** (no key) provides scheduled departures when the Worker or Olho Vivo is unavailable. These are labeled clearly in the UI as "horário programado" |
| Routing | On-campus walking routes from A to B, with a "sem degraus / cadeira de rodas" toggle. **Valhalla** (public FOSSGIS instance, no key) is the default for normal walking. **OpenRouteService** `wheelchair` profile (through the Worker) handles accessible routes. Each one falls back to the other |
| External geocoding | **Photon** (komoot, no key) is a secondary "fora do campus" search section only. Local offline search always comes first |
| Static transit data | Stop locations and line shapes are pre-processed at build time (from SPTrans GTFS and/or OSM) into static GeoJSON |
| Delivery | Mobile-first **PWA** (installable, offline cache of the app shell and static campus data), deployed on **Cloudflare Pages** next to the Worker |
| Tests | Vitest, **only** for data parsing, adapters and pure logic. No snapshot or visual tests in the MVP |

## MVP scope

The MVP must include:

1. **3D extruded buildings**. Tapping a building opens a detail panel with its name, institute and accessibility info.
2. **Offline search**: client-side fuzzy search over buildings, institutes and POIs.
3. **Accessibility layer**: ramps, elevators, accessible entrances and toilets, accessible parking.
4. **Bus stops and Circular line routes**, with **live arrival predictions** per stop.
5. **Live bus positions** shown as animated **3D buses**.
6. **3D trees** (procedural or low-poly, instanced).
7. **Secondary POIs**: bike stations, parking, water fountains, ATMs and similar.

**Right after the MVP core:** milestone **M8**, on-campus routing (Valhalla + OpenRouteService, see the data sources below), then milestone **M9**, a Katu-style basemap (see "Basemap style").

**Out of MVP (list these as later phases only):** public-transit trip planning to/from campus via Transitous (with Photon address picking), a dark basemap variant, full WCAG 2.2 AA conformance with a screen-reader-friendly non-map view, restaurant ("bandejão") daily menus, campus events and opening hours, English UI.

## External data sources

Use free APIs as much as possible. Every provider sits behind a **typed adapter** in its feature folder. If a provider fails, only its feature degrades, never the whole app.

| Source | Role | Key? | Access | Rules |
|---|---|---|---|---|
| **OpenFreeMap** | Basemap vector tiles | No | Direct | Keep attribution |
| **OpenStreetMap / Overpass** | Campus buildings, POIs, accessibility tags | No | **Build-time script only** | Never called at runtime |
| **SPTrans Olho Vivo** | Live bus positions + arrival predictions (primary) | Yes (token) | Via Worker | Poll 15–30 s only while the tab is visible |
| **SPTrans GTFS** | Static stops, line shapes | Login to download | Build-time script | Commit the processed GeoJSON |
| **Transitous** (MOTIS API) | Scheduled departures **fallback** when Olho Vivo or the Worker is down | No | Direct (CORS, to verify) | Label times "horário programado". **To verify:** São Paulo feed coverage and any live data |
| **Photon** (photon.komoot.io) | Geocoding for places outside campus (secondary search section, routing endpoints) | No | Direct | Debounce ≥ 300 ms, at least 3 characters, bias to the campus center, limit to a São Paulo bbox. Fair use |
| **Valhalla** (public FOSSGIS instance) | Default walking routing on campus | No | Direct | Fair use, no bulk requests. **To verify:** pedestrian costing options (e.g. `step_penalty`, wheelchair `type`) |
| **OpenRouteService** | Wheelchair-profile routing for step-free routes | Yes (free tier) | Via Worker | Respect daily quota. Key stays in the Worker |

**Not used:** Digitransit. It only covers Finland and has no data for São Paulo. Katu-Maps' provider/adapter *pattern* is still worth copying.

**Fallback chains:**
- Arrivals: Olho Vivo (live) → Transitous (scheduled) → static "no data" state.
- Routing: Valhalla ↔ OpenRouteService. Accessible mode prefers ORS `wheelchair`; normal mode prefers Valhalla.
- Search: local offline index (always) + Photon (only when online, shown below local results).

## Performance budgets (measurable)

The app mainly runs on phones. The plan must explain how each budget is met:

- Initial JS ≤ **300 KB gzipped**. Three.js and all 3D code are **lazy-loaded** after the map is interactive.
- Map interactive in **< 3 s** on a mid-range Android over 4G.
- **30+ fps** while panning and zooming on that device.
- About **one draw call per 3D object type** (instancing). Set explicit maximum counts for trees and buses.
- Live bus polling every **15–30 s**, **only while the tab is visible**. Pause it in the background.
- All static campus GeoJSON ≤ **1 MB** total (simplify geometry, keep only needed properties).

## Code-structure guardrails

Katu-Maps (the reference) works, but it grew bloated: `MapView.tsx` is ~3,600 lines and `GlobalMapStyle.ts` is ~3,400 lines. **Don't repeat this.**

- Use a feature-folder structure, for example `src/features/buildings`, `src/features/search`, `src/features/accessibility`, `src/features/transit`, `src/features/pois`, `src/render3d/`, `src/map/`, `src/ui/`.
- Keep files under a **soft cap of ~300 lines**. If a file grows past that, split it by responsibility.
- The map component only puts things together. Each feature owns its sources, layers, style fragments and UI.
- React UI never parses raw API or map-source data directly. Adapters convert external data into typed domain models.
- Provider failures (Worker down, SPTrans error) must be recoverable and shown gently in the UI. The rest of the app keeps working.
- Credentials never go into source code, client bundles or logs.

## How to study Katu-Maps (read only what's listed)

Katu-Maps is the main inspiration. It already combines MapLibre with Three.js custom layers for 3D trees and transit vehicles. Learn its **patterns**, not its structure. To save your context budget, read **only** the files below:

**Docs (read fully):**
- `/home/cinatit/projects/Katu-Maps/README.md`
- `/home/cinatit/projects/Katu-Maps/AGENTS.md`
- `/home/cinatit/projects/Katu-Maps/docs/ARCHITECTURE.md`
- `/home/cinatit/projects/Katu-Maps/docs/MVP.md`
- `/home/cinatit/projects/Katu-Maps/docs/API_SERVICE_ASSESSMENT.md`
- `/home/cinatit/projects/Katu-Maps/docs/TRANSIT_VEHICLE_POSITION_PLAN.md`

**Source (read in chunks of ≤ 300 lines, for patterns only):**
- `apps/map-app/src/map/TreeModelLayer.ts` (~1,470 lines): instanced trees in a custom layer
- `apps/map-app/src/map/TreeBiomes.ts`
- `apps/map-app/src/map/TransitVehicleModelLayer.ts` (~670 lines): 3D vehicles
- `apps/map-app/src/map/transit/HslVehiclePositionProvider.ts`: provider/adapter pattern

**Forbidden:** don't open `MapView.tsx`, `GlobalMapStyle.ts`, or any other Katu-Maps file not listed above. Ignore the other docs (Tampere bridge, weather, globe biomes, Android, trademarks, privacy); they are irrelevant here. (The only exception is `GlobalMapStyle.ts` in milestone M9, and only through the export script below. Never read it into context.)

## Basemap style

The basemap style is a **plain JSON file** (`public/styles/campus.json`), the single source of truth. It is edited by hand or in **Maputnik**. Styles are **not** built in TypeScript code, and there is **no permanent style pipeline**.

**Contract set up in M0 (so M9 needs no code changes):**
- From day one the app loads `campus.json`. It starts as a local copy of OpenFreeMap's "liberty" style, with its source pointing to OpenFreeMap tiles.
- The style contains a few empty **anchor layers** with stable IDs, e.g. `anchor-campus-areas`, `anchor-features`, `anchor-labels`. Every app layer (buildings, accessibility, bus routes, the Three.js custom layer, routes) is inserted with `beforeId` set to an anchor, **never** to a basemap layer ID.
- Three.js lighting reads the style's `light` at runtime (instead of duplicating constants), so the 3D models and the extrusions share one sun.

**M9: Katu-style basemap.** I like the look of Katu-Maps' main style: `GLOBAL_MAP_STYLE` at line 1043 of `/home/cinatit/projects/Katu-Maps/apps/map-app/src/map/GlobalMapStyle.ts`. It's a ~100-layer TypeScript object built with helpers and constants from other files, plus runtime values (`import.meta.env`, `navigator.language`). Once evaluated, though, it's plain JSON-serializable data. So:
1. Write a **throwaway script** (`scripts/export-katu-style.ts`, run with `tsx`). It stubs `import.meta.env` and `navigator`, imports `GLOBAL_MAP_STYLE`, and writes it to JSON. **Don't** read the 3,400-line file into context; execute it.
2. **Prune** the result for a flat, street-scale campus map:
   - **Remove:** globe projection (use mercator), Mapterhorn terrain, globe biomes, aeroway/airport layers, tunnel portals, bridge fallback sources and hiking routes.
   - **Keep:** roads (with width tiers), paths, landuse/landcover colors, water, rail, labels and `light`.
3. Replace label name expressions with a fixed `["coalesce", ["get", "name:pt"], ["get", "name"]]`.
4. Re-add the anchor layers. Then replace the contents of `campus.json` and delete the script, or keep it in `scripts/` documented as one-off.
5. Keep OpenFreeMap/OpenMapTiles/OSM attribution, and credit Katu-Maps (MIT license) in a comment in the README.

**Day style only.** A dark variant (`campus-dark.json`) goes on the later-phases list.

## Your workflow

Work in **three steps**, in this order:

### Step 1: Research (no questions to me yet)
- Read the Katu-Maps files listed above. Write down what to reuse and what to avoid.
- Check the current state of the external services: SPTrans Olho Vivo API (auth flow, endpoints for positions per line and predictions per stop, rate limits, terms of use), SPTrans GTFS availability, OpenFreeMap style URLs, and compatibility between `@vis.gl/react-maplibre` and MapLibre GL JS versions.
- Check the other data sources in the table above: whether Transitous covers São Paulo (static and any live data) and supports CORS; Photon parameters (bias, bbox, `lang`); Valhalla public-instance usage policy and pedestrian/wheelchair costing options; OpenRouteService `wheelchair` profile options and free-tier quota.
- Assess OSM coverage of the USP Butantã campus: building names, institutes and accessibility tags. Estimate how much the curated overlay will have to fill in.
- Find the campus boundary/bbox and the bus lines that serve the campus.

### Step 2: Ask me the remaining open questions
- Ask **at most ~10** questions, **only** about things that are still open after Step 1 and that aren't settled by the fixed decisions above.
- For each question, give **your recommended answer** and a one-line reason.
- Wait for my answers before Step 3.

### Step 3: Write the implementation plan
Write it as a single Markdown document with these sections:

1. **Summary**: what the app is, in a few lines.
2. **Decisions log**: the fixed decisions plus my answers from Step 2, each with a short rationale.
3. **Architecture**: a diagram (Mermaid) of the modules, data flow (build-time scripts → static GeoJSON → app; app → Worker → Olho Vivo / ORS; app → Transitous / Photon / Valhalla directly), and the 3D rendering pipeline.
4. **Folder structure**: the full proposed tree, with the responsibility of each folder.
5. **Data schemas**: TypeScript types for the domain models (Building, Poi, AccessibilityFeature, BusStop, BusLine, BusVehicle, Arrival with a `source: 'live' | 'scheduled'` field, Route, GeocodeResult) and the GeoJSON property schema, including the curated-overlay format and how it is merged with OSM data.
6. **Provider adapters**: one typed interface per capability (arrivals, vehicle positions, routing, geocoding), the implementations behind it, and the fallback chains above.
7. **Cloudflare Worker spec**: endpoints (Olho Vivo + OpenRouteService), whitelist, caching, rate limiting, error handling, secrets setup.
8. **Performance plan**: how each budget above is met (code splitting, instancing, LOD, polling strategy, lite mode).
9. **Milestones**: small vertical slices, each sized for **one implementation session**, in this order:
   - M0: scaffold, tooling, local `public/styles/campus.json` (a copy of OpenFreeMap "liberty") with the anchor layers, centered on campus
   - M1: build-time OSM data script + extruded 3D buildings
   - M2: search (local offline index + secondary Photon section) + building detail panel
   - M3: accessibility layer + curated overlay merge
   - M4: static bus stops/routes + Worker (Olho Vivo) + live arrivals per stop + Transitous scheduled fallback
   - M5: Three.js custom layer + live 3D buses (with smooth interpolation)
   - M6: instanced 3D trees + lite mode
   - M7: PWA/offline + secondary POIs + deploy to Cloudflare Pages
   - M8: on-campus routing (Valhalla default, ORS `wheelchair` via the Worker for "sem degraus / cadeira de rodas", with mutual fallback). Endpoints come from the map, local search or Photon
   - M9: Katu-style basemap (see "Basemap style" below)

   For **each** milestone, list: goal, files to create or modify, key implementation notes, **acceptance criteria**, and **how to verify** (commands and manual checks on a phone).
10. **Later phases**: the out-of-MVP items above, with notes on what the MVP architecture should already support.
11. **Risks and mitigations**: for example, sparse OSM accessibility data, Olho Vivo downtime or terms-of-use limits, Transitous lacking São Paulo coverage, fair-use limits on public Photon/Valhalla instances, ORS quota exhaustion, WebGL performance on low-end phones, and OpenFreeMap availability.

## Quality bar for the plan

- Be specific: name libraries (with versions), files, functions and data flows. Avoid generic advice.
- Don't invent API endpoints or data you didn't verify. Mark anything uncertain as **"to verify"**.
- Prefer the simplest solution that meets the requirements. Don't add a dependency without a reason.
