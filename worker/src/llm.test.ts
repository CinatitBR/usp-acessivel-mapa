import { describe, expect, it } from 'vitest';
import { parseGeminiEvent } from './gemini';
import { sseData } from './llm';
import { parseWorkersAiEvent } from './workersAi';

// Shapes recorded from streamGenerateContent?alt=sse.
const middle = { candidates: [{ content: { role: 'model', parts: [{ text: 'A FOUSP ' }] }, index: 0 }], modelVersion: 'gemini-3.8-flash' };
const last = {
  candidates: [{ content: { role: 'model', parts: [{ text: 'atende [[fousp]].' }] }, finishReason: 'STOP', index: 0 }],
  usageMetadata: { promptTokenCount: 1800, cachedContentTokenCount: 1500, candidatesTokenCount: 40, totalTokenCount: 1840 },
};

describe('parseGeminiEvent', () => {
  it('reads text, the end and the token counts', () => {
    expect(parseGeminiEvent(JSON.stringify(middle))).toEqual({ text: 'A FOUSP ' });
    expect(parseGeminiEvent(JSON.stringify(last))).toEqual({ text: 'atende [[fousp]].', end: 'stop', usage: { prompt: 1800, cached: 1500, answer: 40 } });
  });

  it('leaves thoughts out', () => {
    const chunk = { candidates: [{ content: { parts: [{ text: 'pensando', thought: true }, { text: 'Resposta' }] } }] };
    expect(parseGeminiEvent(JSON.stringify(chunk)).text).toBe('Resposta');
  });

  it('tells a cut answer and a blocked one apart', () => {
    expect(parseGeminiEvent(JSON.stringify({ candidates: [{ finishReason: 'MAX_TOKENS' }] })).end).toBe('cut');
    expect(parseGeminiEvent(JSON.stringify({ candidates: [{ finishReason: 'SAFETY' }] })).end).toBe('blocked');
    expect(parseGeminiEvent(JSON.stringify({ promptFeedback: { blockReason: 'OTHER' } })).end).toBe('blocked');
    expect(parseGeminiEvent('not json').end).toBe('error');
  });
});

describe('sseData', () => {
  it('joins events split across chunks', async () => {
    const encoder = new TextEncoder();
    const parts = ['data: {"a":', '1}\r\n\r\ndata: {"b":2}\n', '\n', 'data: {"c":3}'];
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        for (const part of parts) controller.enqueue(encoder.encode(part));
        controller.close();
      },
    });
    const seen: string[] = [];
    for await (const data of sseData(body)) seen.push(data);
    expect(seen).toEqual(['{"a":1}', '{"b":2}', '{"c":3}']);
  });
});

describe('parseWorkersAiEvent', () => {
  it('reads OpenAI-style chunks, the older shape and the end', () => {
    expect(parseWorkersAiEvent('{"choices":[{"index":0,"delta":{"content":"A FOUSP"},"finish_reason":null}]}')).toEqual({ text: 'A FOUSP' });
    expect(parseWorkersAiEvent('{"response":"A FOUSP","p":"abc"}')).toEqual({ text: 'A FOUSP' });
    expect(parseWorkersAiEvent('[DONE]')).toEqual({ text: '', end: 'stop' });
    expect(parseWorkersAiEvent('{"choices":[{"delta":{"content":""},"finish_reason":"length"}],"usage":{"prompt_tokens":1900,"completion_tokens":1024}}')).toEqual({
      text: '',
      end: 'cut',
      usage: { prompt: 1900, cached: 0, answer: 1024 },
    });
  });

  it('leaves reasoning out of the answer', () => {
    expect(parseWorkersAiEvent('{"choices":[{"delta":{"reasoning_content":"pensando","content":null}}]}')).toEqual({ text: '' });
  });
});

