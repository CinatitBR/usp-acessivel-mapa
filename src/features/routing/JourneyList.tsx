import { Fragment } from 'react';
import type { Journey, JourneyLeg } from '../../domain/types';
import { useOnline } from '../../lib/useOnline';
import { type RoutePlan, useAppStore } from '../../state/store';
import { strings } from '../../strings/pt-BR';
import { Icon } from '../../ui/Icon';
import { formatClock } from '../transit/time';
import { formatDuration } from './format';
import { useJourneys } from './useJourneys';

const text = strings.route.journeys;
/** A "walk" shorter than this, in metres, is a change of vehicle at one stop. */
const TRANSFER_METERS = 20;

type Ride = Extract<JourneyLeg, { kind: 'transit' }>;

/** The legs worth showing: a walk of no length between two rides only says that one changes there. */
export const shownLegs = (journey: Journey): JourneyLeg[] =>
  journey.legs.filter((leg) => leg.kind === 'transit' || leg.distance >= TRANSFER_METERS);

export const legSeconds = (leg: JourneyLeg): number => (leg.to.time - leg.from.time) / 1000;

export const transfersLabel = (journey: Journey): string => (journey.transfers === 0 ? text.direct : text.transfers(journey.transfers));

/** Dark or light text for a line colour that came without a text colour of its own. */
function readableOn(color: string): string {
  const [red, green, blue] = [1, 3, 5].map((start) => parseInt(color.slice(start, start + 2), 16));
  return (red! * 299 + green! * 587 + blue! * 114) / 1000 > 150 ? 'var(--text)' : 'var(--on-inverse)';
}

/** The line of a ride as riders know it, on the line's own colour when the timetable gives one. */
export function LineBadge({ ride }: { ride: Ride }) {
  return (
    <span className="journey-line" style={ride.color ? { background: ride.color, color: ride.textColor ?? readableOn(ride.color) } : undefined}>
      <Icon name={ride.vehicle === 'bus' ? 'bus' : 'train'} size={16} />
      <span className="visually-hidden">{text.vehicles[ride.vehicle]} </span>
      {ride.line}
    </span>
  );
}

/** One journey of the list: when it leaves and arrives, how long it takes, and its legs in a row. */
function JourneyCard({ journey, onOpen }: { journey: Journey; onOpen: () => void }) {
  return (
    <button type="button" className="journey-card" onClick={onOpen}>
      <span className="journey-card-head">
        <strong>
          {formatClock(journey.start)} – {formatClock(journey.end)}
        </strong>
        <span className="muted">{formatDuration((journey.end - journey.start) / 1000)}</span>
        <span className="arrival-tag">{transfersLabel(journey)}</span>
      </span>
      <span className="journey-card-legs">
        {shownLegs(journey).map((leg, index) => (
          <Fragment key={index}>
            {index > 0 && (
              <span className="journey-then">
                <Icon name="chevronRight" size={16} />
                <span className="visually-hidden">{text.then}</span>
              </span>
            )}
            {leg.kind === 'transit' ? (
              <LineBadge ride={leg} />
            ) : (
              <span className="journey-walk">
                <Icon name="walk" size={18} />
                <span className="visually-hidden">{text.walk}</span>
                {formatDuration(legSeconds(leg))}
              </span>
            )}
          </Fragment>
        ))}
      </span>
      <span className="journey-card-open">
        <Icon name="chevronRight" />
      </span>
    </button>
  );
}

/** The journeys by public transport for the plan, as a list to choose from. Choosing one opens its details. */
export function JourneyList({ plan }: { plan: RoutePlan }) {
  const openJourney = useAppStore((state) => state.openJourney);
  const online = useOnline();
  const { data, isFetching, isError } = useJourneys(plan);

  if (!plan.from || !plan.to) return null;
  if (!data) {
    if (!online) return <p className="muted">{strings.route.offline}</p>;
    if (isFetching) return <p className="muted">{text.searching}</p>;
    return isError ? <p className="route-warning">{text.error}</p> : null;
  }
  if (data.length === 0) return <p className="muted">{text.none}</p>;
  return (
    <>
      <h3 className="list-title">{text.choose}</h3>
      <ul className="journeys">
        {data.map((journey) => (
          <li key={journey.id}>
            <JourneyCard journey={journey} onOpen={() => openJourney(journey.id)} />
          </li>
        ))}
      </ul>
      <p className="muted">{text.scheduled}</p>
      <p className="muted">{text.credit}</p>
    </>
  );
}
