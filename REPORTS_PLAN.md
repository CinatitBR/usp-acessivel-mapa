# Reports plan: user reports on the campus map

This is a plan of its own, separate from `PLAN.md`, `INDOOR_PLAN.md` and `UI_PLAN.md`. It records a brainstorm with the user on 2026-10-05. The user asked for it to be built on 2026-10-05, one milestone at a time. R1 and R2 are built, and on 2026-10-05 the store moved from a Google Sheet to a Cloudflare D1 database (see "Reports on D1" at the end, which replaces what the sections below say about the spreadsheet and the Form). R3, R4 and R5 are built on that database, which completes the milestones of this plan.

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
- **Changed on 2026-10-08: every report is a pin.** Triangles, squares and diamonds came from the same painter as place and accessibility symbols and read as one more of them. A report is now a round pin on a short tip, about 1.5 times a place symbol with its tip on the spot, a white rim and a shadow, drawn above every other symbol and never hidden. Its head shows a small drawing in its own colours instead of a one-colour pictogram (`src/features/reports/scenes.ts`): a striped barrier, a staircase, a sidewalk pinched between two arrows, elevator doors, a toilet. Red when it cannot be passed or used, amber when it can with help; one's own unreviewed report is white with a dashed outline and a faded drawing. The shape no longer tells temporary from permanent: the sheet does. What shows when (the layer switch, the accessibility view) is unchanged.
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

### R2: reporting (2026-10-05)

- **Decisions (user):** new reports reach the spreadsheet through a Google Form linked to it; abuse is held back by a rate limit only, no bot check for now; the route keeps the name `/reports` although an ad blocker blocked it in the user's browser.
- **Worker:** `POST /reports` takes `{ type, answer, at, target?, note? }`, checks it (a known type with one of its own answers, a place on campus, an id-shaped target, a note of at most 280 characters, a body of at most 2 KB) and submits a row to the Form. It needs an `Origin` it knows, and allows 3 reports a minute per network address (`REPORT_LIMITER`). It stores nothing. The row is written in the spreadsheet's own words and with decimal commas, so an approved row can be copied to the published tab as it is; a note that starts like a formula gets an apostrophe in front.
- **Connecting the Form:** `REPORTS_FORM_LINK` holds a pre-filled link of the Form in which every question was answered with its column name. The Worker reads from it the form's address and which field is which column. Empty, as it is now: sending fails and the report waits on the device.
- **App** (`src/features/reports/`): a third round button on the map and a "Relatar" pill in the panel of a building or an accessibility point. Three steps in the sheet, each with a way back: where (a tap on the map, or "Usar minha localização"; a tap on a building or on an elevator or toilet symbol attaches the report to it), what (the types that fit the place; skipped for an elevator or a toilet), and one question with an optional note and "Enviar". While a report is being written, taps on the map only move its place.
- **The person's own reports** are kept on the device (`usp-map:my-reports`) and drawn hollow with a dashed outline, in every view. Their sheet says "Aguardando revisão" and can remove them. They leave by themselves after 14 days: the app cannot tell when a reviewer has published or refused one, since the published row gets an id of the reviewer's own.
- **Without a connection**, or when the Worker cannot be reached, the report is kept unsent and tried again when the browser comes back online, every minute while the app is open, and when it is next opened. A report the Worker refuses is dropped.
- **Different from the plan:** the place cannot be attached to a ramp, entrance, kerb or steps as a kind of its own; such a point is remembered as the report's target and the types offered are those of a path.
- **Checked** in headless Chrome at 390 × 844 and 1100 × 800, with the Worker's answers simulated: both ways in, the three steps, the limit message, a sent report, a report kept while unreachable and sent on the next start, the pending symbols, a pending report's sheet and its removal. Found and fixed there: the same waiting report could be sent twice. **Not checked:** the Worker against a real Google Form (none exists yet), "Usar minha localização", and anything on a real phone.

### R2 addition: the Worker gives the id (user's idea, 2026-10-05)

- The Form has every column of the published tab. The Worker makes the `id` (`r-` and eight characters), leaves `ate` empty and answers `{ ok, id }`. A row is then published exactly as it arrived.
- The app keeps its own report under that id and drops the hollow copy as soon as the same id appears among the published reports. A report sent before this change, or published under another id, still leaves after 14 days.

## Reports on D1 (2026-10-05)

