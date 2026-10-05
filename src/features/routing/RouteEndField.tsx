import { type KeyboardEvent, type RefObject, useId, useState } from 'react';
import type { GeocodeResult } from '../../domain/types';
import { type RouteEnd, type RoutePoint, useAppStore } from '../../state/store';
import { strings } from '../../strings/pt-BR';
import { Icon } from '../../ui/Icon';
import { searchNote } from '../search/SearchBox';
import { usePlaceSearch } from '../search/usePlaceSearch';

type Props = {
  end: RouteEnd;
  point: RoutePoint | null;
  inputRef: RefObject<HTMLInputElement | null>;
  /** Called once this end has a place, with the keyboard still up. */
  onChosen: () => void;
  onUseLocation: () => void;
};

/**
 * One end of the route: a field that shows the chosen place and, while it is being typed in,
 * a list of matching places under it, with "my location" always first.
 */
export function RouteEndField({ end, point, inputRef, onChosen, onUseLocation }: Props) {
  const setRouteEnd = useAppStore((state) => state.setRouteEnd);
  const requestSheet = useAppStore((state) => state.requestSheet);
  // null while the field is at rest and shows the chosen place.
  const [text, setText] = useState<string | null>(null);
  const [active, setActive] = useState(0);
  const listId = useId();
  const editing = text !== null;
  const { query, local, remote, results, note, ensureIndex } = usePlaceSearch(text ?? '', editing);

  const choose = (result: GeocodeResult) => {
    setRouteEnd(end, { label: result.label, position: result.position });
    onChosen();
  };
  const useLocation = () => {
    onUseLocation();
    inputRef.current?.blur();
  };
  // Option 0 is "my location"; the places follow.
  const pick = (index: number) => {
    const result = results[index - 1];
    if (index === 0) useLocation();
    else if (result) choose(result);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    const count = results.length + 1;
    if (event.key === 'Escape') {
      // The sheet would close on Escape; here it only ends the typing.
      event.stopPropagation();
      event.nativeEvent.stopImmediatePropagation();
      inputRef.current?.blur();
    } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      setActive((active + (event.key === 'ArrowDown' ? 1 : -1) + count) % count);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      // With something typed, Enter takes the first place rather than "my location".
      pick(active === 0 && query && results.length > 0 ? 1 : active);
    }
  };

  const option = (index: number, label: string, detail?: string, icon = false) => (
    <li
      key={index}
      id={`${listId}-${index}`}
      role="option"
      aria-selected={index === active}
      className={icon ? 'search-option route-option-location' : 'search-option'}
      // Keep focus in the field so the list does not close before the click lands.
      onPointerDown={(event) => event.preventDefault()}
      onClick={() => pick(index)}
    >
      <span className="search-option-label">
        {icon && <Icon name="place" size={20} />}
        {label}
      </span>
      {detail && <span className="search-option-detail">{detail}</span>}
    </li>
  );

  return (
    <>
      <label className="route-end">
        <span className="muted">{strings.route[end]}</span>
        <input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-label={strings.route.endLabel[end]}
          aria-expanded={editing}
          aria-controls={listId}
          aria-activedescendant={editing ? `${listId}-${active}` : undefined}
          aria-autocomplete="list"
          autoComplete="off"
          enterKeyHint="search"
          placeholder={strings.route.searchFor[end]}
          value={text ?? point?.label ?? ''}
          onChange={(event) => {
            setText(event.target.value);
            setActive(0);
          }}
          onFocus={() => {
            ensureIndex();
            setText('');
            setActive(0);
            // On a phone, up where the keyboard does not cover the field and its list.
            requestSheet('full');
          }}
          onBlur={() => {
            setText(null);
            requestSheet('half');
          }}
          onKeyDown={onKeyDown}
        />
      </label>
      {editing && (
        <ul id={listId} role="listbox" aria-label={strings.route.suggestions} className="route-results">
          {option(0, strings.route.useMyLocation, undefined, true)}
          {local.map((result, index) => option(index + 1, result.label, result.detail))}
          {query && local.length === 0 && (
            <li role="presentation" className="search-note">
              {searchNote(note)}
            </li>
          )}
          {remote.length > 0 && (
            <li role="presentation" className="search-section">
              {strings.search.offCampus}
            </li>
          )}
          {remote.map((result, index) => option(local.length + index + 1, result.label, result.detail))}
        </ul>
      )}
    </>
  );
}
