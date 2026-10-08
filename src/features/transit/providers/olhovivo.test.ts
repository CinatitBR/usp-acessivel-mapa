import { describe, expect, it } from 'vitest';
import type { LineDirection } from '../../../domain/types';
import recordedPositions from './fixtures/olhovivo-posicao-linhas.json';
import recorded from './fixtures/olhovivo-previsao-parada.json';
import { parseOlhoVivoArrivals, parseOlhoVivoVehicles, predictionTime } from './olhovivo';

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

describe('parseOlhoVivoVehicles', () => {
  const line = (lineId: string, direction: 0 | 1, code: number): LineDirection => ({
    lineId, direction, code, headsign: '', name: '', color: '#000000', stopIds: [], shape: [],
  });
  // Codes as resolved for these lines on 2026-10-04.
  const lines = [line('8012-10', 0, 2023), line('8012-10', 1, 34791), line('8022-10', 0, 2085)];

  it('reads a recorded response from the real API', () => {
    const vehicles = parseOlhoVivoVehicles(recordedPositions, lines);
    const expected = recordedPositions
      .filter((entry) => [2023, 34791, 2085].includes(entry.codigo))
      .reduce((total, entry) => total + entry.body.vs.length, 0);
    expect(vehicles).toHaveLength(expected);
    expect(expected).toBeGreaterThan(0);

    const first = recordedPositions[0]!.body.vs[0]!;
    expect(vehicles[0]).toEqual({
      id: first.p,
      lineId: '8012-10',
      direction: 0,
      position: [first.px, first.py],
      recordedAt: Date.parse(first.ta),
      accessible: first.a,
    });
  });

  it('ignores codes it was not asked about and malformed vehicles', () => {
    expect(parseOlhoVivoVehicles([{ codigo: 999, body: { vs: [{ p: '1', px: 1, py: 2, ta: '2026-10-04T09:53:02Z' }] } }], lines)).toEqual([]);
    expect(
      parseOlhoVivoVehicles([{ codigo: 2023, body: { vs: [{ p: '1', px: 'x', py: 2, ta: '2026-10-04T09:53:02Z' }, { p: '2', px: 1, py: 2 }] } }], lines),
    ).toEqual([]);
  });

  it('reads a loop line under both of its codes', () => {
    const loop = { ...line('8084-10', 0, 2607), loopCode: 35375 };
    const fix = (p: string) => ({ p, px: -46.73, py: -23.56, ta: '2026-10-04T09:53:02Z', a: true });
    const vehicles = parseOlhoVivoVehicles(
      [{ codigo: 2607, body: { vs: [fix('1')] } }, { codigo: 35375, body: { vs: [fix('2')] } }],
      [loop],
    );
    expect(vehicles.map((vehicle) => [vehicle.id, vehicle.lineId, vehicle.direction])).toEqual([['1', '8084-10', 0], ['2', '8084-10', 0]]);
  });

  it('keeps the other lines when the Worker could not read one of them', () => {
    const fix = { p: '7', px: -46.73, py: -23.56, ta: '2026-10-04T09:53:02Z', a: true };
    const vehicles = parseOlhoVivoVehicles([{ codigo: 2023, body: null }, { codigo: 2085, body: { vs: [fix] } }], lines);
    expect(vehicles.map((vehicle) => [vehicle.id, vehicle.lineId])).toEqual([['7', '8022-10']]);
  });

  it('tolerates empty and malformed responses', () => {
    expect(parseOlhoVivoVehicles([{ codigo: 2023, body: { hr: '06:53', vs: [] } }], lines)).toEqual([]);
    expect(parseOlhoVivoVehicles([{ codigo: 2023, body: null }], lines)).toEqual([]);
    expect(parseOlhoVivoVehicles({ error: 'upstream' }, lines)).toEqual([]);
  });
});
