/**
 * Turns the model's text into what the chat shows: paragraphs and lists, with each `[[id]]` citation
 * replaced by a numbered mark that points to its source. Ids that are not sources are dropped.
 */
import type { KnowledgeSource } from '../../domain/knowledge';

export type Inline = { kind: 'text'; text: string; strong?: boolean } | { kind: 'cite'; number: number; source: KnowledgeSource };
export type Block = { kind: 'paragraph'; inline: Inline[] } | { kind: 'list'; items: Inline[][] };
export type Answer = { blocks: Block[]; cited: KnowledgeSource[] };

const CITATION = /\[\[([a-z0-9-]+)\]\]/g;

/** While an answer streams in, a citation can arrive cut in half: hold back a trailing `[` or `[[abc`. */
export const withoutOpenCitation = (text: string) => text.replace(/\[\[?[a-z0-9-]*\]?$/, '');

export function parseAnswer(text: string, sources: ReadonlyMap<string, KnowledgeSource>): Answer {
  const cited: KnowledgeSource[] = [];
  const numberOf = (source: KnowledgeSource) => {
    let index = cited.indexOf(source);
    if (index < 0) index = cited.push(source) - 1;
    return index + 1;
  };

  const inline = (line: string): Inline[] => {
    const parts: Inline[] = [];
    // **bold**, the only emphasis the model is asked to use.
    const pushText = (chunk: string) => {
      for (const piece of chunk.split(/(\*\*[^*]+\*\*)/)) {
        const strong = /^\*\*([^*]+)\*\*$/.exec(piece);
        if (strong) parts.push({ kind: 'text', text: strong[1]!, strong: true });
        else if (piece) parts.push({ kind: 'text', text: piece });
      }
    };
    let last = 0;
    for (const match of line.matchAll(CITATION)) {
      // The mark sits right after the word it supports.
      pushText(line.slice(last, match.index).trimEnd());
      last = match.index + match[0].length;
      const source = sources.get(match[1]!);
      const previous = parts.at(-1);
      if (source && !(previous?.kind === 'cite' && previous.source === source)) parts.push({ kind: 'cite', number: numberOf(source), source });
    }
    pushText(line.slice(last).trimEnd());
    return parts;
  };

  const blocks: Block[] = [];
  for (const chunk of text.replace(/\r\n/g, '\n').split(/\n{2,}/)) {
    let list: Inline[][] | undefined;
    let paragraph: string[] = [];
    const flush = () => {
      if (paragraph.length) blocks.push({ kind: 'paragraph', inline: inline(paragraph.join(' ')) });
      paragraph = [];
    };
    for (const raw of chunk.split('\n')) {
      const line = raw.trim();
      if (!line) continue;
      const item = /^(?:[-*•]|\d+[.)])\s+(.*)$/.exec(line);
      if (item) {
        flush();
        if (!list) blocks.push({ kind: 'list', items: (list = []) });
        list.push(inline(item[1]!));
      } else if (/^#+\s/.test(line)) {
        // A heading the model wrote anyway reads as a line of its own.
        list = undefined;
        flush();
        paragraph.push(line.replace(/^#+\s*/, ''));
        flush();
      } else {
        list = undefined;
        paragraph.push(line);
      }
    }
    flush();
  }
  return { blocks: blocks.filter((block) => (block.kind === 'list' ? block.items.length > 0 : block.inline.length > 0)), cited };
}
