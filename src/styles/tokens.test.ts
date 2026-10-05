import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const tokens = readFileSync('src/styles/tokens.css', 'utf8');
const styles = readFileSync('src/index.css', 'utf8');

/** Every custom property of tokens.css, with `var()` references followed to a literal. */
const declared = new Map([...tokens.matchAll(/(--[\w-]+):\s*([^;]+);/g)].map(([, name, value]) => [name!, value!.trim()]));
function resolve(name: string): string {
  const value = declared.get(name);
  if (value === undefined) throw new Error(`Unknown token ${name}`);
  const reference = /^var\((--[\w-]+)\)$/.exec(value);
  return reference ? resolve(reference[1]!) : value;
}

function luminance(hex: string): number {
  const channels = [1, 3, 5].map((start) => parseInt(hex.slice(start, start + 2), 16) / 255);
  const [red, green, blue] = channels.map((channel) => (channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4));
  return 0.2126 * red! + 0.7152 * green! + 0.0722 * blue!;
}

/** WCAG contrast ratio of two colour tokens. */
function contrast(text: string, background: string): number {
  const [light, dark] = [luminance(resolve(text)), luminance(resolve(background))].sort((a, b) => b - a);
  return (light! + 0.05) / (dark! + 0.05);
}

describe('design tokens', () => {
  it('are the only place with colour and type literals', () => {
    const literals = styles.match(/#[0-9a-f]{3,8}\b|rgba?\(|font-size:\s*[\d.]|font-weight:\s*\d|font-family:/gi);
    expect(literals).toBeNull();
  });

  it('are all defined where the stylesheet uses them', () => {
    const used = new Set([...styles.matchAll(/var\((--[\w-]+)/g)].map(([, name]) => name!));
    // These two are set by components on the element: an access status and a bus line have their own colours.
    const perElement = ['--status-color', '--line-color'];
    const undefinedTokens = [...used].filter((name) => !declared.has(name) && !perElement.includes(name));
    expect(undefinedTokens).toEqual([]);
  });

  it('keep text readable: 4.5:1 or more for every text and background pair in use', () => {
    const pairs: [text: string, background: string][] = [
      ['--text', '--surface'],
      ['--text', '--page'],
      ['--muted', '--surface'],
      ['--muted', '--surface-muted'],
      ['--heading', '--surface'],
      ['--accent', '--surface'],
      ['--accent', '--accent-soft'],
      ['--on-accent', '--accent'],
      ['--on-accent-tonal', '--accent-tonal'],
      ['--on-chip', '--chip'],
      ['--on-inverse', '--surface-inverse'],
      ['--on-accent', '--success-strong'],
      ['--success-strong', '--surface'],
      ['--warning-strong', '--surface'],
      ['--error', '--surface'],
      ['--text', '--warning'],
      ['--text', '--info'],
      ['--text', '--success'],
    ];
    const failing = pairs.filter(([text, background]) => contrast(text, background) < 4.5).map((pair) => pair.join(' on '));
    expect(failing).toEqual([]);
  });
});
