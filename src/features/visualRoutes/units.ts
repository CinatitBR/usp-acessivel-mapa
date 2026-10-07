import type { Building } from '../../domain/types';

/**
 * The campus backend files visual routes under its own ids of university units.
 * Here an institute is the OSM area it occupies, so this says which unit each one is.
 */
const UNIT_OF_INSTITUTE: Record<string, string> = {
  'way/154079145': 'ime',
  'way/158789266': 'if',
  'way/34317133': 'iq',
  'way/158966873': 'poli',
  // Escola Politécnica, Departamento de Engenharia Química: a separate area of the same school.
  'way/52050175': 'poli',
  'way/152732604': 'iag',
  'way/154246451': 'igc',
  'way/34381700': 'iee',
  'way/34381459': 'icb',
  'way/158966875': 'fflch',
  'way/158966874': 'feausp',
  'way/153922309': 'eca',
  'way/153922310': 'fau',
  'way/34317182': 'fe',
  'way/158966876': 'ib',
  'way/52050177': 'fcf',
  'way/34381227': 'fousp',
  'way/158967597': 'fmvz',
  'way/34379613': 'eefe',
  'way/34382548': 'ip',
  'way/403735379': 'io',
};

/** Units that are one or a few buildings with no institute area of their own on the map. */
const UNIT_OF_BUILDING: Record<string, string> = {
  'way/152638233': 'reitoria',
  'way/422962269': 'inova-usp',
  'way/291407687': 'iri',
  // Coordenadoria de Assistência Social and the CRUSP blocks it runs.
  'way/152922421': 'sas',
  'way/151653719': 'sas',
  'way/151653724': 'sas',
  'way/151653726': 'sas',
  'way/151653725': 'sas',
  'way/151653722': 'sas',
  'way/151653718': 'sas',
  'way/151653723': 'sas',
};

/** The backend's id of the unit an institute is, when it has one there. */
export const unitOfInstitute = (instituteId: string): string | undefined => UNIT_OF_INSTITUTE[instituteId];

/** The backend's id of the unit a building belongs to, when it has one there. */
export function unitOf(building: Pick<Building, 'id' | 'institute'>): string | undefined {
  return UNIT_OF_BUILDING[building.id] ?? (building.institute === undefined ? undefined : unitOfInstitute(building.institute));
}
