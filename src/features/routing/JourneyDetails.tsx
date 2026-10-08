import { type CSSProperties, Fragment, useState } from 'react';
import type { Journey, JourneyLeg, JourneyPlace } from '../../domain/types';
import { type RoutePlan, useAppStore } from '../../state/store';
import { strings } from '../../strings/pt-BR';
import { BottomSheet } from '../../ui/BottomSheet';
import { Icon } from '../../ui/Icon';
import { formatClock } from '../transit/time';
import { formatDistance, formatDuration } from './format';
import { legSeconds, LineBadge, shownLegs, transfersLabel } from './JourneyList';

const text = strings.route.journeys;
const MINUTE_MS = 60_000;

type Ride = Extract<JourneyLeg, { kind: 'transit' }>;

/** How the rail looks beside a leg: dashed for a walk, the line's colour for a ride. */
const railOf = (leg: JourneyLeg | undefined) => (leg ? (leg.kind === 'walk' ? 'walk' : 'ride') : 'none');
const colorOf = (leg: JourneyLeg | undefined) => (leg?.kind === 'transit' ? leg.color : undefined);

/** A ride: its line and direction, and the stops it passes, folded away until asked for. */
function RideBody({ ride, onStop }: { ride: Ride; onStop: (place: JourneyPlace) => void }) {
  const [open, setOpen] = useState(false);
  const duration = formatDuration(legSeconds(ride));
  return (
    <div className="journey-body">
      <span className="journey-ride">
        <LineBadge ride={ride} />
        {ride.headsign && <span>{text.towards(ride.headsign)}</span>}
      </span>
      {ride.stops.length === 0 ? (
        <span className="muted">{text.nonStop(duration)}</span>
      ) : (
        <button type="button" className="timeline-toggle journey-toggle" aria-expanded={open} onClick={() => setOpen(!open)}>
          <Icon name="chevronDown" size={20} />
          {text.stops(ride.stops.length, duration)}
        </button>
      )}
      {open && (
        <ol className="journey-stops">
          {ride.stops.map((stop, index) => (
            <li key={index}>
              <span className="journey-stop-time">{formatClock(stop.time)}</span>
              <button type="button" className="journey-stop-name" onClick={() => onStop(stop)}>
                {stop.name}
              </button>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

/**
 * One journey from end to end: every place where something changes, with its time, joined by a
 * rail that is dashed where one walks and in the line's colour where one rides.
 */
export function JourneyDetails({ plan, journey }: { plan: RoutePlan; journey: Journey }) {
  const openJourney = useAppStore((state) => state.openJourney);
  const flyTo = useAppStore((state) => state.flyTo);
  const back = () => openJourney(null);
  const legs = shownLegs(journey);

  /** The place where leg `index - 1` ends and leg `index` begins; the two ends of the journey have only one of them. */
  const place = (index: number) => {
    const before = legs[index - 1];
    const after = legs[index];
    const at = (after?.from ?? before?.to)!;
    const arrival = before?.to.time ?? at.time;
    const departure = after?.from.time ?? arrival;
    const name = at.name || before?.to.name || (index === 0 ? plan.from?.label : plan.to?.label) || '';
    const style = { '--rail-before': colorOf(before), '--rail-after': colorOf(after) } as CSSProperties;
    return (
      <li className={`journey-row journey-place before-${railOf(before)} after-${railOf(after)}`} style={style}>
        <span className="journey-time">
          {formatClock(arrival)}
          {departure - arrival >= MINUTE_MS && <span>{text.departs(formatClock(departure))}</span>}
        </span>
        <span className="journey-mark">
          <span className="journey-dot" />
        </span>
        <button type="button" className="journey-name" onClick={() => flyTo(at.position)}>
          {name}
          {before?.kind === 'transit' && after?.kind === 'transit' && <span className="timeline-note">{text.transferHere}</span>}
        </button>
      </li>
    );
  };

  return (
    <BottomSheet
      title={text.details}
      subtitle={`${formatClock(journey.start)} – ${formatClock(journey.end)} · ${formatDuration((journey.end - journey.start) / 1000)} · ${transfersLabel(journey)}`}
      back={{ label: text.all, onClick: back }}
      onClose={back}
    >
      <ol className="journey-timeline">
        {legs.map((leg, index) => (
          <Fragment key={index}>
            {place(index)}
            <li className={`journey-row journey-leg ${railOf(leg)}`} style={{ '--rail-color': colorOf(leg) } as CSSProperties}>
              <span className="journey-time" />
              <span className="journey-mark" />
              {leg.kind === 'transit' ? (
                <RideBody ride={leg} onStop={(stop) => flyTo(stop.position)} />
              ) : (
                <span className="journey-body journey-walk">
                  <Icon name="walk" size={20} />
                  {text.walkLeg(formatDuration(legSeconds(leg)), formatDistance(leg.distance))}
                </span>
              )}
            </li>
          </Fragment>
        ))}
        {place(legs.length)}
      </ol>
      <p className="muted">{text.scheduled}</p>
      <p className="muted">{text.credit}</p>
    </BottomSheet>
  );
}
