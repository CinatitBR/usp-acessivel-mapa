import { type FormEvent, type KeyboardEvent, useEffect, useRef, useState } from 'react';
import type { KnowledgeSource } from '../../domain/knowledge';
import { useOnline } from '../../lib/useOnline';
import { loadKnowledge } from '../../map/staticData';
import { strings } from '../../strings/pt-BR';
import { Icon } from '../../ui/Icon';
import { ChatAnswer } from './ChatAnswer';
import { MAX_QUESTION_CHARS } from './provider';
import { useChatStore } from './store';

const NO_SOURCES: ReadonlyMap<string, KnowledgeSource> = new Map();

/** The sources' titles and places, once loaded; without them answers still read, just without links. */
function useSources(): ReadonlyMap<string, KnowledgeSource> {
  const [sources, setSources] = useState(NO_SOURCES);
  useEffect(() => {
    let live = true;
    loadKnowledge()
      .then((list) => live && setSources(new Map(list.map((source) => [source.id, source]))))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);
  return sources;
}

/** The chat screen: questions about the campus, answered from the sources in data/knowledge. */
export function ChatScreen() {
  const messages = useChatStore((state) => state.messages);
  const answering = useChatStore((state) => state.answering);
  const ask = useChatStore((state) => state.ask);
  const stop = useChatStore((state) => state.stop);
  const clear = useChatStore((state) => state.clear);
  const online = useOnline();
  const sources = useSources();
  const [draft, setDraft] = useState('');
  const endRef = useRef<HTMLDivElement>(null);

  // Follow the answer as it is written, and to its sources once it ends.
  const last = messages.at(-1);
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [messages.length, last?.text, last?.end]);

  const send = (question: string) => {
    if (!question.trim() || answering || !online) return;
    ask(question);
    setDraft('');
  };
  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    send(draft);
  };
  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      send(draft);
    }
  };

  return (
    <section className="chat-screen" aria-labelledby="chat-title">
      <header className="chat-header">
        <div>
          <h1 id="chat-title">{strings.chat.title}</h1>
          <p className="chat-note">{strings.chat.note}</p>
        </div>
        {messages.length > 0 && (
          <button type="button" className="button button-tonal chat-new" onClick={clear}>
            {strings.chat.newChat}
          </button>
        )}
      </header>

      <div className="chat-scroll">
        {messages.length === 0 ? (
          <div className="chat-empty">
            <p>{strings.chat.intro}</p>
            <ul className="chat-suggestions" aria-label={strings.chat.suggestionsLabel}>
              {strings.chat.suggestions.map((question) => (
                <li key={question}>
                  <button type="button" className="chip" disabled={!online} onClick={() => send(question)}>
                    {question}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <ol className="chat-log" aria-busy={answering}>
            {messages.map((message, index) => (
              <li key={index} className={`chat-message chat-${message.role}`}>
                <span className="visually-hidden">{message.role === 'user' ? strings.chat.you : strings.chat.assistant}: </span>
                {message.role === 'user' ? (
                  <p>{message.text}</p>
                ) : (
                  <ChatAnswer message={message} sources={sources} writing={answering && index === messages.length - 1} />
                )}
              </li>
            ))}
          </ol>
        )}
        <div ref={endRef} />
      </div>

      <p className="visually-hidden" role="status">
        {answering ? strings.chat.answering : last?.role === 'assistant' ? strings.chat.answered : ''}
      </p>
      {!online && <p className="chat-offline">{strings.chat.offline}</p>}

      <form className="chat-composer" onSubmit={onSubmit}>
        <label className="visually-hidden" htmlFor="chat-input">
          {strings.chat.input}
        </label>
        <textarea
          id="chat-input"
          rows={1}
          value={draft}
          maxLength={MAX_QUESTION_CHARS}
          placeholder={strings.chat.placeholder}
          enterKeyHint="send"
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={onKeyDown}
        />
        {answering ? (
          <button type="button" className="icon-button chat-send" aria-label={strings.chat.stop} onClick={stop}>
            <Icon name="stop" />
          </button>
        ) : (
          <button type="submit" className="icon-button chat-send" aria-label={strings.chat.send} disabled={!online || !draft.trim()}>
            <Icon name="send" />
          </button>
        )}
      </form>
    </section>
  );
}
