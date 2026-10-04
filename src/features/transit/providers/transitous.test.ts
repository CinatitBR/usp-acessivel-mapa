import { describe, expect, it } from 'vitest';
import fixture from './fixtures/transitous-stoptimes.json';
import { parseTransitousArrivals } from './transitous';

/** Just before the first departure recorded in the fixture (2026-10-05T03:01:00Z). */
const NOW = Date.parse('2026-10-05T02:55:00Z');

describe('parseTransitousArrivals', () => {
  it('reads a recorded response as scheduled departures, soonest first', () => {
    const arrivals = parseTransitousArrivals(fixture, NOW);
    expect(arrivals).toHaveLength(fixture.stopTimes.length);
    expect(arrivals[0]).toEqual({
      lineId: '8082-10',
      headsign: 'Metrô Butantã',
      time: Date.parse('2026-10-05T03:01:00Z'),
      source: 'scheduled',
    });
    expect(arrivals.map((arrival) => arrival.time)).toEqual([...arrivals.map((arrival) => arrival.time)].sort());
  });

  it('drops departures that already left', () => {
    expect(parseTransitousArrivals(fixture, Date.parse('2026-10-06T00:00:00Z'))).toEqual([]);
  });

  it('marks realtime entries as live and tolerates missing fields', () => {
    const arrivals = parseTransitousArrivals(
      {
        stopTimes: [
          { place: { departure: '2026-10-05T03:10:00Z' }, routeShortName: '8085-10', realTime: true },
          { place: {}, routeShortName: '8085-10' },
          { place: { departure: '2026-10-05T03:12:00Z' } },
        ],
      },
      NOW,
    );
    expect(arrivals).toEqual([{ lineId: '8085-10', headsign: '', time: Date.parse('2026-10-05T03:10:00Z'), source: 'live' }]);
  });

  it('tolerates malformed responses', () => {
    expect(parseTransitousArrivals(null, NOW)).toEqual([]);
    expect(parseTransitousArrivals({ stopTimes: 'nope' }, NOW)).toEqual([]);
  });
});
