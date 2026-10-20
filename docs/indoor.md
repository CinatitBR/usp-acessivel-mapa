# Indoor maps

A building with a floor plan gets a **Ver planta interna** button in its panel. The plan replaces the building's 3D block: a slab, coloured rooms with their names, the walls, and a switch between floors. Tapping a room opens its sheet. It is drawn with plain map layers, so it is the same in lite mode. The plan's file is fetched the first time it is opened and kept for offline use from then on.

The Edifício Vilanova Artigas (FAU) is the only building with a plan so far. Its data is in `data/indoor/fau-artigas/`:

| File | Made by | What it holds |
|---|---|---|
| `source.json` | hand | The building's OSM id, its box in metres and the map position of the box's four corners, the credit, the floors, and how each sheet of the PDF sits on the box |
| `walls.json` | `npm run indoor:extract` | Wall lines per floor, in centimetres on the building's axes |
| `labels.json` | `npm run indoor:extract` | The text of the sheets with its position; only a reference for drawing rooms |
| `rooms.json` | hand | Rooms per floor: name, category, and a `box` or a `ring` in metres on the building's axes |

`npm run data:build` turns these into `public/data/indoor/<folder>.json` and marks the building as having a plan. It stops with an error if a room is on a floor that does not exist, has an unknown category or no name, is not a polygon, or reaches more than 0.5 m outside the building's box.

## The building's axes

Everything indoor is measured in metres from one corner of the building: `x` along its width, `y` along its depth, as on the sheet with `y` going down. `size` in `source.json` is `[width, depth]` and `corners` are the map positions of (0, 0), (width, 0), (width, depth) and (0, depth). This keeps a building with right angles easy to edit by hand whatever way it faces on the map.

## Editing rooms

Each entry of `rooms` in `rooms.json` has a `level`, a `name`, a `cat` and either `box: [x1, y1, x2, y2]` or `ring: [[x, y], …]` for a shape that is not a rectangle. Rooms are drawn in the order of the file, so a room listed later lies over an earlier one. Categories: `classroom`, `studio`, `laboratory`, `library`, `museum`, `auditorium`, `administration`, `department`, `food`, `services`, `bathroom`, `hall`, `circulation`, `ramp`, `stairs`, `elevator`, `void`, `technical`. The last five passage categories (`circulation`, `ramp`, `stairs`, `elevator`, `void`) are drawn but cannot be tapped. Run `npm run data:build` after editing.

## Adding a building

1. Get the floor plan as a vector PDF (exported from CAD, not scanned), one floor per page. The PDF stays out of the repository.
2. Create `data/indoor/<folder>/source.json`, following the FAU one: `building` (the OSM id, the `id` property in `public/data/buildings.geojson`), `credit`, `size`, `corners`, `defaultLevel` and one entry in `sheets` per page with its `page`, `level`, `name` and `elevations`.
3. Give each sheet at least two `controls`: a point on the page (in PDF points) and the same point on the building's axes (in metres). Structural columns work well. If the page has other drawings inside the building's box, limit the sheet with `extent`; if a floor is smaller than the building, give its `floor` box.
4. Run `npm run indoor:extract -- <plan.pdf> <folder>` (needs `pdftocairo` and `pdftotext` from poppler-utils). It stops if a control point is more than 0.1 m off or the corners are more than 0.5 m from a true box, and writes `walls.json` and `labels.json`.
5. Write `rooms.json` against the walls and labels, then run `npm run data:build` and `npm run check:data`.

The extraction keeps straight lines along the building's axes that are at least 1.2 m long, which drops furniture, door swings and dashed lines; curved walls are lost. A flight of stairs that the sheet draws cut by a break line loses steps the same way: list it under the sheet's `stairs` (a `box` and a number of `treads`) and the extraction redraws it whole.

## What the FAU plan does not say

The plan is the 2025 drawing of FAU's Serviço Técnico de Infraestrutura; only geometry derived from it is published, with credit in the room sheet. Each floor of the building is two half-levels joined by ramps, and the sheets do not mark which room is on which, so a room shows its floor's pair of heights. Some rooms are unnamed on the sheets and are left blank, and the borders of the three departments on floor 1 are estimates. What still needs checking on site is listed below.

## How the FAU plan was georeferenced

The source is a vector PDF exported from a DWG (4 A3 sheets, 2025), so walls and room labels are extracted, not traced. Corner points could not be used: the sheets have different outlines (the basement is 97 × 46 m, the middle floors are recessed) and different scales (sheet 3 says 1:300 and is about 1:368). Each sheet is tied instead to the structural columns, drawn as circles every 11 m in two rows 44 m apart; sheet 4 has no columns and is tied to its outer frame, the 110 × 66 m box of the OSM footprint. The top of every sheet is the building's north-east long side. All strokes in the PDF have the same width and colour, so walls are picked by shape alone (see "Adding a building").

The two-letter prefixes on the sheets are categories, not names: `PROF` research labs, `AUL` teaching, `BLM` library and museum, `APA` support, `COM` shops and student bodies, `OUT` other.

## To confirm on site

- Floor 1: the three departments (AUH, AUP, AUT) are one strip each, with borders guessed from where the labels sit; the professors' offices inside are not separate rooms.
- Basement: "Expediente" and "Arquivo Permanente" carry the same area on the sheet (93,34 m²), so one of them is wrong; the shelved area east of them is unnamed; the border between the photo lab and the storeroom is worked out from their written areas.
- Floor 0: the museum, the copy shop and the stationery kiosk share one open space, so the museum's east edge is an estimate; the rooms along the east side (x 95 to 103, y 23 to 47) are unnamed; the porter's block is one room.
- Names kept as the sheet writes them: CESAD, CCInt, LAP, NAPPLAC, CPD, CTA, LCG 1 and 2, COC Design, COC AU.
- Toilets on floors 1 and 2 are "Sanitários" without male or female, except the one the sheet names.

## Known gaps

- The FAU plan is an internal FAU document. Only derived geometry is published, with credit; whether that is acceptable is the owner's call.
- POIs and the house number from the base map show over every floor; floor 0 is drawn on a slab the size of the whole building although its walls stop short of it.
- On a phone with the building panel open, the floor's name covers the plan's lower left corner.
- Curved walls are lost by the extraction (the museum's rounded partition, the curved rows of room 807).
- Not built: room search, routing inside a building, a stacked 3D view of floors.
