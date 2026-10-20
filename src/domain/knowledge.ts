import type { LngLat } from './types';

/** Where on the map a chat source is: what selecting it opens, and where the camera goes. */
export type KnowledgePlace = { kind: 'building' | 'institute' | 'poi'; id: string; position: LngLat };

/** One source the chat may cite, as the app shows it under an answer (`public/data/knowledge.json`). */
export type KnowledgeSource = {
  id: string;
  title: string;
  /** The first official page the entry was written from. */
  url: string;
  place?: KnowledgePlace;
};
