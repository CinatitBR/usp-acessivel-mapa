import { type KeyboardEvent, type PointerEvent, type ReactNode, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import { type RoutePoint, useAppStore } from '../state/store';
import { strings } from '../strings/pt-BR';
import { Icon, type IconName } from './Icon';
import { coverOf, settle, type Snap, snapHeights, step } from './sheetSnap';

type Props = {
  title: string;
  subtitle?: string;
  /** Shown before the subtitle: what kind of thing this is. */
  icon?: IconName;
  onClose: () => void;
  /** When given, the sheet offers a route to this place. */
  routeTo?: RoutePoint;
  /** When given, a link above the title that leads back to where this sheet was opened from. */
  back?: { label: string; onClick: () => void };
  /** Buttons that follow the route button in the row of actions. */
  actions?: ReactNode;
  children?: ReactNode;
};

/** From this width the panel stands beside the map; the same value as in index.css. */
const WIDE = '(min-width: 760px)';
/** A press that moves less than this is a tap on a button, not a drag. */
const DRAG_START_PX = 6;
/** How far past its lowest and highest rest the sheet follows the finger. */
const OVERDRAG_PX = 24;
/** The browser sends the click that ends a drag within this time of the release. */
const CLICK_AFTER_DRAG_MS = 400;

const subscribeWide = (onChange: () => void) => {
  const query = window.matchMedia(WIDE);
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
};
const useWide = () => useSyncExternalStore(subscribeWide, () => window.matchMedia(WIDE).matches);

type Sizes = { viewport: number; grip: number; content: number };

/**
 * Detail panel. On a phone it lies over the bottom of the map and rests at three heights
 * (header, half, full): drag its handle or header, flick it, or use the handle as a button.
 * It tells the app how much of the map it covers, so the camera and the controls at the
 * bottom of the map stay clear of it. On wide screens it is a panel beside the map.
 */
export function BottomSheet({ title, subtitle, icon, onClose, routeTo, back, actions, children }: Props) {
  const startRoute = useAppStore((state) => state.startRoute);
  const setSheetCover = useAppStore((state) => state.setSheetCover);
  const wide = useWide();
  const gripRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [snap, setSnap] = useState<Snap>('half');
  const [sizes, setSizes] = useState<Sizes | null>(null);
  const [dragHeight, setDragHeight] = useState<number | null>(null);

  // Something else needs the map (a floor plan was opened): show only the header.
  const collapses = useAppStore((state) => state.sheetCollapses);
  const [collapsesSeen, setCollapsesSeen] = useState(collapses);
  if (collapses !== collapsesSeen) {
    setCollapsesSeen(collapses);
    setSnap('collapsed');
  }

  useEffect(() => {
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  // The sheet's rests follow the screen and its own content, which grows as data arrives.
  useLayoutEffect(() => {
    if (wide) return;
    const measure = () => {
      const next = { viewport: window.innerHeight, grip: gripRef.current?.offsetHeight ?? 0, content: (gripRef.current?.offsetHeight ?? 0) + (bodyRef.current?.offsetHeight ?? 0) };
      setSizes((current) => (current && current.viewport === next.viewport && current.grip === next.grip && current.content === next.content ? current : next));
    };
    measure();
    const observer = new ResizeObserver(measure);
    if (gripRef.current) observer.observe(gripRef.current);
    if (bodyRef.current) observer.observe(bodyRef.current);
    window.addEventListener('resize', measure);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [wide]);

  const heights = !wide && sizes ? snapHeights(sizes.viewport, sizes.grip, sizes.content) : null;
  const height = heights ? (dragHeight ?? heights[snap]) : null;
  const dragging = dragHeight !== null;

  // The controls at the bottom of the map ride on the sheet as it moves; the camera hears of it once it rests.
  useLayoutEffect(() => {
    const cover = height === null || !sizes ? 0 : coverOf(height, sizes.viewport);
    document.documentElement.style.setProperty('--sheet-cover', `${cover}px`);
    document.documentElement.classList.toggle('sheet-dragging', dragging);
    if (!dragging) setSheetCover(cover);
  }, [height, sizes, dragging, setSheetCover]);
  useLayoutEffect(
    () => () => {
      document.documentElement.style.setProperty('--sheet-cover', '0px');
      document.documentElement.classList.remove('sheet-dragging');
      setSheetCover(0);
    },
    [setSheetCover],
  );

  const heightsRef = useRef(heights);
  heightsRef.current = heights;
  const heightRef = useRef(height);
  heightRef.current = height;
  const draggedNow = useRef(false);

  /** Starts following a finger or the mouse from `startY`; the sheet moves once it has travelled a little. */
  const beginDrag = (startY: number, startTime: number) => {
    const startHeight = heightRef.current;
    let moving = false;
    let [lastY, lastTime, velocity, reached] = [startY, startTime, 0, startHeight ?? 0];
    return {
      move(y: number, time: number) {
        const rests = heightsRef.current;
        if (!rests || startHeight === null) return;
        const lifted = startY - y;
        if (!moving && Math.abs(lifted) < DRAG_START_PX) return;
        moving = true;
        if (time > lastTime) velocity = (lastY - y) / (time - lastTime);
        [lastY, lastTime] = [y, time];
        reached = Math.max(rests.collapsed - OVERDRAG_PX, Math.min(rests.full + OVERDRAG_PX, startHeight + lifted));
        setDragHeight(reached);
      },
      end() {
        if (!moving) return;
        const rests = heightsRef.current;
        if (rests) setSnap(settle(rests, reached, velocity));
        setDragHeight(null);
        // The click that ends a drag belongs to the drag, not to the button under the finger.
        draggedNow.current = true;
        setTimeout(() => {
          draggedNow.current = false;
        }, CLICK_AFTER_DRAG_MS);
      },
    };
  };

  // By the handle and header, with a finger or the mouse. Followed on the window: a mouse that leaves the header keeps hold of the sheet.
  const stopDrag = useRef<(() => void) | null>(null);
  useEffect(() => () => stopDrag.current?.(), []);
  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (!heights || event.button !== 0) return;
    const { pointerId } = event;
    const drag = beginDrag(event.clientY, event.timeStamp);
    const onMove = (move: globalThis.PointerEvent) => {
      if (move.pointerId === pointerId) drag.move(move.clientY, move.timeStamp);
    };
    const onEnd = (end: globalThis.PointerEvent) => {
      if (end.pointerId !== pointerId) return;
      stopDrag.current?.();
      drag.end();
    };
    stopDrag.current?.();
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onEnd);
    window.addEventListener('pointercancel', onEnd);
    stopDrag.current = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onEnd);
      window.removeEventListener('pointercancel', onEnd);
      stopDrag.current = null;
    };
  };

  const top = heights ? step(heights, snap, 1) === snap : true;
  const topRef = useRef(top);
  topRef.current = top;

  // By the content, with a finger. Below its highest rest the sheet follows any vertical drag;
  // at its highest the content scrolls, and the sheet follows a drag down once the content is at its start.
  useEffect(() => {
    const scroll = scrollRef.current;
    if (wide || !scroll) return;
    let gesture: { x: number; y: number; scrolled: number; drag: ReturnType<typeof beginDrag> | null; native: boolean } | null = null;
    const onStart = (event: TouchEvent) => {
      const touch = event.touches[0];
      gesture = event.touches.length === 1 && touch ? { x: touch.clientX, y: touch.clientY, scrolled: scroll.scrollTop, drag: null, native: false } : null;
    };
    const onMove = (event: TouchEvent) => {
      const touch = event.touches[0];
      if (!gesture || gesture.native || !touch) return;
      if (!gesture.drag) {
        const [across, down] = [touch.clientX - gesture.x, touch.clientY - gesture.y];
        if (across === 0 && down === 0) return;
        // A row of chips or the photos, swiped sideways; or the content, scrolled.
        const sideways = Math.abs(across) > Math.abs(down);
        const scrolls = topRef.current && (gesture.scrolled > 0 || down < 0);
        if (sideways || scrolls || !event.cancelable) {
          gesture.native = true;
          return;
        }
        gesture.drag = beginDrag(gesture.y, event.timeStamp);
      }
      event.preventDefault();
      gesture.drag.move(touch.clientY, event.timeStamp);
    };
    const onEnd = () => {
      gesture?.drag?.end();
      gesture = null;
    };
    scroll.addEventListener('touchstart', onStart, { passive: true });
    // Not passive: the sheet takes the gesture from the browser's own scrolling.
    scroll.addEventListener('touchmove', onMove, { passive: false });
    scroll.addEventListener('touchend', onEnd);
    scroll.addEventListener('touchcancel', onEnd);
    return () => {
      scroll.removeEventListener('touchstart', onStart);
      scroll.removeEventListener('touchmove', onMove);
      scroll.removeEventListener('touchend', onEnd);
      scroll.removeEventListener('touchcancel', onEnd);
    };
    // The sheet's body appears with its first content.
  }, [wide, children !== undefined || routeTo !== undefined || actions !== undefined]);

  // Content that could be scrolled only at the highest rest starts from its beginning again below it.
  useEffect(() => {
    if (!top && scrollRef.current) scrollRef.current.scrollTop = 0;
  }, [top]);

  const swallowClickAfterDrag = (event: { stopPropagation: () => void; preventDefault: () => void }) => {
    if (!draggedNow.current) return;
    draggedNow.current = false;
    event.stopPropagation();
    event.preventDefault();
  };

  const onHandleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (!heights || (event.key !== 'ArrowUp' && event.key !== 'ArrowDown')) return;
    event.preventDefault();
    setSnap(step(heights, snap, event.key === 'ArrowUp' ? 1 : -1));
  };

  return (
    <section
      className={`sheet${dragging ? ' dragging' : ''}${top ? ' at-top' : ''}`}
      aria-label={title}
      style={height === null ? undefined : { height }}
      onClickCapture={swallowClickAfterDrag}
    >
      <div ref={gripRef} className="sheet-grip" onPointerDown={onPointerDown}>
        {!wide && (
          <button
            type="button"
            className="sheet-handle"
            aria-label={top ? strings.sheet.collapse : strings.sheet.expand}
            aria-expanded={snap !== 'collapsed'}
            onClick={() => heights && setSnap(top ? 'collapsed' : step(heights, snap, 1))}
            onKeyDown={onHandleKeyDown}
          />
        )}
        <header className="sheet-header">
          <div>
            {back && (
              <button type="button" className="sheet-back" onClick={back.onClick}>
                <Icon name="back" size={18} />
                {back.label}
              </button>
            )}
            <h2 className="sheet-title">{title}</h2>
            {subtitle && (
              <p className="sheet-subtitle">
                {icon && <Icon name={icon} size={18} />}
                {subtitle}
              </p>
            )}
          </div>
          <button type="button" className="sheet-close" aria-label={strings.close} onClick={onClose}>
            <Icon name="close" />
          </button>
        </header>
      </div>
      {(children || routeTo || actions) && (
        // A collapsed sheet shows only its header: what is under it is out of reach of the keyboard too.
        <div
          ref={scrollRef}
          className="sheet-scroll"
          inert={!wide && snap === 'collapsed' && !dragging}
          // Below its highest rest the content does not scroll: the wheel raises the sheet instead.
          onWheel={(event) => {
            if (heights && !top && event.deltaY > 0) setSnap(step(heights, snap, 1));
          }}
        >
          <div ref={bodyRef} className="sheet-body">
            {(routeTo || actions) && (
              <div className="sheet-actions">
                {routeTo && (
                  <button type="button" className="button" onClick={() => startRoute(routeTo)}>
                    <Icon name="route" size={20} />
                    {strings.route.toHere}
                  </button>
                )}
                {actions}
              </div>
            )}
            {children}
          </div>
        </div>
      )}
    </section>
  );
}
