// maplibre-gl 6 looks for its worker next to its own module URL, which does
// not survive bundling. `?worker&url` makes Vite emit the worker (and the code
// it imports) as its own bundle and gives us the final URL.
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';

/** Starts downloading MapLibre as soon as the app module loads, in parallel with React's first render. */
export const mapLib = import('maplibre-gl').then((maplibre) => {
  maplibre.setWorkerUrl(workerUrl);
  return maplibre;
});
