# Reports

People report barriers from the app ("Relatar"): a blocked passage, a step, a narrow sidewalk, an elevator or an accessible toilet that is out of service or missing. A report is drawn on the map once a reviewer has published it. The purpose is one: to help people with a physical disability move around the campus. Most reports are corrections to the map; a few are short-lived alerts.

## The five types

The person never sees "temporary" or "permanent"; the type and the answer decide it.

| Type (`type`) | Shown as | Answers | Lifetime |
|---|---|---|---|
| `bloqueio` | Passagem bloqueada (works, fence, branch, rubble, a car on the ramp, a closed accessible entrance) | Dá para passar? sim · ajuda · nao | temporary, 7 days |
| `degrau` | Degrau ou falta de rampa | sim · ajuda · nao | permanent |
| `estreita` | Calçada estreita | sim · ajuda · nao | permanent |
| `elevador` | Elevador | quebrado (temporary, 14 days) · inexistente (permanent) | by the answer |
| `banheiro` | Banheiro acessível | interditado (temporary, 14 days) · inexistente (permanent) | by the answer |

"Dá para passar?" replaces a severity, which would mean different things to a cane user and a power-chair user. The default lifetimes are guesses, to be tuned with real data; a reviewer sets "Vale até" for long works. Left out on purpose: slippery or flooded ground, broken pavement, steep ramps (too subjective without measuring), and anything for other disabilities.

## Sending

Two ways in: a "Relatar" pill in the panel of a building or an accessibility point (the place is known), and a round button on the map (the place is chosen first). Then three steps in the sheet, each with a way back: where (a tap on the map, or "Usar minha localização"; a tap on a building or an elevator or toilet symbol attaches the report to it), what (the types that fit the place; skipped for an elevator or toilet), and the one question with an optional note. Rows are large, one decision per step, no gestures, no time limit.

The Worker (`POST /reports`) checks each report (a known type with one of its own answers, a place on campus, an id-shaped target, a note of at most 280 characters), allows three a minute per network address, gives it an id (`r-` and eight characters) and stores it as `pending`. Nothing about the sender is stored.

The person's own reports are kept on the device (`usp-map:my-reports`) and drawn white with a dashed outline, "Aguardando revisão". The copy disappears when the same id shows among the published reports, or after 14 days. Without a connection a report is kept and sent when the browser is back online; a report the Worker refuses is dropped.

## On the map

Every report is a round pin on a short tip, drawn above every other symbol and never hidden, with a small drawing in its head (`src/features/reports/scenes.ts`). Red when one cannot pass or use it, amber when one can with help. Temporary reports always show, with the "Avisos temporários" switch in the layer menu; permanent ones show in the accessibility view. Where two share a spot the worse one shows. A building's panel lists the reports about it or its points.

The public note is the only note the map shows; the reporter's own note stays with the reviewers.

## The database

Reports are the Worker's own data, in a Cloudflare D1 database `usp-campus-db` (tables `reports` and `report_feedback`, described in `worker/src/schema.ts`; queries in `worker/src/reportsDb.ts` with Drizzle ORM). Status is `pending`, `published`, `refused`, `duplicate` or `withdrawn`.

To change the database, change `worker/src/schema.ts` and run `npm run db:generate`: it writes the migration into `worker/migrations/`. Then apply it with `npm run db:migrate:local` and `npm run db:migrate`. Migrations are never written by hand (the first three were, before this was set up; `20261005232644_baseline.sql` is the snapshot of what they created and does nothing itself).

Setting up, once:

1. `npx wrangler d1 create usp-campus-db`, and put the id it prints as `database_id` in `worker/wrangler.jsonc`.
2. `npm run db:migrate` creates the tables in that database. `npm run db:migrate:local` does the same for the copy `npm run worker:dev` uses.
3. `npm run deploy:worker`.

## Review

Reviewers work on the review page, at `…/?revisar` (`src/features/review/`, its own chunk): **Pendentes** (Publicar with "Vale até" and "Nota pública", Duplicado, Recusar), **Mudanças relatadas** (Retirar do mapa, Manter no mapa) and **Publicados** (Salvar, Retirar do mapa). It asks for the reviewers' password, which is the Worker secret `REVIEW_TOKEN`, compared hashed and in constant time:

```
npx wrangler secret put REVIEW_TOKEN -c worker/wrangler.jsonc
```

Choose a long random one and share it only with reviewers. For local work it is `REVIEW_TOKEN=…` in `worker/.dev.vars`.

## "Continua assim" and "Mudou"

Under a published report anyone can say "Continua assim" or "Mudou" ("Foi resolvido" or "Está diferente", with an optional note), once per report per device per day. A confirmation keeps a temporary report on the map for at least its default days from that day, even past the reviewer's end date (`lastDay` in `src/domain/reports.ts`); so the Worker keeps serving a report for 14 days after its end date and the app decides. A "mudou" marks it "pode ter mudado" and lists it under "Mudanças relatadas", but never removes it by itself. A later "continua assim" or a reviewer's decision clears the mark (`summarize` in `worker/src/reports.ts`).

## Reports and routes

A planned route lists the reports within 12 m of its line, in the order they are met, plus those about its destination (`src/features/reports/onRoute.ts`), and draws them a third larger in any view. A step-free route counts blocked passages, steps and narrow sidewalks on the way and elevators and toilets of the destination building; a walking route only passages that cannot be passed. The app never says a route is clear.

A step-free route also goes around published reports that say one cannot get through, keeping 8 m away from each (`AVOID_RADIUS_METERS` in `worker/src/ors.ts`, `src/features/routing/detour.ts`), and says what the way around adds ("Rota desviando de 1 bloqueio relatado (+130 m)"). The app sends only report ids; the Worker looks them up and keeps only published blocking ones, so a route cannot be bent with anything else. If there is no way around, the usual route is shown with a warning. A route from the Valhalla fallback is not changed, since only openrouteservice can keep out of an area.

## Decisions

| Decision | Reason |
|---|---|
| Anyone reports, anonymously; a reviewer publishes | Few reporters, mostly permanent barriers: accuracy matters more than speed |
| D1 is the only store; no Google Sheet or Form | The sheet needed number-format hacks, column mapping and rows copied between tabs |
| Abuse held back by rate limits only, no bot check | Keeps the flow to a few taps |
| Only published reports change a route; a person's own pending report warns only them | Nobody can bend routes for others |
| "Só com ajuda" warns and never detours | The person can still pass |
| 12 m to count as on the route, 8 m to go around | A trial with openrouteservice: 12 m sometimes closed a parallel sidewalk; 8 m keeps it open, at the price of not going around a pin placed 9–12 m from its path |
| The route is still called `/reports` | Chosen even though an ad blocker blocked it once |

## Known gaps

- `/reports` may be blocked by ad blockers whose lists match the word; such visitors see no reports.
- Pins are not snapped to the nearest path when published (the 12 m allowance stands in for it).
- Reviewers get no notification when a report arrives.
- Answers ("Continua assim", "Mudou") are not queued offline; the one-a-day rule is only on the device.
- Answers about the static accessibility symbols (ramps, kerbs) are not possible: they would need their own table.
- Permanent reports are not yet moved into the curated overlay.
- `r-a6758a97` and `r-19aa2bce`, carried over from the spreadsheet, may be test reports; withdraw them if so.
- Not decided: how to get the first reports (a survey day), how reports reach whoever repairs things, photos, privacy wording for a report with a position.
