/** Average frame time above this means the map is running below about 25 fps. */
const SLOW_FRAME_MS = 40;
/** How long it must stay slow before giving up on 3D. */
const SUSTAINED_MS = 3_000;
/** A gap this long is a pause (tab switch, GC), not a slow frame. */
const PAUSE_MS = 1_000;

/**
 * Decides when rendering has been slow for long enough to switch to lite mode.
 * Feed it the time between frames while the map is moving; it returns true
 * once the average over the last three seconds of movement is too slow.
 */
export function createFrameMonitor(slowFrameMs = SLOW_FRAME_MS, sustainedMs = SUSTAINED_MS) {
  let elapsed = 0;
  let frames = 0;
  return {
    reset() {
      elapsed = 0;
      frames = 0;
    },
    push(frameMs: number): boolean {
      if (frameMs > PAUSE_MS) {
        this.reset();
        return false;
      }
      elapsed += frameMs;
      frames += 1;
      if (elapsed < sustainedMs) return false;
      const slow = elapsed / frames > slowFrameMs;
      this.reset();
      return slow;
    },
  };
}
