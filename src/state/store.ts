import { create } from 'zustand';

export type MapStatus = 'loading' | 'ready' | 'error';

type AppState = {
  mapStatus: MapStatus;
  setMapStatus: (status: MapStatus) => void;
};

export const useAppStore = create<AppState>((set) => ({
  mapStatus: 'loading',
  setMapStatus: (mapStatus) => set({ mapStatus }),
}));
