# Indoor map plan: Edifício Vilanova Artigas (FAU)

This is a plan of its own, separate from `PLAN.md` (the general plan of the campus map). Approved by the user on 2026-10-04. I1 and I2 are built; I3 and I4 are not.

## Context

The map shows every building as a 3D block. The user wants to tap the Vilanova Artigas building (`way/158966879`), open its indoor map, and switch between floors. The source is the FAU infrastructure office's floor plan, `~/projects/map-creation/PLANTAS EDIFÍCIO VILANOVA ARTIGAS (FAUUSP).pdf` (4 A3 sheets, dated 11/03/2025).

What I found:

- The PDF is a vector drawing exported from a DWG, not a scan: 6,000 to 25,000 paths per sheet, and every room label is real text with a position. Walls and names can be extracted instead of traced.
- The building has 8 half-levels joined by ramps. Each sheet draws two of them side by side, and they do not overlap in plan.
- `~/projects/map-creation` already holds the building's four structural corners in map coordinates (`GEOREFERENCING_GUIDE.md`, and `.points` files for sheets 1 and 4), plus hand-drawn room polygons (`rooms-*.geojson`, 92 rooms). Those polygons are coarse and the basement is mostly unnamed, so they serve as a checklist of room names, not as geometry.

Decisions taken with the user:

- **4 floors, one per sheet**: `-1` Laboratórios e Auditório (−3,00 / −1,10 m), `0` Caramelo e Museu (+0,80 / +2,70 m), `1` Biblioteca e Departamentos (+4,60 / +6,50 m), `2` Estúdios e Salas de Aula (+8,40 / +10,30 m). A floor shows both half-levels, as the sheet does.
- **Rooms plus wall lines**: coloured, tappable room polygons with names, over the wall linework from the PDF.
- **Entry**: a "Ver planta interna" button in the building panel.

The design is per building, so a second building later only needs new data.

## Data

Two steps, so the normal data build does not need the PDF or any new tool.

**1. Extraction, run once by hand** (`npm run indoor:extract -- <pdf>`, new `scripts/extract-indoor.ts` + `scripts/lib/indoor/`):

- `pdftocairo -svg` (poppler, already installed) turns each sheet into SVG; the script reads the paths and `pdftotext -bbox` reads the labels.
- Keeps only linework inside the building's frame (drops the title block, scale bar, north arrow, section marks), drops text glyphs, then drops furniture and fixtures (chairs, desks, toilets, door swings) by size and repetition, simplifies to 5 cm and rounds to decimetres.
- Georeferences each sheet with a rigid fit (Helmert: shift, rotation, one scale) from the four structural corners to the known map coordinates. Sheets 1 and 4 reuse the existing `.points` files (PNG pixels at 300 dpi convert directly to PDF points); sheets 2 and 3 use the same four corners picked on the drawing. The script fails if any corner is more than 0.5 m off.
- Writes `data/indoor/fau-artigas/walls.json` (lines per floor) and `labels.json` (text and position per floor). Both are committed. The PDF itself stays outside the repository.

**2. Curated rooms** (`data/indoor/fau-artigas/rooms.geojson`, edited by hand, openable in QGIS): one polygon per room with `level`, `name`, `category` and `elevation` (the half-level, e.g. `+2,70 m`). I draw them against the extracted walls and labels, floor by floor, about 100 rooms. Categories: classroom, studio, laboratory, library, auditorium, administration, department, food, services, bathroom, circulation, ramp, stairs, elevator, void, technical.

**Build** (`npm run data:build`, new section in `scripts/build-campus.ts`): checks every room (known level, valid polygon, inside the building footprint with a small tolerance) and writes `public/data/indoor/fau-artigas.json`:

```
{ building: "way/158966879", defaultLevel: 0,
  levels: [{ id: -1, name: "Laboratórios e Auditório", elevations: "−3,00 / −1,10 m" }, …],
  rooms: GeoJSON FeatureCollection (id, level, name, cat, elev),
  walls: GeoJSON FeatureCollection (one MultiLineString per level) }
```

`buildings.geojson` gains `indoor: "fau-artigas"` on that building. Target size: 250 KB at most, inside the 1 MB static data budget (now 655 KB). The file is fetched only when the indoor map is opened and is cached on first use, like `roofs.json`; it is not precached.

## App

New feature folder `src/features/indoor/`.

- **State** (`src/state/store.ts`): `indoor: { buildingId, level } | null`, with `openIndoor(buildingId)`, `setIndoorLevel(level)`, `closeIndoor()`. New selection kind `{ kind: 'room', id, buildingId, position }`.
- **Entry** (`src/features/buildings/BuildingPanel.tsx`): a "Ver planta interna" button when the building has `indoor`. It opens the indoor map on the default floor (0, the Caramelo) and moves the camera to fit the building, looking straight down.
- **Layers** (`indoor/layers.tsx`, mounted in `src/map/CampusMap.tsx`), all filtered to the current floor:
  - floor slab: the building footprint as a light fill, so the map under it does not show through;
  - rooms: `fill` coloured by category, the selected room highlighted;
  - walls: `line`, thinner below zoom 18;
  - names: `symbol` from zoom 18.5, larger rooms first.
  Fills and lines go before `ANCHORS.features`, names before `ANCHORS.labels`. Only MapLibre layers, so it works the same in lite mode.
