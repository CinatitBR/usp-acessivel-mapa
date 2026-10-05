# Reports plan: user reports on the campus map

This is a plan of its own, separate from `PLAN.md`, `INDOOR_PLAN.md` and `UI_PLAN.md`. It records a brainstorm with the user on 2026-10-05. The user asked for it to be built on 2026-10-05, one milestone at a time. R1 is built; R2 to R5 are not.

## Context

The app is an information and accessibility map of the USP Butantã campus. The user wants reports made by users on the map, in the spirit of Waze, with one purpose: **to help people with a physical disability move around the campus**.

An earlier project, `~/projects/usp_acessivel` (Flutter), has a mocked version in `lib/features/map`. What it has, and what was learned from it:

- Two implementations that do not connect: reports read from a backend (`MapReport`, 7 types, a severity, a banner when tapped) and a mocked three-step creation flow (class, subtype, optional photo; position from GPS; kept in memory only). The two use different vocabularies.
- Worth keeping: the effort level. Three taps, large tiles, concrete names.
- Missing: any life after creation (no confirmation, expiry or "resolved"), any link to the thing reported or to routes, a way to correct the position, and a severity that means the same to a cane user and a power-chair user.
- The Waze comparison only half fits: Waze hazards are short-lived and seen by thousands; campus barriers are mostly permanent and reporters are few. Most reports are corrections to the map; a few are true alerts.

The value of a report comes from three things: it is still true, it is on my way, and someone acts on it.

## Decisions taken with the user

| Topic | Decision |
|---|---|
| Kinds | Both temporary alerts and permanent barriers, with different lifetimes |
| Who reports | Anyone, anonymously |
| Types | Five, as few and as clear as possible (below) |
| Sending | One tap in the app; the Worker passes the report on |
| Publishing | A spreadsheet is the live source: rows marked "publicar" are served by the Worker |
| Visibility | Temporary reports always on the map, with a switch in the layer menu |
| Routes | Warn first; later the step-free route detours automatically |

Two of these stretch decisions fixed in `PLAN.md` ("static data", "one tiny Worker for secrets"): the Worker forwards reports and serves published ones, and a third-party spreadsheet acts as a small database. The user chose this knowingly; it is a backend that is not built or hosted here.

## The five types

The user never sees "temporary" or "permanent"; the type and the answer decide it.

| # | Name shown | Covers | Lifetime |
|---|---|---|---|
| 1 | Passagem bloqueada | obra, tapume, galho, entulho, veículo na rampa, entrada acessível fechada | temporary |
| 2 | Degrau ou falta de rampa | guia sem rebaixamento, degrau na entrada, entrada sem rampa | permanent |
| 3 | Calçada estreita | a cadeira não passa, ou passa apertado | permanent |
| 4 | Elevador | "não funciona" (temporary) or "não existe" (permanent) | by the answer |
| 5 | Banheiro acessível | "interditado" (temporary) or "não existe" (permanent) | by the answer |

- Question for types 1 to 3: **"Dá para passar?" Sim · Só com ajuda · Não.** It replaces severity. Types 4 and 5 have their own two answers.
- An optional note. Nothing has to be typed.
- Left out on purpose, at the user's request: slippery or flooded ground, and broken pavement (roots, holes). Also left out: steep ramps (too subjective without measuring), and anything for other disabilities (tactile paving, sound signals).
- Default expiry of temporary reports, to be tuned with real data: blocked passage 30 days for works and 3 days otherwise, elevator and toilet 14 days. These numbers are guesses.
- Every report and every accessibility symbol gets the same two buttons: **"Continua assim"** (renews the date) and **"Mudou"** (asks what it is like now).

## Reporting screens

Built on what the app has since the redesign: the draggable sheet, the row of action pills, and picking a place by tapping the map as the route panel does.

