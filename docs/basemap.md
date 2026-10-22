# Basemap style

`public/styles/campus.json` is the single source of truth for the basemap: plain JSON, loaded as is. Its look comes from Katu-Maps' main style, pruned for a flat, street-scale map.

<!-- Basemap style derived from Katu-Maps, MIT License, Copyright (c) 2026 Karri Ojala. -->

It was generated once by `scripts/export-katu-style.ts`, which evaluates Katu-Maps' `GLOBAL_MAP_STYLE` and then:

- keeps roads, paths, land use, water, rail, labels and the `light` (which is also the sun of the 3D trees and buses);
- removes the globe projection, terrain and hillshade, globe biomes, airports, tunnel portals, hiking and other layers Katu-Maps keeps hidden, layers only visible below zoom 13, its building extrusions (the app draws the campus buildings) and its bus stops;
- fixes label names to Portuguese, then the local name;
- inserts the four anchor layers;
- slims the result (`scripts/lib/slimStyle.ts`), because MapLibre's workers run every layer's filter and expressions for every feature of every tile:
  - each group of six per-class road layers (casing, fill, bridge shadow, bridge casing, bridge fill) becomes one layer that picks its width per feature; the six only differed in width, so the result draws the same widths;
  - `line-sort-key` is dropped (the road fills already lie above every casing).

  Rendered side by side with the unslimmed style on real tiles (a junction at z16.5, the campus at z15, the city at z13, a bridge at z16), the two differ in at most 99 pixels of a 500 × 500 view, by at most 3/255: rounding, invisible.

You can edit `campus.json` by hand or in [Maputnik](https://maplibre.org/maputnik/); just remember that running the script again (`npx tsx scripts/export-katu-style.ts [path to Katu-Maps]`) overwrites it. Check an edited style with `npx gl-style-validate public/styles/campus.json`. `npm test` fails if the style is invalid, has more than 70 layers, has a `line-sort-key`, or has per-class road layers again; `npm run style:slim` merges those back in place.

App layers are always inserted before one of the anchors (see `src/map/anchors.ts`), never before a basemap layer id, so keep these four when you edit the style:

| Anchor | Position | Used for |
|---|---|---|
| `anchor-campus-areas` | above land use and water, below roads | area fills |
| `anchor-features` | above roads, below labels | lines and flat features |
| `anchor-3d` | right after `anchor-features` | building extrusions, Three.js layer |
| `anchor-labels` | last layer | app symbols and labels |

## Decisions

| Decision | Reason |
|---|---|
| The exported style is slimmed by a checked pass, not by hand | Worker time per tile grows with layers × features; the pass refuses a Katu-Maps change it does not understand instead of drawing something different |

## Known gaps

- Minor streets are drawn from z10.5: the z12 tile over the campus holds 2,218 of them (250 KB), the heaviest tile around. Hiding them below z13 would lighten views framed across the city, not the campus, and changes how the city looks, so it is left as is.
- Within one road layer, features are drawn in tile order, so at a junction a minor road's fill can lie over a major one's. All fills share one colour from zoom 15.5, so this only shows as slightly different tints between 13 and 15.5.
