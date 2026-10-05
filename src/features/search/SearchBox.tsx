import { type KeyboardEvent, useId, useRef, useState } from 'react';
import { Icon } from '../../ui/Icon';
import type { GeocodeResult } from '../../domain/types';
import { type Selection, useAppStore } from '../../state/store';
import { strings } from '../../strings/pt-BR';
import { usePlaceSearch } from './usePlaceSearch';

function toSelection(result: GeocodeResult): Selection {
  const { ref, position } = result;
  if (ref?.type === 'building') return { kind: 'building', id: ref.id };
  if (ref) return { kind: ref.type, id: ref.id, position };
  return { kind: 'place', label: result.label, detail: result.detail, position };
}

/** The line shown in place of campus results. */
export const searchNote = (note: 'failed' | 'none' | 'loading') =>
  note === 'failed' ? strings.dataError : note === 'none' ? strings.search.noLocalResults : strings.loading;

export function SearchBox() {
  const select = useAppStore((state) => state.select);
  const [text, setText] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();
  const { query, local, remote, results, note, ensureIndex } = usePlaceSearch(text, open);

  const choose = (result: GeocodeResult) => {
    select(toSelection(result), result.position);
    setText(result.label);
    setOpen(false);
    inputRef.current?.blur();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') {
      setOpen(false);
    } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (results.length > 0) {
        const step = event.key === 'ArrowDown' ? 1 : -1;
        setActive((active + step + results.length) % results.length);
      }
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const result = results[active] ?? results[0];
      if (result) choose(result);
    }
  };

  const showList = open && query.length > 0;
  const option = (result: GeocodeResult, index: number) => (
    <li
      key={result.id}
      id={`${listId}-${index}`}
      role="option"
      aria-selected={index === active}
      className="search-option"
      // Keep focus in the input so the list does not close before the click lands.
      onPointerDown={(event) => event.preventDefault()}
      onClick={() => choose(result)}
    >
      <span className="search-option-label">{result.label}</span>
      {result.detail && <span className="search-option-detail">{result.detail}</span>}
    </li>
  );

  return (
    <div className="search" role="search">
      <div className="search-field">
        <input
          ref={inputRef}
          type="search"
          role="combobox"
          aria-label={strings.search.label}
          aria-expanded={showList}
          aria-controls={listId}
          aria-activedescendant={showList && results.length > 0 ? `${listId}-${active}` : undefined}
          aria-autocomplete="list"
          autoComplete="off"
          enterKeyHint="search"
          placeholder={strings.search.placeholder}
          value={text}
          onChange={(event) => {
            setText(event.target.value);
            setActive(0);
            setOpen(true);
          }}
          onFocus={() => {
            ensureIndex();
            setOpen(true);
          }}
          onBlur={() => setOpen(false)}
          onKeyDown={onKeyDown}
        />
        {text !== '' && (
          <button
            type="button"
            className="search-clear"
            aria-label={strings.search.clear}
            title={strings.search.clear}
            // Keeps the focus in the field, so the list does not close and reopen.
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => {
              setText('');
              setActive(0);
              inputRef.current?.focus();
            }}
          >
            <Icon name="close" />
          </button>
        )}
      </div>
      {showList && (
        <ul id={listId} role="listbox" aria-label={strings.search.results} className="search-results">
          {local.map(option)}
          {local.length === 0 && (
            <li role="presentation" className="search-note">
              {searchNote(note)}
            </li>
          )}
          {remote.length > 0 && (
            <li role="presentation" className="search-section">{strings.search.offCampus}</li>
          )}
          {remote.map((result, index) => option(result, local.length + index))}
        </ul>
      )}
    </div>
  );
}
