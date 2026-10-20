import { describe, expect, it } from 'vitest';
import { parseChatEvent, parseKnowledgeSource, sseData } from './parse';

describe('parseKnowledgeSource', () => {
  it('reads a source with its place', () => {
    const source = { id: 'fousp', title: 'FOUSP', url: 'https://a.b', place: { kind: 'institute', id: 'way/1', position: [-46.7, -23.5] } };
    expect(parseKnowledgeSource(source)).toEqual(source);
  });

  it('drops a broken place but keeps the source', () => {
    expect(parseKnowledgeSource({ id: 'a', title: 'A', url: 'https://a.b', place: { kind: 'room', id: 'x', position: [] } })).toEqual({
      id: 'a',
      title: 'A',
      url: 'https://a.b',
    });
    expect(parseKnowledgeSource({ id: 'a' })).toBeUndefined();
  });
});

describe('the /chat stream', () => {
  it('reads text and end events, and treats anything else as a failure', () => {
    expect(parseChatEvent('{"text":"Olá"}')).toEqual({ text: 'Olá' });
    expect(parseChatEvent('{"end":"stop"}')).toEqual({ end: 'stop' });
    expect(parseChatEvent('{"end":"later"}')).toEqual({ end: 'error' });
    expect(parseChatEvent('oops')).toEqual({ end: 'error' });
  });

  it('splits a recorded stream, whatever the chunks', async () => {
    const recorded = 'data: {"text":"A FOUSP "}\n\ndata: {"text":"atende [[fousp]]."}\n\ndata: {"end":"stop"}\n\n';
    const encoder = new TextEncoder();
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        for (let start = 0; start < recorded.length; start += 7) controller.enqueue(encoder.encode(recorded.slice(start, start + 7)));
        controller.close();
      },
    });
    const events = [];
    for await (const data of sseData(body)) events.push(parseChatEvent(data));
    expect(events).toEqual([{ text: 'A FOUSP ' }, { text: 'atende [[fousp]].' }, { end: 'stop' }]);
  });
});
