# Interface

The look and behaviour of the interface, 3D, the layer menu and offline use.

## Visual identity

The look of the interface comes from the project's Figma file: the Manrope font, a blue scale on neutral greys, pill buttons with icons, chips, cards and a bottom sheet.

- **Tokens.** `src/styles/tokens.css` is the only place with colours, font sizes, weights, radii and shadows. It has the two Figma scales (Primary and Neutral, 50 to 900), the four status colours, and *roles* built on them (`--surface`, `--text`, `--muted`, `--heading`, `--accent`, `--accent-tonal`, `--chip`, `--border` and so on). The rest of the CSS uses the roles, never a step of a scale. `npm test` fails if a colour or type literal appears in `src/index.css`, if a token is used without being defined, or if a pair of text and background colours falls under 4.5:1.
- **Text styles**, as in Figma (size / line height): Display 40/48, Heading 32/40, Title 24/32, Subtitle 20/28, Body 16/24, Body small 14/20 and Label 12/16, in `rem`, so the browser's text size setting applies. Titles are semibold, subtitles and labels medium, body regular. Nothing is smaller than Label.
- **Two tokens are not in Figma**: `success-700` and `warning-700`, darker steps for green and amber text and for the green chip with white text (white on the Figma green is only 2.3:1).
- **Font.** Manrope is served with the app from `src/assets/fonts/manrope-latin.woff2`: the variable font cut down to Latin with Portuguese accents (24 KB, weights 200 to 800). To rebuild it from the full file: `python3 -m fontTools.subset Manrope-VariableFont_wght.ttf --unicodes="U+0020-007E,U+00A0-00FF,U+0131,U+0152-0153,U+2013-2014,U+2018-201A,U+201C-201E,U+2022,U+2026,U+2032-2033,U+2039-203A,U+20AC,U+2190-2193,U+2212" --flavor=woff2 --layout-features='*' --output-file=src/assets/fonts/manrope-latin.woff2` (needs `fonttools` and `brotli`). Names on the map itself stay in Noto Sans, which comes with the map tiles.
- **Icons.** `src/ui/Icon.tsx` holds the app's icons as SVG paths copied from Material Symbols (rounded, weight 400), so there is no icon font. To add one, copy the `d` of its 24 px SVG into `PATHS`.
- **On the map.** MapLibre cannot read CSS variables, so the few tokens drawn on the map (the route line, the pin, bus stops, label colours) are repeated in `src/styles/palette.ts`; a test keeps the two files equal. Colours that carry meaning are not part of the identity and keep their own values: accessibility status, bus lines, POI categories, indoor room categories, the stairs warning on a route.
- **Navigation.** A bar under the screens with "Mapa" and "Pergunte" (`src/ui/BottomNav.tsx`, height `--nav-height`); from 760 px it is a rail on the left. The chat lies over the map, which stays mounted ([chat.md](chat.md)).
- **The bottom sheet.** On a phone the detail panel lies over the bottom of the map, resting on the navigation bar, and rests at three heights (header, 45% of the screen, almost full). It is dragged by its handle and header, or with a finger on its content; the handle is also a button and the arrow keys move it. The snapping rules are in `src/ui/sheetSnap.ts`. The sheet reports how much of the map it covers, which moves the attribution, the toast and the floor switcher above it and makes the camera centre things in the part that shows (`src/map/SheetPadding.tsx`). From 760 px the panel stands beside the map instead.
- **Touch and keyboard.** Controls are 44 px or have a 44 px touch area (MapLibre's own zoom buttons are enlarged for this), every control shows the same focus ring, and motion of the sheet is skipped under "reduce motion".

## 3D and lite mode

Trees, shaped roofs and 3D buses are drawn by one Three.js layer, loaded after the map. Lite mode leaves that layer (and its download) out: no trees, flat-topped buildings, and buses as flat markers. It starts automatically when the device asks for reduced motion, has no WebGL 2, reports 2 GB of memory or less, or is a phone with 4 cores or fewer; it also switches on by itself, with an "undo", if the 3D map stays below about 25 fps for three seconds while you move it. The **Visualização 3D** switch in the layer menu overrides all of that, and the choice is remembered on the device.

## Places on the map

The layer menu (the round button under the zoom controls) chooses which categories of places are drawn; the choice is remembered on the device. Categories, colours, icons and which ones start switched on are all in `src/features/pois/style.ts`. Places are hidden while the accessibility view is on, which has its own symbols.

## Offline and installing

The app is a PWA (`vite-plugin-pwa`, configured in `vite.config.ts`). On the first visit, once the map's first screen is drawn (so the download does not compete with the first tiles), the service worker stores the app, the basemap style and all campus data, so the map, buildings, search and the accessibility view work without a connection. Basemap tiles, fonts and icons are stored as they are viewed. Live buses and arrivals always need the network; offline, the app says so. The 3D code is stored only once it has been used, so lite mode still never downloads it.

A new version is not applied behind the user's back: the app shows "Há uma nova versão do mapa" with an **Atualizar** button.

`assets/icon.png` is the source of the icons in `public/icons/` (192, 512 and 180 px copies).

## Visual routes

A building's or an institute's panel lists the "rotas visuais" of its university unit: ways shown as a sequence of photos, sent in by people through the campus backend (`usp-acessivel-backend`). The app reads them from `GET /buildings/{unit}/accessibility` and loads each photo from the backend's public storage. Both addresses are in `src/config.ts` (`CAMPUS_API_BASE`, `CAMPUS_STORAGE_BASE`) and can be changed with `VITE_CAMPUS_API_BASE` and `VITE_CAMPUS_STORAGE_BASE`.

The backend names units by its own ids (`ime`, `poli`, ...), while here an institute is an OSM area. `src/features/visualRoutes/units.ts` says which is which; a unit that is not in it shows no routes. `iea`, `ieb` and `cepeusp` are not in it yet.

## Dragging the sheet

Below its highest rest the sheet follows any vertical drag on its content, and the content does not scroll. At its highest rest the content scrolls, and a drag down moves the sheet once the content is at its start. A sideways swipe is left to the chips or photos under the finger. The mouse drags only by the handle and header, so text can still be selected; the wheel over a sheet that is not at its highest rest raises it one rest. A release goes to the nearest rest, or one further in the direction of a flick (0.4 px/ms or faster). The sheet collapses to its header when a floor plan opens, goes to its highest rest while a route field has the focus, and the viewport shrinks with the on-screen keyboard (`interactive-widget=resizes-content`).

## Decisions

| Decision | Reason |
|---|---|
| A real draggable bottom sheet on phones | The Figma handle implies the behaviour; a long panel under the map squeezed it |
| Bottom navigation with the map kept mounted under the chat (`visibility: hidden`, `inert`) | Coming back to the map must not reload it or lose the camera and selection |
| Plain CSS with tokens; no Tailwind | One stylesheet, roles in one file |
| The map opens looking straight down (`INITIAL_PITCH` 0); tilting shows the buildings in 3D | A tilted opening loads more tiles and reached the first screen 0.5–0.8 s later on 4G (`npm run perf:app`) |
| Filled green chips use `success-700` `#15803D`; `#22C55E` only for dots and icons | White on the Figma green is 2.3:1 |
| White text never on warning or information fills; no text lighter than neutral 500 | Contrast under 4.5:1 |
| Nothing smaller than Label 12/16; Figma's 10 px "Descrição" is not used | Readability in an accessibility map |
| Icons are Material Symbols as inline paths, no icon font | No dependency, `currentColor` |
| Map labels stay in Noto Sans | Manrope on the map would mean hosting our own glyph files (several MB) |
| Colours that carry meaning (access status, bus lines, POI and room categories, stairs warning) are not restyled | They are information, not identity |

## Known gaps

- The font is not preloaded: its file name is hashed by the build, so `index.html` cannot name it.
- The bus panel and its stop timeline have not been reviewed in the new style.
- A real flick and the feel of the sheet under a finger have not been tried on a phone (only unit tests and synthetic drags).
- At 200% text size the legend and the floor switcher overlap when both are open on a phone.
- Links inside running text (attribution, photo credits, "Ler na Wikipédia") and MapLibre's attribution button are under 44 px.
