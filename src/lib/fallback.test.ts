import { describe, expect, it, vi } from 'vitest';
import { withFallback } from './fallback';

const provider = (id: string, result: () => Promise<number[]>) => ({ id, get: vi.fn(result) });
const notEmpty = (value: number[]) => value.length > 0;

describe('withFallback', () => {
  it('returns the first provider that succeeds and does not call the rest', async () => {
    const first = provider('a', async () => [1]);
    const second = provider('b', async () => [2]);
    await expect(withFallback([first, second], (p) => p.get())).resolves.toEqual({ provider: 'a', value: [1], failed: [] });
    expect(second.get).not.toHaveBeenCalled();
  });

  it('moves on when a provider throws', async () => {
    const first = provider('a', async () => { throw new Error('down'); });
    const second = provider('b', async () => [2]);
    await expect(withFallback([first, second], (p) => p.get())).resolves.toEqual({ provider: 'b', value: [2], failed: ['a'] });
  });

  it('prefers a usable result over an earlier empty one', async () => {
    const first = provider('a', async () => []);
    const second = provider('b', async () => [2]);
    await expect(withFallback([first, second], (p) => p.get(), notEmpty)).resolves.toEqual({ provider: 'b', value: [2], failed: [] });
  });

  it('falls back to the earliest unusable result when nothing better exists', async () => {
    const first = provider('a', async () => []);
    const second = provider('b', async () => { throw new Error('down'); });
    await expect(withFallback([first, second], (p) => p.get(), notEmpty)).resolves.toEqual({ provider: 'a', value: [], failed: ['b'] });
  });

  it('rethrows the last error when every provider fails', async () => {
    const first = provider('a', async () => { throw new Error('first'); });
    const second = provider('b', async () => { throw new Error('second'); });
    await expect(withFallback([first, second], (p) => p.get())).rejects.toThrow('second');
  });

  it('stops at once when the request was cancelled', async () => {
    const first = provider('a', async () => { throw new DOMException('cancelled', 'AbortError'); });
    const second = provider('b', async () => [2]);
    await expect(withFallback([first, second], (p) => p.get())).rejects.toMatchObject({ name: 'AbortError' });
    expect(second.get).not.toHaveBeenCalled();
  });
});
