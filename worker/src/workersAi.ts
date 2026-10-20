/**
 * The chat on Cloudflare Workers AI (`CHAT_PROVIDER=workers-ai`), through the AI binding: no key, and free up
 * to the account's daily allowance of neurons. The model is the WORKERS_AI_MODEL var.
 */
import { type ChatTurn, chatMessages } from './chat';
import { type ChatEnd, ChatUpstreamError, type ProviderEvent, sseData, TIMEOUT_MS } from './llm';

/** Room for a long answer; without thinking a typical one is a few hundred tokens. */
const MAX_TOKENS = 2048;

type Chunk = {
  /** Older Workers AI text models stream `{ response }`. */
  response?: string;
  /** Newer ones stream OpenAI-style chunks. Reasoning fields are left out of the answer. */
  choices?: { delta?: { content?: string | null }; text?: string; finish_reason?: string | null }[];
  usage?: { prompt_tokens?: number; completion_tokens?: number; prompt_tokens_details?: { cached_tokens?: number } | null } | null;
};

/** One `data:` payload of a Workers AI stream. `[DONE]` closes it. */
export function parseWorkersAiEvent(data: string): ProviderEvent {
  if (data === '[DONE]') return { text: '', end: 'stop' };
  let chunk: Chunk;
  try {
    chunk = JSON.parse(data) as Chunk;
  } catch {
    return { text: '', end: 'error' };
  }
  const choice = chunk.choices?.[0];
  const text = chunk.response ?? choice?.delta?.content ?? choice?.text ?? '';
  const reason = choice?.finish_reason;
  const end: ChatEnd | undefined = reason === 'length' ? 'cut' : reason === 'content_filter' ? 'blocked' : undefined;
  const usage = chunk.usage && {
    prompt: chunk.usage.prompt_tokens ?? 0,
    cached: chunk.usage.prompt_tokens_details?.cached_tokens ?? 0,
    answer: chunk.usage.completion_tokens ?? 0,
  };
  return { text: text ?? '', ...(end && { end }), ...(usage && { usage }) };
}

/** A stream ends on `[DONE]`; a cut answer says so before it, and that end must not be overwritten. */
async function* events(body: ReadableStream<Uint8Array>): AsyncGenerator<ProviderEvent> {
  let ended: ChatEnd | undefined;
  for await (const data of sseData(body)) {
    const event = parseWorkersAiEvent(data);
    if (data === '[DONE]') {
      yield { text: '', end: ended ?? 'stop' };
      return;
    }
    if (event.end) ended = event.end;
    yield { ...event, end: undefined };
  }
  // The stream closed without [DONE].
  yield { text: '', end: ended ?? 'error' };
}

export async function workersAiEvents(messages: ChatTurn[], env: Env): Promise<AsyncIterable<ProviderEvent>> {
  const run = env.AI.run(env.WORKERS_AI_MODEL as Parameters<Ai['run']>[0], {
    messages: chatMessages(messages),
    stream: true,
    max_tokens: MAX_TOKENS,
    temperature: 0.2,
    // Gemma 4 and Qwen 3 think before answering by default: on a short answer from given sources that only
    // spends neurons and time, and a long thought can use up max_tokens before any answer is written.
    chat_template_kwargs: { enable_thinking: false },
  } as never) as Promise<unknown>;
  const timeout = new Promise<never>((_, reject) => setTimeout(() => reject(new ChatUpstreamError(502)), TIMEOUT_MS));
  let body: unknown;
  try {
    body = await Promise.race([run, timeout]);
  } catch (error) {
    if (error instanceof ChatUpstreamError) throw error;
    // Only the kind of failure is logged: the message can repeat what was asked.
    console.log(JSON.stringify({ route: 'chat-provider-error', provider: 'workers-ai', name: error instanceof Error ? error.name : typeof error }));
    throw new ChatUpstreamError(/rate|limit|neuron|quota|429/i.test(String(error)) ? 429 : 502);
  }
  if (!(body instanceof ReadableStream)) throw new ChatUpstreamError(502);
  return events(body as ReadableStream<Uint8Array>);
}