The user asked to keep reports in a Cloudflare D1 database instead of the Google Sheet and Form, which had proved awkward (number formats, a pre-filled link mapping fields to columns, rows copied between tabs, and formulas needed for R3). Decisions taken with the user:

| Topic | Decision |
|---|---|
| Store | Cloudflare D1, the only store. The Google Sheet and Form are removed |
| Review | A review page in the app, protected by a reviewer password kept as a Worker secret |
| "Mudou" | One more question: "Foi resolvido" or "Está diferente", plus an optional note |
| "Pode ter mudado" | Stays until someone confirms the report again, a reviewer deals with it, or the report ends |

Milestones from here: **D1** the store swap, **D2** the review page, **R3** "Continua assim" and "Mudou", then R4 and R5 as above.

Not in this plan: the two buttons on the existing accessibility symbols (static data; an answer about them would need its own table), and a notification to reviewers when a report arrives (the Form could e-mail; D1 does not).

### D1: the store swap (2026-10-05)

- `worker/migrations/0001_reports.sql`: the tables `reports` (with the reporter's `note`, never served, and the reviewer's `public_note`, the only one the map shows; `status` pending, published, refused or duplicate) and `report_feedback` (for R3). `0002_first_report.sql` carries over `r12`, the one report that was in the spreadsheet. Binding `DB`; `npm run db:migrate` and `npm run db:migrate:local`.
- `GET /reports` reads the published rows that have not passed a reviewer's end date; browsers may reuse it for 60 s, and the app now asks every 2 minutes. `POST /reports` checks the report as before and stores it as pending. Queries are written with Drizzle ORM (`worker/src/reportsDb.ts`, tables described in `worker/src/schema.ts`), which binds every value. The migrations stay hand-written SQL applied by Wrangler, so `schema.ts` and the migrations must be kept saying the same thing.
- Removed: the CSV reading, the Form submission, their settings `REPORTS_CSV_URL` and `REPORTS_FORM_LINK`, and their tests. The app is unchanged apart from the refresh time: same routes, same JSON.
- Until D2, publishing is a `wrangler d1 execute` command (README).
- **Checked against a local D1** with real requests to `wrangler dev`: the migrated report is listed; a new report is stored as pending and not listed; a wrong answer for the type, a body that is not JSON, a missing or foreign `Origin` are refused; the limit answers 429; a note written like SQL or a formula is stored as plain text; publishing with an end date in the past keeps it off the list, in the future puts it on, with the public note. 
- **Drizzle and names (user, 2026-10-05):** the Worker's queries use Drizzle ORM; the feedback table is `report_feedback`; the database is `usp-campus-db`.
- **Live:** the remote database was created (region ENAM, chosen by Cloudflare), both migrations applied to it, and the Worker deployed. The live `GET /reports` returns `r12` from D1, and a report with a wrong answer is refused with 400. A real report was not sent to the live database, so as not to leave a test row in it. The app on Pages was not redeployed.
- **Two more reports carried over:** when the Worker was switched, the spreadsheet's published tab held two reports besides `r12` (`r-a6758a97` and `r-19aa2bce`, both a step that cannot be passed, about 10 m apart, sent through the app that day). `0003_spreadsheet_reports.sql` brings them over as published, so the map shows what it showed before. They may be the user's tests; if so they are to be withdrawn.
- **Migrations from the schema (user, 2026-10-05):** migrations are generated from `worker/src/schema.ts` with `drizzle-kit` (`drizzle.config.ts`, `npm run db:generate`), no longer written by hand. `20261005232644_baseline.sql` is the starting point: its snapshot describes the tables the three hand-written migrations created, and the file itself does nothing. Generated names carry a timestamp, so they sort after `0001` to `0003`. Checked: with the schema unchanged the generator reports nothing to migrate; with a trial column added it wrote only `ALTER TABLE reports ADD trial text` (then removed). The SQL it would write for the whole schema matches `0001_reports.sql`, except that it marks the text primary key `NOT NULL`, which the existing table does not; ids are always given by the Worker, so this makes no difference in use.

### D2: the review page (2026-10-05)

