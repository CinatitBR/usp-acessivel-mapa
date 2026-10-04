import { describe, expect, it } from 'vitest';
import { arrivalLabels } from './time';

/** São Paulo is UTC−3. */
const local = (day: number, hour: number, minute: number) => Date.UTC(2026, 9, day, hour + 3, minute);
const NOW = local(5, 14, 30);

describe('arrivalLabels', () => {
  it('counts down under an hour', () => {
    expect(arrivalLabels(local(5, 14, 30), NOW)).toEqual({ primary: 'agora', secondary: '14:30' });
    expect(arrivalLabels(local(5, 14, 33), NOW)).toEqual({ primary: '3 min', secondary: '14:33' });
    expect(arrivalLabels(local(5, 15, 29), NOW)).toEqual({ primary: '59 min', secondary: '15:29' });
  });

  it('treats a bus that has just left as "agora"', () => {
    expect(arrivalLabels(local(5, 14, 29), NOW).primary).toBe('agora');
  });

  it('shows the clock time and the day from one hour on', () => {
    expect(arrivalLabels(local(5, 16, 0), NOW)).toEqual({ primary: '16:00', secondary: 'hoje' });
    expect(arrivalLabels(local(6, 0, 8), NOW)).toEqual({ primary: '00:08', secondary: 'amanhã' });
    expect(arrivalLabels(local(7, 7, 0), NOW).secondary).toMatch(/^qua/);
  });

  it('uses the São Paulo day, not the UTC day', () => {
    // 22:00 local is already the next day in UTC.
    expect(arrivalLabels(local(5, 23, 30), local(5, 22, 0))).toEqual({ primary: '23:30', secondary: 'hoje' });
  });
});
