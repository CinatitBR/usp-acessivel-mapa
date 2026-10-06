import { describe, expect, it } from 'vitest';
import { checkOrigin, matchRoute } from './routes';

const route = (path: string, method = 'GET') => matchRoute(method, new URL(`https://worker.example${path}`));

describe('matchRoute', () => {
  it('forwards the whitelisted Olho Vivo calls with a rebuilt query', () => {
    expect(route('/olhovivo/Previsao/Parada?codigoParada=120010342&extra=1')).toEqual({
      kind: 'olhovivo',
      upstream: '/Previsao/Parada?codigoParada=120010342',
    });
    expect(route('/olhovivo/Posicao/Linha?codigoLinha=2506')).toEqual({
      kind: 'olhovivo',
      upstream: '/Posicao/Linha?codigoLinha=2506',
    });
  });

  it('accepts a de-duplicated list of line codes', () => {
    expect(route('/olhovivo/Posicao/Linhas?codigos=2506,35274,2506')).toEqual({ kind: 'positions', codes: [2506, 35274] });
  });

  it('rejects malformed parameters', () => {
    for (const path of [
      '/olhovivo/Previsao/Parada',
      '/olhovivo/Previsao/Parada?codigoParada=abc',
      '/olhovivo/Previsao/Parada?codigoParada=1%26token%3Dx',
      '/olhovivo/Posicao/Linha?codigoLinha=-1',
      '/olhovivo/Posicao/Linhas?codigos=',
      '/olhovivo/Posicao/Linhas?codigos=1,,2',
      `/olhovivo/Posicao/Linhas?codigos=${Array.from({ length: 21 }, (_, index) => index + 1).join(',')}`,
    ]) {
      expect(route(path).kind, path).toBe('bad-request');
    }
  });

  it('accepts a route request and rounds its points', () => {
    expect(route('/ors/route?profile=wheelchair&from=-46.7273836,-23.560624&to=-46.72752,-23.56085')).toEqual({
      avoid: [],
      kind: 'ors',
      profile: 'wheelchair',
      from: '-46.72738,-23.56062',
      to: '-46.72752,-23.56085',
    });
  });

  it('rejects route requests with another profile, bad points or points outside São Paulo', () => {
    for (const path of [
      '/ors/route?profile=driving-car&from=-46.72,-23.56&to=-46.73,-23.55',
      '/ors/route?profile=wheelchair&from=-46.72,-23.56',
      '/ors/route?profile=wheelchair&from=-46.72,-23.56&to=-43.2,-22.9',
      '/ors/route?profile=wheelchair&from=-46.72,-23.56,7&to=-46.73,-23.55',
      '/ors/route?profile=wheelchair&from=-46.72,-23.56&to=-46.720001,-23.560001',
      '/ors/route?profile=wheelchair&from=a,b&to=-46.73,-23.55',
    ]) {
      expect(route(path).kind, path).toBe('bad-request');
    }
  });

  it('exposes nothing else', () => {
    expect(route('/olhovivo/Login/Autenticar').kind).toBe('not-found');
    expect(route('/olhovivo/Posicao').kind).toBe('not-found');
    expect(route('/').kind).toBe('not-found');
    expect(route('/olhovivo/Previsao/Parada?codigoParada=1', 'POST').kind).toBe('not-found');
    expect(route('/health')).toEqual({ kind: 'health' });
  });
});

describe('checkOrigin', () => {
  const allowed = 'https://usp-map.pages.dev, http://localhost:5173';

  it('echoes an allowed origin', () => {
    const result = checkOrigin('http://localhost:5173', allowed);
    expect(result.ok).toBe(true);
    expect(result.headers['Access-Control-Allow-Origin']).toBe('http://localhost:5173');
    expect(result.headers.Vary).toBe('Origin');
  });

  it('refuses other origins', () => {
    expect(checkOrigin('https://evil.example', allowed)).toEqual({ ok: false, headers: {} });
    expect(checkOrigin('https://usp-map.pages.dev.evil.example', allowed).ok).toBe(false);
  });

  it('lets requests without an Origin through, with no CORS headers', () => {
    expect(checkOrigin(null, allowed)).toEqual({ ok: true, headers: {} });
  });

  it('takes the reports a route should go around, by id, sorted and without repeats', () => {
    const base = '/ors/route?profile=wheelchair&from=-46.72738,-23.56062&to=-46.72752,-23.56085';
    expect(route(`${base}&avoid=r-b,r-a,r-b`)).toMatchObject({ kind: 'ors', avoid: ['r-a', 'r-b'] });
    expect(route(`${base}&avoid=`)).toMatchObject({ kind: 'ors', avoid: [] });
    expect(route(`${base}&avoid=r-1,<script>`)).toMatchObject({ kind: 'bad-request' });
    expect(route(`${base}&avoid=${Array.from({ length: 9 }, (_, index) => `r-${index}`).join(',')}`)).toMatchObject({ kind: 'bad-request' });
  });

  it('knows the review routes', () => {
    expect(matchRoute('GET', new URL('https://w/review/reports'))).toEqual({ kind: 'review-list' });
    expect(matchRoute('POST', new URL('https://w/review/reports/r-3f9a1c2e'))).toEqual({ kind: 'review-decide', id: 'r-3f9a1c2e' });
    expect(matchRoute('POST', new URL("https://w/review/reports/x'%20OR%201=1"))).toEqual({ kind: 'not-found' });
    expect(matchRoute('POST', new URL('https://w/review/reports/'))).toEqual({ kind: 'not-found' });
    expect(matchRoute('GET', new URL('https://w/review/reports/r12'))).toEqual({ kind: 'not-found' });
  });

  it('knows the routes for answers about a report', () => {
    expect(matchRoute('POST', new URL('https://w/reports/r-3f9a1c2e/feedback'))).toEqual({ kind: 'feedback', id: 'r-3f9a1c2e' });
    expect(matchRoute('GET', new URL('https://w/reports/r-3f9a1c2e/feedback'))).toEqual({ kind: 'not-found' });
    expect(matchRoute('POST', new URL('https://w/review/reports/r12/keep'))).toEqual({ kind: 'review-keep', id: 'r12' });
    expect(matchRoute('POST', new URL('https://w/reports/a/b/feedback'))).toEqual({ kind: 'not-found' });
  });

  it('takes a report only as a POST to /reports', () => {
    expect(matchRoute('POST', new URL('https://w/reports'))).toEqual({ kind: 'submit-report' });
    expect(matchRoute('GET', new URL('https://w/reports'))).toEqual({ kind: 'reports' });
    expect(matchRoute('POST', new URL('https://w/health'))).toEqual({ kind: 'not-found' });
    expect(matchRoute('PUT', new URL('https://w/reports'))).toEqual({ kind: 'not-found' });
  });
});
