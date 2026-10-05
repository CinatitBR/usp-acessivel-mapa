# UI plan: new visual identity

This is a plan of its own, like `INDOOR_PLAN.md`. Written on 2026-10-04 from the user's Figma screenshots (a place sheet, a route sheet, the colour variables and the text styles) and the Manrope font file. The user approved it on 2026-10-04 with every recommendation and every suggested change accepted (see "Decisions" at the end). Nothing is built yet.

## Context

The app works but looks like a prototype: system font, one blue, square panels, text buttons. The Figma screens define an identity: Manrope, a blue primary scale on neutral greys, a rounded bottom sheet with a grab handle, pill buttons with icons, chips and cards.

The brief:

- Restyle the existing screens to match the identity. The content of the screens stays as it is: no new actions ("Ligar", "Salvar", "Iniciar rota"), no new sections ("Descubra rotas internas"), no new route modes.
- Font: Manrope. Colours and text styles: as in the images.
- Suggestions on the text styles, colours and other UI aspects are welcome; they are in "Suggested changes" below.

What exists today: one stylesheet (`src/index.css`, 1,192 lines, 13 colours written in place, 10 font sizes) and about 20 components. The detail panel (`src/ui/BottomSheet.tsx`) does not cover the map: it takes its own space under it on phones and beside it on wide screens.

## Design tokens

New file `src/styles/tokens.css`, imported first. Components use only the role names, never the scale steps directly, so a later palette change is one file.

### Colour scales (from the images, unchanged)

| | 50 | 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900 |
|---|---|---|---|---|---|---|---|---|---|---|
| Primary | `#ECF3FF` | `#DCE8FF` | `#C3D9FF` | `#8CB3FF` | `#5F8EF4` | `#1E5AE8` | `#1B4ACD` | `#133B99` | `#1F2D73` | `#0F1B45` |
| Neutral | `#FAFAFA` | `#F5F5F5` | `#EAEAEA` | `#D6D6D6` | `#A3A3A3` | `#737373` | `#525252` | `#404040` | `#262626` | `#171717` |

Semantic: success `#22C55E`, warning `#F59E0B`, error `#DC2626`, information `#0EA5E9`.

### Roles

| Role | Value | Used for |
|---|---|---|
| `--surface` | white | Sheet, cards, search box, menus |
| `--surface-muted` | neutral 50 | Page behind the sheet's content, card footers |
| `--text` | neutral 900 | Body text |
| `--text-muted` | neutral 500 | Subtitles, captions (4.7:1 on white) |
| `--heading` | primary 700 | Sheet titles and section headings (9.9:1) |
| `--accent` | primary 600 | Filled buttons, links, selected states, focus ring (7.2:1 with white) |
| `--accent-tonal` | primary 100 | Secondary pill buttons; their text and icon are primary 700 |
| `--chip` | neutral 200 | Neutral chips; text neutral 700 |
| `--border` | neutral 200 | Dividers, input underline |
| `--success`, `--warning`, `--error`, `--info` | as above | Status fills, dots and icons |

### Text styles

Sizes and line heights as in the image, in `rem` so the browser's text size setting still works. The image gives no weights; the ones below are read from the two screens and are **to confirm**.

| Style | Size / line | Weight | Used for |
|---|---|---|---|
| Display | 40 / 48 | 600 | Not used yet |
| Heading | 32 / 40 | 600 | The large number in a route summary |
| Title | 24 / 32 | 600 | Sheet title |
| Subtitle | 20 / 28 | 500 | Section heading in a sheet |
| Subtitle bold | 20 / 28 | 700 | Primary action label on a wide button |
| Body | 16 / 24 | 400 | Search text, paragraphs, list rows |
| Body small | 14 / 20 | 400 | Subtitles, pill buttons, chips, captions |
| Navegação | 14 / 20 | 600 selected, 500 not | Pills that switch something: route profile, floors |
| Label | 12 / 16 | 500 | Photo credits, attributions |
| Label bold | 12 / 16 | 700 | Small headings in capitals, badges |
| Descrição | 10 / 12 | 500 | See "Suggested changes" |

