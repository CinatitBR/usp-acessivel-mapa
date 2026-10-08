# How Katu Maps estimates a bus's position

The bus position comes from one of two sources: a live GPS fix snapped onto the route line when a fresh one exists, otherwise a linear interpolation between stop times along the route line. The follow button itself computes nothing; it only turns camera-follow on.

This was traced by reading the code only; nothing was run or changed.

Source: `/home/cinatit/projects/Katu-Maps`. All paths below are relative to `apps/map-app/src/map/`.

## Call chain

1. **Departure click starts tracking.** `MapView.tsx:3434` (`onDepartureSelect`) calls `transitStopsLayerRef.current.selectTrip(...)` with the trip id, service date and the boarding stop.
2. **Follow button.** `TransitDeparturesPanel.tsx:331` calls `onFollowRequest`, which at `MapView.tsx:3468` only sets `vehicleFollowEnabledRef` and `setVehicleFollowing(true)`. The button is disabled while `positionStatus === 'unavailable'`.
3. **Polling starts.** `TransitStopsLayer.ts:930` (`selectTrip`) calls `startTripPolling` (`:1015`), which starts two timers: a 250 ms position tick and a data refresh.
4. **Data fetch.** `loadTrackedTrip` (`:1041`) fetches the trip (stops, times, route geometry) via `fetchTransitTrip`, then live observations via `fetchTransitVehicleObservations` (`:1090`).
5. **Route model.** `buildEstimatedTripLeg` (`:375`) turns the trip into a polyline with cumulative distances plus `(distance, time)` anchors, one or two per stop.
6. **Position tick.** `updateEstimatedVehicle` (`:1265`) calls `poseForTrackedTrip` (`:1189`), writes the point to the GeoJSON source `transit-estimated-vehicle`, and fires `onVehiclePose`.
7. **Rendering and camera.** `MapLayerRuntime.ts:47` forwards the pose to the 3D vehicle model (`transitVehicle.setPose`) and to `MapView.tsx:1885`. That callback sets the status shown in the panel and, if following, calls `smoothlyFollowVehicle` (`MapViewportLayout.ts:50`), a 350 ms linear `easeTo`.

## Data source

- **Timetable and geometry:** the trip provider, Digitransit or Transitous (`transit/index.ts:26`). Stop times use realtime values when present, otherwise scheduled ones.
- **Live GPS:** only wired for the `digitransit` provider (`transit/index.ts:31`). It routes by route-id prefix to HSL (MQTT), Nysse/Tampere, Föli, Digitraffic trains, or Digitransit's own `vehiclePositions` GraphQL query.
- **Transitous trips** have no live provider, so they are always estimated.

The marker label says which case applies: `Live`, `Estimated · realtime times`, or `Estimated · schedule` (`TransitStopsLayer.ts:1285`).

## Estimation algorithm

### Building the route model

`buildEstimatedTripLeg`, `TransitStopsLayer.ts:375`:

- The geometry is reversed if that maps the ordered stops onto it with less error.
- Each stop is projected onto the nearest polyline segment, never moving backwards from the previous stop (`nearestPathDistance`, `:335`).
- Each stop yields anchors at its arrival and departure times, so dwell time is a flat segment. Anchors with times going backwards are dropped.
- If fewer than two anchors survive, it falls back to trip start at distance 0 and trip end at full length.

### Schedule-based position

`estimatedDistance`, `TransitStopsLayer.ts:441`:

- Clamp the current time into the trip, find the surrounding anchors, and interpolate distance linearly (constant speed between stops).
- Hold back an "approach reserve" of up to 40 m (or 15% of the segment), which shrinks to zero over the last 15 s, so the bus doesn't appear to arrive early.
- Before the selected departure time at the boarding stop, the bus is capped at that stop's distance, so it never shows as having passed the rider.
- `pathPoseAtDistance` (`:475`) converts distance back to a coordinate and heading on the polyline.

### Live position

`poseForTrackedTrip`, `TransitStopsLayer.ts:1189`; helpers in `transit/vehiclePosition.ts`:

- An observation is accepted only if it matches provider, trip id and service date, and exactly one vehicle matches; ambiguous matches are discarded (`matchLiveObservation`, `:67`).
- The GPS fix is snapped to the route polyline, and the marker moves along the route from its current distance to the new one.
- That move takes the gap between the two GPS samples, clamped to 5–15 s. It never extrapolates past the latest fix.

### Stale data

- A fix is live only if it is at most 60 s old and at most 15 s in the future (`transit/vehiclePosition.ts:9-10`).
- When it goes stale, the marker blends over 5 s from the last live position to the schedule estimate (`blendVehiclePoses`, `TransitStopsLayer.ts:584`).
- If the stop times are unusable (missing or non-monotonic, `transit/tripTimeline.ts:109`), there is no estimate, only live or unavailable.
- The estimate disappears 60 s after the trip's final arrival time.

## Update frequency

| What | Interval | Where |
|---|---|---|
| Position recompute and marker redraw | 250 ms | `TransitStopsLayer.ts:1019` |
| Trip and live refetch, Digitransit | 15 s default | `ServiceConfig.ts:48` |
| Trip refetch, Transitous | 60 s default | `ServiceConfig.ts:49` |
| Extra refetch after the first live fix | 4 s, once | `TransitStopsLayer.ts:48`, `:1158` |
| Camera follow ease | 350 ms per pose | `MapViewportLayout.ts:50` |

Polling stops when the tab is hidden and restarts when it becomes visible (`TransitStopsLayer.ts:610`). Camera follow skips a tick if the user touched the map in the last 400 ms. After a departure click, auto-follow begins only once the bus has left its first stop (`MapView.tsx:1889`).

## Not covered

The Nysse, Föli, Digitraffic and Transitous provider files were not read in detail; only the HSL one and the shared matching logic.
