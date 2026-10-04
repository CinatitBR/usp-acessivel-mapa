import { useMap } from '@vis.gl/react-maplibre';
import { useEffect } from 'react';
import { useAppStore } from '../state/store';
import { ANCHORS } from './anchors';

/**
 * Adds the Three.js layer once the map is ready, unless lite mode is on. The
 * 3D code is a separate chunk fetched here, so it never delays the map and is
 * never downloaded in lite mode.
 */
export function Scene3D() {
  const { current: map } = useMap();
  const ready = useAppStore((state) => state.mapStatus === 'ready');
  const lite = useAppStore((state) => state.lite);
  const setScene3dActive = useAppStore((state) => state.setScene3dActive);

  useEffect(() => {
    if (!map || !ready || lite) return;
    let cancelled = false;
    let layerId: string | undefined;

    import('../render3d').then(
      ({ createCampusScene }) => {
        if (cancelled) return;
        const layer = createCampusScene();
        // MapRef hides style-mutating methods; the layer is ours to manage, so use the map itself.
        map.getMap().addLayer(layer, ANCHORS.scene3d);
        layerId = layer.id;
        setScene3dActive(true);
      },
      // Without the chunk (offline, old cache) the flat markers simply stay on.
      (error: unknown) => console.warn('3D layer unavailable', error),
    );

    return () => {
      cancelled = true;
      setScene3dActive(false);
      if (layerId && map.getLayer(layerId)) map.getMap().removeLayer(layerId);
    };
  }, [map, ready, lite, setScene3dActive]);

  return null;
}