Today's ten sizes map onto these: 12 and 13 px become Label or Body small, 14 and 15 px become Body small, 16 px Body, 18 to 24 px Subtitle or Title.

### Shape, depth, spacing

- Radius: pills and chips fully round; cards and menus 16 px; the sheet's top corners 28 px; photos inside cards 12 px.
- Shadow: one soft, wide shadow for things that float over the map (search box, map buttons, sheet), replacing today's tight one.
- Spacing: a 4 px step (4, 8, 12, 16, 24); sheets have 16 px side padding.
- Touch targets stay at 44 px or more: pill buttons are 44 px high, chips 32 px with a 44 px hit area where they are buttons.

### Font

- `Manrope-VariableFont_wght.ttf` (167 KB, SIL Open Font License, so it can be hosted with the app) is subset to Latin with Portuguese accents and saved as WOFF2 in `src/assets/fonts/`, expected at 25 to 35 KB. The variable file covers every weight.
- `font-display: swap`, preloaded from `index.html`, and added to the service worker's precache so it works offline.
- Fallback stack: `Manrope, system-ui, sans-serif`.
- **Map labels stay in Noto Sans.** MapLibre draws them from glyph files served by the tile provider; Manrope there would mean generating and hosting our own glyph files (several MB). Not in this plan.

### Icons

The screens use outline icons in the Material Symbols style. New `src/ui/Icon.tsx` holds the paths of the icons the app needs (about 20: close, route, swap, search, layers, wheelchair, bus, walk, elevator, toilet, stairs, chevrons, school, place, navigation, link, info) as inline SVG, coloured by `currentColor`. No icon font and no new dependency. Material Symbols is under the Apache 2.0 licence; it is credited in the README. **To confirm**: which icon set the Figma file uses, if it is another one.

## The bottom sheet (the main decision)

In Figma the sheet lies over the map with rounded top corners and a grab handle. Today it sits under the map and is as tall as its content. A handle that cannot be dragged would be misleading, so the look implies the behaviour.

**Recommended:** make it a real bottom sheet on phones.

- It overlays the bottom of the map, with three heights: header only, half, and almost full. Dragging the handle or the header moves it; a flick goes to the next height.
- The handle is also a button, so the keyboard and screen readers can raise and lower the sheet; `Esc` still closes it.
- The map knows how much of it is covered (`map.setPadding`), so a selected place is centred in the visible part, and the attribution, the status line, the toast and the floor switcher sit above the sheet instead of under it.
- Written by hand with pointer events and a CSS transform (about 150 lines and a unit-tested function for the snapping); no library. Motion is skipped under "reduce motion".
- On wide screens there is no Figma design. The panel stays beside the map with the new styling, as a card without a handle.

**Alternative (styling only):** keep the sheet under the map, give it rounded top corners that overlap the map by their radius, and leave the handle out. Less work and no behaviour change, but it does not match the screens and a long panel still squeezes the map.

## Components

Every screen keeps its content; this is what changes in how it looks.

| Component | Change |
|---|---|
| Search box, results | A 56 px pill with the wide shadow, Body text, icon for clear; results as a rounded card of rows |
| Map buttons, MapLibre controls | Round white buttons with icons and the wide shadow; zoom and compass restyled to match |
| Accessibility switch and legend | A chip that fills with the accent when on; legend entries as chips |
| Layer menu | A 16 px card; switches in the accent colour |
| Sheet header | Handle, Title in the heading colour, subtitle in Body small with an icon, close as an icon button |
| Actions | "Rota até aqui" becomes the filled pill with the route icon. Other actions that exist today (website, indoor plan, follow a bus) become tonal pills in one scrollable row |
| Accessibility summary | Status as a chip (see the green note below); features as neutral chips with icons |
| Wikipedia text and photos | The carousel becomes a card with 16 px corners; credits in Label |
| Stop, arrivals, bus, timeline | Rows with Body and Body small; line badges keep the lines' own colours; the "follow" action is a tonal pill |
| Route panel | From and to in one white card with a divider and a swap icon button; profiles as Navegação pills; the time in Heading with the details beside it; steps as rows |
| Room sheet, floor switcher | Same sheet; the switcher becomes a pill group with the selected floor filled |
| Toast, status line | Dark neutral 800 pill with white text; the status line a white pill |
| On the map | Route line in primary 500 with its white casing; the pin and the selection ring in the accent; `theme-color` and the PWA manifest colours follow the new background |

