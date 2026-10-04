import { describe, expect, it } from 'vitest';
import { type DeviceHints, resolveLite, shouldStartLite } from './detect';

const capable: DeviceHints = { reducedMotion: false, webgl2: true, memory: 8, cores: 8, coarsePointer: true };

describe('shouldStartLite', () => {
  it('keeps 3D on a capable phone or desktop', () => {
    expect(shouldStartLite(capable)).toBe(false);
    expect(shouldStartLite({ ...capable, coarsePointer: false, cores: 4 })).toBe(false);
  });

  it('starts lite when the user prefers reduced motion', () => {
    expect(shouldStartLite({ ...capable, reducedMotion: true })).toBe(true);
  });

  it('starts lite without WebGL 2', () => {
    expect(shouldStartLite({ ...capable, webgl2: false })).toBe(true);
  });

  it('starts lite on low memory or a phone with few cores', () => {
    expect(shouldStartLite({ ...capable, memory: 2 })).toBe(true);
    expect(shouldStartLite({ ...capable, cores: 4 })).toBe(true);
  });

  it('does not guess when the browser hides memory and cores', () => {
    expect(shouldStartLite({ reducedMotion: false, webgl2: true, coarsePointer: true })).toBe(false);
  });
});

describe('resolveLite', () => {
  it('follows detection and the watchdog while the choice is automatic', () => {
    expect(resolveLite('auto', false, false)).toBe(false);
    expect(resolveLite('auto', true, false)).toBe(true);
    expect(resolveLite('auto', false, true)).toBe(true);
  });

  it('lets an explicit choice override both', () => {
    expect(resolveLite('off', true, true)).toBe(false);
    expect(resolveLite('on', false, false)).toBe(true);
  });
});
