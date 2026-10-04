import { describe, expect, it } from 'vitest';
import { createFrameMonitor } from './fpsWatchdog';

const feed = (monitor: ReturnType<typeof createFrameMonitor>, frameMs: number, count: number) => {
  let tripped = false;
  for (let index = 0; index < count; index += 1) tripped = monitor.push(frameMs) || tripped;
  return tripped;
};

describe('createFrameMonitor', () => {
  it('stays quiet at 60 and 30 fps', () => {
    expect(feed(createFrameMonitor(), 16.7, 600)).toBe(false);
    expect(feed(createFrameMonitor(), 33.3, 300)).toBe(false);
  });

  it('trips after three seconds at 15 fps', () => {
    const monitor = createFrameMonitor();
    expect(feed(monitor, 66, 40)).toBe(false); // 2.6 s
    expect(feed(monitor, 66, 10)).toBe(true); // past 3 s
  });

  it('forgives a short stutter inside an otherwise smooth window', () => {
    const monitor = createFrameMonitor();
    feed(monitor, 16.7, 150);
    feed(monitor, 120, 3);
    expect(feed(monitor, 16.7, 60)).toBe(false);
  });

  it('treats a long gap as a pause, not a slow frame', () => {
    const monitor = createFrameMonitor();
    feed(monitor, 66, 40);
    expect(monitor.push(5_000)).toBe(false);
    expect(feed(monitor, 66, 40)).toBe(false);
  });
});
