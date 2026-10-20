import { describe, expect, it } from 'vitest';
import { extractLinks, htmlToText } from './htmlText';
import { robotsAllows } from './robots';

const page = `<html><head><style>p{}</style><script>var a=1</script></head><body>
<header><nav><a href="/">Início</a></nav></header>
<main><h1>Atendimento &amp; clínicas</h1><p>Vagas conforme&nbsp;disponibilidade.<br>Ligue (11) 3091-7418.</p>
<ul><li>Extração de siso</li><li><a href="/implantes#topo">Implantes</a></li></ul></main>
<footer>© FO</footer></body></html>`;

describe('htmlToText', () => {
  it('keeps the main text, line by line, and drops the rest', () => {
    expect(htmlToText(page)).toBe('Atendimento & clínicas\nVagas conforme disponibilidade.\nLigue (11) 3091-7418.\n- Extração de siso\n- Implantes');
  });


  it('can keep the address of each link', () => {
    expect(htmlToText(page, 'https://site.fo.usp.br/paciente/')).toContain('- Implantes <https://site.fo.usp.br/implantes#topo>');
  });
});

describe('extractLinks', () => {
  it('makes links absolute and drops anchors and repeats', () => {
    const html = `${page}<a href="https://site.fo.usp.br/implantes">Implantes de novo</a><a href="mailto:a@b.c">e-mail</a>`;
    expect(extractLinks(html, 'https://site.fo.usp.br/paciente/')).toEqual([
      { text: 'Início', href: 'https://site.fo.usp.br/' },
      { text: 'Implantes', href: 'https://site.fo.usp.br/implantes' },
    ]);
  });
});

describe('robotsAllows', () => {
  const robots = `User-agent: *\nDisallow: /wp-admin/\nAllow: /wp-admin/admin-ajax.php\nDisallow: /*.pdf$\n\nUser-agent: BadBot\nDisallow: /`;
  it('follows the longest matching rule of the right group', () => {
    expect(robotsAllows(robots, 'MapaUSP', '/paciente/')).toBe(true);
    expect(robotsAllows(robots, 'MapaUSP', '/wp-admin/x')).toBe(false);
    expect(robotsAllows(robots, 'MapaUSP', '/wp-admin/admin-ajax.php')).toBe(true);
    expect(robotsAllows(robots, 'MapaUSP', '/a/b.pdf')).toBe(false);
    expect(robotsAllows(robots, 'BadBot/1.0', '/paciente/')).toBe(false);
    expect(robotsAllows('', 'MapaUSP', '/')).toBe(true);
  });
});
