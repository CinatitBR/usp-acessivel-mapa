import { describe, expect, it } from 'vitest';
import { corpusOf, formatEntry, parseEntry, parseFrontMatter } from './knowledge';

const source = `---
title: FOUSP
topic: saude
place: institute way/34381227
sources:
  - https://site.fo.usp.br/paciente/
  - https://www.fo.usp.br/
checked: 2026-10-20
reviewed: true
---
Oferece tratamentos.
`;

describe('parseFrontMatter', () => {
  it('reads values, lists and the body', () => {
    const parsed = parseFrontMatter(source);
    expect(parsed).toEqual({
      ok: {
        fields: {
          title: 'FOUSP',
          topic: 'saude',
          place: 'institute way/34381227',
          sources: ['https://site.fo.usp.br/paciente/', 'https://www.fo.usp.br/'],
          checked: '2026-10-20',
          reviewed: 'true',
        },
        body: 'Oferece tratamentos.',
      },
    });
  });

  it('refuses a file without front matter', () => {
    expect(parseFrontMatter('Oferece tratamentos.')).toHaveProperty('error');
  });
});

describe('parseEntry', () => {
  it('reads a complete entry', () => {
    const parsed = parseEntry('fousp', 'saude', source);
    expect(parsed).toHaveProperty('ok.place', { kind: 'institute', id: 'way/34381227' });
    expect(parsed).toHaveProperty('ok.reviewed', true);
  });

  it('wants the topic to match the folder', () => {
    expect(parseEntry('fousp', 'extensao', source)).toEqual({ error: 'topic must match its folder (extensao)' });
  });

  it('refuses a malformed place, a bad date and a missing source', () => {
    expect(parseEntry('a', 'saude', source.replace('institute way', 'faculdade way'))).toHaveProperty('error');
    expect(parseEntry('a', 'saude', source.replace('2026-10-20', 'ontem'))).toHaveProperty('error');
    expect(parseEntry('a', 'saude', source.replace(/sources:\n(  - .*\n)+/, ''))).toHaveProperty('error');
  });

  it('reads tags from the fixed list and refuses others', () => {
    const tagged = source.replace('sources:', 'tags:\n  - computação\n  - pesquisa\nsources:');
    expect(parseEntry('a', 'saude', tagged)).toHaveProperty('ok.tags', ['computação', 'pesquisa']);
    expect(parseEntry('a', 'saude', tagged.replace('pesquisa', 'xadrez'))).toEqual({ error: 'unknown tag: xadrez (see TAGS in scripts/lib/knowledge.ts)' });
    expect(parseEntry('a', 'saude', source)).not.toHaveProperty('ok.tags');
  });

  it('refuses a file name that is not an id', () => {
    expect(parseEntry('Fo USP', 'saude', source)).toHaveProperty('error');
  });

  it('reads back what formatEntry writes', () => {
    const parsed = parseEntry('fousp', 'saude', source.replace('sources:', 'tags:\n  - religião\nsources:'));
    if (!('ok' in parsed)) throw new Error('fixture');
    const { id, ...rest } = parsed.ok;
    expect(parseEntry(id, 'saude', formatEntry(rest))).toEqual(parsed);
  });
});

describe('corpusOf', () => {
  it('keeps reviewed entries only, sorted by id', () => {
    const entry = (id: string, reviewed: boolean) => ({ id, title: id, topic: 't', sources: ['https://a.b'], checked: '2026-01-01', reviewed, body: 'x' });
    const corpus = corpusOf([entry('b', true), entry('c', false), entry('a', true)]);
    expect(corpus.entries.map((item) => item.id)).toEqual(['a', 'b']);
    expect(corpus.entries[0]).not.toHaveProperty('reviewed');
  });
});
