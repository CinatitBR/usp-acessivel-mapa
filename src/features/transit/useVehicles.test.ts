import { describe, expect, it } from 'vitest';
import { FEED_LOST_MS, feedLost } from './useVehicles';

const NOW = Date.UTC(2026, 9, 8, 17, 30);

describe('feedLost', () => {
  it('is false while requests succeed, however old the data', () => {
    expect(feedLost({ isError: false, dataUpdatedAt: NOW - 10 * FEED_LOST_MS, now: NOW })).toBe(false);
  });

  it('forgives failures soon after a good answer', () => {
    expect(feedLost({ isError: true, dataUpdatedAt: NOW - 25_000, now: NOW })).toBe(false);
    expect(feedLost({ isError: true, dataUpdatedAt: NOW - FEED_LOST_MS, now: NOW })).toBe(false);
  });

  it('is true once the last good answer is old', () => {
    expect(feedLost({ isError: true, dataUpdatedAt: NOW - FEED_LOST_MS - 1, now: NOW })).toBe(true);
  });

  it('is true when the first request fails (no good answer yet)', () => {
    expect(feedLost({ isError: true, dataUpdatedAt: 0, now: NOW })).toBe(true);
  });
});
