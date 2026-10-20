import type { KnowledgePlace, KnowledgeSource } from '../../domain/knowledge';

const PLACE_KINDS = new Set<string>(['building', 'institute', 'poi']);
const isNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

/** One item of public/data/knowledge.json, or undefined when it is not one. */
export function parseKnowledgeSource(value: unknown): KnowledgeSource | undefined {
  const { id, title, url, place } = (value ?? {}) as Record<string, unknown>;
  if (typeof id !== 'string' || typeof title !== 'string' || typeof url !== 'string') return undefined;
  const { kind, id: placeId, position } = (place ?? {}) as Record<string, unknown>;
  const parsedPlace: KnowledgePlace | undefined =
    typeof kind === 'string' && PLACE_KINDS.has(kind) && typeof placeId === 'string' && Array.isArray(position) && isNumber(position[0]) && isNumber(position[1])
      ? { kind: kind as KnowledgePlace['kind'], id: placeId, position: [position[0], position[1]] }
      : undefined;
  return { id, title, url, ...(parsedPlace && { place: parsedPlace }) };
}

/** How an answer from the Worker ended (see worker/src/llm.ts). */
export type ChatEnd = 'stop' | 'cut' | 'blocked' | 'error';
export type ChatEvent = { text: string } | { end: ChatEnd };

const ENDS = new Set<string>(['stop', 'cut', 'blocked', 'error']);

/** One `data:` payload of the Worker's `/chat` stream. Anything unreadable counts as a failed answer. */
export function parseChatEvent(data: string): ChatEvent {
  try {
    const event = JSON.parse(data) as { text?: unknown; end?: unknown };
    if (typeof event.text === 'string') return { text: event.text };
    if (typeof event.end === 'string' && ENDS.has(event.end)) return { end: event.end as ChatEnd };
  } catch {
    // Falls through to an error below.
  }
  return { end: 'error' };
}

/** Splits a server-sent event stream into the payloads of its `data:` lines. */
export async function* sseData(body: ReadableStream<Uint8Array>): AsyncGenerator<string> {
  const decoder = new TextDecoder();
  const dataOf = (event: string) =>
    event.split(/\r?\n/).filter((line) => line.startsWith('data:')).map((line) => line.slice(5).trimStart()).join('\n');
  let buffer = '';
  const reader = body.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
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
