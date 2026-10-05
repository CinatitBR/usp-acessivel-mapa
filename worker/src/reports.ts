import { UpstreamError } from './olhovivo';

/** One published report, as the app receives it. */
export type PublishedReport = {
  id: string;
  type: ReportType;
  answer: ReportAnswer;
  /** [lng, lat] */
  at: [number, number];
  /** Id of the building or accessibility point it is about. */
  target?: string;
  /** ISO dates. */
  since: string;
  until?: string;
  note?: string;
};

type ReportType = 'blocked' | 'step' | 'narrow' | 'elevator' | 'toilet';
type ReportAnswer = 'yes' | 'help' | 'no' | 'broken' | 'closed' | 'missing';

/** How long the app may reuse the list. A newly published report shows after at most this long. */
export const REPORTS_TTL_SECONDS = 300;
const UPSTREAM_TIMEOUT_MS = 10_000;
/** The published tab is small; anything larger is not ours. */
const MAX_CSV_BYTES = 512 * 1024;
const MAX_REPORTS = 500;
const MAX_NOTE = 280;
/** Synthetic Cache API key (see olhovivo.ts). */
const CACHE_KEY = 'https://reports.internal/published';
/** Only a Google Sheets tab published to the web is read. */
const SHEET_URL = /^https:\/\/docs\.google\.com\/spreadsheets\/d\/e\/[\w-]+\/pub\?[\w=&-]*output=csv/;

/** The words reviewers write in the spreadsheet, without accents and in lower case. */
const TYPES: Record<string, ReportType> = { bloqueio: 'blocked', degrau: 'step', estreita: 'narrow', elevador: 'elevator', banheiro: 'toilet' };
const PASSABLE: Record<string, ReportAnswer> = { sim: 'yes', ajuda: 'help', nao: 'no' };
const ANSWERS: Record<ReportType, Record<string, ReportAnswer>> = {
  blocked: PASSABLE,
  step: PASSABLE,
  narrow: PASSABLE,
  elevator: { quebrado: 'broken', inexistente: 'missing' },
  toilet: { interditado: 'closed', inexistente: 'missing' },
};

/** OSM-style ids (`way/123`) and the overlay's own (`curated/elevator-1`). */
const TARGET = /^[a-z]+\/[\w-]{1,40}$/;

/** The campus with a margin: [west, south, east, north]. */
const CAMPUS_BBOX = [-46.75, -23.58, -46.705, -23.545] as const;

const plain = (value: string | undefined) => (value ?? '').trim().toLowerCase().normalize('NFD').replace(/\p{M}/gu, '');

/** Rows of a CSV text (RFC 4180): quoted fields may hold commas, line breaks and doubled quotes. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let index = 0; index < text.length; index++) {
    const char = text[index]!;
    if (quoted) {
      if (char !== '"') field += char;
      else if (text[index + 1] === '"') {
        field += '"';
        index++;
      } else quoted = false;
    } else if (char === '"') quoted = true;
    else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[index + 1] === '\n') index++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else field += char;
  }
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

/**
 * A coordinate as a spreadsheet writes it. With Brazilian settings that is `-46,73`; and a
 * value typed with a point, `-46.725185`, is taken there for a whole number and comes out as
 * `-46.725.185`. Campus coordinates have two digits before the decimal mark, so the digits
 * alone are enough to read that back.
 */
const toNumber = (value: string | undefined) => {
  const text = (value ?? '').trim();
  const grouped = /^(-?)(\d{2})((?:\.\d{3})+)$/.exec(text);
  if (grouped) return Number(`${grouped[1]}${grouped[2]}.${grouped[3]!.replaceAll('.', '')}`);
  const plainNumber = text.replace(',', '.');
  return /^-?\d{1,3}(\.\d+)?$/.test(plainNumber) ? Number(plainNumber) : Number.NaN;
};

/** `2026-10-05` or `05/10/2026` → `2026-10-05`. */
function toDate(value: string | undefined): string | undefined {
  const text = (value ?? '').trim();
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  const local = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(text);
  const [year, month, day] = iso ? [iso[1]!, iso[2]!, iso[3]!] : local ? [local[3]!, local[2]!.padStart(2, '0'), local[1]!.padStart(2, '0')] : [];
  if (!year || !month || !day) return undefined;
  const date = new Date(`${year}-${month}-${day}T00:00:00Z`);
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== `${year}-${month}-${day}` ? undefined : `${year}-${month}-${day}`;
}

