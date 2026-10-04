/** `340` → `340 m`, `1234` → `1,2 km`. */
export function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.max(Math.round(meters / 10) * 10, 10)} m`;
  return `${(meters / 1000).toFixed(1).replace('.', ',')} km`;
}

/** Whole minutes, never less than one. */
export function formatDuration(seconds: number): string {
  const minutes = Math.max(Math.round(seconds / 60), 1);
  if (minutes < 60) return `${minutes} min`;
  const rest = minutes % 60;
  return rest === 0 ? `${Math.floor(minutes / 60)} h` : `${Math.floor(minutes / 60)} h ${rest} min`;
}
