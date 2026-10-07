import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { strings } from '../../strings/pt-BR';
import { Icon } from '../../ui/Icon';
import type { VisualRouteStep } from './parse';

type Props = {
  steps: VisualRouteStep[];
  /** Index of the step shown. */
  index: number;
  onChange: (index: number) => void;
  onClose: () => void;
};

/**
 * One step's photo over the whole screen, with its instruction under it. The arrows (on
 * screen or on the keyboard) go to the step before and after. It is drawn outside the
 * sheet, so dragging over the photo does not move the sheet.
 */
export function StepViewer({ steps, index, onChange, onClose }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = dialogRef.current;
    // A modal dialog keeps the focus inside it and gives it back to the photo that opened it.
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  const step = steps[index];
  if (!step) return null;
  const go = (to: number) => {
    if (to >= 0 && to < steps.length) onChange(to);
  };

  return createPortal(
    <dialog
      ref={dialogRef}
      className="step-viewer"
      aria-label={strings.visualRoutes.photo(index + 1)}
      onClose={onClose}
      // A click on the dark area around the photo closes it.
      onClick={(event) => {
        if (event.target === event.currentTarget || (event.target as HTMLElement).tagName === 'FIGURE') onClose();
      }}
      onKeyDown={(event) => {
        if (event.key === 'ArrowLeft') go(index - 1);
        else if (event.key === 'ArrowRight') go(index + 1);
        // Escape closes the photo only, not the sheet under it, which also listens for it.
        else if (event.key === 'Escape') event.stopPropagation();
      }}
    >
      <figure>
        <img src={step.image} alt={strings.visualRoutes.photo(index + 1)} />
        <figcaption aria-live="polite">
          <span className="visual-step-number">{index + 1}</span>
          {step.description ?? strings.visualRoutes.step(index + 1)}
        </figcaption>
      </figure>
      <button type="button" className="carousel-button step-viewer-close" aria-label={strings.close} onClick={onClose}>
        <Icon name="close" />
      </button>
      {steps.length > 1 && (
        <>
          <button type="button" className="carousel-button previous" aria-label={strings.visualRoutes.previousStep} disabled={index === 0} onClick={() => go(index - 1)}>
            <Icon name="chevronLeft" />
          </button>
          <button
            type="button"
            className="carousel-button next"
            aria-label={strings.visualRoutes.nextStep}
            disabled={index === steps.length - 1}
            onClick={() => go(index + 1)}
          >
            <Icon name="chevronRight" />
          </button>
        </>
      )}
    </dialog>,
    document.body,
  );
}
