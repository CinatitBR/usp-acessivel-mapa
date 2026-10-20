import { Fragment } from 'react';
import type { KnowledgeSource } from '../../domain/knowledge';
import { type Selection, useAppStore } from '../../state/store';
import { strings } from '../../strings/pt-BR';
import { Icon } from '../../ui/Icon';
import { type Inline, parseAnswer, withoutOpenCitation } from './answer';
import type { ChatMessage } from './store';

function InlineText({ parts }: { parts: Inline[] }) {
  return parts.map((part, index) =>
    part.kind === 'cite' ? (
      <sup key={index} className="chat-cite" title={part.source.title}>
        <span className="visually-hidden">{strings.chat.source(part.number)}: </span>
        {part.number}
      </sup>
    ) : part.strong ? (
      <strong key={index}>{part.text}</strong>
    ) : (
      <Fragment key={index}>{part.text}</Fragment>
    ),
  );
}

/** Opens the map with the place a source is about selected. */
function useShowOnMap() {
  const setScreen = useAppStore((state) => state.setScreen);
  const select = useAppStore((state) => state.select);
  return ({ place }: KnowledgeSource) => {
    if (!place) return;
    const selection: Selection = place.kind === 'building' ? { kind: 'building', id: place.id } : { kind: place.kind, id: place.id, position: place.position };
    setScreen('map');
    select(selection, place.position);
  };
}

/** One answer: its text with numbered citations, then the sources it cited, and how it ended if not normally. */
export function ChatAnswer({ message, sources, writing }: { message: ChatMessage; sources: ReadonlyMap<string, KnowledgeSource>; writing: boolean }) {
  const showOnMap = useShowOnMap();
  const { blocks, cited } = parseAnswer(writing ? withoutOpenCitation(message.text) : message.text, sources);
  const end = message.end && message.end !== 'stop' ? strings.chat.ends[message.end] : undefined;

  return (
    <div className="chat-answer">
      {blocks.map((block, index) =>
        block.kind === 'paragraph' ? (
          <p key={index}>
            <InlineText parts={block.inline} />
          </p>
        ) : (
          <ul key={index}>
            {block.items.map((item, itemIndex) => (
              <li key={itemIndex}>
                <InlineText parts={item} />
              </li>
            ))}
          </ul>
        ),
      )}
      {writing && blocks.length === 0 && <p className="chat-writing">{strings.chat.answering}</p>}
      {end && <p className="chat-end">{end}</p>}
      {!writing && cited.length > 0 && (
        <section className="chat-sources" aria-label={strings.chat.sources}>
          <h3>{strings.chat.sources}</h3>
          <ol>
            {cited.map((source) => (
              <li key={source.id}>
                <a href={source.url} target="_blank" rel="noreferrer">
                  {source.title}
                </a>
                {source.place && (
                  <button type="button" className="chip chat-map-chip" onClick={() => showOnMap(source)}>
                    <Icon name="place" size={18} />
                    {strings.chat.showOnMap}
                  </button>
                )}
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}
