import { type CSSProperties, useState } from 'react';
import { useAppStore } from '../../state/store';
import { strings } from '../../strings/pt-BR';
import { estimateTimes } from './lineStops';
import { arrivalLabels } from './time';
import type { BusProgress } from './useBusProgress';

type Props = {
  progress: BusProgress;
  /** Predicted arrival at the user's stop (epoch ms), when the live forecast has one for this bus. */
  targetTime?: number;
  now: number;
};

/**
 * The stops of the bus's line as a checklist: passed stops, where the bus is,
 * and the stops ahead. Opened from a stop, the list ends at that stop.
 */
export function StopTimeline({ progress, targetTime, now }: Props) {
  const { stops, located, passed, target, pose, line } = progress;
  const flyTo = useAppStore((state) => state.flyTo);
  const [showPassed, setShowPassed] = useState(false);
  const shown = target === undefined ? stops : stops.slice(0, target + 1);
  const times =
    target !== undefined && targetTime !== undefined && pose.onRoute
      ? estimateTimes(located, pose.along, target, targetTime, now)
      : [];

  // The list opens at the bus: of the stops behind it only the last one shows until the user asks for the rest.
  const behind = Math.min(passed, shown.length);
  const hidden = showPassed ? 0 : Math.max(0, behind - 1);

  const busMarker = (
    <li key="bus" className="timeline-bus" style={{ color: line.color }}>
      {strings.transit.busHere}
    </li>
  );

  return (
    <>
      <div className="timeline-header">
        <h3 className="list-title">{strings.transit.lineStops}</h3>
        <span className="muted">{strings.transit.stopCount(shown.length)}</span>
      </div>
      <ol className="timeline" style={{ '--line-color': line.color } as CSSProperties}>
        {behind > 1 && (
          <li className="timeline-more">
            <button type="button" className="timeline-toggle" aria-expanded={showPassed} onClick={() => setShowPassed(!showPassed)}>
              {showPassed ? strings.transit.hidePassed : strings.transit.showPassed(behind - 1)}
            </button>
          </li>
        )}
        {shown.flatMap((stop, index) => {
          if (index < hidden) return [];
          const state = index === target ? 'target' : index < passed ? 'passed' : 'ahead';
          const time = times[index];
          const label = time === undefined ? undefined : arrivalLabels(time, now).primary;
          const note = index === target ? strings.transit.yourStop : index === stops.length - 1 ? strings.transit.terminus : undefined;
          const row = (
            <li key={`${stop.id}-${index}`} className={`timeline-stop ${state}`}>
              <button type="button" className="timeline-name" onClick={() => flyTo(stop.position)}>
                {stop.name}
                {note && <span className="timeline-note">{note}</span>}
              </button>
              <span className="timeline-time">
                {index < passed
                  ? strings.transit.passed
                  : label && (index === target ? label : strings.transit.estimate(label))}
              </span>
            </li>
          );
          return index === passed ? [busMarker, row] : [row];
        })}
        {passed >= shown.length && busMarker}
      </ol>
      {times.some((time, index) => time !== undefined && index !== target) && <p className="muted">{strings.transit.estimatesNote}</p>}
    </>
  );
}