- **Worker:** `GET /review/reports` (the pending reports, oldest first, and the published ones) and `POST /review/reports/:id` (`{ status, until?, publicNote? }`). Both need `Authorization: Bearer` with the reviewers' password, the secret `REVIEW_TOKEN`; both sides are hashed and compared in constant time, and without the secret nobody gets in. `REVIEW_LIMITER` allows 30 requests a minute per client. A fifth status, `withdrawn`, is for a report taken off the map after being published (no migration: the column is free text).
- **Page** (`src/features/review/`, at `?revisar`, its own chunk): asks for the password and keeps it on the device until "Sair"; a refused password is forgotten and asked again. **Pendentes**: what, whether one can get through, the place, the date, "Ver no mapa", the reporter's note marked as not public, and Publicar, Duplicado, Recusar. Publicar opens two fields, the end date and the public note, the latter filled with the reporter's note for the reviewer to edit or clear. **Publicados**: the same two fields with Salvar, and Retirar do mapa.
- For local work the password is `revisar-local`, in `worker/.dev.vars` (not in git).
- **Checked end to end** in headless Chrome at 390 × 844 against the local Worker and database, nothing simulated: a report sent from the app, with a phone number in its note, shows as pending; a wrong password is refused; publishing with an edited note and an end date puts it on the public list with only the edited note; back on the map the person's hollow copy is gone and the published report opens; changing the end date and withdrawing work. With `curl`: no password and a wrong one get 401, a badly written date 400, an unknown id 404.
- **Not done:** the secret `REVIEW_TOKEN` is not set on the deployed Worker, so D2 is not deployed. **Not built:** "Mudanças relatadas", which belongs to R3; a notification when a report arrives.

### R3: "Continua assim" and "Mudou" (2026-10-05)

- **Worker:** `POST /reports/:id/feedback` takes `{ kind, note? }` with `kind` still, resolved or different, only for a report that is on the map (404 otherwise), 10 a minute per client (`FEEDBACK_LIMITER`). `GET /reports` now gives each report `confirmed`, the São Paulo day of the last "continua assim", and `changed`, true while a "mudou" no reviewer has dealt with is newer than that. The notes of these answers are never served publicly. No schema change: `report_feedback` was already there.
- **The rule** (`summarize` in `worker/src/reports.ts`): a later "continua assim" clears the mark; a "mudou" never takes a report off the map by itself.
- **Last day:** a temporary report lasts at least its type's default days (7 or 14) from its last confirmation, even past the end date a reviewer gave (`lastDay` in `src/domain/reports.ts`). So the Worker keeps serving a report for 14 days after its end date and the app decides.
- **App:** under a published report, "Continua assim" and "Mudou". "Mudou" asks "Foi resolvido" or "Está diferente", with an optional note, then "Enviar". After answering, the person sees a thank-you instead of the buttons; one answer per report per device per day, remembered on the device. "Pode ter mudado" shows on the report's sheet and in the building's list; the dates line gains "confirmado em".
- **Review page:** "Mudanças relatadas" lists the reports with unhandled answers, what was said and when, with "Retirar do mapa" and "Manter no mapa" (`POST /review/reports/:id/keep`). Any decision about a report also marks its answers as dealt with.
- **Checked end to end** against the local Worker and database, in headless Chrome at 390 × 844 and with `curl`: a report whose end date had passed stayed on the map because it was confirmed; "Continua assim" cleared the mark and showed the thank-you; reopened the same day, the buttons stayed away; "Mudou" with "Foi resolvido" and a note set the mark; the review page showed the answers with their notes; "Manter no mapa" cleared it; answers about an unknown report, with a wrong kind or without an `Origin` were refused; a note with a phone number never appeared in the public list.
- **Limits:** the person's own answer shows at once on their device, but a page reloaded within a minute can still show the previous state, because browsers may reuse the list for 60 s. Other people see a change within about two minutes. The one-a-day rule is only on the device; the Worker's limit is per minute, so someone determined can answer repeatedly. Answers cannot be sent without a connection; they are not queued.
- **Not built, as planned:** the two buttons on the existing accessibility symbols (ramps, kerbs and so on).

### R4: route warnings (2026-10-05)

