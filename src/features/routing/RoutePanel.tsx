import { useEffect, useRef, useState } from 'react';
import { Icon } from '../../ui/Icon';
import type { RouteProfile } from '../../domain/types';
import { useOnline } from '../../lib/useOnline';
import { type RouteEnd, type RoutePlan, useAppStore } from '../../state/store';
import { strings } from '../../strings/pt-BR';
import { BottomSheet } from '../../ui/BottomSheet';
import { RouteWarnings } from '../reports/RouteWarnings';
import { formatDistance, formatDuration } from './format';
import { RouteEndField } from './RouteEndField';
import { type RouteResult, useRoute } from './useRoute';

const ENDS: RouteEnd[] = ['from', 'to'];
/** A way around that adds less than this, in metres, is not worth a number. */
const DETOUR_WORTH_SAYING = 10;
const PROFILES: RouteProfile[] = ['walk', 'wheelchair'];

function Result({ result }: { result: RouteResult }) {
  const { route, orsOverQuota, detour, noDetour } = result;
  const hasStairs = route.steps.some((step) => step.hasSteps);
  const stepFree = strings.route.stepFree[route.stepFree];
  return (
    <>
      <p className="route-summary">
        <strong>{formatDuration(route.duration)}</strong> · {formatDistance(route.distance)}
      </p>
      {hasStairs
        ? <p className="route-warning">{strings.route.hasStairs}</p>
        : stepFree && <p className={route.stepFree === 'guaranteed' ? 'route-ok' : 'route-warning'}>{stepFree}</p>}
      {detour && <p className="route-detour">{strings.route.detour(detour.avoided, detour.extra >= DETOUR_WORTH_SAYING ? formatDistance(detour.extra) : undefined)}</p>}
      {noDetour && <p className="route-warning">{strings.route.noDetour}</p>}
      {orsOverQuota && <p className="muted">{strings.route.quota}</p>}
      <RouteWarnings />
      <div>
        <h3 className="list-title">{strings.route.steps}</h3>
        <ol className="route-steps">
          {route.steps.map((step, index) => (
            <li key={index}>
              <span>
                {step.instruction}
                {step.hasSteps && <span className="arrival-tag">{strings.route.stairs}</span>}
              </span>
              <span className="muted">{formatDistance(step.distance)}</span>
            </li>
          ))}
        </ol>
      </div>
      <p className="muted">
        {strings.route.providers[route.provider]} · {strings.route.dataCredit}
      </p>
    </>
  );
}

/** Plans a walking route: two ends, a profile, and the result. */
export function RoutePanel({ plan }: { plan: RoutePlan }) {
  const setRouteEnd = useAppStore((state) => state.setRouteEnd);
  const setRouteProfile = useAppStore((state) => state.setRouteProfile);
  const swapRouteEnds = useAppStore((state) => state.swapRouteEnds);
  const closeRoute = useAppStore((state) => state.closeRoute);
  const [locationFailed, setLocationFailed] = useState(false);
  const online = useOnline();
  const { data, isFetching, isError } = useRoute(plan);

  const useMyLocation = (end: RouteEnd) => {
    setLocationFailed(false);
    if (!('geolocation' in navigator)) return setLocationFailed(true);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => setRouteEnd(end, { label: strings.route.myLocation, position: [coords.longitude, coords.latitude] }),
      () => setLocationFailed(true),
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  };

  // The panel opens ready for typing: at the end that is still missing, the destination first.
  const fields = { from: useRef<HTMLInputElement>(null), to: useRef<HTMLInputElement>(null) };
  useEffect(() => {
    const { routePlan } = useAppStore.getState();
    if (!routePlan?.to) fields.to.current?.focus();
    else if (!routePlan.from) fields.from.current?.focus();
    // Only when the panel opens.
  }, []);
  /** After an end is chosen: on to the other one if it is empty, or done with typing. */
  const afterChoice = (end: RouteEnd) => {
    const other = end === 'from' ? 'to' : 'from';
    if (useAppStore.getState().routePlan?.[other]) fields[end].current?.blur();
    else fields[other].current?.focus();
  };

  const ready = plan.from && plan.to;
  return (
    <BottomSheet title={strings.route.title} onClose={closeRoute}>
      <div className="route-ends">
        {ENDS.map((end) => (
          <RouteEndField
            key={end}
            end={end}
            point={plan[end]}
            inputRef={fields[end]}
            onChosen={() => afterChoice(end)}
            onUseLocation={() => useMyLocation(end)}
          />
        ))}
        <button type="button" className="route-swap" aria-label={strings.route.swap} title={strings.route.swap} onClick={swapRouteEnds}>
          <Icon name="swap" />
        </button>
      </div>
      {locationFailed && <p className="route-warning">{strings.route.locationError}</p>}
      <div className="chips chips-wrap" role="group" aria-label={strings.route.profile}>
        {PROFILES.map((profile) => (
          <button
            key={profile}
            type="button"
            className="chip chip-choice"
            aria-pressed={plan.profile === profile}
            onClick={() => setRouteProfile(profile)}
          >
            {strings.route.profiles[profile]}
          </button>
        ))}
      </div>
      <div aria-live="polite" className="route-result">
        {ready && !online && !data && <p className="muted">{strings.route.offline}</p>}
        {ready && online && isFetching && <p className="muted">{strings.route.calculating}</p>}
        {ready && online && isError && !isFetching && <p className="route-warning">{strings.route.error}</p>}
        {ready && data && !isFetching && <Result result={data} />}
      </div>
    </BottomSheet>
  );
}
