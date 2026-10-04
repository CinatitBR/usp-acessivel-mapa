/** What a request to the Worker asks for, after validation. Only these read-only routes exist. */
export type Route =
  | { kind: 'health' }
  /** One Olho Vivo call, forwarded as is. `upstream` is the path and query on the Olho Vivo API. */
  | { kind: 'olhovivo'; upstream: string }
  /** Positions of several lines in one request, so a phone does not make one call per line and direction. */
  | { kind: 'positions'; codes: number[] }
  | { kind: 'bad-request'; message: string }
  | { kind: 'not-found' };

const MAX_CODES = 20;

/** Olho Vivo stop and line codes are positive integers of at most 9 digits. */
function parseCode(value: string | null): number | undefined {
  return value && /^[1-9]\d{0,8}$/.test(value) ? Number(value) : undefined;
}

export function matchRoute(method: string, url: URL): Route {
  if (method !== 'GET') return { kind: 'not-found' };

  switch (url.pathname) {
    case '/health':
      return { kind: 'health' };

    case '/olhovivo/Previsao/Parada': {
      const stop = parseCode(url.searchParams.get('codigoParada'));
      return stop
        ? { kind: 'olhovivo', upstream: `/Previsao/Parada?codigoParada=${stop}` }
        : { kind: 'bad-request', message: 'codigoParada must be a positive integer' };
    }

    case '/olhovivo/Posicao/Linha': {
      const line = parseCode(url.searchParams.get('codigoLinha'));
      return line
        ? { kind: 'olhovivo', upstream: `/Posicao/Linha?codigoLinha=${line}` }
        : { kind: 'bad-request', message: 'codigoLinha must be a positive integer' };
    }

    case '/olhovivo/Posicao/Linhas': {
      const parts = (url.searchParams.get('codigos') ?? '').split(',');
      const codes = parts.map(parseCode);
      if (codes.length > MAX_CODES || codes.some((code) => code === undefined)) {
        return { kind: 'bad-request', message: `codigos must be 1 to ${MAX_CODES} positive integers` };
      }
      return { kind: 'positions', codes: [...new Set(codes as number[])] };
    }

    default:
      return { kind: 'not-found' };
  }
}

/**
 * CORS decision for a request. `allowed` is the comma-separated ALLOWED_ORIGINS
 * variable. Requests without an Origin (curl, server-side scripts) are let
 * through: CORS only governs browsers, and the rate limit still applies.
 */
export function checkOrigin(origin: string | null, allowed: string): { ok: boolean; headers: Record<string, string> } {
  if (!origin) return { ok: true, headers: {} };
  const list = allowed.split(',').map((entry) => entry.trim()).filter(Boolean);
  if (!list.includes(origin)) return { ok: false, headers: {} };
  return {
    ok: true,
    headers: {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Max-Age': '86400',
      Vary: 'Origin',
    },
  };
}
