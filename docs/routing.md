# Routes

The round arrow button (or "Rota até aqui" in any detail panel) opens the route panel. Each end is a field in the panel: type in it and pick one of the places listed under it, or "Usar minha localização", which is always the first of them. The panel opens with the cursor in the end that is still missing. The kinds of route are tabs under the two ends:

| Kind | First choice | Fallback |
|---|---|---|
| A pé | Valhalla (public FOSSGIS server, called directly) | openrouteservice `foot-walking` |
| Sem degraus | openrouteservice `wheelchair`, which excludes stairs | Valhalla's wheelchair mode, which only avoids them: the panel then says "pode conter degraus" |
| Transporte (public transport) | Transitous `GET /api/v5/plan`, called directly | none: the panel says that journeys could not be fetched |

The clock button beside the tabs opens the choice of when to travel: "Sair agora", "Sair às" or "Chegar às" with a date and time, read on the São Paulo clock. It decides which journeys are listed; for the two walking kinds it only adds when the walk starts and ends.

"Transporte" lists the journeys Transitous finds (`src/features/routing/providers/transitousPlan.ts`): when each leaves and arrives, how long it takes, whether one changes vehicle, and its legs in a row with each line in its own colour from the timetable feed. A journey opens its details: every place where something changes, with its time, on a rail that is dashed where one walks and in the line's colour where one rides, and the stops a ride passes folded under it. The journey is drawn on the map the same way while its details are open. Transitous has no realtime feed for São Paulo, so these are timetable times, and the panel says so. Journeys are not yet filtered for step-free access.

When the bus of a ride is one of the tracked ones, the details offer "Seguir ônibus" with the live time at the stop where one boards. It is found through that stop's arrivals: the tracked bus of the same line that reaches it within 8 minutes of the timetable. It opens the bus's panel, following it, with "Detalhes da viagem" as the way back.

The camera flies to a bus that starts being followed: it rises and comes down by as much as the bus is far, and only then keeps it centred. Going back from a bus's panel, to the stop's arrivals or to the journey, puts the camera exactly where it was when the bus was opened (`src/features/transit/FollowCamera.tsx`). Closing the panel leaves the camera where it is.

A route or a journey is framed on the map when it arrives (`src/features/routing/frame.ts`). The camera is not kept to the campus, since either may end anywhere in the city. MapLibre fits bounds as if the map were seen from above, which cuts off the near end of a route on a tilted map, so the fit is corrected by measuring the path on the screen before the camera moves.

Stairs on a route are drawn dashed in orange and flagged in the step list. openrouteservice is reached through the Worker (`GET /ors/route?profile=&from=&to=`), which holds the key, builds the request itself, caches each answer for 5 minutes and allows 10 requests a minute per client. Put the key in `worker/.dev.vars` as `ORS_API_KEY=...` for local use and upload it with `npx wrangler secret put ORS_API_KEY -c worker/wrangler.jsonc` before the next `npm run deploy:worker`. Without a key the app still routes, through Valhalla alone.

## Decisions

| Decision | Reason |
|---|---|
| Routes are asked for only on an explicit action, never while dragging | Fair use of the public Valhalla and ORS |
| The Worker builds the ORS request (`GET /ors/route`) instead of forwarding a body | A client can choose only the profile, two points in Greater São Paulo and report ids; answers are cacheable by URL |
| Valhalla's step-free result is labelled "pode conter degraus" | Valhalla can only penalise stairs, not exclude them |

## Known gaps

- Public transport journeys are not filtered for step-free access.
- Transitous has no realtime feed for São Paulo, so journey times are timetable times.
