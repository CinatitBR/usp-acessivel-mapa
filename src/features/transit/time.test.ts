import { describe, expect, it } from 'vitest';
import { arrivalLabels, dayClock, formatClock, fromDateTimeField, toDateTimeField } from './time';

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

describe('dayClock', () => {
  it('gives the time alone today and names any other day', () => {
    expect(formatClock(local(5, 9, 5))).toBe('09:05');
    expect(dayClock(local(5, 16, 0), NOW)).toBe('16:00');
    expect(dayClock(local(6, 0, 8), NOW)).toBe('amanhã, 00:08');
    expect(dayClock(local(14, 7, 0), NOW)).toMatch(/^qua\.?, 14\/10, 07:00$/);
  });
});

describe('date and time field', () => {
  it('reads and writes the São Paulo clock', () => {
    // 23:30 local is already the next day in UTC.
    expect(toDateTimeField(local(5, 23, 30))).toBe('2026-10-05T23:30');
    expect(fromDateTimeField('2026-10-05T23:30')).toBe(local(5, 23, 30));
    expect(fromDateTimeField(toDateTimeField(NOW))).toBe(NOW);
  });

  it('has no moment while the field is empty or half typed', () => {
    expect(fromDateTimeField('')).toBeNull();
    expect(fromDateTimeField('2026-10-05')).toBeNull();
    expect(fromDateTimeField('2026-13-45T99:99')).toBeNull();
  });
});
