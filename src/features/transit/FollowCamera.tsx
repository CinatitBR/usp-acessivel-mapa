import { useMap } from '@vis.gl/react-maplibre';
import type { CameraOptions, MapLibreEvent } from 'maplibre-gl';
import { useEffect, useRef } from 'react';
import { useAppStore } from '../../state/store';
import { busTracker } from './busTracker';

const STEP_MS = 500;
/** Following starts at least this close, so the bus and the stops around it can be told apart. */
const FOLLOW_MIN_ZOOM = 16.5;
const RETURN_MS = 600;

/**
 * Keeps the selected bus in the centre of the map while `followBus` is on. It flies to the bus
 * first, rising and coming down by as much as the bus is far, and then stays on it.
 * Zoom, bearing and pitch stay the user's. Dragging the map pauses following.
 * It also remembers where the camera was when a bus was opened, and puts it back
 * there when the panel's back link asks for it (`cameraReturn`).
 */
export function FollowCamera() {
  const { current: map } = useMap();
  const busId = useAppStore((state) => (state.selection?.kind === 'bus' ? state.selection.id : undefined));
  const follow = useAppStore((state) => state.followBus);
  const cameraReturn = useAppStore((state) => state.cameraReturn);
  const before = useRef<CameraOptions>(undefined);

  // Only when a bus is opened with none open: going from one bus to another keeps the first camera.
  const busOpen = busId !== undefined;
  useEffect(() => {
    if (map && busOpen) before.current = { center: map.getCenter(), zoom: map.getZoom(), bearing: map.getBearing(), pitch: map.getPitch() };
  }, [map, busOpen]);

  useEffect(() => {
    if (!map || !busId || !follow) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    // While the user zooms or rotates, the camera is theirs: moving it would fight the gesture.
    let userMoving = false;
    let started = false;
    // The flight to the bus takes as long as the bus is far: the steps wait for it to land.
    let flying = false;

    const step = () => {
      const pose = busTracker.get(busId, Date.now());
      if (!pose || userMoving || flying) return;
      if (!started) {
        // The panel opening has just changed the map's size.
        map.resize();
        started = true;
        const target = { center: pose.position, zoom: Math.max(map.getZoom(), FOLLOW_MIN_ZOOM) };
        if (reduced) return map.jumpTo(target);
        map.flyTo(target);
        // Set after the call: starting a flight ends whatever move was under way, and that is not this one landing.
        flying = map.isMoving();
      } else {
        map.easeTo({ center: pose.position, duration: reduced ? 0 : STEP_MS, easing: (t) => t });
      }
    };

    // Only gestures carry the browser event; the camera moves made here do not.
    const byUser = (event: MapLibreEvent<unknown>) => 'originalEvent' in event && event.originalEvent !== undefined;
    const onMoveStart = (event: MapLibreEvent<unknown>) => {
      if (byUser(event)) userMoving = true;
    };
    const onMoveEnd = () => {
      userMoving = false;
      flying = false;
    };
    const onDragStart = (event: MapLibreEvent<unknown>) => {
      if (byUser(event)) useAppStore.getState().setFollowBus(false);
    };

    step();
    const timer = setInterval(step, STEP_MS);
    map.on('movestart', onMoveStart);
    map.on('moveend', onMoveEnd);
    map.on('dragstart', onDragStart);
    return () => {
      clearInterval(timer);
      map.off('movestart', onMoveStart);
      map.off('moveend', onMoveEnd);
      map.off('dragstart', onDragStart);
    };
  }, [map, busId, follow]);

  useEffect(() => {
    if (!map || !cameraReturn || !before.current) return;
    // The panel that comes back has just changed the map's size.
    map.resize();
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    map.easeTo({ ...before.current, duration: reduced ? 0 : RETURN_MS });
  }, [map, cameraReturn]);

  return null;
}
