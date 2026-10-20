/** The chat on Google's Gemini API (`CHAT_PROVIDER=gemini`), with the GEMINI_API_KEY secret. */
import { type ChatTurn, geminiRequest } from './chat';
import { type ChatEnd, ChatUpstreamError, type ProviderEvent, sseData, TIMEOUT_MS } from './llm';

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const BLOCKED = new Set(['SAFETY', 'RECITATION', 'BLOCKLIST', 'PROHIBITED_CONTENT', 'SPII', 'LANGUAGE']);

type GeminiChunk = {
  candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] }; finishReason?: string }[];
  promptFeedback?: { blockReason?: string };
  usageMetadata?: { promptTokenCount?: number; cachedContentTokenCount?: number; candidatesTokenCount?: number };
};

/** One `data:` payload of Gemini's stream: the visible text (thoughts left out), and how it ended, if it did. */
export function parseGeminiEvent(data: string): ProviderEvent {
  let chunk: GeminiChunk;
  try {
    chunk = JSON.parse(data) as GeminiChunk;
  } catch {
    return { text: '', end: 'error' };
  }
  const candidate = chunk.candidates?.[0];
  const text = (candidate?.content?.parts ?? [])
    .filter((part) => !part.thought && typeof part.text === 'string')
    .map((part) => part.text)
    .join('');
  const usage = chunk.usageMetadata && {
    prompt: chunk.usageMetadata.promptTokenCount ?? 0,
    cached: chunk.usageMetadata.cachedContentTokenCount ?? 0,
    answer: chunk.usageMetadata.candidatesTokenCount ?? 0,
  };
  const reason = chunk.promptFeedback?.blockReason ? 'SAFETY' : candidate?.finishReason;
  const end: ChatEnd | undefined =
    !reason || reason === 'FINISH_REASON_UNSPECIFIED' ? undefined
    : reason === 'STOP' ? 'stop'
    : reason === 'MAX_TOKENS' ? 'cut'
    : BLOCKED.has(reason) ? 'blocked'
    : 'error';
  return { text, ...(end && { end }), ...(usage && { usage }) };
}

export async function geminiEvents(messages: ChatTurn[], env: Env): Promise<AsyncIterable<ProviderEvent>> {
  // Optional: only this provider needs it, so it is not among the required secrets.
  const key = (env as Env & { GEMINI_API_KEY?: string }).GEMINI_API_KEY;
  if (!key) throw new ChatUpstreamError(500);
  const upstream = await fetch(`${GEMINI_BASE}/${env.GEMINI_MODEL}:streamGenerateContent?alt=sse`, {
    method: 'POST',
    // The key goes in a header, never in the URL, so it cannot end up in a log.
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify(geminiRequest(messages)),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!upstream.ok || !upstream.body) throw new ChatUpstreamError(upstream.status === 429 ? 429 : 502);
  const body = upstream.body;
  return (async function* () {
    for await (const data of sseData(body)) yield parseGeminiEvent(data);
  })();
}
