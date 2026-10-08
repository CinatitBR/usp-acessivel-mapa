import { describe, expect, it } from 'vitest';
import fixture from './fixtures/transitous-plan.json';
import { parseTransitousPlan } from './transitousPlan';

describe('parseTransitousPlan', () => {
  const journeys = parseTransitousPlan(fixture);

  it('reads a recorded response as journeys, soonest first', () => {
    expect(journeys).toHaveLength(2);
    const [direct, transfer] = journeys;
    expect(direct).toMatchObject({ start: Date.parse('2026-10-08T20:16:00Z'), end: Date.parse('2026-10-08T20:39:00Z'), transfers: 0 });
    expect(direct!.legs.map((leg) => leg.kind)).toEqual(['walk', 'transit', 'walk']);
    expect(transfer!.transfers).toBe(1);
    expect(transfer!.legs.flatMap((leg) => (leg.kind === 'transit' ? leg.line : []))).toEqual(['8086-10', '8083-10']);
  });

  it('keeps what a ride needs: line, direction, colours, stops and path', () => {
    const ride = journeys[0]!.legs[1]!;
    expect(ride).toMatchObject({
      kind: 'transit',
      vehicle: 'bus',
      line: '8084-10',
      headsign: 'Cid. Universitária',
      color: '#ff671f',
      textColor: '#000000',
      from: { name: 'Letras', stopId: '120010353', time: Date.parse('2026-10-08T20:24:00Z') },
      to: { name: 'Av. Dr. Vital Brasil, 569', time: Date.parse('2026-10-08T20:34:00Z') },
    });
    if (ride.kind !== 'transit') throw new Error('not a ride');
    expect(ride.stops).toHaveLength(4);
    expect(ride.stops[0]!.name).toBe('Cultura Japonesa');
    expect(ride.geometry.length).toBeGreaterThan(10);
    // Longitude first, and on the campus.
    expect(ride.geometry[0]![0]).toBeCloseTo(-46.724, 2);
    expect(ride.geometry[0]![1]).toBeCloseTo(-23.562, 2);
  });

  it('leaves the journey\'s own ends unnamed and measures the walks', () => {
    const [first, , last] = journeys[0]!.legs;
    expect(first).toMatchObject({ kind: 'walk', distance: 474, from: { name: '' }, to: { name: 'Letras' } });
    expect(last).toMatchObject({ kind: 'walk', distance: 254, to: { name: '' } });
  });

  it('gives the same journey the same id, and different journeys different ones', () => {
    expect(parseTransitousPlan(fixture).map(({ id }) => id)).toEqual(journeys.map(({ id }) => id));
    expect(journeys[0]!.id).not.toBe(journeys[1]!.id);
    // An answer that repeats a journey lists it once.
    expect(parseTransitousPlan({ itineraries: [...fixture.itineraries, fixture.itineraries[0]] })).toHaveLength(2);
  });

  it('drops a journey with a leg it cannot read, and anything that is not a plan', () => {
    const [good, other] = fixture.itineraries;
    const broken = { ...other!, legs: other!.legs.map((leg, index) => (index === 1 ? { ...leg, from: { name: 'Sem posição' } } : leg)) };
    expect(parseTransitousPlan({ itineraries: [good, broken] })).toHaveLength(1);
    expect(parseTransitousPlan(null)).toEqual([]);
    expect(parseTransitousPlan({ itineraries: 'nope' })).toEqual([]);
  });

  it('ignores a line colour that is not a colour', () => {
    const [good] = fixture.itineraries;
    const odd = { ...good!, legs: good!.legs.map((leg) => ({ ...leg, routeColor: 'orange', routeTextColor: '000000' })) };
    const ride = parseTransitousPlan({ itineraries: [odd] })[0]!.legs[1]!;
    expect(ride).not.toHaveProperty('color');
    expect(ride).not.toHaveProperty('textColor');
  });
});
