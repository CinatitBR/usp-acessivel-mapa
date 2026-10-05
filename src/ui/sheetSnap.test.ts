import { describe, expect, it } from 'vitest';
import { coverOf, settle, snapHeights, step } from './sheetSnap';

describe('snapHeights', () => {
  it('gives the header, 45% of the screen, and all but the top of it', () => {
    expect(snapHeights(800, 90, 2000)).toEqual({ collapsed: 90, half: 360, full: 712 });
  });

  it('never makes a sheet taller than its content', () => {
    expect(snapHeights(800, 90, 500)).toEqual({ collapsed: 90, half: 360, full: 500 });
    expect(snapHeights(800, 90, 200)).toEqual({ collapsed: 90, half: 200, full: 200 });
    expect(snapHeights(800, 90, 60)).toEqual({ collapsed: 60, half: 60, full: 60 });
  });
});

describe('settle', () => {
  const heights = { collapsed: 90, half: 360, full: 712 };

  it('goes to the nearest rest when released slowly', () => {
    expect(settle(heights, 200, 0)).toBe('collapsed');
    expect(settle(heights, 250, 0.1)).toBe('half');
    expect(settle(heights, 600, -0.1)).toBe('full');
  });

  it('goes on in the direction of a flick, one rest at a time', () => {
    expect(settle(heights, 120, 1)).toBe('half');
    expect(settle(heights, 380, 1)).toBe('full');
    expect(settle(heights, 700, -1)).toBe('half');
    expect(settle(heights, 300, -1)).toBe('collapsed');
    expect(settle(heights, 720, 1)).toBe('full');
    expect(settle(heights, 80, -1)).toBe('collapsed');
  });
});

describe('step', () => {
  it('moves one rest up or down and stops at the ends', () => {
    const heights = { collapsed: 90, half: 360, full: 712 };
    expect(step(heights, 'collapsed', 1)).toBe('half');
    expect(step(heights, 'half', 1)).toBe('full');
    expect(step(heights, 'full', 1)).toBe('full');
    expect(step(heights, 'half', -1)).toBe('collapsed');
    expect(step(heights, 'collapsed', -1)).toBe('collapsed');
  });

  it('skips a rest of the same height', () => {
    const short = { collapsed: 90, half: 200, full: 200 };
    expect(step(short, 'half', 1)).toBe('half');
    expect(step(short, 'full', -1)).toBe('collapsed');
  });
});

describe('coverOf', () => {
  it('is the height of the sheet, up to 60% of the screen', () => {
    expect(coverOf(360, 800)).toBe(360);
    expect(coverOf(712, 800)).toBe(480);
  });
});