Colours that carry meaning on the map are **not** restyled: the access status colours on buildings, the bus lines' colours, POI categories, the indoor room categories and the stairs warning on a route. The selected building is already `#F59E0B`, which is the palette's warning colour.

## Suggested changes

1. **White text on the success green fails contrast.** White on `#22C55E` is 2.3:1; the "Acessível" chip in the place screen is drawn that way. Proposal: add `success-700 #15803D` for filled chips with white text (5.0:1) and keep `#22C55E` for dots and icons. The other option is dark text on `#22C55E` (7.9:1).
2. **Warning and information are fills for dark text only.** White on `#F59E0B` or `#0EA5E9` is under 3:1. Error `#DC2626` works with white (4.8:1).
3. **Neutral 400 and primary 400 are not text colours** on white (2.5:1 and 3.2:1). Muted text is neutral 500 at the lightest.
4. **Drop "Descrição 10/12" for anything that must be read.** In an accessibility map the smallest text should be Label 12/16. The 10 px style is kept only for the map's own attribution, if at all.
5. **Add weights to the Figma text styles** (the table above), so the two "bold" variants and the Navegação pair are defined by weight alone.
6. **A focus style.** The screens show none. Proposal: a 3 px accent outline with a 2 px offset on every interactive element, as today but in the new colour.
7. **Role names in Figma too** (surface, text, heading, accent, tonal), so design and code share a vocabulary.

## Milestones

Each one ends working and is shown to the user before the next; commits only when asked. Before U1, screenshots of every screen at 390 × 844 and 1280 × 800 are taken with headless Chrome as the "before" set, and again after each milestone.

| | Result | Check |
|---|---|---|
| **U1** | Tokens, font and text styles; every colour and size in `index.css` points to a token. Layout unchanged | Font loads offline; no colour or `font-size` literal left outside `tokens.css` (checked by a script); screenshots |
| **U2** | Icons and the shared pieces: pill button (filled, tonal), icon button, chip, card. Search box, map buttons, accessibility chip, layer menu, toast, status line | Screenshots; keyboard pass over the map's controls |
| **U3** | The bottom sheet as decided above, with its header and action row; every panel inherits it | Unit test for the snapping; drag, flick, keyboard and `Esc` in headless Chrome; attribution, toast and floor switcher never under the sheet; wide screen unchanged in behaviour |
| **U4** | Panel contents: building, POI, institute, accessibility feature, stop and arrivals, bus and timeline, route, room; the floor switcher | Screenshots of each panel on both sizes, 3D and lite mode |
| **U5** | Map-side colours, wide-screen pass, accessibility pass (contrast of every text pair by script, 200% text size, reduced motion, 44 px targets), README section "Visual identity" | `npm test`, `npm run typecheck`, `npm run check:data`, `npm run build`; bundle size compared with before |

## Risks

- **The draggable sheet is the only part that changes behaviour.** Dragging competes with scrolling the sheet's content and with panning the map; the rule (drag from the handle and header always, from the content only when it is scrolled to the top) needs trying on a real phone, which I cannot do.
- **Manrope is wider than the system font** at the same size, so pills and the floor switcher may wrap at 390 px; U2 and U4 check each one.
- **No design for wide screens or for most panels** (stops, buses, timeline, indoor). They are derived from the two screens; expect a round of adjustments after U4.
- **Offline:** the font adds about 30 KB to the first download and the precache.
- **Not verifiable by me:** how it feels on a phone, and whether the colours match Figma on a real screen.

## Decisions (user, 2026-10-04)

