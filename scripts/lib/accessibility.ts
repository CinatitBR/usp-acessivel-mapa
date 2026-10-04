import { deriveAccessStatus } from '../../src/domain/access';
import type { AccessFeatureKind, AccessStatus } from '../../src/domain/types';
import { isAccessKind } from '../../src/features/accessibility/parse';
import type { OsmTags } from './normalize';

type Classified = { kind: AccessFeatureKind; status: AccessStatus };

const known = (status: AccessStatus) => status !== 'unknown';

/** Reserved spaces from `capacity:disabled`: a count, or `yes` for "some". */
export function reservedParking(tags: OsmTags): number | undefined {
  const value = tags['capacity:disabled']?.trim().toLowerCase();
  if (!value) return undefined;
  if (value === 'yes') return 1;
  if (value === 'no') return 0;
  const count = Number(value);
  return Number.isInteger(count) && count >= 0 ? count : undefined;
}

const KERB_STATUS: Record<string, AccessStatus> = { lowered: 'yes', flush: 'yes', rolled: 'partial', raised: 'no' };

/** What a kind means when nobody recorded `wheelchair=*` for it. */
const DEFAULT_STATUS: Record<AccessFeatureKind, AccessStatus> = {
  ramp: 'yes',
  elevator: 'yes',
  steps: 'no',
  entrance: 'unknown',
  toilet: 'unknown',
  parking: 'unknown',
  kerb: 'unknown',
};

/**
 * Decides whether an object belongs in the accessibility layer.
 *
 * Ramps, elevators, kerbs and steps always do: they exist to help or hinder
 * step-free movement. Entrances, toilets and parking only do when their
 * accessibility is actually recorded, so the layer is not filled with
 * "unknown" markers.
 */
export function classifyAccessFeature(tags: OsmTags): Classified | undefined {
  const wheelchair = deriveAccessStatus(tags.wheelchair);

  // Curated overlay features name their kind directly.
  if (isAccessKind(tags.kind)) {
    return { kind: tags.kind, status: known(wheelchair) ? wheelchair : DEFAULT_STATUS[tags.kind] };
  }

  if (tags.highway === 'elevator') return { kind: 'elevator', status: known(wheelchair) ? wheelchair : 'yes' };

  if (tags.highway === 'steps') {
    if (tags['ramp:wheelchair'] === 'yes') return { kind: 'ramp', status: known(wheelchair) ? wheelchair : 'yes' };
    if (known(wheelchair)) return { kind: 'steps', status: wheelchair };
    return { kind: 'steps', status: tags.ramp === 'yes' ? 'partial' : 'no' };
  }

  const kerb = tags.kerb && KERB_STATUS[tags.kerb];
  if (kerb) return { kind: 'kerb', status: kerb };

  if (tags.entrance && known(wheelchair)) return { kind: 'entrance', status: wheelchair };

  if (tags.amenity === 'toilets') {
    const status = known(wheelchair) ? wheelchair : deriveAccessStatus(tags['toilets:wheelchair']);
    return known(status) ? { kind: 'toilet', status } : undefined;
  }

  if (tags.amenity === 'parking') {
    const reserved = reservedParking(tags);
    return reserved === undefined ? undefined : { kind: 'parking', status: reserved > 0 ? 'yes' : 'no' };
  }
  if (tags.amenity === 'parking_space' && (tags.parking_space === 'disabled' || wheelchair === 'yes')) {
    return { kind: 'parking', status: 'yes' };
  }

  return undefined;
}