- **Two ways in**: a "Relatar" pill in the panel of a building, elevator, ramp or entrance (the place is known); and a third round button on the map (the place is chosen first).
- **1. Onde?** Only from the map button. "Toque no mapa onde está o problema", plus "Usar minha localização". A tap drops the pin, another moves it; no dragging, no long press. A tap on a building or an elevator attaches the report to it.
- **2. O que?** Two to four large rows, each with an icon, the name and a line of examples. On a path: types 1, 2, 3. On a building: 1, 2, 4, 5. On an elevator: skipped.
- **3. One question, then "Enviar"**, with a one-line summary above the button.
- Three taps for a broken elevator, four from a building, five from the map button.
- After sending: "Relato enviado. Ele aparece no mapa depois de revisado." The person's own report shows on their device at once, hollow with a dashed outline, "aguardando revisão".
- A report made offline is kept on the phone and sent when the connection returns.
- For limited hand mobility: one decision per step, a back arrow on each, rows of at least 56 px, no gestures, no time limit, keyboard and screen reader as in the rest of the sheet.

## On the map

- **Permanent reports need no new look.** Once published they are accessibility data and use the existing symbols, shapes and colours (green circle, amber square, red diamond, hollow grey). Only "Calçada estreita" needs a new symbol.
- **Temporary reports are triangles**, the one shape not yet used: a barrier for a blocked passage, the elevator arrows struck through, "WC" struck through. Red when it cannot be passed or used, amber when it can with help.
- A triangle about a thing already on the map replaces that thing's symbol, and the building's panel says "Elevador fora de serviço · relatado há 3 dias". Two reports on one spot: the worse one shows.
- **A tapped report**: type, place, the status chip, "Relatado em 3 out · vale até 17 out", the note if published, "Continua assim" and "Mudou".

## Routes

- **Level 1, warn.** Reports within about 10 m of the route are listed in the route panel in the order they are met, and drawn larger on the map. A report on the destination building is shown before setting off ("O elevador deste prédio está fora de serviço").
  - Step-free route: types 1, 2, 3 on the way, 4 and 5 at the destination.
  - Walking route: only a blocked passage that cannot be passed.
