import { create } from 'zustand';
import { ProviderError } from '../../lib/http';
import type { ChatEnd } from './parse';
import { askCampus, type ChatTurn } from './provider';

/** How an answer ended, as the chat shows it: the Worker's own ends, plus what can go wrong before it. */
export type MessageEnd = ChatEnd | 'network' | 'busy' | 'stopped';
export type ChatMessage = { role: 'user' | 'assistant'; text: string; end?: MessageEnd };

/** The Worker takes at most 12 turns; the new question is the twelfth. */
const HISTORY_TURNS = 10;
const STORAGE_KEY = 'chat';

/** The conversation is kept for this tab only, and never on the server. */
function readSaved(): ChatMessage[] {
  try {
    const saved = JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? '[]') as unknown;
    return Array.isArray(saved) ? (saved as ChatMessage[]).filter((message) => typeof message?.text === 'string') : [];
  } catch {
    return [];
  }
}

function save(messages: ChatMessage[]) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
  } catch {
    // Private mode or a full storage: the conversation just does not survive a reload.
  }
}

/** The turns to send: questions with the answers they got, without the ones that failed, then the new question. */
export function requestTurns(messages: ChatMessage[], question: string): ChatTurn[] {
  const pairs: ChatTurn[] = [];
  for (let index = 0; index + 1 < messages.length; index += 1) {
    const [asked, answered] = [messages[index]!, messages[index + 1]!];
    if (asked.role !== 'user' || answered.role !== 'assistant') continue;
    if ((answered.end === 'stop' || answered.end === 'cut') && answered.text.trim()) pairs.push({ role: 'user', text: asked.text }, { role: 'assistant', text: answered.text });
    index += 1;
  }
  return [...pairs.slice(-HISTORY_TURNS), { role: 'user', text: question }];
}

type ChatState = {
  messages: ChatMessage[];
  answering: boolean;
  ask: (question: string) => void;
  stop: () => void;
  clear: () => void;
};

let controller: AbortController | null = null;

export const useChatStore = create<ChatState>((set, get) => {
  /** Changes the answer being written, which is always the last message. */
  const updateAnswer = (change: (answer: ChatMessage) => ChatMessage) =>
    set(({ messages }) => ({ messages: [...messages.slice(0, -1), change(messages.at(-1)!)] }));

  return {
    messages: readSaved(),
    answering: false,

    ask: (question) => {
      const text = question.trim();
      if (!text || get().answering) return;
      const turns = requestTurns(get().messages, text);
      controller = new AbortController();
      const { signal } = controller;
      set(({ messages }) => ({ answering: true, messages: [...messages, { role: 'user', text }, { role: 'assistant', text: '' }] }));

      const finish = (end: MessageEnd) => {
        updateAnswer((answer) => ({ ...answer, end }));
        set({ answering: false });
        save(get().messages);
        controller = null;
      };
      askCampus(turns, signal, (piece) => updateAnswer((answer) => ({ ...answer, text: answer.text + piece })))
        .then(finish)
        .catch((error: unknown) => {
          if (signal.aborted) finish('stopped');
          else if (error instanceof ProviderError && error.kind === 'quota') finish('busy');
          else if (error instanceof ProviderError && error.kind === 'network') finish('network');
          else finish('error');
        });
    },

    stop: () => controller?.abort(),

    clear: () => {
      controller?.abort();
      set({ messages: [], answering: false });
      save([]);
    },
  };
});