- **The rule** (`src/features/reports/onRoute.ts` + test): a report counts when it lies within 12 m of the route line (the plan said about 10; pins are rarely exactly on the path). On a step-free route: a blocked passage, a step, a narrow sidewalk on the way, and an elevator or accessible toilet of the destination. On foot: only a blocked passage that cannot be passed. They are listed in the order they are met, those about the destination last.
- **The destination's building** is the one whose centre the route ends at, which is how "Rota até aqui" and the search set a destination. A report about an elevator or toilet counts when it belongs to that building, wherever its pin is; one that names no building counts when it is within 25 m of the destination.
- **Route panel:** "N relatos nesta rota", each with what it is, whether one can get through, and "a 180 m do início" or "no destino", plus "pode ter mudado" when marked. Tapping one opens its sheet and moves the map there. With no reports nothing is shown: the panel never says a route is clear.
- **On the map:** reports on the route are drawn a third larger, and are drawn whatever the view, so a step on a step-free route shows even with the accessibility view off.
- **Whose reports:** the published ones, and the person's own that wait for review, which warn only on their device.
- **Checked** in headless Chrome against the local Worker and database with a real route (IME to the Vilanova Artigas building, step-free through openrouteservice and on foot through Valhalla) and three reports published along it: the step-free panel listed the step at 60 m, the blocked passage at 180 m and the elevator at the destination; on foot only the blocked passage; tapping a warning opened its sheet. A far-away report and another person's pending report being left out are covered by the unit tests only: the test's fourth and fifth reports were stopped by the Worker's own limit of three a minute.
- **Not done:** pins are not snapped to the nearest path when published (the plan asked for it; the 12 m allowance stands in for it). The route is not changed; that is R5.

### R5 trial: openrouteservice "avoid areas" with the wheelchair profile (2026-10-05)

Twelve direct requests to openrouteservice, same settings as the Worker uses for a step-free route, with a small circle to avoid placed on the route it had just given:

| Case (IME → FAU, 397 m) | Result |
|---|---|
| Block at 60% of the way, circle of 5, 8, 12 or 20 m | 469 m (+72 m) every time; the new route passes 110 m from the spot |
| Block at 30%, 8 m | 397 m (+0 m), passing 12 m from the spot: a parallel path of the same length |
| Block at the very start, 8 m | 392 m (−5 m): it starts from another point nearby |
| Block at the very end, 8 m | 453 m (+56 m): it arrives from another side |
| Two blocks at once (30% and 60%) | 469 m (+72 m) |
| Block far from the route | 397 m, unchanged |
| FEA → IME (384 m), block at 50%, 8 m | 525 m (+141 m), passing 26 m from the spot |

- The option works with the wheelchair profile on campus paths, takes several areas at once, and leaves the route alone when the area is elsewhere.
- No case gave "no route", so that answer was not seen; it still has to be handled.
- The 30% case shows why the circle's size matters: a parallel path 12 m away stayed open with an 8 m circle. A circle as wide as the distance at which a report counts as "on the route" (12 m) is sure to cut the path that set off the warning, at the price of sometimes closing a parallel one too.
- Each detour costs one more request to openrouteservice than a plain route.

### R5: automatic detour (2026-10-05)

- **Decision (user):** the route keeps 8 m away from a report, not the 12 m at which a report counts as on the route. A parallel sidewalk stays open more often; a pin placed 9 to 12 m from its path is warned about but not gone around.
- **Worker:** `/ors/route` takes `avoid`, up to 8 report ids. For the step-free profile it looks them up in the database and keeps only those that are published and say one cannot get through a passage, a step or a sidewalk, then asks openrouteservice to stay out of a twelve-sided ring of 8 m around each (`avoidPolygons` in `worker/src/ors.ts`). The app never sends positions or areas, so a route cannot be bent with anything but published reports. "No route" from openrouteservice is answered as 404 `no_route`. The cache entry includes the reports gone around.
- **App** (`src/features/routing/detour.ts` + test, `useRoute.ts`): the step-free route is asked for as before; if published blocking reports lie on it, it is asked for again going around them, and once more if the way around meets another one. The panel then says "Rota desviando de 1 bloqueio relatado (+130 m)"; the number is left out under 10 m. If there is no way around, the usual route is shown with "não encontramos um caminho sem degraus que desvie dele"; if going around changes nothing, the usual route is shown with its warnings as in R4. A route that came from the fallback service is left as it is, since only openrouteservice can keep out of an area. A new published report makes an open route be worked out again.
- **Not changed:** the walking route, and reports that say "só com ajuda", which only warn.
- **Checked** against the local Worker and database with real requests: for IME to the Vilanova Artigas building the usual step-free route is 310 m; with a blocked passage published at 60% of it, the Worker's answer for `avoid` with that id, a "só com ajuda" id and an unknown id was a 438 m route, and the app showed 440 m, "Rota desviando de 1 bloqueio relatado (+130 m)", on a different path; the walking route kept its usual path and listed the block as a warning. **Not seen in a real run:** "no way around" and the second round, which are covered by unit tests only.
- **Cost:** one more request to openrouteservice per round, only when a blocking report is on the route; the Worker allows 10 route requests a minute per client.
