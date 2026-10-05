import { beforeAll, describe, expect, it } from 'vitest';
import { isReviewer, parseDecision } from './review';

beforeAll(() => {
  // The Workers runtime adds this to Web Crypto; Node, where the tests run, does not have it there.
  Object.assign(crypto.subtle, {
    timingSafeEqual: (a: ArrayBuffer, b: ArrayBuffer) => {
      const [x, y] = [new Uint8Array(a), new Uint8Array(b)];
      return x.length === y.length && x.every((byte, index) => byte === y[index]);
    },
  });
});

describe('isReviewer', () => {
  it('accepts only the exact password, as a bearer token', async () => {
    expect(await isReviewer('Bearer correct horse', 'correct horse')).toBe(true);
    expect(await isReviewer('Bearer correct hors', 'correct horse')).toBe(false);
    expect(await isReviewer('Bearer correct horse ', 'correct horse')).toBe(false);
    expect(await isReviewer('correct horse', 'correct horse')).toBe(false);
    expect(await isReviewer('Basic correct horse', 'correct horse')).toBe(false);
    expect(await isReviewer(null, 'correct horse')).toBe(false);
  });

  it('lets nobody in when no password is set', async () => {
    expect(await isReviewer('Bearer ', '')).toBe(false);
    expect(await isReviewer('Bearer undefined', undefined)).toBe(false);
    expect(await isReviewer(null, undefined)).toBe(false);
  });
});

describe('parseDecision', () => {
  it('reads a status alone, leaving the rest unchanged', () => {
    expect(parseDecision({ status: 'refused' })).toEqual({ status: 'refused' });
    expect(parseDecision({ status: 'withdrawn' })).toEqual({ status: 'withdrawn' });
  });

  it('reads an end date and a public note, trimmed', () => {
    expect(parseDecision({ status: 'published', until: '2026-10-30', publicNote: '  Tapume  ' })).toEqual({
      status: 'published', until: '2026-10-30', publicNote: 'Tapume',
    });
  });

  it('clears a field given as null, and a note given empty', () => {
    expect(parseDecision({ status: 'published', until: null, publicNote: '   ' })).toEqual({ status: 'published', until: null, publicNote: null });
  });

  it('refuses anything else', () => {
    const refused = [
      null,
      [],
      {},
      { status: 'approved' },
      { status: 'published', until: '30/10/2026' },
      { status: 'published', until: '2026-13-40' },
      { status: 'published', until: 5 },
      { status: 'published', publicNote: 'x'.repeat(281) },
      { status: 'published', publicNote: 7 },
    ];
    for (const body of refused) expect(parseDecision(body)).toHaveProperty('error');
  });
});
