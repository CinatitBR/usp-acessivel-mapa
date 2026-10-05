import { useMap } from '@vis.gl/react-maplibre';
import { useLayoutEffect, useRef } from 'react';
import { useAppStore } from '../state/store';

/** After the app moves the camera, a sheet that is still growing keeps the target in the middle for this long. */
const FOLLOW_MS = 1500;
const NUDGE_MS = 250;
/** Marks this component's own camera moves, so they are not taken for the app's. */
const OWN = { sheetPadding: true };

/**
 * Tells the map how much of its bottom the sheet covers, so everything the camera centres
 * lands in the part that can be seen. When the user moves the sheet the map stays where it
 * is; when the sheet grows right after the app moved the camera, the target is kept centred.
 */
export function SheetPadding() {
  const { current: map } = useMap();
  const cover = useAppStore((state) => state.sheetCover);
  const lastAppMove = useRef(0);

  useLayoutEffect(() => {
    if (!map) return;
    const onMoveStart = (event: { originalEvent?: unknown; sheetPadding?: boolean }) => {
      if (!event.originalEvent && !event.sheetPadding) lastAppMove.current = Date.now();
    };
    map.on('movestart', onMoveStart);
    return () => {
      map.off('movestart', onMoveStart);
    };
  }, [map]);

  useLayoutEffect(() => {
    if (!map || map.getPadding().bottom === cover) return;
    const padding = { top: 0, right: 0, left: 0, bottom: cover };
    const keepTarget = () => map.easeTo({ padding, duration: NUDGE_MS }, OWN);
    if (map.isMoving()) {
      // A flight is on its way: let it land, then bring its target into the visible part.
      map.once('moveend', keepTarget);
      return () => {
        map.off('moveend', keepTarget);
      };
    }
    if (Date.now() - lastAppMove.current < FOLLOW_MS) {
      keepTarget();
      return;
    }
    // Nothing on screen moves: the point that becomes the new middle is the one already there.
    const { clientWidth, clientHeight } = map.getContainer();
    map.jumpTo({ padding, center: map.unproject([clientWidth / 2, (clientHeight - cover) / 2]) }, OWN);
  }, [map, cover]);

  return null;
}