- **Level 2, detour.** The step-free route avoids a small circle around each published "não dá para passar" report, automatically, and says what it costs ("Rota desviando de 1 bloqueio (+180 m)"). If there is no way around, the usual route with the warning on top.
- Rules: only published reports change a route (a person's own unreviewed report warns only them); "só com ajuda" warns and never detours; pins are snapped to the nearest path when published; expired reports do nothing; the app never says a route is clear.

## Review and publishing

- **Arrival**: the Worker checks the report (one of the five types, inside the campus, short text, a limit per sender, a bot check), adds a row to the spreadsheet and notifies the reviewers.
- **Review**: open the row, follow its link to the spot in the app, set a status: publicar, duplicado or recusar. Free-text notes go public only when copied into a "public note" column.
- **Live**: the Worker serves the published rows, refreshed every few minutes. No deploy.
- "Continua assim" extends a published report's date by itself. "Mudou" never removes one by itself: it marks it "pode ter mudado" on the map and adds a row to the queue.
- Permanent reports show as soon as published and are moved into the curated overlay from time to time.
- More than one reviewer, ideally two or three people from a campus accessibility group.
- Expected speed: minutes to a few hours. If that is too slow, the next step is trusted reporters whose reports skip review.

## Milestones (for when building is approved)

| | Result |
|---|---|
| **R1** | Published reports on the map: the Worker serves the spreadsheet's published rows; triangles, the narrow-sidewalk symbol, the report sheet, the layer switch; expiry on the device. Filled by hand at first |
| **R2** | Reporting: the two ways in, the three steps, sending through the Worker, the person's own pending report, the offline queue |
| **R3** | "Continua assim" and "Mudou", the date extension, "pode ter mudado" |
| **R4** | Route warnings (level 1), including the destination warning |
| **R5** | Automatic detour (level 2), after a trial of the routing service's "avoid" option |

R1 comes first so that reviewers can publish known problems before anyone can report, and the layer is not empty on day one.

## Open points

- **Not checked**: how the Worker writes to and reads from the spreadsheet; whether the routing service's "avoid areas" option works well with its wheelchair profile on campus paths; what bot check suits a one-tap flow.
- **Not discussed yet**: how to get the first reports (seeding from the old project's survey data and photos, a survey day with students with disabilities); how reports reach whoever repairs things on campus, which I do not know; photos (left for later: they need moderation, stripped metadata and storage); privacy wording for an anonymous report with a position.
- **To decide when building**: what counts as "the same sender" for the limit; how long a "pode ter mudado" mark stays without review; whether the walking route should warn at all.
- **Measure before growing it**: reports per week and the share that could be published. That number decides whether a real database, trusted reporters or photos are worth building.

## As built

### R1: published reports on the map (2026-10-05)

- **Decision (user):** the spreadsheet is a Google Sheet, and the Worker reads one tab of it published to the web as CSV. No credentials.
- **Worker:** `GET /reports` (`worker/src/reports.ts` + test) fetches the tab named by the `REPORTS_CSV_URL` variable, keeps the result five minutes and answers `{ reports: [...] }`. It finds the columns by header (`id`, `tipo`, `resposta`, `lng`, `lat`, `alvo`, `desde`, `ate`, `nota`) and passes on nothing else, so a stray column in the tab does not reach the app. Rows that are incomplete, off campus, repeated or badly dated are left out. It accepts what a spreadsheet with Brazilian settings writes: `-46,73`, `05/10/2026`, `Não`. With the variable empty, as it is now, there are no reports.
- **Words in the spreadsheet:** `tipo` is bloqueio, degrau, estreita, elevador or banheiro. `resposta` is sim, ajuda or nao for the first three; quebrado or inexistente for an elevator; interditado or inexistente for a toilet. `alvo` is the id of the building or accessibility point, when there is one.
- **App:** `src/domain/reports.ts` (what is temporary, the last day, the status colour) and `src/features/reports/` (fetching every five minutes, symbols, layers, the sheet). Temporary reports are triangles, always drawn, with the "Avisos temporários" switch in the layer menu; permanent ones are squares and diamonds in the accessibility view. Where two share a spot the worse one shows. An accessibility point with a temporary report on it gives way to the triangle. A building's panel lists the reports about it or its points.
- **Expiry** is judged on the device from `ate`, or else from a default: 7 days for a blocked passage, 14 for an elevator or a toilet. The plan had 30 days for works and 3 otherwise, but works and other obstacles are one type now, so the reviewer sets `ate` for works. These numbers are still guesses.
- **Different from the plan:** the toilet and elevator triangles are not struck through (the triangle and the red already say it, and a stroke made the small symbol unreadable).
- **Not in R1:** "Continua assim" and "Mudou" on the report sheet (R3), snapping pins to paths, and moving permanent reports into the curated overlay.
- **After the first real row (user's spreadsheet, 2026-10-05):** a coordinate typed with a point in a spreadsheet with Brazilian settings is published grouped by thousands (`-23.562.956`), and the first row had longitude and latitude the wrong way round. The Worker now reads the grouped form and swaps a pair back, since on campus the two cannot be confused. The Worker was then deployed by the user and returns the row.
- **Known risk:** in the user's browser the request to `/reports` was blocked on the client, most likely by an ad blocker whose lists match that word (inferred, not seen). Visitors with such a blocker would get no reports. Renaming the route would avoid it; not decided.
- **Checked** in headless Chrome at 1100 × 800 and 390 × 844 with nine sample reports served in place of the Worker: each symbol, an expired report staying off the map, two reports on one spot, the sheet of a blocked passage and of an elevator, the building panel, the accessibility view and the switch. The Worker has since been checked against the user's published sheet.
