import { describe, expect, it } from 'vitest';
import type { KnowledgeSource } from '../../domain/knowledge';
import { parseAnswer, withoutOpenCitation } from './answer';

const fousp: KnowledgeSource = { id: 'fousp', title: 'FOUSP', url: 'https://site.fo.usp.br/paciente/' };
const fundecto: KnowledgeSource = { id: 'fundecto', title: 'FUNDECTO', url: 'https://fundecto.example/' };
const sources = new Map([fousp, fundecto].map((source) => [source.id, source]));

describe('parseAnswer', () => {
  it('numbers sources in the order they are first cited', () => {
    const answer = parseAnswer('A FUNDECTO extrai sisos [[fundecto]]. A FOUSP tem emergência [[fousp]] e a FUNDECTO também [[fundecto]].', sources);
    expect(answer.cited).toEqual([fundecto, fousp]);
    expect(answer.blocks).toEqual([
      {
        kind: 'paragraph',
        inline: [
          { kind: 'text', text: 'A FUNDECTO extrai sisos' },
          { kind: 'cite', number: 1, source: fundecto },
          { kind: 'text', text: '. A FOUSP tem emergência' },
          { kind: 'cite', number: 2, source: fousp },
          { kind: 'text', text: ' e a FUNDECTO também' },
          { kind: 'cite', number: 1, source: fundecto },
          { kind: 'text', text: '.' },
        ],
      },
    ]);
  });

  it('drops ids that are not sources and repeated marks', () => {
    const answer = parseAnswer('Veja [[inventada]] o site [[fousp]][[fousp]].', sources);
    expect(answer.cited).toEqual([fousp]);
    expect(answer.blocks[0]).toEqual({
      kind: 'paragraph',
      inline: [{ kind: 'text', text: 'Veja' }, { kind: 'text', text: ' o site' }, { kind: 'cite', number: 1, source: fousp }, { kind: 'text', text: '.' }],
    });
  });

  it('reads lists, bold and stray headings', () => {
    const answer = parseAnswer('## Onde\nDuas opções:\n- **FOUSP** [[fousp]]\n- FUNDECTO\n\nConfirme no site.', sources);
    expect(answer.blocks.map((block) => block.kind)).toEqual(['paragraph', 'paragraph', 'list', 'paragraph']);
    expect(answer.blocks[0]).toEqual({ kind: 'paragraph', inline: [{ kind: 'text', text: 'Onde' }] });
    expect(answer.blocks[2]).toEqual({
      kind: 'list',
      items: [[{ kind: 'text', text: 'FOUSP', strong: true }, { kind: 'cite', number: 1, source: fousp }], [{ kind: 'text', text: 'FUNDECTO' }]],
    });
  });
});

describe('withoutOpenCitation', () => {
  it('holds back a citation that has not arrived whole', () => {
    expect(withoutOpenCitation('A FOUSP [[fou')).toBe('A FOUSP ');
    expect(withoutOpenCitation('A FOUSP [')).toBe('A FOUSP ');
    expect(withoutOpenCitation('A FOUSP [[fousp]')).toBe('A FOUSP ');
    expect(withoutOpenCitation('A FOUSP [[fousp]].')).toBe('A FOUSP [[fousp]].');
  });
});