/**
 * The reports in the published tab. Columns are found by their header (`id`, `tipo`, `resposta`,
 * `lng`, `lat`, `alvo`, `desde`, `ate`, `nota`), in any order; other columns are ignored, so
 * nothing else in the tab reaches the app. A row that is incomplete or does not make sense is
 * left out.
 */
export function publishedReports(csv: string): PublishedReport[] {
  const [header, ...rows] = parseCsv(csv);
  if (!header) return [];
  const columns = header.map(plain);
  const reports: PublishedReport[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    if (reports.length >= MAX_REPORTS) break;
    const cell = (name: string) => {
      const index = columns.indexOf(name);
      return index < 0 ? undefined : row[index];
    };
    const id = (cell('id') ?? '').trim();
    const type = TYPES[plain(cell('tipo'))];
    const answer = type && ANSWERS[type][plain(cell('resposta'))];
    let lng = toNumber(cell('lng'));
    let lat = toNumber(cell('lat'));
    // On campus the two cannot be mistaken for one another, so a pair typed the wrong way round is put right.
    if (lng >= CAMPUS_BBOX[1] && lng <= CAMPUS_BBOX[3] && lat >= CAMPUS_BBOX[0] && lat <= CAMPUS_BBOX[2]) [lng, lat] = [lat, lng];
    const since = toDate(cell('desde'));
    const [west, south, east, north] = CAMPUS_BBOX;
    if (!/^[\w-]{1,40}$/.test(id) || seen.has(id) || !type || !answer || !since) continue;
    if (!(lng >= west && lng <= east && lat >= south && lat <= north)) continue;
    seen.add(id);

    const target = (cell('alvo') ?? '').trim();
    const until = toDate(cell('ate'));
    const note = (cell('nota') ?? '').trim().slice(0, MAX_NOTE);
    reports.push({
      id,
      type,
      answer,
      at: [Number(lng.toFixed(6)), Number(lat.toFixed(6))],
      ...(TARGET.test(target) && { target }),
      since,
      ...(until && { until }),
      ...(note && { note }),
    });
  }
  return reports;
}

/**
 * The published reports as JSON text, read from the spreadsheet tab named by REPORTS_CSV_URL
 * and kept for a few minutes. Without that variable there are no reports.
 */
export async function reports(env: Env, ctx: ExecutionContext): Promise<string> {
  const url = env.REPORTS_CSV_URL;
  if (!url) return '{"reports":[]}';
  if (!SHEET_URL.test(url)) throw new UpstreamError('upstream', 502);
  const cached = await caches.default.match(CACHE_KEY);
  if (cached) return cached.text();

  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS) });
    if (!response.ok) throw new UpstreamError('upstream', 502);
    const length = Number(response.headers.get('Content-Length') ?? 0);
    if (length > MAX_CSV_BYTES) throw new UpstreamError('upstream', 502);
    const csv = await response.text();
    if (csv.length > MAX_CSV_BYTES) throw new UpstreamError('upstream', 502);

    const body = JSON.stringify({ reports: publishedReports(csv) });
    ctx.waitUntil(
      caches.default.put(
        CACHE_KEY,
        new Response(body, { headers: { 'Content-Type': 'application/json', 'Cache-Control': `max-age=${REPORTS_TTL_SECONDS}` } }),
      ),
    );
    return body;
  } catch (error) {
    if (error instanceof UpstreamError) throw error;
    const timedOut = error instanceof DOMException && error.name === 'TimeoutError';
    throw new UpstreamError(timedOut ? 'timeout' : 'upstream', timedOut ? 504 : 502);
  }
}

// --- Sending a report --------------------------------------------------------

/** A report as the app sends it: the same codes as a published one, without id or dates. */
export type Submission = Pick<PublishedReport, 'type' | 'answer' | 'at' | 'target' | 'note'>;

/** The largest body the app can produce is a few hundred bytes. */
export const MAX_SUBMISSION_BYTES = 2048;

const wordFor = <T extends string>(words: Record<string, T>, code: T) => Object.keys(words).find((word) => words[word] === code)!;

