# Basemap style

`public/styles/campus.json` is the single source of truth for the basemap: plain JSON, loaded as is. Its look comes from Katu-Maps' main style, pruned for a flat, street-scale map.

<!-- Basemap style derived from Katu-Maps, MIT License, Copyright (c) 2026 Karri Ojala. -->

It was generated once by `scripts/export-katu-style.ts`, which evaluates Katu-Maps' `GLOBAL_MAP_STYLE` and then:

- keeps roads, paths, land use, water, rail, labels and the `light` (which is also the sun of the 3D trees and buses);
- removes the globe projection, terrain and hillshade, globe biomes, airports, tunnel portals, hiking and other layers Katu-Maps keeps hidden, layers only visible below zoom 13, its building extrusions (the app draws the campus buildings) and its bus stops;
- fixes label names to Portuguese, then the local name;
- inserts the four anchor layers.

You can edit `campus.json` by hand or in [Maputnik](https://maplibre.org/maputnik/); just remember that running the script again (`npx tsx scripts/export-katu-style.ts [path to Katu-Maps]`) overwrites it. Check an edited style with `npx gl-style-validate public/styles/campus.json`.

App layers are always inserted before one of the anchors (see `src/map/anchors.ts`), never before a basemap layer id, so keep these four when you edit the style:

| Anchor | Position | Used for |
|---|---|---|
| `anchor-campus-areas` | above land use and water, below roads | area fills |
| `anchor-features` | above roads, below labels | lines and flat features |
| `anchor-3d` | right after `anchor-features` | building extrusions, Three.js layer |
| `anchor-labels` | last layer | app symbols and labels |
