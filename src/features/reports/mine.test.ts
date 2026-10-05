import { describe, expect, it } from 'vitest';
import type { MyReport } from '../../domain/reports';
import { parseMine, serializeMine } from './mine';

const report = (fields: Partial<MyReport>): MyReport => ({ id: 'meu-1', type: 'blocked', answer: 'no', position: [-46.73, -23.56], since: '2026-10-05', sent: true, ...fields });

describe('own reports on the device', () => {
  it('come back as they were stored', () => {
    const mine = [report({ note: 'Tapume', target: 'way/1' }), report({ id: 'meu-2', sent: false, type: 'elevator', answer: 'broken' })];
    expect(parseMine(serializeMine(mine), '2026-10-06')).toEqual(mine.map((entry) => ({ until: undefined, note: undefined, target: undefined, ...entry })));
  });

  it('are dropped after fourteen days', () => {
    const stored = serializeMine([report({ since: '2026-10-05' })]);
    expect(parseMine(stored, '2026-10-19')).toHaveLength(1);
    expect(parseMine(stored, '2026-10-20')).toHaveLength(0);
  });

  it('survive a damaged store', () => {
    expect(parseMine(null, '2026-10-05')).toEqual([]);
    expect(parseMine('{', '2026-10-05')).toEqual([]);
    expect(parseMine('{"a":1}', '2026-10-05')).toEqual([]);
    expect(parseMine('[null, {"id":"x"}]', '2026-10-05')).toEqual([]);
  });

  it('take a report without the flag as not sent', () => {
    expect(parseMine('[{"id":"m","type":"step","answer":"no","at":[-46.73,-23.56],"since":"2026-10-05"}]', '2026-10-05')[0]!.sent).toBe(false);
  });
});
