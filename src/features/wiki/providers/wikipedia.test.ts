import { describe, expect, it } from 'vitest';
import images from './fixtures/images-fau.json';
import summary from './fixtures/summary-fau.json';
import wikidata from './fixtures/wikidata-hu.json';
import { parsePhotos, parseSitelink, parseSummary, plainText, trimExtract } from './wikipedia';

// The fixtures are real responses recorded on 2026-10-04 for the FAU article and the Hospital Universitário item.

describe('parseSummary', () => {
  it('reads title, extract, link and lead image from a recorded response', () => {
    const parsed = parseSummary(summary);
    expect(parsed?.title).toBe('Faculdade de Arquitetura e Urbanismo e de Design da Universidade de São Paulo');
    expect(parsed?.extract.startsWith('Faculdade de Arquitetura e Urbanismo e de Design')).toBe(true);
    expect(parsed?.url).toMatch(/^https:\/\/pt\.wikipedia\.org\/wiki\//);
    expect(parsed?.leadImage).toContain('upload.wikimedia.org');
  });

  it('rejects disambiguation pages, empty extracts and malformed answers', () => {
    expect(parseSummary({ ...summary, type: 'disambiguation' })).toBeUndefined();
    expect(parseSummary({ ...summary, extract: '  ' })).toBeUndefined();
    expect(parseSummary(null)).toBeUndefined();
    expect(parseSummary({ title: 'X' })).toBeUndefined();
  });
});

describe('parsePhotos', () => {
  const photos = parsePhotos(images, parseSummary(summary)?.leadImage);

  it('keeps the photos and drops flags, logos and icons', () => {
    expect(photos).toHaveLength(4);
    expect(photos.every((photo) => /\.jpe?g/i.test(photo.src))).toBe(true);
  });

  it("puts the article's lead image first", () => {
    expect(decodeURIComponent(photos[0]!.src)).toContain('Faculdade_de_Arquitetura_e_Urbanismo_da_Cidade_de_São_Paulo._1.jpg');
  });

  it('gives each photo a size, a Commons page and a plain-text credit', () => {
    for (const photo of photos) {
      expect(photo.width).toBe(640);
      expect(photo.height).toBeGreaterThan(0);
      expect(photo.page).toMatch(/^https:\/\/commons\.wikimedia\.org\/wiki\//);
      expect(photo.author ?? '').not.toMatch(/[<>]/);
      expect(photo.license).toBeTruthy();
    }
  });

  it('returns nothing for a malformed answer', () => {
    expect(parsePhotos({})).toEqual([]);
    expect(parsePhotos(null)).toEqual([]);
  });
});

describe('parseSitelink', () => {
  it('finds the Portuguese article of a Wikidata item', () => {
    expect(parseSitelink(wikidata, 'Q9004924')).toBe('Hospital Universitário da Universidade de São Paulo');
  });

  it('is undefined when the item has no Portuguese article', () => {
    expect(parseSitelink({ entities: { Q1: { sitelinks: {} } } }, 'Q1')).toBeUndefined();
    expect(parseSitelink({}, 'Q1')).toBeUndefined();
  });
});

describe('trimExtract', () => {
  it('keeps a short text whole', () => {
    expect(trimExtract('Um  texto\ncurto.')).toBe('Um texto curto.');
  });

  it('cuts at the end of a sentence', () => {
    const text = `${'a'.repeat(30)}. ${'b'.repeat(30)}. ${'c'.repeat(30)}.`;
    expect(trimExtract(text, 70)).toBe(`${'a'.repeat(30)}. ${'b'.repeat(30)}.`);
  });

  it('cuts a single long sentence at a word, with an ellipsis', () => {
    expect(trimExtract('palavra '.repeat(20), 30)).toBe('palavra palavra palavra…');
  });
});

describe('plainText', () => {
  it('strips tags and entities', () => {
    expect(plainText('<a href="//commons.wikimedia.org/wiki/User:X" title="User:X">Fulano &amp; Cia</a>')).toBe('Fulano & Cia');
  });

  it('is undefined for nothing', () => {
    expect(plainText('<br>')).toBeUndefined();
    expect(plainText(undefined)).toBeUndefined();
  });
});