/** Checks a report sent by the app. Anything that is not exactly a report is refused, with the reason. */
export function parseSubmission(json: unknown): Submission | { error: string } {
  if (!json || typeof json !== 'object' || Array.isArray(json)) return { error: 'the body must be a JSON object' };
  const { type, answer, at, target, note } = json as Record<string, unknown>;
  const known = Object.values(TYPES).find((candidate) => candidate === type);
  if (!known) return { error: 'unknown type' };
  const found = Object.values(ANSWERS[known]).find((candidate) => candidate === answer);
  if (!found) return { error: 'this type does not take this answer' };
  if (!Array.isArray(at) || at.length !== 2 || typeof at[0] !== 'number' || typeof at[1] !== 'number') return { error: 'at must be [lng, lat]' };
  const [lng, lat] = at as [number, number];
  const [west, south, east, north] = CAMPUS_BBOX;
  if (!(lng >= west && lng <= east && lat >= south && lat <= north)) return { error: 'the place is outside the campus' };
  if (target !== undefined && (typeof target !== 'string' || !TARGET.test(target))) return { error: 'target is not an id' };
  if (note !== undefined && (typeof note !== 'string' || note.length > MAX_NOTE)) return { error: `note must be text of at most ${MAX_NOTE} characters` };
  return {
    type: known,
    answer: found,
    at: [Number(lng.toFixed(6)), Number(lat.toFixed(6))],
    ...(typeof target === 'string' && { target }),
    ...(typeof note === 'string' && note.trim() && { note: note.trim() }),
  };
}

/** A spreadsheet takes text that starts like a formula for one; a leading apostrophe keeps it text. */
const asText = (value: string) => (/^[=+\-@\t\r]/.test(value) ? `'${value}` : value);

/**
 * The cells of a new row, by column name, in the words and number format the reviewers'
 * spreadsheet uses: every column of the published tab, so an approved row is published as it is.
 * `ate` is left empty for the reviewer; without it the app applies its default.
 */
export function submissionRow({ type, answer, at, target, note }: Submission, today: string, id: string): Record<string, string> {
  return {
    id,
    tipo: wordFor(TYPES, type),
    resposta: wordFor(ANSWERS[type], answer),
    // A decimal comma is read as a number under Brazilian settings and left alone under others.
    lng: at[0].toFixed(6).replace('.', ','),
    lat: at[1].toFixed(6).replace('.', ','),
    alvo: target ?? '',
    desde: today,
    ate: '',
    nota: asText(note ?? ''),
  };
}

const FORM_LINK = /^https:\/\/docs\.google\.com\/forms\/d\/e\/[\w-]+\/viewform\?/;
const REQUIRED_FIELDS = ['tipo', 'resposta', 'lng', 'lat'];

/**
 * Where to send a row, read from a pre-filled link of the Google Form in which every question
 * was answered with its own column name (`id`, `tipo`, `resposta`, `lng`, `lat`, `alvo`,
 * `desde`, `ate`, `nota`). The link then says which form field stands for which column. Nothing is returned
 * if the link is not such a link or a required column is missing.
 */
export function formTarget(prefilledLink: string): { url: string; fields: Record<string, string> } | undefined {
  if (!FORM_LINK.test(prefilledLink)) return undefined;
  const link = new URL(prefilledLink);
  const fields: Record<string, string> = {};
  for (const [name, value] of link.searchParams) {
    if (/^entry\.\d+$/.test(name)) fields[plain(value)] = name;
  }
  if (REQUIRED_FIELDS.some((column) => !fields[column])) return undefined;
  return { url: `${link.origin}${link.pathname.replace(/\/viewform$/, '/formResponse')}`, fields };
}

/** A new id for a report: short, unique enough for a spreadsheet, and nothing in it says who sent it. */
export const newReportId = () => `r-${crypto.randomUUID().slice(0, 8)}`;

/**
 * Adds the report to the reviewers' spreadsheet, through the form named by REPORTS_FORM_LINK, and
 * returns the id it was given. Stores nothing here.
 */
export async function submitReport(submission: Submission, env: Env): Promise<string> {
  const target = formTarget(env.REPORTS_FORM_LINK ?? '');
  if (!target) throw new UpstreamError('upstream', 502);
  // The day in São Paulo, where the campus is.
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
  const id = newReportId();
  const row = submissionRow(submission, today, id);
  const body = new URLSearchParams();
  for (const [column, field] of Object.entries(target.fields)) {
    if (row[column] !== undefined) body.set(field, row[column]);
  }
  try {
    const response = await fetch(target.url, { method: 'POST', body, signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS) });
    if (!response.ok) throw new UpstreamError('upstream', 502);
    await response.body?.cancel();
    return id;
  } catch (error) {
    if (error instanceof UpstreamError) throw error;
    const timedOut = error instanceof DOMException && error.name === 'TimeoutError';
    throw new UpstreamError(timedOut ? 'timeout' : 'upstream', timedOut ? 504 : 502);
  }
}
