import { describe, expect, it } from 'vitest';
import { parseReports } from './parse';

describe('parseReports', () => {
  it('maps the Worker answer to the domain model', () => {
    const json = { reports: [{ id: 'r1', type: 'elevator', answer: 'broken', at: [-46.73, -23.56], target: 'curated/elevator-1', since: '2026-10-05', until: '2026-10-20', note: 'Em manutenção' }] };
    expect(parseReports(json)).toEqual([
      { id: 'r1', type: 'elevator', answer: 'broken', position: [-46.73, -23.56], target: 'curated/elevator-1', since: '2026-10-05', until: '2026-10-20', note: 'Em manutenção' },
    ]);
  });

  it('leaves out what it cannot read', () => {
    const good = { id: 'ok', type: 'blocked', answer: 'no', at: [-46.73, -23.56], since: '2026-10-05' };
    const json = {
      reports: [
        good,
        { ...good, id: 'a', type: 'pothole' },
        { ...good, id: 'b', answer: 'broken' },
        { ...good, id: 'c', at: ['x', 1] },
        { ...good, id: 'd', since: '05/10/2026' },
        { ...good, id: '' },
        null,
        'text',
      ],
    };
    expect(parseReports(json).map(({ id }) => id)).toEqual(['ok']);
  });

  it('drops an end date that is not a date', () => {
    expect(parseReports({ reports: [{ id: 'r', type: 'step', answer: 'help', at: [1, 2], since: '2026-10-05', until: 'soon' }] })[0]!.until).toBeUndefined();
  });

  it('gives nothing for anything else', () => {
    expect(parseReports(null)).toEqual([]);
    expect(parseReports({})).toEqual([]);
    expect(parseReports({ reports: 'none' })).toEqual([]);
  });
});
