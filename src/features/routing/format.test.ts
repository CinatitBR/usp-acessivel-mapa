import { describe, expect, it } from 'vitest';
import { formatDistance, formatDuration } from './format';

describe('formatDistance', () => {
  it('rounds short distances to 10 m and long ones to 100 m', () => {
    expect(formatDistance(4)).toBe('10 m');
    expect(formatDistance(344)).toBe('340 m');
    expect(formatDistance(1234)).toBe('1,2 km');
  });
});

describe('formatDuration', () => {
  it('shows minutes, then hours', () => {
    expect(formatDuration(20)).toBe('1 min');
    expect(formatDuration(596)).toBe('10 min');
    expect(formatDuration(3600)).toBe('1 h');
    expect(formatDuration(4500)).toBe('1 h 15 min');
  });
});
