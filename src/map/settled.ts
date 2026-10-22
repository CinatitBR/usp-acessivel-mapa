let settle: () => void = () => undefined;

/**
 * Resolves at the map's first idle, when its first screen is drawn. Work that can wait
 * (the offline precache) waits for it, so it does not compete with the first tiles.
 */
export const mapSettled = new Promise<void>((resolve) => {
  settle = resolve;
});

export function markMapSettled() {
  // Also read by `npm run perf:app`, and by DevTools when profiling on a phone.
  performance.mark('map-first-idle');
  settle();
}
