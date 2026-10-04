import { useMap } from '@vis.gl/react-maplibre';
import { useEffect } from 'react';
import { useAppStore } from '../../state/store';
import { strings } from '../../strings/pt-BR';
import { createFrameMonitor } from './fpsWatchdog';

/**
 * Watches frame times while the 3D layer is on and the map is moving. If
 * rendering stays slow, it turns lite mode on and offers to undo. It never
 * overrides an explicit choice.
 */
export function FpsWatchdog() {
  const { current: map } = useMap();
  const watching = useAppStore((state) => state.scene3dActive && state.liteChoice === 'auto');

  useEffect(() => {
    if (!map || !watching) return;
    const monitor = createFrameMonitor();
    let last = 0;
    const onRender = () => {
      const now = performance.now();
      // Only frames drawn while the user is moving the map say anything about smoothness.
      if (last > 0 && map.isMoving() && monitor.push(now - last)) {
        const { tripWatchdog, setLiteChoice, showToast } = useAppStore.getState();
        tripWatchdog();
        showToast({ message: strings.lite.autoEnabled, actionLabel: strings.lite.undo, action: () => setLiteChoice('off') });
      }
      last = now;
    };
    map.on('render', onRender);
    return () => {
      map.off('render', onRender);
    };
  }, [map, watching]);

  return null;
}
