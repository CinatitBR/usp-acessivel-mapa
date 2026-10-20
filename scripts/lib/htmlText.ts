/** Small, dependency-free HTML reading for `knowledge:fetch`: the visible text of a page, and its links. */

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '–', mdash: '—', hellip: '…' };

export function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, name: string) => {
    if (name[0] === '#') {
      const code = name[1] === 'x' || name[1] === 'X' ? parseInt(name.slice(2), 16) : parseInt(name.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : whole;
    }
    return ENTITIES[name.toLowerCase()] ?? whole;
  });
}

/**
 * The page's readable text: the main content when it is marked, without scripts, menus, headers and footers.
 * With `pageUrl`, each link keeps its address after its text, `text <https://…>`, so a list of groups
 * still says which site is whose.
 */
export function htmlToText(html: string, pageUrl?: string): string {
  let body = html.replace(/<!--[\s\S]*?-->/g, '');
  if (pageUrl) {
    body = body.replace(/<a\b[^>]*\bhref\s*=\s*(["'])(.*?)\1[^>]*>([\s\S]*?)<\/a>/gi, (whole, _quote, href: string, text: string) => {
      try {
        const url = new URL(decodeEntities(href), pageUrl).href;
        return /^https?:/.test(url) ? `${text} &lt;${url}&gt;` : whole;
      } catch {
        return whole;
      }
    });
  }
  const main = /<(main|article)\b[^>]*>([\s\S]*?)<\/\1>/i.exec(body);
  if (main) body = main[2]!;
  body = body
    .replace(/<(script|style|noscript|svg|nav|header|footer|form|iframe|template)\b[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<li\b[^>]*>/gi, '\n- ')
    .replace(/<\/?(p|div|section|h[1-6]|ul|ol|li|tr|table|blockquote|dd|dt)\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ');
  return decodeEntities(body)
    .split('\n')
    .map((line) => line.replace(/[ \t ]+/g, ' ').trim())
    .filter((line, index, lines) => line && line !== '-' && !(line === lines[index - 1]))
    .join('\n');
}

export type PageLink = { text: string; href: string };

/** Links with their text, made absolute, without anchors, mail links or duplicates. */
export function extractLinks(html: string, pageUrl: string): PageLink[] {
  const links: PageLink[] = [];
  const seen = new Set<string>();
  for (const match of html.matchAll(/<a\b[^>]*\bhref\s*=\s*(["'])(.*?)\1[^>]*>([\s\S]*?)<\/a>/gi)) {
    let href: string;
    try {
      href = new URL(decodeEntities(match[2]!), pageUrl).href.replace(/#.*$/, '');
    } catch {
      continue;
    }
    if (!/^https?:/.test(href) || seen.has(href)) continue;
    const text = decodeEntities(match[3]!.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
    if (!text) continue;
    seen.add(href);
    links.push({ text, href });
  }
  return links;
}