1. The bottom sheet becomes a draggable overlay on phones, as recommended.
2. Filled green chips use the darker green `#15803D` with white text; `#22C55E` stays for dots and icons.
3. The font weights in the text styles table are right.
4. Icons are Material Symbols.
5. Map labels stay in Noto Sans.
6. All seven suggested changes are applied.
7. No Tailwind: plain CSS with tokens.

## As built

### U1: tokens, font and text styles (2026-10-04)

- `src/styles/tokens.css` holds the two scales, the semantic colours, the roles, the text styles, radii and shadows. `src/index.css` imports it and has no colour, font size, font weight or font family literal left; `src/styles/tokens.test.ts` keeps it that way and also checks that every token the stylesheet uses is defined and that 18 text and background pairs reach 4.5:1.
- Two tokens are not in Figma: `success-700 #15803D` (agreed) and `warning-700 #B45309`, for the "scheduled, not live" note on a stop, which is amber text on white and needs a dark amber to be readable.
- Manrope: `src/assets/fonts/manrope-latin.woff2`, 24 KB, weights 200 to 800, Latin with Portuguese accents, arrows, × and −. Made with `python3 -m fontTools.subset … --flavor=woff2`. It is precached by the service worker.
- **Not done from the plan: the font is not preloaded.** Its file name is hashed by the build, so a `<link rel="preload">` in `index.html` cannot name it without an extra build step. With `font-display: swap` the text shows at once in the fallback font and switches when Manrope arrives.
- The ten font sizes became five (Label, Body small, Body, Subtitle, Title), each with its line height. The sheet title is already Title 24/32. `theme-color` and the manifest colours are neutral 50.
- Layout, radii and the look of buttons are unchanged; that is U2 onwards. The "×" and arrow glyphs look small in Manrope until U2 replaces them with icons. Colours drawn on the map (route line, markers) are still the old blue until U5.
- Checked with before and after screenshots of eight screens at 390 × 844 and 1280 × 800 in headless Chrome, no console errors.

### U2: icons and shared pieces (2026-10-04)

- `src/ui/Icon.tsx`: 19 Material Symbols (rounded, weight 400) as inline paths, 10 KB of source. Every text glyph used as an icon (×, ←, ‹ ›, ⇅) and the two hand-drawn SVGs are replaced by it. Font and icons are credited in the README.
- Shared classes in `index.css`: `.button` and `.button-tonal` (pills), `.icon-button`, `.card`, `.icon`, and one focus ring for every control (3 px accent, 2 px offset).
- Search box: a 56 px pill with the wide shadow and no border, with the app's own clear button (new string "Limpar busca") instead of the browser's. Results are a 16 px card.
- Map buttons and MapLibre's zoom and compass: no borders, the wide shadow, icons in primary 700; a pressed button fills with the accent, an open one with the tonal blue.
- Accessibility switch: a white pill with the wheelchair icon that fills with the accent when on. Chips are pills without a border: tonal blue when on, light grey and struck through when off. Legend and layer menu are 16 px cards.
- Toast: a dark pill, its action in primary 300. Status line: a white pill.
- "Rota até aqui" already has the route icon and the pill shape; the swap button in the route panel is a tonal round button. The rest of the sheet is U3 and U4.
- Three tokens added: `--on-inverse-accent`, `--chip-off`, `--on-chip-off`; their pairs are in the contrast test.
- Checked with screenshots of the eight screens at both sizes, no console errors. **Not done:** the keyboard pass over the map's controls listed in the plan; the ring is one global rule, but I did not tab through the page.

### U3: the bottom sheet (2026-10-04)

