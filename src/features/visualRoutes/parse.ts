/** One photo of the way, with what to do there. */
export type VisualRouteStep = {
  description?: string;
  /** Address of the photo. */
  image: string;
};

/** A way into or through a building, shown as a sequence of photos. */
export type VisualRoute = {
  id: string;
  title: string;
  steps: VisualRouteStep[];
};

type RawStep = { stepOrder?: unknown; description?: unknown; imageUrl?: unknown };
type RawRoute = { id?: unknown; title?: unknown; steps?: unknown };

/**
 * Converts the answer of `/buildings/{id}/accessibility` into the visual routes of that unit.
 * Photos are stored as paths inside the storage bucket. A route with no usable step is left
 * out: there would be nothing to show.
 */
export function parseVisualRoutes(json: unknown, storageBase: string): VisualRoute[] {
  const raw = (json as { data?: { visualRoutes?: unknown } } | null)?.data?.visualRoutes;
  if (!Array.isArray(raw)) return [];

  return (raw as RawRoute[]).flatMap((route) => {
    if (!route || typeof route.id !== 'string' || typeof route.title !== 'string' || !Array.isArray(route.steps)) return [];
    const steps = (route.steps as RawStep[])
      .filter((step) => step && typeof step.imageUrl === 'string' && step.imageUrl !== '')
      .sort((a, b) => (typeof a.stepOrder === 'number' ? a.stepOrder : 0) - (typeof b.stepOrder === 'number' ? b.stepOrder : 0))
      .map((step): VisualRouteStep => {
        const description = typeof step.description === 'string' ? step.description.trim() : '';
        const path = (step.imageUrl as string).replace(/^\/+/, '');
        return {
          ...(description && { description }),
          image: /^https?:\/\//.test(path) ? path : `${storageBase}/${path}`,
        };
      });
    return steps.length === 0 ? [] : [{ id: route.id, title: route.title.trim() || route.id, steps }];
  });
}
