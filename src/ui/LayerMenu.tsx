import { useEffect, useId, useState } from 'react';
import { POI_CATEGORIES } from '../features/pois/style';
import { selectLite, useAppStore } from '../state/store';
import { strings } from '../strings/pt-BR';

const categoryLabel = (category: (typeof POI_CATEGORIES)[number]) =>
  category === 'other' ? strings.layers.otherPois : strings.poi.categories[category];

/** Round button that opens the map's options: the 3D switch and which places are drawn. */
export function LayerMenu() {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const lite = useAppStore(selectLite);
  const setLiteChoice = useAppStore((state) => state.setLiteChoice);
  const visible = useAppStore((state) => state.poiCategories);
  const togglePoiCategory = useAppStore((state) => state.togglePoiCategory);
  const accessMode = useAppStore((state) => state.accessMode);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open]);

  return (
    <>
      <button
        type="button"
        className="map-button layer-button"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={strings.layers.button}
        title={strings.layers.button}
        onClick={() => setOpen(!open)}
      >
        <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
          <path
            d="M12 4l9 5-9 5-9-5z M3.5 13.5l8.5 4.7 8.5-4.7"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        </svg>
      </button>
      {open && (
        <section id={panelId} className="layer-menu" aria-label={strings.layers.title}>
          {/* The choice is remembered on this device and overrides the automatic lite mode. */}
          <button
            type="button"
            className="switch-row"
            role="switch"
            aria-checked={!lite}
            onClick={() => setLiteChoice(lite ? 'off' : 'on')}
          >
            <span>
              <strong>{strings.lite.label}</strong>
              <span className="muted">{strings.lite.hint}</span>
            </span>
            <span className="switch" aria-hidden="true" />
          </button>
          <h2 className="list-title">{strings.layers.pois}</h2>
          {accessMode && <p className="muted">{strings.layers.hiddenInAccessMode}</p>}
          <div className="chips chips-wrap" role="group" aria-label={strings.layers.pois}>
            {POI_CATEGORIES.map((category) => (
              <button
                key={category}
                type="button"
                className="chip"
                aria-pressed={visible.includes(category)}
                onClick={() => togglePoiCategory(category)}
              >
                {categoryLabel(category)}
              </button>
            ))}
          </div>
        </section>
      )}
    </>
  );
}