- **Hiding the block**: while a building's indoor map is open, `src/features/buildings/layers.tsx` filters that building out of the extrusion layer, and `src/render3d/RoofsActor.ts` skips its roof (it keeps each roof's triangle range and leaves that range out of the draw).
- **Level switcher** (`indoor/LevelSwitcher.tsx`): a vertical control on the right edge, above the bottom sheet: `2 · 1 · 0 · −1`, the current one highlighted, the floor's name beside it, and a close button that brings the 3D block back. Buttons of 44 px, `aria-pressed`, pt-BR strings in `src/strings/pt-BR.ts`.
- **Rooms** (`src/map/MapSelection.tsx`, `indoor/RoomPanel.tsx`, `src/ui/SelectionSheet.tsx`): tapping a room selects it and opens a sheet with its name, category, floor and half-level, and "Rotas" to the building. Changing floor clears a selected room from another floor.
- **Closing**: the close button, or opening another building's panel.
- **Credit**: "Planta: Serviço Técnico de Infraestrutura, FAUUSP (2025)" in the room sheet and in the README.

Not in this plan: room search, routing inside the building, a 3D stacked view of floors, other buildings.

## Milestones

Each one ends working and is shown to the user before the next; commits only when asked.

| | Result | Check |
|---|---|---|
| **I1** | Extraction and georeferencing: `walls.json` and `labels.json` for the 4 floors | Unit tests for path parsing, the rigid fit and the furniture filter; a throwaway page overlaying each floor's walls on the OSM footprint, screenshots to the user |
| **I2** | Indoor map opens from the building panel with floor slab, walls and level switcher; block and roof hide and return | Headless Chrome, 3D on and lite mode: each floor, open and close, another building selected |
| **I3** | Rooms: curated polygons for the 4 floors, colours, names, room sheet | Build validation; screenshots of each floor at zoom 18.5 and 20; a tapped room on each floor |
| **I4** | README section "Indoor maps" (how to add a building), `check:data`, typecheck, tests, build | `npm test`, `npm run typecheck`, `npm run check:data`, `npm run build` |

## Risks

- **The furniture filter may not separate walls cleanly**, above all on sheet 4 (hundreds of chairs). The DWG layer names are lost in the PDF, so the filter works on geometry only. If the result is noisy or too large, that floor falls back to walls drawn from the room outlines, which the curated polygons give for free.
- **Georeferencing is only as good as the four corners.** The check against the OSM footprint in I1 shows any shift before rooms are drawn.
- **Room names in the drawing are abbreviated** (`PROF`, `APA`, `OUT`, `BLM`). I expand the ones I can and list the rest for the user at the end of I3.
- **Permission**: the plan is an internal FAU document. Only derived geometry is published, with credit, but whether that is acceptable is the user's call before deploy.
- **Not verifiable by me**: whether the 2025 layout matches the building today, and how it feels on a real phone.

## As built

### I1: extraction and georeferencing (2026-10-04)

- `npm run indoor:extract -- <plan.pdf>` (`scripts/extract-indoor.ts`, `scripts/lib/indoor/` + tests) writes `data/indoor/fau-artigas/walls.json` (40 KB, 2,100 wall lines over the 4 floors) and `labels.json` (21 KB, 400 text blocks). Both are in metres on the building's own axes; `source.json` in the same folder says where those axes sit on the map and how each sheet sits on them.
- **Georeferencing changed from the plan.** The corner points in `map-creation` could not be used: they assume every sheet shows the same 110 × 66 m outline, but the basement is 97 × 46 m and the middle floors are recessed, and the sheets have three different scales (sheet 3 says 1:300 and is really about 1:368). Instead each sheet is tied to the structural columns, which are drawn as circles and stand every 11 m: 9 per row, two rows 44 m apart. Sheet 4 draws no columns and is tied to its outer frame, which is the 110 × 66 m box of the OSM footprint; that the floors then line up was checked on the toilet blocks, the ramps and the central void, which fall on the same spot on floors 1 and 2. Control points fit within 1 cm; the OSM corners are within 0.21 m of a true box.
- **Orientation**: the top of every sheet is the building's north-east long side. Checked against the sheet's north arrow and against two OSM points inside the building (the cantina and the stationery shop), which land on the right end of the right floor, about 10 to 15 m from the drawn rooms; a sheet turned by 180° would put them 60 m away.
- **Wall filter**: all strokes in the PDF have the same width and colour, so walls are picked by shape: straight, along the building's axes, and at least 1.2 m long once the pieces of a line are joined. That drops furniture, door swings, dashed projections and the diagonal crosses over voids, and keeps stair treads, toilet partitions and the auditorium's seating rows. No floor needed the fallback to room outlines.
- Not kept: curved things (the museum's rounded partition, the curved rows of room 807), which will come from the room polygons where they matter.
- Known leftovers: a few section marks on the outline of floor 1.

### I2: indoor map in the app (2026-10-04)

- "Ver planta interna" in the building panel opens the plan (`src/features/indoor/`): the camera comes over the building looking straight down, turned the way the sheets are drawn, and the block and its roof go away. Selecting another building or the switcher's × puts them back and returns the camera's zoom and angle.
- The published file is `public/data/indoor/fau-artigas.json`, 112 KB (static data is now 767 KB of the 1 MB budget). It carries one slab per floor instead of the building footprint, because the basement is smaller than the building; around it the base map's own grey footprint shows.
- **Level switcher placement changed from the plan**: on phones it is a row at the bottom left of the map with the floor's name above it; on wide screens it is a column at the bottom right, top floor on top. While it is open on a phone, the status line and the toast move above it.
- A tap on the plan keeps the current selection. Room selection is I3.
- Checked in headless Chrome at 390 × 844 with 3D on and in lite mode, and at 1280 × 800: each floor, open, close, another building selected; no console errors.
- Known: on a phone with the building panel open, the floor's name covers the plan's lower left corner, and the status line sits on the plan when it shows.
