# Mapa USP Butantã

Mobile-first PWA map of the USP Butantã campus, with accessibility as a top-level feature. Vite + React + TypeScript (strict) + MapLibre, a lazy Three.js layer, and a Cloudflare Worker (Olho Vivo, openrouteservice, reports in D1). The UI is pt-BR only; code, comments and docs are in English.

## Commands

```sh
npm run dev -- --host        # app; reaches the Worker through Vite's /api proxy
npm run worker:dev           # Worker on :8787, secrets in worker/.dev.vars
npm run typecheck            # app and Worker
npm test                     # Vitest
npm run build
npm run check:data           # public/data must stay ≤ 1 MB
npm run data:osm && npm run data:build   # regenerate campus data (data:addresses, data:transit too)
npm run db:generate          # D1 migration from worker/src/schema.ts
npm run db:migrate:local     # apply locally (db:migrate for remote)
```

Before calling a change done: `npm run typecheck && npm test`, plus `npm run build` and `npm run check:data` when the build or data changed.

## Where to read first

| Touching | Read |
|---|---|
| Structure, providers, Worker routes, settled decisions | `docs/architecture.md` |
| `scripts/`, `data/overlay/`, trees, roofs | `docs/data.md` |
| `src/features/transit/`, Olho Vivo | `docs/transit.md` |
| `src/features/routing/` | `docs/routing.md` |
| `src/features/reports/`, `src/features/review/`, D1 | `docs/reports.md` |
| `src/features/indoor/`, `data/indoor/` | `docs/indoor.md` |
| CSS, tokens, `src/ui/`, the bottom sheet, PWA | `docs/ui.md` |
| `public/styles/campus.json` | `docs/basemap.md` |

Each doc ends with **Decisions** (do not reopen without asking) and **Known gaps**.

## Rules

- Every user-facing string goes in `src/strings/pt-BR.ts`.
- Colours, font sizes, weights, radii and shadows only as tokens in `src/styles/tokens.css`; CSS uses the roles, never a scale step. Colours drawn by MapLibre are mirrored in `src/styles/palette.ts`. Tests enforce both.
- App map layers are inserted before an anchor from `src/map/anchors.ts`, never before a basemap layer id.
- Providers export a pure `parse…()` tested against recorded responses; components only see domain types.
- No Overpass or Nominatim calls at runtime; campus data is built by scripts and committed in `public/data/`.
- D1 migrations are generated from `worker/src/schema.ts` with `npm run db:generate`, never written by hand.
- Secrets live only in `worker/.dev.vars` (local) and Wrangler secrets; never in source, the bundle or logs.
- Keep files under about 300 lines; split by responsibility.
- `npm run journey:screenshots` is slow and needs live services: run it only for large UI changes. When a screen changes, update its slide in `docs/journey/journey.md` and its test in `scripts/journey/slides.spec.ts` together.
- Commit only when asked.

## Keeping docs current

- Do not add plan or report files at the repository root. Plans are made in plan mode; one-off research goes in the conversation.
- When a change lands, update the matching `docs/*.md` in the same change: describe how it works now (not the history), add any decision worth protecting to **Decisions** with its reason, and add or remove **Known gaps**.
- Personal, machine-local preferences belong in auto memory or `CLAUDE.local.md`; rules every session needs belong here.
