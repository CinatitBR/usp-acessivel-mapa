import { describe, expect, it } from 'vitest';
import { ProviderError } from '../../lib/http';
import { isWrongPassword, parseReview } from './api';

describe('parseReview', () => {
  const row = { id: 'r-1', type: 'blocked', answer: 'no', at: [-46.73, -23.56], since: '2026-10-05', status: 'pending' };

  it('reads both lists, with the reporter\'s note and the public one apart', () => {
    const lists = parseReview({
      pending: [{ ...row, reporterNote: 'Falar com João', createdAt: '2026-10-05T12:00:00.000Z' }],
      published: [{ ...row, id: 'r-2', note: 'Tapume', until: '2026-10-30' }],
    });
    expect(lists.pending).toEqual([
      { id: 'r-1', type: 'blocked', answer: 'no', position: [-46.73, -23.56], since: '2026-10-05', target: undefined, until: undefined, note: undefined, reporterNote: 'Falar com João', createdAt: '2026-10-05T12:00:00.000Z', changes: undefined },
    ]);
    expect(lists.published[0]).toMatchObject({ id: 'r-2', note: 'Tapume', until: '2026-10-30', reporterNote: undefined });
  });

  it('reads what people said changed about a published report', () => {
    const changes = [
      { kind: 'resolved', note: 'Tiraram o tapume', createdAt: '2026-10-07T15:00:00.000Z' },
      { kind: 'different', createdAt: '2026-10-08T15:00:00.000Z' },
      { kind: 'still', createdAt: '2026-10-08T16:00:00.000Z' },
      null,
    ];
    const [report] = parseReview({ published: [{ ...row, changes }] }).published;
    expect(report!.changes).toEqual([
      { kind: 'resolved', note: 'Tiraram o tapume', createdAt: '2026-10-07T15:00:00.000Z' },
      { kind: 'different', note: undefined, createdAt: '2026-10-08T15:00:00.000Z' },
    ]);
    expect(parseReview({ published: [{ ...row, changes: [] }] }).published[0]!.changes).toBeUndefined();
  });

  it('leaves out what it cannot read, and survives anything', () => {
    expect(parseReview({ pending: [row, { id: 'x' }, null], published: 'none' })).toMatchObject({ pending: [{ id: 'r-1' }], published: [] });
    expect(parseReview(null)).toEqual({ pending: [], published: [] });
  });
});

describe('isWrongPassword', () => {
  it('is true only for a 401 from the Worker', () => {
    expect(isWrongPassword(new ProviderError('review', 'http', 'HTTP 401'))).toBe(true);
    expect(isWrongPassword(new ProviderError('review', 'http', 'HTTP 404'))).toBe(false);
    expect(isWrongPassword(new ProviderError('review', 'network', 'failed'))).toBe(false);
    expect(isWrongPassword(new Error('HTTP 401'))).toBe(false);
  });
});
