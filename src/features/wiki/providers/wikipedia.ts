import type { WikiRef } from '../../../domain/types';
import { fetchJson } from '../../../lib/http';

const PROVIDER = 'wikipedia';
const WIKI = 'https://pt.wikipedia.org';
const WIKIDATA = 'https://www.wikidata.org/w/api.php';

const EXTRACT_MAX = 400;
const PHOTO_WIDTH = 640;
/** Smaller originals are icons, seals and diagrams rather than photos of the place. */
const PHOTO_MIN_WIDTH = 400;
export const MAX_PHOTOS = 8;

export type WikiSummary = {
  title: string;
  extract: string;
  /** The article, for "read more". */
  url: string;
  /** URL of the article's lead image at full size, used to put that photo first. */
  leadImage?: string;
};

export type WikiPhoto = {
  src: string;
  width: number;
  height: number;
  /** Plain text; absent when Commons does not name an author. */
  author?: string;
  license?: string;
  /** The file's page on Wikimedia Commons, where the full credit is. */
  page: string;
};

export type WikiArticle = { summary: WikiSummary; photos: WikiPhoto[] };

/** Shortens a text to whole sentences within `max` characters; a single long sentence is cut at a word. */
export function trimExtract(text: string, max = EXTRACT_MAX): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  const head = clean.slice(0, max);
  const sentenceEnd = Math.max(head.lastIndexOf('. '), head.lastIndexOf('! '), head.lastIndexOf('? '));
  if (sentenceEnd > max / 2) return head.slice(0, sentenceEnd + 1);
  return `${head.slice(0, head.lastIndexOf(' '))}…`;
}

type SummaryJson = {
  type?: unknown;
  title?: unknown;
  extract?: unknown;
  content_urls?: { mobile?: { page?: unknown }; desktop?: { page?: unknown } };
  originalimage?: { source?: unknown };
};

/** Converts a REST `page/summary` response. Disambiguation pages and empty articles give `undefined`. */
export function parseSummary(json: unknown): WikiSummary | undefined {
  const data = json as SummaryJson | null;
  if (!data || data.type === 'disambiguation' || typeof data.title !== 'string' || typeof data.extract !== 'string') return undefined;
  const url = data.content_urls?.desktop?.page ?? data.content_urls?.mobile?.page;
  const extract = trimExtract(data.extract);
  if (!extract || typeof url !== 'string') return undefined;
  const lead = data.originalimage?.source;
  return { title: data.title, extract, url, ...(typeof lead === 'string' && { leadImage: lead }) };
}

/** Commons credits are HTML (links, sometimes whole paragraphs): keep the text only. */
export function plainText(html: unknown): string | undefined {
  if (typeof html !== 'string') return undefined;
  const text = html
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!text) return undefined;
  return text.length > 60 ? `${text.slice(0, 59)}…` : text;
}

type ImageInfo = {
  url?: unknown;
  descriptionurl?: unknown;
  mime?: unknown;
  width?: unknown;
  thumburl?: unknown;
  thumbwidth?: unknown;
  thumbheight?: unknown;
  extmetadata?: { Artist?: { value?: unknown }; LicenseShortName?: { value?: unknown } };
};
type ImagesJson = { query?: { pages?: { imageinfo?: ImageInfo[] }[] } };

/** File name of a Wikimedia image URL, without the query string and percent-encoding. */
const fileName = (url: string) => {
  const name = url.split('?')[0]!.split('/').pop() ?? '';
  try {
    return decodeURIComponent(name);
  } catch {
    return name;
  }
};

/**
 * Converts an `imageinfo` listing of an article's images into the photos worth
 * showing: raster images of a decent size (which drops flags, logos and
 * maintenance icons, all SVG or tiny), the article's lead image first.
 */
export function parsePhotos(json: unknown, leadImage?: string): WikiPhoto[] {
  const pages = (json as ImagesJson | null)?.query?.pages;
  if (!Array.isArray(pages)) return [];
  const lead = leadImage ? fileName(leadImage) : undefined;

  const photos: (WikiPhoto & { lead: boolean })[] = [];
  for (const page of pages) {
    const info = page.imageinfo?.[0];
    if (
      !info
      || (info.mime !== 'image/jpeg' && info.mime !== 'image/png')
      || typeof info.width !== 'number'
      || info.width < PHOTO_MIN_WIDTH
      || typeof info.thumburl !== 'string'
      || typeof info.thumbwidth !== 'number'
      || typeof info.thumbheight !== 'number'
      || typeof info.descriptionurl !== 'string'
    ) continue;
    const author = plainText(info.extmetadata?.Artist?.value);
    const license = plainText(info.extmetadata?.LicenseShortName?.value);
    photos.push({
      src: info.thumburl,
      width: info.thumbwidth,
      height: info.thumbheight,
      ...(author && { author }),
      ...(license && { license }),
      page: info.descriptionurl,
      lead: typeof info.url === 'string' && fileName(info.url) === lead,
    });
  }
  // A stable sort: the lead image moves to the front, the rest keep the article's order.
  return photos
    .sort((a, b) => Number(b.lead) - Number(a.lead))
    .slice(0, MAX_PHOTOS)
    .map(({ lead: _lead, ...photo }) => photo);
}

/** The Portuguese article title in a `wbgetentities` response, if the item has one. */
export function parseSitelink(json: unknown, id: string): string | undefined {
  const title = (json as { entities?: Record<string, { sitelinks?: { ptwiki?: { title?: unknown } } }> } | null)
    ?.entities?.[id]?.sitelinks?.ptwiki?.title;
  return typeof title === 'string' && title ? title : undefined;
}

const isWikidataId = (ref: WikiRef) => /^Q\d+$/.test(ref);

/**
 * Fetches the article a campus object points to: its summary and its photos.
 * `undefined` means there is nothing to show (no Portuguese article, or a
 * disambiguation page). The photos are optional: if that request fails the
 * summary is still returned.
 */
export async function fetchWikiArticle(ref: WikiRef, signal: AbortSignal): Promise<WikiArticle | undefined> {
  // No custom headers: they would add a preflight to every call. The browser's Origin identifies the app.
  const options = { provider: PROVIDER, signal };
  let title: string | undefined = ref;
  if (isWikidataId(ref)) {
    const url = `${WIKIDATA}?action=wbgetentities&ids=${ref}&props=sitelinks&sitefilter=ptwiki&format=json&origin=*`;
    title = parseSitelink(await fetchJson(url, options), ref);
    if (!title) return undefined;
  }

  const summary = parseSummary(
    await fetchJson(`${WIKI}/api/rest_v1/page/summary/${encodeURIComponent(title.replaceAll(' ', '_'))}?redirect=true`, options),
  );
  if (!summary) return undefined;

  const imagesUrl =
    `${WIKI}/w/api.php?action=query&titles=${encodeURIComponent(summary.title)}&redirects=1`
    + '&generator=images&gimlimit=50&prop=imageinfo&iiprop=url|mime|size|extmetadata'
    + `&iiextmetadatafilter=Artist|LicenseShortName&iiurlwidth=${PHOTO_WIDTH}&format=json&formatversion=2&origin=*`;
  const photos = await fetchJson(imagesUrl, options).then(
    (json) => parsePhotos(json, summary.leadImage),
    (error: unknown) => {
      if (signal.aborted) throw error;
      return [];
    },
  );
  return { summary, photos };
}
