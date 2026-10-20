/**
 * Gemini for the build scripts (`knowledge:draft`): one request, a JSON answer that follows a schema.
 * The key comes from GEMINI_API_KEY in the shell; the model from GEMINI_MODEL, or the one the Worker uses.
 */
const BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
export const DEFAULT_MODEL = 'gemini-3.8-flash';

/** The JSON text of a generateContent response, or an error saying why there is none. */
export function responseText(response: unknown): { ok: string } | { error: string } {
  const { candidates, promptFeedback } = (response ?? {}) as {
    candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] }; finishReason?: string }[];
    promptFeedback?: { blockReason?: string };
  };
  if (promptFeedback?.blockReason) return { error: `blocked: ${promptFeedback.blockReason}` };
  const candidate = candidates?.[0];
  if (candidate?.finishReason && candidate.finishReason !== 'STOP') return { error: `stopped: ${candidate.finishReason}` };
  const text = (candidate?.content?.parts ?? []).filter((part) => !part.thought).map((part) => part.text ?? '').join('');
  return text ? { ok: text } : { error: 'empty answer' };
}

export async function generateJson(prompt: string, schema: object): Promise<unknown> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error('Set GEMINI_API_KEY in the shell (the same key as in worker/.dev.vars).');
  const model = process.env.GEMINI_MODEL ?? DEFAULT_MODEL;
  const response = await fetch(`${BASE}/${model}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.1, responseMimeType: 'application/json', responseSchema: schema },
    }),
    signal: AbortSignal.timeout(90_000),
  });
  if (!response.ok) throw new Error(`Gemini answered HTTP ${response.status}: ${(await response.text()).slice(0, 300)}`);
  const text = responseText(await response.json());
  if ('error' in text) throw new Error(`Gemini: ${text.error}`);
  return JSON.parse(text.ok) as unknown;
}
