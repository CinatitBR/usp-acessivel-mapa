/**
 * The model behind the chat. `CHAT_PROVIDER` picks it: Cloudflare Workers AI (`workers-ai`, through the AI
 * binding, within the account's free daily allowance) or Google's Gemini API (`gemini`, with GEMINI_API_KEY).
 * Each provider turns its own event stream into ProviderEvents; this file turns those into the app's stream:
 * `data: {"text":"..."}` for each piece of the answer, then one `data: {"end":"stop"|"cut"|"blocked"|"error"}`.
 */
import type { ChatTurn } from './chat';
import { geminiEvents } from './gemini';
import { workersAiEvents } from './workersAi';

export type ChatEnd = 'stop' | 'cut' | 'blocked' | 'error';
export type Usage = { prompt: number; cached: number; answer: number };
export type ProviderEvent = { text: string; end?: ChatEnd; usage?: Usage };
/** Starts an answer. Throws ChatUpstreamError when the provider refuses before anything is streamed. */
export type Provider = (messages: ChatTurn[], env: Env) => Promise<AsyncIterable<ProviderEvent>>;

export const TIMEOUT_MS = 30_000;

export class ChatUpstreamError extends Error {
  constructor(readonly status: number) {
    super(`the model answered ${status}`);
  }
}

/** Splits a server-sent event stream into the payloads of its `data:` lines. */
export async function* sseData(body: ReadableStream<Uint8Array>): AsyncGenerator<string> {
  const decoder = new TextDecoder();
  const dataOf = (event: string) =>
    event.split(/\r?\n/).filter((line) => line.startsWith('data:')).map((line) => line.slice(5).trimStart()).join('\n');
  let buffer = '';
  for await (const bytes of body) {
    buffer += decoder.decode(bytes, { stream: true });
    let match: RegExpExecArray | null;
    while ((match = /\r?\n\r?\n/.exec(buffer))) {
      const data = dataOf(buffer.slice(0, match.index));
      buffer = buffer.slice(match.index + match[0].length);
      if (data) yield data;
    }
  }
  const tail = dataOf(buffer);
  if (tail) yield tail;
}

const PROVIDERS: Record<string, Provider> = { 'workers-ai': workersAiEvents, gemini: geminiEvents };

export async function streamAnswer(messages: ChatTurn[], env: Env, onUsage: (usage: Usage | undefined, end: ChatEnd) => void): Promise<ReadableStream<Uint8Array>> {
  const provider = PROVIDERS[env.CHAT_PROVIDER];
  if (!provider) throw new ChatUpstreamError(500);
  const events = await provider(messages, env);

  const encoder = new TextEncoder();
  const send = (payload: object) => encoder.encode(`data: ${JSON.stringify(payload)}\n\n`);
  return new ReadableStream<Uint8Array>({
    async start(controller) {
      let end: ChatEnd = 'error';
      let usage: Usage | undefined;
      try {
        for await (const event of events) {
          if (event.text) controller.enqueue(send({ text: event.text }));
          if (event.usage) usage = event.usage;
          if (event.end) end = event.end;
        }
      } catch {
        end = 'error';
      }
      controller.enqueue(send({ end }));
      controller.close();
      onUsage(usage, end);
    },
  });
}
