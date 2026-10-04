import { type ReactNode, useRef, useState } from 'react';
import { strings } from '../strings/pt-BR';

export type CarouselImage = {
  src: string;
  alt: string;
  /** Shown under the image while it is the current one. */
  caption?: ReactNode;
};

/**
 * Images side by side in a strip that snaps to one at a time. Swiping is the
 * browser's own scrolling; the buttons are for mouse and keyboard. An image
 * that fails to load is taken out.
 */
export function Carousel({ images, label }: { images: CarouselImage[]; label: string }) {
  const strip = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState<readonly string[]>([]);
  const [index, setIndex] = useState(0);

  const shown = images.filter((image) => !failed.includes(image.src));
  if (shown.length === 0) return null;
  const current = Math.min(index, shown.length - 1);

  const go = (target: number) => {
    const element = strip.current;
    if (!element) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    element.scrollTo({ left: target * element.clientWidth, behavior: reduced ? 'auto' : 'smooth' });
  };

  return (
    <figure className="carousel" role="group" aria-roledescription="carrossel" aria-label={label}>
      <div className="carousel-frame">
        <div
          ref={strip}
          className="carousel-strip"
          onScroll={(event) => {
            const element = event.currentTarget;
            if (element.clientWidth > 0) setIndex(Math.round(element.scrollLeft / element.clientWidth));
          }}
        >
          {shown.map((image, position) => (
            <img
              key={image.src}
              className="carousel-image"
              // Only the current photo and the next one are fetched; the others wait until the user gets near them.
              {...(position <= current + 1 && { src: image.src })}
              alt={image.alt}
              decoding="async"
              referrerPolicy="no-referrer"
              onError={() => setFailed((previous) => [...previous, image.src])}
            />
          ))}
        </div>
        {shown.length > 1 && (
          <>
            <button
              type="button"
              className="carousel-button previous"
              aria-label={strings.carousel.previous}
              disabled={current === 0}
              onClick={() => go(current - 1)}
            >
              ‹
            </button>
            <button
              type="button"
              className="carousel-button next"
              aria-label={strings.carousel.next}
              disabled={current === shown.length - 1}
              onClick={() => go(current + 1)}
            >
              ›
            </button>
            <span className="carousel-count" aria-live="polite">
              {strings.carousel.position(current + 1, shown.length)}
            </span>
          </>
        )}
      </div>
      {shown[current]!.caption && <figcaption className="carousel-caption">{shown[current]!.caption}</figcaption>}
    </figure>
  );
}
