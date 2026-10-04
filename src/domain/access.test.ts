import { describe, expect, it } from 'vitest';
import { decodeAccess, deriveAccessStatus, encodeAccess } from './access';

describe('deriveAccessStatus', () => {
  it('maps OSM wheelchair values', () => {
    expect(deriveAccessStatus('yes')).toBe('yes');
    expect(deriveAccessStatus('designated')).toBe('yes');
    expect(deriveAccessStatus('limited')).toBe('partial');
    expect(deriveAccessStatus('no')).toBe('no');
  });

  it('never turns missing or odd values into "no"', () => {
    expect(deriveAccessStatus(undefined)).toBe('unknown');
    expect(deriveAccessStatus('')).toBe('unknown');
    expect(deriveAccessStatus('bad')).toBe('unknown');
  });

  it('tolerates case and whitespace', () => {
    expect(deriveAccessStatus(' Yes ')).toBe('yes');
  });
});

describe('access codes', () => {
  it('round-trips every status', () => {
    for (const status of ['yes', 'partial', 'no', 'unknown'] as const) {
      expect(decodeAccess(encodeAccess(status))).toBe(status);
    }
  });

  it('decodes unknown input as unknown', () => {
    expect(decodeAccess(undefined)).toBe('unknown');
    expect(decodeAccess('x')).toBe('unknown');
    expect(decodeAccess(1)).toBe('unknown');
  });
});
