import type { AccessStatus } from './types';

/** One-letter codes used in the generated GeoJSON to keep files small. */
export type AccessCode = 'y' | 'p' | 'n' | 'u';

const CODE_BY_STATUS: Record<AccessStatus, AccessCode> = {
  yes: 'y',
  partial: 'p',
  no: 'n',
  unknown: 'u',
};

const STATUS_BY_CODE: Record<AccessCode, AccessStatus> = {
  y: 'yes',
  p: 'partial',
  n: 'no',
  u: 'unknown',
};

/** Maps an OSM `wheelchair=*` value to a status. Anything unrecognised is `unknown`. */
export function deriveAccessStatus(wheelchair: string | undefined): AccessStatus {
  switch (wheelchair?.trim().toLowerCase()) {
    case 'yes':
    case 'designated':
      return 'yes';
    case 'limited':
      return 'partial';
    case 'no':
      return 'no';
    default:
      return 'unknown';
  }
}

export function encodeAccess(status: AccessStatus): AccessCode {
  return CODE_BY_STATUS[status];
}

export function decodeAccess(code: unknown): AccessStatus {
  return typeof code === 'string' && code in STATUS_BY_CODE
    ? STATUS_BY_CODE[code as AccessCode]
    : 'unknown';
}
