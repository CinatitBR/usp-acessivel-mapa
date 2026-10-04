/**
 * OSM areas that together make up the map's extent. The USP relation alone
 * leaves out the institutes that sit inside or next to the campus but are not
 * part of the university: they are holes in, or carved out of, its boundary.
 */
export const CAMPUS_RELATIONS = [
  20199272, // Universidade de São Paulo - Cidade Universitária Armando de Salles Oliveira
  3375375, // Instituto de Pesquisas Energéticas e Nucleares (IPEN)
  20199273, // Instituto de Pesquisas Tecnológicas (IPT)
  3375374, // Centro Tecnológico da Marinha (CTMSP)
];

export const CAMPUS_WAYS = [
  74924310, // Instituto Butantan
];

/** The same areas as ids in the form the build scripts use (`relation/123`, `way/45`). */
export const CAMPUS_AREA_IDS = new Set([
  ...CAMPUS_RELATIONS.map((id) => `relation/${id}`),
  ...CAMPUS_WAYS.map((id) => `way/${id}`),
]);
