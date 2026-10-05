import { describe, expect, it } from 'vitest';
import { parseCsv, publishedReports } from './reports';

describe('parseCsv', () => {
  it('reads quoted fields with commas, quotes and line breaks', () => {
    expect(parseCsv('a,b\r\n"x, y","he said ""no""\nagain"\n')).toEqual([
      ['a', 'b'],
      ['x, y', 'he said "no"\nagain'],
    ]);
  });

  it('keeps empty fields and a last line without a line break', () => {
    expect(parseCsv('a,,c\n,,')).toEqual([['a', '', 'c'], ['', '', '']]);
  });
});

describe('publishedReports', () => {
  const header = 'id,tipo,resposta,lng,lat,alvo,desde,ate,nota';

  it('reads a row written by a reviewer', () => {
    const csv = `${header}\nr1,Bloqueio,Não,"-46,7300","-23,5600",,05/10/2026,2026-10-20,"Tapume, sem passagem"`;
    expect(publishedReports(csv)).toEqual([
      { id: 'r1', type: 'blocked', answer: 'no', at: [-46.73, -23.56], since: '2026-10-05', until: '2026-10-20', note: 'Tapume, sem passagem' },
    ]);
  });

  it('reads coordinates that the spreadsheet grouped by thousands, and a pair typed the wrong way round', () => {
    const csv = `${header}\nr12,estreita,ajuda,-23.562.956,-46.725.185,,05/10/2026,,`;
    expect(publishedReports(csv)[0]).toMatchObject({ id: 'r12', at: [-46.725185, -23.562956] });
    expect(publishedReports(`${header}\nr13,estreita,ajuda,"-23,5629","-46,7251",,05/10/2026,,`)[0]!.at).toEqual([-46.7251, -23.5629]);
  });

  it('finds columns by name, in any order, and ignores the others', () => {
    const csv = 'e-mail,lat,lng,tipo,resposta,id,desde,alvo\nx@usp.br,-23.56,-46.73,elevador,quebrado,r2,2026-10-05,curated/elevator-1';
    expect(publishedReports(csv)).toEqual([
      { id: 'r2', type: 'elevator', answer: 'broken', at: [-46.73, -23.56], target: 'curated/elevator-1', since: '2026-10-05' },
    ]);
  });

  it('accepts each type only with its own answers', () => {
    const row = (id: string, type: string, answer: string) => `${id},${type},${answer},-46.73,-23.56,,2026-10-05,,`;
    const csv = [header, row('a', 'degrau', 'ajuda'), row('b', 'estreita', 'sim'), row('c', 'banheiro', 'interditado'), row('d', 'banheiro', 'sim'), row('e', 'elevador', 'nao'), row('f', 'buraco', 'sim')].join('\n');
    expect(publishedReports(csv).map(({ id, type, answer }) => [id, type, answer])).toEqual([
      ['a', 'step', 'help'],
      ['b', 'narrow', 'yes'],
      ['c', 'toilet', 'closed'],
    ]);
  });

  it('leaves out rows that are incomplete, off campus, repeated or badly dated', () => {
    const csv = [
      header,
      'ok,bloqueio,sim,-46.73,-23.56,,2026-10-05,,',
      'ok,bloqueio,sim,-46.73,-23.56,,2026-10-05,,',
      ',bloqueio,sim,-46.73,-23.56,,2026-10-05,,',
      'far,bloqueio,sim,-43.2,-22.9,,2026-10-05,,',
      'nodate,bloqueio,sim,-46.73,-23.56,,,,',
      'baddate,bloqueio,sim,-46.73,-23.56,,31/02/2026,,',
      'nopos,bloqueio,sim,,,,2026-10-05,,',
    ].join('\n');
    expect(publishedReports(csv).map(({ id }) => id)).toEqual(['ok']);
  });

  it('drops a target or an end date that it cannot read, and cuts a long note', () => {
    const [report] = publishedReports(`${header}\nr,degrau,nao,-46.73,-23.56,<script>,2026-10-05,amanhã,${'x'.repeat(400)}`);
    expect(report).toMatchObject({ id: 'r', since: '2026-10-05' });
    expect(report).not.toHaveProperty('target');
    expect(report).not.toHaveProperty('until');
    expect(report!.note).toHaveLength(280);
  });

  it('gives nothing for an empty tab', () => {
    expect(publishedReports('')).toEqual([]);
    expect(publishedReports(header)).toEqual([]);
  });
});
