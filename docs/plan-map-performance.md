# Plan: map performance on phones

Temporary working plan; delete it when every step is done (the lasting facts go to the matching `docs/*.md`).

**Symptoms.** On a phone the first map screen takes long to appear, and tiles take long to fill in while panning. OpenFreeMap's own demo styles are smooth on the same phone.

## Causes found

1. **Heavy basemap style** (`public/styles/campus.json`, from Katu-Maps): 87 visible layers, 61 of them on the `transportation` source layer (each road class split into casing, fill, bridge shadow, bridge casing, bridge fill…), 31 with a data-driven `line-sort-key`, 32 with per-feature paint, and a ~2.8 KB per-feature colour expression on every building footprint. The workers run every filter and expression for every feature of every tile; 59 of the road layers start below z14, so the distant city in a pitched view gets all of them.
2. **Pitched camera** (`INITIAL_PITCH` 50, `MAX_PITCH` 70): many more tiles, down to low zooms near the horizon.
3. **Live buses `setData` every 500 ms** (`LiveBuses.tsx`): geojson-vt and symbol placement twice a second, on the same workers that parse tiles while panning.
4. **Startup contention**: several GeoJSON sources at once, `buildings.geojson` also parsed on the main thread, a ~3 MB first-visit precache in parallel with tiles, a serial chain style → TileJSON → tiles → glyphs with no preload, and a second font stack.
5. **Fill cost**: full device pixel ratio (3× on many phones) with extrusions and Three.js; lite-mode detection rarely triggers on modern phones.

## Steps

- [ ] **0. Measure.** `npm run perf:basemap` (style alone, opening + fixed pan) and `npm run perf:app` (the built app until the map's first idle), in `scripts/perf/`: phone viewport, CPU ×4 slower, CPU time per thread from a Chrome trace, OpenFreeMap served from a local mirror so `--net` (none, 4g, slow4g) throttles tiles and app alike. Frame times are left out (software WebGL in headless Chrome). Live buses cannot be measured here (no Olho Vivo token).
  - [x] harness and scripts; `--dist a,b` runs builds alternately (numbers from separate sessions drift by ~0.5 s, so compare only within one run);
  - [x] numbers with network throttling (below).
- [x] **1. Slim the basemap** — `scripts/lib/slimStyle.ts`, run by `export-katu-style.ts` and by `npm run style:slim`. 91 → 66 layers, 211 → 120 KB:
  - [x] each six-layer road group (casing, fill, bridge shadow, bridge casing, bridge fill) merged into one layer with a per-feature width; filters and widths checked equal to the old layers with the style-spec evaluator (11,340 feature × zoom cases);
  - [x] `line-sort-key` dropped everywhere;
  - [x] flat building colour is a lookup by id (same colours for untagged buildings);
  - [ ] raise minor roads, paths and footprints to z13+: deferred to step 0, which shows what the z11–12 tiles actually carry (OpenMapTiles generalises low zooms already);
  - [x] test: valid style, ≤ 70 layers, no `line-sort-key`, already slim (`scripts/lib/slimStyle.test.ts`); `docs/basemap.md` updated;
  - [ ] look at the result on real tiles (blocked here: `tiles.openfreemap.org` is not reachable from the cloud session).
- [x] **2. Calm the live buses** — `LiveBuses.tsx` + `busFeatures.ts`: flat markers refresh every 1 s (500 ms with a bus open, to keep pace with `FollowCamera`), not during a gesture, and not when no bus moved ~1 m; `docs/transit.md` updated.
- [ ] **3. Faster first screen**:
  - [x] `preloadMap()` in `vite.config.ts`: modulepreload for the MapLibre chunk, preload for `campus.json` and the tile index (a worker prefetch was downloaded twice, so it was dropped);
  - [x] service worker registered after the map's first idle (`src/map/settled.ts`);
  - [x] `useRouteWarnings` loads buildings and accessibility points with the first route; the bus lines source only while a bus is open;
  - [x] `validateStyle: false` (the style is validated by its test);
  - [ ] lower `INITIAL_PITCH` (50) and `MAX_PITCH` (70): pitch 0 loads 2 tiles instead of 5 and opens ~0.5–0.8 s sooner on 4G. A product decision (the tilt shows the 3D buildings): ask first, and measure intermediate pitches.
- [ ] **4. Fill cost**: cap `pixelRatio` at 2; reconsider lite mode (also simplify the basemap, watchdog with 3D off) — this reopens a decision in `docs/architecture.md`, so ask first.
- [ ] **5. Lock in**: performance numbers from step 0 in `docs/architecture.md`.

## Progress notes

- Katu-Maps is not checked out here, so `export-katu-style.ts` cannot run; the slim pass is applied to the committed `campus.json` (it is idempotent) and the export script calls it too.
- `tiles.openfreemap.org` is now allowed in the cloud environment.
- On 4G the opening is now limited by the main thread, not the network: tiles arrive by ~3 s, the map loads ~1.5–2 s later. MapLibre fetches the same z14 tile once per overscaled z15 tile (4× at the opening view); that is MapLibre's behaviour, OpenFreeMap's demo has it too.

## Measurements

CPU ×4 slower, phone viewport at 1× pixels, one run each unless noted (noise is a few hundred ms).

Basemap alone (`perf:basemap`, pitch 50, network not throttled):

| style | layers | first idle | main CPU to idle | worker CPU to idle |
|---|---|---|---|---|
| OpenFreeMap Liberty | 111 | 2.5 s | 2.0 s | 0.53 s |
| campus before step 1 | 91 | 3.3 s | 2.5 s | 0.54 s |
| campus after step 1 | 66 | 2.9 s | 2.2 s | 0.48 s |

Basemap alone on 4G (`perf:basemap --net 4g`, pitch 50): Liberty 5.0 s to first idle, campus before step 1 5.9 s, after 5.4 s; tile catch-up after the pan 1.7 / 2.2 / 1.5 s.

App on 4G with compression and caching like the real hosts, step 3 A/B in one session (`perf:app --net 4g --dist before,after --variant "3D (8 cores)"`, median of 5): map load 5.15 → 4.53 s, first idle 5.95 → 5.50 s, main-thread CPU 4.84 → 4.52 s.

App (`perf:app`, network not throttled, before step 3): first idle 4.3 s with 3D, main thread 3.7 s, workers 0.6 s. Pitch 0 and blocking the campus GeoJSON each change it by a few hundred ms. Main-thread profile (4.3 s run): MapLibre drawing ~1.0 s (shader compiling ~0.25 s), React and app code ~0.5 s, style load ~0.25 s (validation ~0.13 s), label placement ~0.25 s, native (script compile, GC, GL) ~1.9 s.

