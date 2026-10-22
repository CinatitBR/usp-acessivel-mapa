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

- [ ] **0. Measure.** Playwright with 4× CPU throttling: time to first `idle`, frame times and tile-load time over a scripted pan; compare campus.json, OpenFreeMap Liberty, no app layers, buses off. Needs `tiles.openfreemap.org` allowed in the environment (blocked in the cloud session), or run locally.
- [x] **1. Slim the basemap** — `scripts/lib/slimStyle.ts`, run by `export-katu-style.ts` and by `npm run style:slim`. 91 → 66 layers, 211 → 120 KB:
  - [x] each six-layer road group (casing, fill, bridge shadow, bridge casing, bridge fill) merged into one layer with a per-feature width; filters and widths checked equal to the old layers with the style-spec evaluator (11,340 feature × zoom cases);
  - [x] `line-sort-key` dropped everywhere;
  - [x] flat building colour is a lookup by id (same colours for untagged buildings);
  - [ ] raise minor roads, paths and footprints to z13+: deferred to step 0, which shows what the z11–12 tiles actually carry (OpenMapTiles generalises low zooms already);
  - [x] test: valid style, ≤ 70 layers, no `line-sort-key`, already slim (`scripts/lib/slimStyle.test.ts`); `docs/basemap.md` updated;
  - [ ] look at the result on real tiles (blocked here: `tiles.openfreemap.org` is not reachable from the cloud session).
- [x] **2. Calm the live buses** — `LiveBuses.tsx` + `busFeatures.ts`: flat markers refresh every 1 s (500 ms with a bus open, to keep pace with `FollowCamera`), not during a gesture, and not when no bus moved ~1 m; `docs/transit.md` updated.
- [ ] **3. Faster first screen**: lower initial pitch (~35) and `MAX_PITCH` (~60); preload the style and TileJSON; defer secondary GeoJSON sources until first `idle` or until their layer is on; delay the precache until the map is idle.
- [ ] **4. Fill cost**: cap `pixelRatio` at 2; reconsider lite mode (also simplify the basemap, watchdog with 3D off) — this reopens a decision in `docs/architecture.md`, so ask first.
- [ ] **5. Lock in**: performance numbers from step 0 in `docs/architecture.md`.

## Progress notes

- Katu-Maps is not checked out here, so `export-katu-style.ts` cannot run; the slim pass is applied to the committed `campus.json` (it is idempotent) and the export script calls it too.
