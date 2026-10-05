import { useEffect, useState } from 'react';
import type { IndoorLevel, IndoorPlan } from '../../domain/indoor';
import { loadIndoorPlan } from '../../map/staticData';
import { useAppStore } from '../../state/store';
import { strings } from '../../strings/pt-BR';

export type OpenPlan = { plan: IndoorPlan; level: IndoorLevel };

/** The floor plan that is open and the floor it shows, once loaded. A plan that cannot be loaded closes itself. */
export function useOpenPlan(): OpenPlan | undefined {
  const name = useAppStore((state) => state.indoor?.plan);
  const chosen = useAppStore((state) => state.indoor?.level ?? null);
  const [loaded, setLoaded] = useState<{ name: string; plan: IndoorPlan }>();

  useEffect(() => {
    if (!name) return;
    let current = true;
    loadIndoorPlan(name).then(
      (plan) => current && setLoaded({ name, plan }),
      () => {
        if (!current) return;
        const { closeIndoor, showToast } = useAppStore.getState();
        closeIndoor();
        showToast({ message: strings.indoor.error });
      },
    );
    return () => {
      current = false;
    };
  }, [name]);

  if (!name || loaded?.name !== name) return undefined;
  const { plan } = loaded;
  const level = plan.levels.find(({ id }) => id === (chosen ?? plan.defaultLevel)) ?? plan.levels[0];
  return level && { plan, level };
}
