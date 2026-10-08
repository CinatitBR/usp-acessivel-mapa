import { type KeyboardEvent, useId, useRef, useState } from 'react';
import type { RouteMode } from '../../domain/types';
import { type RoutePlan, type RouteTime, useAppStore } from '../../state/store';
import { strings } from '../../strings/pt-BR';
import { Icon } from '../../ui/Icon';
import { dayClock, fromDateTimeField, toDateTimeField } from '../transit/time';

const MODES: RouteMode[] = ['walk', 'wheelchair', 'transit'];
const TIME_KINDS: RouteTime['kind'][] = ['now', 'depart', 'arrive'];
const MINUTE_MS = 60_000;

const text = strings.route.time;

/** The time the plan is for, in words: "Sair agora", "Chegada: amanhã, 12:31". */
const chosenTime = (time: RouteTime, now: number) =>
  time.kind === 'now' ? text.kinds.now : text.chosen[time.kind](dayClock(time.at, now));

/**
 * The kinds of route as tabs, with the clock button beside them. The button opens the choice of
 * when to travel: leaving now, leaving at a time, or arriving by one. `panelId` is the element
 * the tabs control, which shows the route of the chosen kind.
 */
export function RouteModeBar({ plan, panelId }: { plan: RoutePlan; panelId: string }) {
  const setRouteMode = useAppStore((state) => state.setRouteMode);
  const setRouteTime = useAppStore((state) => state.setRouteTime);
  const [timeOpen, setTimeOpen] = useState(false);
  const menuId = useId();
  const tabs = useRef<Partial<Record<RouteMode, HTMLButtonElement | null>>>({});
  const { mode, time } = plan;
  const chosen = chosenTime(time, Date.now());

  // Arrow keys move along the tabs and choose as they go, as tabs do.
  const onTabKeyDown = (event: KeyboardEvent) => {
    const step = { ArrowRight: 1, ArrowLeft: -1 }[event.key];
    const next = event.key === 'Home' ? MODES[0] : event.key === 'End' ? MODES.at(-1) : step && MODES[(MODES.indexOf(mode) + step + MODES.length) % MODES.length];
    if (!next) return;
    event.preventDefault();
    setRouteMode(next);
    tabs.current[next]?.focus();
  };

  // A time that is being set starts at this minute, or stays the one already chosen.
  const setKind = (kind: RouteTime['kind']) =>
    setRouteTime(kind === 'now' ? { kind } : { kind, at: time.kind === 'now' ? Math.floor(Date.now() / MINUTE_MS) * MINUTE_MS : time.at });

  return (
    <>
      <div className="route-modes">
        <div className="segmented" role="tablist" aria-label={strings.route.mode} onKeyDown={onTabKeyDown}>
          {MODES.map((one) => (
            <button
              key={one}
              ref={(element) => {
                tabs.current[one] = element;
              }}
              type="button"
              role="tab"
              id={`${panelId}-${one}`}
              aria-selected={mode === one}
              aria-controls={panelId}
              aria-label={strings.route.modeNames[one]}
              title={strings.route.modeNames[one]}
              tabIndex={mode === one ? 0 : -1}
              onClick={() => setRouteMode(one)}
            >
              {strings.route.modes[one]}
            </button>
          ))}
        </div>
        <button
          type="button"
          className={`route-time-button${time.kind === 'now' ? '' : ' set'}`}
          aria-expanded={timeOpen}
          aria-controls={menuId}
          aria-label={text.button(chosen)}
          title={text.button(chosen)}
          onClick={() => setTimeOpen(!timeOpen)}
        >
          <Icon name="clock" />
        </button>
      </div>
      {timeOpen && (
        <div id={menuId} className="route-time" role="group" aria-label={text.title}>
          <div className="segmented">
            {TIME_KINDS.map((kind) => (
              <button key={kind} type="button" aria-pressed={time.kind === kind} onClick={() => setKind(kind)}>
                {text.kinds[kind]}
              </button>
            ))}
          </div>
          {time.kind !== 'now' && (
            <label className="route-time-field">
              <span className="muted">{text.when}</span>
              {/* Not controlled: while the field is half typed it holds no moment to give back. */}
              <input
                type="datetime-local"
                defaultValue={toDateTimeField(time.at)}
                onChange={(event) => {
                  const at = fromDateTimeField(event.target.value);
                  if (at !== null) setRouteTime({ kind: time.kind, at });
                }}
              />
            </label>
          )}
        </div>
      )}
      {/* With the menu closed, a time other than "now" is still said. */}
      {!timeOpen && time.kind !== 'now' && <p className="route-time-chosen">{chosen}</p>}
    </>
  );
}
