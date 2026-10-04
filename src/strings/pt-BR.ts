import type { AccessStatus, PoiCategory } from '../domain/types';

/** Every user-facing string lives here so the UI can be translated later. */
export const strings = {
  appName: 'Mapa USP Butantã',
  close: 'Fechar',
  loading: 'Carregando…',
  dataError: 'Não foi possível carregar os dados do campus.',
  map: {
    ariaLabel: 'Mapa do campus Butantã da USP',
    loading: 'Carregando mapa…',
    error: 'Não foi possível carregar o mapa. Verifique sua conexão.',
  },
  search: {
    placeholder: 'Buscar prédio, instituto ou local',
    label: 'Buscar no campus',
    results: 'Resultados da busca',
    noLocalResults: 'Nenhum resultado no campus',
    offCampus: 'Fora do campus',
    institute: 'Unidade',
  },
  building: {
    unnamed: 'Edifício sem nome',
    kinds: {
      university: 'Prédio universitário',
      dormitory: 'Moradia estudantil',
      roof: 'Cobertura',
      retail: 'Comércio',
      commercial: 'Comércio',
      construction: 'Em construção',
      school: 'Escola',
      greenhouse: 'Estufa',
      hospital: 'Hospital',
      yes: 'Edifício',
    } as Record<string, string>,
  },
  institute: {
    buildings: 'Prédios',
    noNamedBuildings: 'Nenhum prédio com nome cadastrado.',
  },
  poi: {
    inside: 'Em',
    openingHours: 'Horário',
    categories: {
      food: 'Alimentação',
      library: 'Biblioteca',
      bank: 'Banco',
      atm: 'Caixa eletrônico',
      water: 'Bebedouro',
      toilets: 'Banheiro',
      bike_rental: 'Estação de bicicletas',
      bike_parking: 'Bicicletário',
      parking: 'Estacionamento',
      health: 'Saúde',
      culture: 'Cultura',
      sport: 'Esporte',
      park: 'Área verde',
      shop: 'Loja',
      info: 'Informações',
      other: 'Local',
    } satisfies Record<PoiCategory, string>,
  },
  place: {
    offCampus: 'Local fora do campus',
  },
  access: {
    title: 'Acessibilidade',
    status: {
      yes: 'Acessível',
      partial: 'Parcialmente acessível',
      no: 'Não acessível',
      unknown: 'Sem informação',
    } satisfies Record<AccessStatus, string>,
    unknownHint: 'Ninguém registrou ainda a acessibilidade deste local.',
    source: { osm: 'Fonte: OpenStreetMap', curated: 'Fonte: levantamento do projeto' },
  },
} as const;

export const buildingKindLabel = (kind: string) => strings.building.kinds[kind] ?? strings.building.kinds.yes!;
