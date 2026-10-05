import { describe, expect, it } from 'vitest';
import { formTarget, newReportId, parseCsv, parseSubmission, publishedReports, submissionRow } from './reports';

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

describe('parseSubmission', () => {
  const good = { type: 'blocked', answer: 'no', at: [-46.7251851, -23.5629561] };

  it('accepts a report and rounds its place', () => {
    expect(parseSubmission({ ...good, target: 'way/158966879', note: '  Tapume  ' })).toEqual({
      type: 'blocked', answer: 'no', at: [-46.725185, -23.562956], target: 'way/158966879', note: 'Tapume',
    });
    expect(parseSubmission(good)).toEqual({ type: 'blocked', answer: 'no', at: [-46.725185, -23.562956] });
  });

  it('drops an empty note and fields it does not know', () => {
    expect(parseSubmission({ ...good, note: '   ', id: 'x', until: '2030-01-01' })).toEqual({ type: 'blocked', answer: 'no', at: [-46.725185, -23.562956] });
  });

  it('refuses anything else', () => {
    const refused = [
      null,
      'text',
      [good],
      { ...good, type: 'pothole' },
      { ...good, answer: 'broken' },
      { type: 'elevator', answer: 'no', at: good.at },
      { ...good, at: [-43.2, -22.9] },
      { ...good, at: ['-46.72', '-23.56'] },
      { ...good, at: [-46.72, -23.56, 700] },
      { ...good, target: '<script>' },
      { ...good, target: 7 },
      { ...good, note: 'x'.repeat(281) },
      { ...good, note: 5 },
    ];
    for (const body of refused) expect(parseSubmission(body)).toHaveProperty('error');
  });
});

describe('submissionRow', () => {
  it('writes the row in the spreadsheet\'s own words', () => {
    expect(submissionRow({ type: 'narrow', answer: 'help', at: [-46.725185, -23.562956], note: 'Raízes' }, '2026-10-05', 'r-1')).toEqual({
      id: 'r-1', ate: '', tipo: 'estreita', resposta: 'ajuda', lng: '-46,725185', lat: '-23,562956', alvo: '', desde: '2026-10-05', nota: 'Raízes',
    });
    expect(submissionRow({ type: 'toilet', answer: 'closed', at: [-46.73, -23.56], target: 'way/1' }, '2026-10-05', 'r-2')).toMatchObject({
      tipo: 'banheiro', resposta: 'interditado', alvo: 'way/1', nota: '',
    });
  });

  it('comes back unchanged through the published tab', () => {
    const row = submissionRow({ type: 'elevator', answer: 'broken', at: [-46.725185, -23.562956], target: 'node/4120153445', note: 'Parado, sem previsão' }, '2026-10-05', newReportId());
    const quote = (value: string) => `"${value.replaceAll('"', '""')}"`;
    const csv = `${Object.keys(row).join(',')}\n${Object.values(row).map(quote).join(',')}`;
    expect(publishedReports(csv)).toEqual([
      { id: row.id, type: 'elevator', answer: 'broken', at: [-46.725185, -23.562956], target: 'node/4120153445', since: '2026-10-05', note: 'Parado, sem previsão' },
    ]);
  });

  it('keeps a note that looks like a formula as text', () => {
    for (const note of ['=IMPORTXML("http://x")', '+1', '-1', '@x']) {
      expect(submissionRow({ type: 'blocked', answer: 'no', at: [-46.73, -23.56], note }, '2026-10-05', 'r-3').nota).toBe(`'${note}`);
    }
  });
});

describe('formTarget', () => {
  const link = 'https://docs.google.com/forms/d/e/1FAIpQLSabc-_123/viewform?usp=pp_url&entry.11=tipo&entry.22=Resposta&entry.33=lng&entry.44=lat&entry.55=alvo&entry.66=desde&entry.77=nota';

  it('reads the form address and which field is which column', () => {
    expect(formTarget(link)).toEqual({
      url: 'https://docs.google.com/forms/d/e/1FAIpQLSabc-_123/formResponse',
      fields: { tipo: 'entry.11', resposta: 'entry.22', lng: 'entry.33', lat: 'entry.44', alvo: 'entry.55', desde: 'entry.66', nota: 'entry.77' },
    });
  });

  it('refuses a link that is not a pre-filled form link, or lacks a required column', () => {
    expect(formTarget('')).toBeUndefined();
    expect(formTarget('https://example.com/forms/d/e/x/viewform?entry.1=tipo')).toBeUndefined();
    expect(formTarget(link.replace('&entry.44=lat', ''))).toBeUndefined();
  });
});
