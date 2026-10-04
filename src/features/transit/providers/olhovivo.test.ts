import { describe, expect, it } from 'vitest';
import recorded from './fixtures/olhovivo-previsao-parada.json';
import { parseOlhoVivoArrivals, predictionTime } from './olhovivo';

/** 2026-10-05 14:30 in São Paulo (UTC−3). */
const NOW = Date.UTC(2026, 9, 5, 17, 30);
const local = (day: number, hour: number, minute: number) => Date.UTC(2026, 9, day, hour + 3, minute);

describe('predictionTime', () => {
  it('reads HH:MM as São Paulo time on the current day', () => {
    expect(predictionTime('14:42', NOW)).toBe(local(5, 14, 42));
    expect(predictionTime('9:05', NOW)).toBe(local(5, 9, 5));
  });

  it('rolls over midnight in both directions', () => {
    const lateNight = local(5, 23, 58);
    expect(predictionTime('00:05', lateNight)).toBe(local(6, 0, 5));
    const earlyMorning = local(6, 0, 2);
    expect(predictionTime('23:59', earlyMorning)).toBe(local(5, 23, 59));
  });

  it('rejects anything that is not a time', () => {
    expect(predictionTime('', NOW)).toBeUndefined();
    expect(predictionTime('25:00', NOW)).toBeUndefined();
    expect(predictionTime('soon', NOW)).toBeUndefined();
  });
});

// Same shape as a real /Previsao/Parada response (see the recorded fixture below), with times chosen for the assertions.
const response = {
  hr: '14:30',
  p: {
    cp: 120010342,
    np: 'BIOMÉDICAS I E II',
    l: [
      {
        c: '8082-10', cl: 2605, sl: 1, lt0: 'METRÔ BUTANTÃ', lt1: 'CID. UNIVERSITÁRIA', qv: 2,
        vs: [
          { p: '74558', t: '14:47', a: true, ta: '2026-10-05T17:29:40Z' },
          { p: 74559, t: '14:33', a: false, ta: '2026-10-05T17:29:50Z' },
        ],
      },
      {
        c: '701U-10', cl: 1234, sl: 2, lt0: 'CID. UNIVERSITÁRIA', lt1: 'METRÔ SANTANA', qv: 1,
        vs: [{ p: '12001', t: '14:40', a: true }],
      },
    ],
  },
};

describe('parseOlhoVivoArrivals', () => {
  const arrivals = parseOlhoVivoArrivals(response, NOW);

  it('lists every predicted bus, soonest first, marked live', () => {
    expect(arrivals.map((arrival) => [arrival.lineId, arrival.vehicleId])).toEqual([
      ['8082-10', '74559'],
      ['701U-10', '12001'],
      ['8082-10', '74558'],
    ]);
    expect(arrivals.every((arrival) => arrival.source === 'live')).toBe(true);
    expect(arrivals[0]?.time).toBe(local(5, 14, 33));
  });

  it('shows the destination for the running direction, in readable case', () => {
    expect(arrivals[0]?.headsign).toBe('Metrô Butantã');
    expect(arrivals[1]?.headsign).toBe('Metrô Santana');
  });

  it('keeps the accessible flag of each bus', () => {
    expect(arrivals.map((arrival) => arrival.accessible)).toEqual([false, true, true]);
  });

  it('reads a recorded response from the real API', () => {
    // Recorded on 2026-10-04 at 06:3x São Paulo time, at stop 1211351 (Av. Dr. Vital Brasil, 334).
    const now = Date.UTC(2026, 9, 4, 9, 35);
    const live = parseOlhoVivoArrivals(recorded, now);
    const expected = recorded.p.l.reduce((total, line) => total + line.vs.length, 0);
    expect(live).toHaveLength(expected);
    expect(live.every((arrival) => arrival.source === 'live' && arrival.vehicleId && arrival.headsign)).toBe(true);
    // Every prediction is within the hour around the recording.
    expect(live.every((arrival) => Math.abs(arrival.time - now) < 60 * 60_000)).toBe(true);
    const first = recorded.p.l[0]!;
    expect(live.some((arrival) => arrival.lineId === first.c)).toBe(true);
  });

  it('returns nothing for a stop with no predictions or a malformed body', () => {
    expect(parseOlhoVivoArrivals({ hr: '14:30', p: null }, NOW)).toEqual([]);
    expect(parseOlhoVivoArrivals({ Message: 'Authorization has been denied for this request.' }, NOW)).toEqual([]);
    expect(parseOlhoVivoArrivals(null, NOW)).toEqual([]);
    expect(parseOlhoVivoArrivals({ p: { l: [{ c: '8082-10', vs: [{ t: 'x' }] }] } }, NOW)).toEqual([]);
  });
});
