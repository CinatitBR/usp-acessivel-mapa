import { describe, expect, it } from 'vitest';
import { requestTurns } from './store';

describe('requestTurns', () => {
  it('sends answered questions and leaves out failed ones', () => {
    const turns = requestTurns(
      [
        { role: 'user', text: 'Onde tem dentista?' },
        { role: 'assistant', text: 'Na FOUSP [[fousp]].', end: 'stop' },
        { role: 'user', text: 'E sisos?' },
        { role: 'assistant', text: '', end: 'network' },
        { role: 'user', text: 'Tem emergência?' },
        { role: 'assistant', text: 'Sim, na FO', end: 'stopped' },
      ],
      'E implantes?',
    );
    expect(turns).toEqual([
      { role: 'user', text: 'Onde tem dentista?' },
      { role: 'assistant', text: 'Na FOUSP [[fousp]].' },
      { role: 'user', text: 'E implantes?' },
    ]);
  });

  it('keeps the request within the Worker limit of 12 turns', () => {
    const long = Array.from({ length: 20 }, (_, index) =>
      index % 2 === 0 ? { role: 'user' as const, text: `p${index}` } : { role: 'assistant' as const, text: `r${index}`, end: 'stop' as const },
    );
    const turns = requestTurns(long, 'última');
    expect(turns).toHaveLength(11);
    expect(turns[0]!.role).toBe('user');
    expect(turns.at(-1)).toEqual({ role: 'user', text: 'última' });
  });
});
