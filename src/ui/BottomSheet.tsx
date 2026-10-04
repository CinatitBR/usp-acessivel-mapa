import { type ReactNode, useEffect } from 'react';
import { strings } from '../strings/pt-BR';

type Props = {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children?: ReactNode;
};

/**
 * Detail panel next to the map (below it on phones, beside it on wide
 * screens). It takes its own space instead of covering the map, so the
 * attribution and controls stay visible.
 */
export function BottomSheet({ title, subtitle, onClose, children }: Props) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <section className="sheet" aria-label={title}>
      <header className="sheet-header">
        <div>
          <h2 className="sheet-title">{title}</h2>
          {subtitle && <p className="sheet-subtitle">{subtitle}</p>}
        </div>
        <button type="button" className="sheet-close" aria-label={strings.close} onClick={onClose}>
          ×
        </button>
      </header>
      {children && <div className="sheet-body">{children}</div>}
    </section>
  );
}
