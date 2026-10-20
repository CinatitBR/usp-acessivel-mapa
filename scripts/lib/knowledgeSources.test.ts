import { describe, expect, it } from 'vitest';
import { responseText } from './gemini';
import { addProposals, parseSources, slug } from './knowledgeSources';

describe('parseSources', () => {
  it('accepts the committed list', async () => {
    const { readFileSync } = await import('node:fs');
    expect(parseSources(JSON.parse(readFileSync('data/knowledge/sources.json', 'utf8')))).toHaveProperty('ok');
  });

  it('refuses repeated ids and pages without URLs', () => {
    const page = { id: 'a', topic: 't', urls: ['https://a.b'] };
    expect(parseSources({ pages: [page, page], indexes: [] })).toHaveProperty('error');
    expect(parseSources({ pages: [{ ...page, urls: [] }], indexes: [] })).toHaveProperty('error');
  });
});

describe('addProposals', () => {
  it('adds new URLs only, with ids that do not clash', () => {
    const list = { pages: [{ id: 'turing-usp', topic: 'extensao', urls: ['https://turing.usp.br/'] }], indexes: [] };
    const added = addProposals(list, 'extensao', [
      { name: 'Turing USP', url: 'https://turing.usp.br/' },
      { name: 'Turing USP', url: 'https://turing.usp.br/sobre' },
      { name: 'Núcleo de Empreendedorismo', url: 'https://neusp.org/' },
      { name: 'Sem link', url: 'mailto:a@b.c' },
    ]);
    expect(added.map((page) => page.id)).toEqual(['turing-usp-2', 'nucleo-de-empreendedorismo']);
    expect(list.pages).toHaveLength(3);
  });

  it('makes plain ids', () => {
    expect(slug('ThunderRatz — Robótica!')).toBe('thunderratz-robotica');
  });
});

describe('responseText', () => {
  it('reads the answer and explains a missing one', () => {
    expect(responseText({ candidates: [{ content: { parts: [{ text: 'x', thought: true }, { text: '{"a":1}' }] }, finishReason: 'STOP' }] })).toEqual({ ok: '{"a":1}' });
    expect(responseText({ candidates: [{ finishReason: 'MAX_TOKENS' }] })).toEqual({ error: 'stopped: MAX_TOKENS' });
    expect(responseText({ promptFeedback: { blockReason: 'SAFETY' } })).toEqual({ error: 'blocked: SAFETY' });
  });
});