- On a phone the map now fills the screen and the sheet (`src/ui/BottomSheet.tsx`) lies over its bottom with 28 px top corners and a handle. It rests at three heights: header only, 45% of the screen, and the screen minus 88 px (the search box stays in reach). A sheet is never taller than its content, and it grows by itself as its content loads.
- Dragging the handle or the header moves it; on release it goes to the nearest rest, or one rest further in the direction of a flick (0.4 px/ms or faster). The rules are in `src/ui/sheetSnap.ts` with unit tests. The handle is a button ("Expandir painel" / "Recolher painel"): a click raises the sheet one rest, or collapses it from the top; arrow up and down move it; `Esc` closes it. A collapsed sheet's content is `inert`.
- `--sheet-cover` (set on the page as the sheet moves) lifts the attribution, the status line, the toast and the floor switcher, so they ride on the sheet. It stops at 60% of the screen: a full sheet covers them, except the toast, which stays on top.
- The camera: `src/map/SheetPadding.tsx` gives MapLibre the covered height as bottom padding once the sheet rests, so a selected place, a route and a floor plan are centred in the part of the map that shows. When the user moves the sheet the map does not move; when the sheet grows within 1.5 s of the app moving the camera, the target is kept centred.
- Sheet titles are Title 24/32 semibold in the heading colour. Wide screens keep the panel beside the map, with no handle and no behaviour change.
- Checked in headless Chrome at 390 × 844: drag up and down between the three rests, handle click, arrow keys, close by tap and by `Esc`, with a building, the indoor map, a route and a stop; the attribution and the floor switcher measured above the sheet at every rest; no console errors. Screenshots at 1280 × 800 for the wide layout.
- **Not verifiable here:** a real flick (the test's synthetic drags are too slow to count as one, so flicks are covered by the unit tests only), touch behaviour, and how the map's small shift feels when a sheet opens.

### U3 additions after the user's review (2026-10-05)

- **Dragging from the content**, with a finger. Below its highest rest the sheet follows any vertical drag on its content, and the content does not scroll. At its highest rest the content scrolls, and a drag down moves the sheet once the content is at its start. A sideways swipe is left to the row of chips or the photos under the finger. The mouse keeps the handle and header for dragging, so text can still be selected; turning the wheel over a sheet that is not at its highest rest raises it one rest.
- **The sheet collapses to its header when a floor plan is opened** ("Ver planta interna"), and the plan is fitted to the map above it. Closing the plan leaves the sheet as it is; the handle raises it again.
- Checked in headless Chrome with touch events at 390 × 844: content dragged up from half to full, scrolled at full and back, dragged down from its start to a lower rest, a tap on a button in the content still pressing it, and the collapse on opening the plan. No console errors.

### U4: panel contents (2026-10-05)

- **Sheet header and actions**: the subtitle has an icon for the kind of thing (place, institute, bus, floor). Below the header is one row of actions that scrolls sideways on a phone and wraps beside the map: "Rota até aqui" as the filled pill, then tonal pills for what the place offers today ("Ver planta interna", the website). The website pill shows the host name with a globe icon and moved up from the body into this row. "Seguir" on a bus is a tonal pill.
- **Section headings** inside a sheet are Subtitle 20/28 in the heading colour, no longer small capitals (the layer menu keeps a smaller one). Link rows are accent text in medium weight with a divider between them.
- **Accessibility block**: the status is a chip (dark green with white text for accessible, amber with dark text for partial, red with white text for not accessible, grey for unknown), still with its symbol and words. Toilet, lift and parking are neutral chips, the first two with icons. In lists of a building's features the status keeps its round coloured symbol.
- **Photos and Wikipedia**: 16 px corners on the photo and its loading placeholder.
- **Stops**: taller rows, the line badge with 8 px corners, "acessível" as a small neutral chip.
- **Route**: from and to in one white card with a divider and the swap button; the end being chosen is tinted with an accent bar. Profiles are 44 px pills, the chosen one filled and the other tonal. The time is in Heading 32/40 with the distance beside it. Steps have more room.
- **Floor switcher**: a pill of round buttons with the current floor filled; the floor's name in a white card.
- Checked with screenshots of each panel raised to its full height at 390 × 844 and beside the map at 1280 × 800 (building, building with accessibility data, institute, POI, accessibility point, stop, route with and without an end being chosen, indoor map, room), no console errors.
- **Not seen:** the bus panel and its stop timeline, because no live bus was on the map during the check. Their classes were restyled only through the shared tokens and the "Seguir" pill.
