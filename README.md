# Mapa USP Butantã

Mobile-first map of the USP Butantã campus: buildings, institutes, bus lines with live arrivals, and accessibility information (ramps, elevators, accessible entrances, toilets and parking).

The full implementation plan and milestones are in [PLAN.md](PLAN.md).

## Run locally

```sh
npm install
npm run dev -- --host   # open the "Network" URL on a phone in the same Wi-Fi
```

## Checks

```sh
npm run typecheck
npm test
npm run build
```

## Basemap style

`public/styles/campus.json` is the single source of truth for the basemap. Edit it by hand or in [Maputnik](https://maplibre.org/maputnik/). It currently is OpenFreeMap "liberty" with three changes: the `building-3d` layer is removed, a `light` block is added, and four empty anchor layers are inserted.

App layers are always inserted before one of the anchors (see `src/map/anchors.ts`), never before a basemap layer id, so keep these four when you edit the style:

| Anchor | Position | Used for |
|---|---|---|
| `anchor-campus-areas` | above land use and water, below roads | area fills |
| `anchor-features` | above roads, below labels | lines and flat features |
| `anchor-3d` | right after `anchor-features` | building extrusions, Three.js layer |
| `anchor-labels` | last layer | app symbols and labels |

## Attribution

Map rendering by [MapLibre GL JS](https://maplibre.org/). Tiles by [OpenFreeMap](https://openfreemap.org/), schema © [OpenMapTiles](https://openmaptiles.org/), data © [OpenStreetMap](https://www.openstreetmap.org/copyright) contributors.
