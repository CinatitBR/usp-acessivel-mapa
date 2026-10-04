import { describe, expect, it } from 'vitest';
import { ProviderError } from '../../../lib/http';
import orsSteps from './fixtures/ors-steps.json';
import orsWheelchair from './fixtures/ors-wheelchair.json';
import valhallaSteps from './fixtures/valhalla-steps.json';
import valhallaWheelchair from './fixtures/valhalla-wheelchair.json';
import { parseOrsRoute } from './ors';
import { parseValhallaRoute, valhallaRequestBody } from './valhalla';

describe('parseValhallaRoute', () => {
  // Recorded on 2026-10-04: the two ends of a mapped staircase near the IME.
  it('marks stairs and translates their instruction', () => {
    const route = parseValhallaRoute(valhallaSteps, 'walk');
    expect(route.provider).toBe('valhalla');
    expect(route.stepFree).toBe('no');
    expect(route.distance).toBeCloseTo(29, 0);
    expect(route.geometry).toHaveLength(2);
    expect(route.steps).toEqual([{ instruction: 'Suba ou desça a escada.', distance: 29, hasSteps: true, from: 0, to: 1 }]);
  });

  it('goes around the stairs in the wheelchair profile, as best effort', () => {
    const route = parseValhallaRoute(valhallaWheelchair, 'wheelchair');
    expect(route.stepFree).toBe('best-effort');
    expect(route.distance).toBeCloseTo(638, 0);
    expect(route.duration).toBeCloseTo(596, 0);
    expect(route.steps).toHaveLength(8);
    expect(route.steps.some((step) => step.hasSteps)).toBe(false);
    expect(route.steps.at(-1)!.to).toBe(route.geometry.length - 1);
  });

  it('rejects a response without a route', () => {
    expect(() => parseValhallaRoute({ error_code: 442, error: 'No path could be found for input' }, 'walk')).toThrow(ProviderError);
    expect(() => parseValhallaRoute(null, 'walk')).toThrow(ProviderError);
  });
});

describe('valhallaRequestBody', () => {
  it('asks for Portuguese and, for wheelchairs, a heavy penalty on stairs', () => {
    const walk = valhallaRequestBody({ from: [-46.73, -23.56], to: [-46.72, -23.55], profile: 'walk' });
    expect(walk.locations[0]).toEqual({ lon: -46.73, lat: -23.56 });
    expect(walk.directions_options.language).toBe('pt-BR');
    expect('costing_options' in walk).toBe(false);

    const wheelchair = valhallaRequestBody({ from: [-46.73, -23.56], to: [-46.72, -23.55], profile: 'wheelchair' });
    expect(wheelchair.costing_options?.pedestrian.type).toBe('wheelchair');
  });
});

describe('parseOrsRoute', () => {
  // Recorded through the Worker on 2026-10-04, between the same two points as the Valhalla fixtures.
  it('reads a wheelchair route and drops the arrival step', () => {
    const route = parseOrsRoute(orsWheelchair, 'wheelchair');
    expect(route.provider).toBe('ors');
    expect(route.stepFree).toBe('guaranteed');
    expect(route.distance).toBeCloseTo(639.2, 1);
    expect(route.duration).toBeCloseTo(470.2, 1);
    expect(route.geometry).toHaveLength(19);
    expect(route.steps).toHaveLength(9);
    expect(route.steps[1]).toEqual({ instruction: 'Vire bastante à direita', distance: 132.1, from: 1, to: 3 });
    expect(route.steps.some((step) => step.hasSteps)).toBe(false);
  });

  it('marks the steps that run over stairs', () => {
    const route = parseOrsRoute(orsSteps, 'walk');
    expect(route.stepFree).toBe('no');
    expect(route.distance).toBeCloseTo(29.4, 1);
    expect(route.steps.map((step) => step.hasSteps ?? false)).toEqual([false, true]);
  });

  it('rejects a response without a route', () => {
    expect(() => parseOrsRoute({ error: { code: 2010, message: 'Could not find routable point' } }, 'walk')).toThrow(ProviderError);
  });
});
