import { API_BASE } from '../../config';
import { ProviderError } from '../../lib/http';
import { type ChatEnd, parseChatEvent, sseData } from './parse';

export type ChatTurn = { role: 'user' | 'assistant'; text: string };

const TIMEOUT_MS = 45_000;
/** The Worker refuses longer questions (MAX_TURN_CHARS in worker/src/chat.ts). */
export const MAX_QUESTION_CHARS = 1000;

/**
 * Asks the Worker's `/chat` and hands each piece of the answer to `onText` as it arrives.
 * Resolves with how the answer ended; throws ProviderError when no answer could start, and AbortError when stopped.
 */
export async function askCampus(messages: ChatTurn[], signal: AbortSignal, onText: (text: string) => void): Promise<ChatEnd> {
  if (!API_BASE) throw new ProviderError('chat', 'network', 'no API base');
  let response: Response;
  try {
    response = await fetch(`${API_BASE}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages }),
      signal: AbortSignal.any([signal, AbortSignal.timeout(TIMEOUT_MS)]),
    });
  } catch (error) {
    if (signal.aborted) throw error;
    throw new ProviderError('chat', 'network', error instanceof Error ? error.message : 'request failed');
  }
  if (!response.ok || !response.body) throw new ProviderError('chat', response.status === 429 ? 'quota' : 'http', `HTTP ${response.status}`);

  try {
    for await (const data of sseData(response.body)) {
      const event = parseChatEvent(data);
      if ('end' in event) return event.end;
      onText(event.text);
    }
  } catch (error) {
    if (signal.aborted) throw error;
  }
  // The stream broke off before saying how it ended.
  return 'error';
}
