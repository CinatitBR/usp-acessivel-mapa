# Plan: draft `journey.md`, the user-journey spec for the slide deck

## Context

You will build an interactive slide deck in Claude Design that explains what the app does, one slide per screen + important user action. Claude Design needs a written spec to build from, and later a screenshot per slide. This step produces only the spec; screenshots are a follow-up.

I read the UI code to find the screens: `src/App.tsx` (map controls), `src/ui/SelectionSheet.tsx` (which panel shows when), `src/state/store.ts` (state transitions), `src/map/MapSelection.tsx` (what a tap on the map does), each feature panel, and `src/strings/pt-BR.ts` (the exact labels).

## Deliverable

One new file: `docs/journey/journey.md` (screenshots will later go in `docs/journey/screenshots/`). No code changes, no commit unless you ask.

Assumptions — change any of these when approving:
- `journey.md` is written entirely in **Portuguese**: the prose, the slide titles and the field names, with every UI label quoted exactly as the app shows it (e.g. "Rota até aqui").
- **Phone layout** is the primary one described (bottom sheet over the map); a short note covers the wide layout (panel beside the map, from 760 px).
- The **reviewer page** (`?revisar`) is included as its own chapter, since it closes the report loop.

## Structure of `journey.md`

1. **Visão geral** — what the app is, who uses it (campus visitor, wheelchair user, reviewer), and the one layout every screen shares: map, floating controls, bottom sheet.
2. **Mapa do fluxo** — a short list of how the chapters connect (which slide leads to which).
3. **Slides** — one entry per slide, in this fixed format (shown as it will be written, in Portuguese):

```
### S03 · Painel do prédio
- Etapa/Objetivo: o que o usuário quer fazer aqui
- Ações e pontos de interação:
  - "Rota até aqui" (botão) → S15, com este prédio como destino
  - "Ver planta interna" (botão, só na FAU) → S09
  - …
- Estado a capturar: como chegar à tela e que exemplo usar (para a captura)
- Captura: screenshots/s03-predio.png
```

Each hotspot names the element, its type, and the slide it leads to, so the deck's click-through links can be wired straight from the spec.

## Slide list (30)

**A. Explore the campus**
- S01 Home map — search field, "Acessibilidade" toggle, layers, route and report buttons; tap anything on the map
- S02 Search — typing, campus results, "Fora do campus" section; pick a result
- S03 Building panel — photos and text from Wikipedia, accessibility summary, "Recursos neste prédio", "Rotas visuais", "Rota até aqui", "Ver planta interna", "Relatar", "Site"
- S04 Institute panel — "Rotas visuais", list of its buildings
- S05 Place (POI) panel — opening hours, accessibility
- S06 Layer menu — "Visualização 3D", "Avisos temporários", place category chips

**B. Accessibility view**
- S07 Accessibility view on — buildings coloured by status, legend, kind chips (Rampa, Elevador, …)
- S08 Accessibility point panel — a ramp or elevator: status, floor, its building, "Relatar"

**C. Inside a building**
- S09 Floor plan open (FAU) — floor buttons, close
- S10 Room panel

**D. Visual routes**
- S11 Visual route — opened from an item of "Rotas visuais" in the building or institute panel: numbered steps, each with its instruction and photo; back link to where it was opened from
- S12 Step photo — one photo over the whole screen, "Passo anterior" / "Próximo passo", "Fechar"

**E. Buses**
- S13 Stop panel — "Próximos ônibus", live vs. scheduled; tap an arrival
- S14 Bus panel — following the bus, "Pontos da linha" timeline, "Seguir veículo", back to "Todas as chegadas"

**F. Routes**
- S15 Route panel, empty — "De" / "Para", swap, "A pé" / "Sem degraus"
- S16 Choosing an end — suggestions with "Usar minha localização" first
- S17 Walking route result — time, distance, "Passo a passo", stairs warning
- S18 Step-free route — "Rota sem degraus.", detour around reported blocks, "N relatos nesta rota"

**G. Reporting a problem**
- S19 Step 1, "Onde está o problema?" — tap the map or use location
- S20 Step 2, "O que há de errado?" — the types offered for that kind of place
- S21 Step 3 — the one question, optional note, "Enviar", the anonymity note
- S22 After sending — toast, the report on the user's own map, "Seu relato" panel ("Aguardando revisão", "Remover do meu mapa")
- S23 Published report panel — "Continua assim" / "Mudou"
- S24 "O que mudou?" — "Foi resolvido" / "Está diferente", note, thanks message

**H. Reviewing reports (`?revisar`)**
- S25 Login — "Senha de revisão"
- S26 Pending reports — "Ver no mapa", "Publicar", "Duplicado", "Recusar"
- S27 Confirm publication — "Vale até", "Nota pública"
- S28 Changed and published reports — "Salvar", "Retirar do mapa", "Manter no mapa"

**I. When things go wrong** (two short slides, easy to drop)
- S29 Offline — the status line, routes and arrivals unavailable, a report kept and sent later
- S30 Slow device — the automatic "Modo leve" toast with "Desfazer"

Small states that don't earn a slide are folded into the nearest one as notes: an off-campus place picked from search (S02), the "Há uma nova versão do mapa." update toast (S30), a report that expired while open (S23).

## Screenshots (later, not part of this step)

The "Estado a capturar" line on each slide is written so this step is mechanical. What it will need:
- **Playwright**, added as a dev dependency and pointed at the Google Chrome already installed (`channel: 'chrome'`, so no browser download). One re-runnable script, `scripts/journey-screenshots.ts`, with one step per slide, so the screenshots can be regenerated whenever the UI changes. Phone viewport 390×844 at 2× density.
  - Why not the raw headless-Chrome approach I used for the scroll test: that was fine for one wheel event, but 28 flows need reliable waiting (map idle, sheet settled), tapping by label, a mocked location for "Usar minha localização", and an offline switch for S29. Playwright has all of these built in; by hand they would be fragile.
- The Worker running locally (`npm run worker:dev`) with a few seeded reports and a review password, for chapters G and H.
- `ORS_API_KEY` for S18 and `OLHOVIVO_TOKEN` for S14 (live buses also only exist while buses are running). I'll flag any slide I can't capture for real rather than fake it.

## Verification

- Every control in `src/App.tsx` and every `Selection` kind in `src/state/store.ts` appears in at least one slide.
- Every quoted label is checked against `src/strings/pt-BR.ts`.
- Every "→ Sxx" target exists, and every slide is reachable from S01 (or from `?revisar` for chapter H).
