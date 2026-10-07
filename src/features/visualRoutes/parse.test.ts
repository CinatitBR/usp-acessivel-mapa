import { describe, expect, it } from 'vitest';
import { parseVisualRoutes } from './parse';

const STORAGE = 'https://storage.example';

const step = (stepOrder: number, description: string | null, imageUrl = `visual_routes/vr_1_step_${stepOrder}.webp`) => ({
  stepOrder, description, imageUrl, lat: null, lon: null,
});
const answer = (visualRoutes: unknown) => ({ success: true, data: { id: 'ime', name: 'IME', pois: [], visualRoutes } });

describe('parseVisualRoutes', () => {
  it('reads the routes with their steps in order and the full address of each photo', () => {
    const routes = parseVisualRoutes(
      answer([{ id: 'vr_1', title: ' Elevador do bloco A ', steps: [step(1, 'Vire à direita'), step(0, 'Entrada principal')] }]),
      STORAGE,
    );
    expect(routes).toEqual([
      {
        id: 'vr_1',
        title: 'Elevador do bloco A',
        steps: [
          { description: 'Entrada principal', image: `${STORAGE}/visual_routes/vr_1_step_0.webp` },
          { description: 'Vire à direita', image: `${STORAGE}/visual_routes/vr_1_step_1.webp` },
        ],
      },
    ]);
  });

  it('keeps a step with no description and a photo that already has a full address', () => {
    const [route] = parseVisualRoutes(answer([{ id: 'vr_1', title: 'A', steps: [step(0, null), step(1, '  ', 'https://other.example/x.webp')] }]), STORAGE);
    expect(route!.steps).toEqual([{ image: `${STORAGE}/visual_routes/vr_1_step_0.webp` }, { image: 'https://other.example/x.webp' }]);
  });

  it('leaves out routes with no steps, steps with no photo and malformed routes', () => {
    const routes = parseVisualRoutes(
      answer([
        { id: 'vr_empty', title: 'Sem passos', steps: [] },
        { id: 'vr_2', title: 'B', steps: [step(0, 'Sem foto', ''), step(1, 'Com foto')] },
        { id: 3, title: 'C', steps: [step(0, 'x')] },
        { id: 'vr_4', steps: [step(0, 'x')] },
        null,
      ]),
      STORAGE,
    );
    expect(routes.map((route) => [route.id, route.steps.length])).toEqual([['vr_2', 1]]);
  });

  it('tolerates answers that are not what was expected', () => {
    expect(parseVisualRoutes(null, STORAGE)).toEqual([]);
    expect(parseVisualRoutes({ success: false, error: { code: 'ERR_BUILDING_NOT_FOUND' } }, STORAGE)).toEqual([]);
    expect(parseVisualRoutes(answer('x'), STORAGE)).toEqual([]);
  });
});
