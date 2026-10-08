import { describe, expect, it } from 'vitest';
import { positionsBody } from './olhovivo';

const ok = (value: string): PromiseSettledResult<string> => ({ status: 'fulfilled', value });
const failed: PromiseSettledResult<string> = { status: 'rejected', reason: new Error('timeout') };

describe('positionsBody', () => {
  it('joins the raw body of each line code', () => {
    const positions = positionsBody([2023, 2085], [ok('{"hr":"14:18","vs":[]}'), ok('{"hr":"14:18","vs":[{"p":"1"}]}')]);
    expect(positions?.partial).toBe(false);
    expect(JSON.parse(positions!.body)).toEqual([
      { codigo: 2023, body: { hr: '14:18', vs: [] } },
      { codigo: 2085, body: { hr: '14:18', vs: [{ p: '1' }] } },
    ]);
  });

  it('gives a null body to a code whose call failed and keeps the others', () => {
    const positions = positionsBody([2023, 2085], [failed, ok('{"vs":[]}')]);
    expect(positions?.partial).toBe(true);
    expect(JSON.parse(positions!.body)).toEqual([{ codigo: 2023, body: null }, { codigo: 2085, body: { vs: [] } }]);
  });

  it('returns nothing when no call succeeded', () => {
    expect(positionsBody([2023, 2085], [failed, failed])).toBeUndefined();
  });
});
