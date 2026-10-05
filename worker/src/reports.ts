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
      // OSM-style ids (`way/123`) and the overlay's own (`curated/elevator-1`).
      ...(/^[a-z]+\/[\w-]{1,40}$/.test(target) && { target }),
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
