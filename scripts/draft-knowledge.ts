/**
 * Drafts chat entries with Gemini from the text `knowledge:fetch` downloaded. Every draft is written with
 * `reviewed: false`, so it stays out of the chat until a person reads it, fixes it and sets `reviewed: true`.
 * Reviewed entries are never touched.
 *
 * Usage:
 *   GEMINI_API_KEY=... npm run knowledge:draft [-- --topic extensao]   drafts an entry per fetched page
 *   GEMINI_API_KEY=... npm run knowledge:draft -- --index               adds the pages an index lists to sources.json
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import type { Institute } from '../src/domain/types';
import { generateJson } from './lib/gemini';
import { type EntryPlaceRef, formatEntry, parseEntry } from './lib/knowledge';
import { addProposals, parseSources, rawIndexPath, rawPagePath, type SourcePage } from './lib/knowledgeSources';

const SOURCES = 'data/knowledge/sources.json';
const MAX_PAGE_CHARS = 40_000;

const args = process.argv.slice(2);
const topic = args.includes('--topic') ? args[args.indexOf('--topic') + 1] : undefined;

const parsed = parseSources(JSON.parse(readFileSync(SOURCES, 'utf8')));
if ('error' in parsed) {
  console.error(parsed.error);
  process.exit(1);
}
const sources = parsed.ok;
const institutes = JSON.parse(readFileSync('public/data/institutes.json', 'utf8')) as Institute[];
const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });

const entrySchema = {
  type: 'OBJECT',
  properties: {
    relevant: { type: 'BOOLEAN', description: 'false se a página não descreve o serviço ou grupo (página de erro, menu, outro assunto)' },
    title: { type: 'STRING', description: 'nome do serviço ou grupo, com a sigla, por exemplo "Turing USP — grupo de inteligência artificial"' },
    body: { type: 'STRING' },
    institute: { type: 'STRING', description: 'id da unidade da lista, ou "" se a página não diz' },
  },
  required: ['relevant', 'title', 'body', 'institute'],
};

const pagePrompt = (page: SourcePage, text: string) => `Você prepara fontes para o chat de um mapa do campus Butantã da USP.
Escreva, a partir do TEXTO de uma página (tema: ${page.topic}), uma ficha curta em português do Brasil:
- um parágrafo: o que é e o que oferece;
- quem pode participar ou ser atendido, e como (processo seletivo, encaminhamento, inscrição), se o texto diz;
- uma lista "- " com endereço, telefone, e-mail, site e redes sociais que o texto traga.
Use só o que está no texto. Não invente nada nem complete com o que você sabe. Datas de processos seletivos mudam: não as copie, diga apenas que há seleção e onde acompanhar.
Em "institute", escolha o id da unidade da USP a que pertence, entre estas, só se o texto deixar claro:
${institutes.map((institute) => `${institute.id}: ${institute.name}${institute.sigla ? ` (${institute.sigla})` : ''}`).join('\n')}

TEXTO:
${text.slice(0, MAX_PAGE_CHARS)}`;

async function draftPage(page: SourcePage) {
  const raw = rawPagePath(page);
  const path = `data/knowledge/entries/${page.topic}/${page.id}.md`;
  if (!existsSync(raw)) return;
  if (existsSync(path)) {
    const current = parseEntry(page.id, page.topic, readFileSync(path, 'utf8'));
    if ('ok' in current && current.ok.reviewed) return;
  }
  const answer = (await generateJson(pagePrompt(page, readFileSync(raw, 'utf8')), entrySchema)) as { relevant: boolean; title: string; body: string; institute: string };
  if (!answer.relevant) {
    console.log(`not about it  ${page.topic}/${page.id}`);
    return;
  }
  const [kind, id] = page.place?.split(' ') ?? [];
  const place: EntryPlaceRef | undefined =
    kind && id ? { kind: kind as EntryPlaceRef['kind'], id }
    : institutes.some((institute) => institute.id === answer.institute) ? { kind: 'institute', id: answer.institute }
    : undefined;
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, formatEntry({ title: answer.title.trim(), topic: page.topic, ...(place && { place }), sources: page.urls, checked: today, reviewed: false, body: answer.body }));
  console.log(`draft  ${path}`);
}

const indexSchema = {
  type: 'OBJECT',
  properties: {
    items: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: { name: { type: 'STRING' }, url: { type: 'STRING', description: 'um dos links do texto, de preferência o site do próprio grupo' } },
        required: ['name', 'url'],
      },
    },
  },
  required: ['items'],
};

async function readIndexes() {
  for (const index of sources.indexes.filter((candidate) => !topic || candidate.topic === topic)) {
    const raw = rawIndexPath(index);
    if (!existsSync(raw)) continue;
    const { text, links } = JSON.parse(readFileSync(raw, 'utf8')) as { text: string; links: { text: string; href: string }[] };
    const prompt = `Esta página lista ${index.about}. Liste cada um deles com o nome e o link da página que melhor o descreve.
Os links aparecem no TEXTO como <https://…>, logo depois do que apontam. Use só esses links. Prefira o site do próprio grupo;
use uma rede social só se for o único link dele. Deixe de fora menus, notícias e páginas que não são de um item da lista.

TEXTO:
${text.slice(0, MAX_PAGE_CHARS)}`;
    const { items } = (await generateJson(prompt, indexSchema)) as { items: { name: string; url: string }[] };
    const known = new Set(links.map((link) => link.href));
    const added = addProposals(sources, index.topic, items.filter((item) => known.has(item.url)));
    console.log(`index ${index.url}: ${items.length} found, ${added.length} new`);
    for (const page of added) console.log(`  + ${page.id}  ${page.urls[0]}`);
  }
  writeFileSync(SOURCES, `${JSON.stringify(sources, null, 2)}\n`);
}

if (args.includes('--index')) {
  await readIndexes();
  console.log('Next: npm run knowledge:fetch, then npm run knowledge:draft');
} else {
  for (const page of sources.pages.filter((candidate) => !topic || candidate.topic === topic)) await draftPage(page);
  console.log('Read each draft, fix it, set reviewed: true, then npm run knowledge:build');
}
