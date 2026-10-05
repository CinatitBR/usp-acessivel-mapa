/** What a request to the Worker asks for, after validation. Only these routes exist. */
export type Route =
  | { kind: 'health' }
  /** One Olho Vivo call, forwarded as is. `upstream` is the path and query on the Olho Vivo API. */
  | { kind: 'olhovivo'; upstream: string }
  /** Positions of several lines in one request, so a phone does not make one call per line and direction. */
  | { kind: 'positions'; codes: number[] }
  /** One walking route from openrouteservice. The points are `lng,lat` strings with 5 decimals. */
  | { kind: 'ors'; profile: OrsProfile; from: string; to: string }
  /** The reports that reviewers have published. */
  | { kind: 'reports' }
  /** A new report, in the request's body, to add to the reviewers' queue. */
  | { kind: 'submit-report' }
  /** For reviewers, with their password: the reports to review, and a decision about one, in the body. */
  | { kind: 'review-list' }
  | { kind: 'review-decide'; id: string }
  | { kind: 'bad-request'; message: string }
  | { kind: 'not-found' };

const MAX_CODES = 20;

const ORS_PROFILES = ['foot-walking', 'wheelchair'] as const;
export type OrsProfile = (typeof ORS_PROFILES)[number];

/** Greater São Paulo: [west, south, east, north]. Routes elsewhere are not this app's business. */
const ROUTING_BBOX = [-46.83, -23.8, -46.36, -23.35] as const;

/** `lng,lat` inside the routing area, rounded to about a metre so nearby requests share a cache entry. */
function parsePoint(value: string | null): string | undefined {
  const match = /^(-?\d{1,3}(?:\.\d{1,8})?),(-?\d{1,2}(?:\.\d{1,8})?)$/.exec(value ?? '');
  if (!match) return undefined;
  const lng = Number(match[1]);
  const lat = Number(match[2]);
  const [west, south, east, north] = ROUTING_BBOX;
  if (lng < west || lng > east || lat < south || lat > north) return undefined;
  return `${lng.toFixed(5)},${lat.toFixed(5)}`;
}

/** Olho Vivo stop and line codes are positive integers of at most 9 digits. */
function parseCode(value: string | null): number | undefined {
  return value && /^[1-9]\d{0,8}$/.test(value) ? Number(value) : undefined;
}

export function matchRoute(method: string, url: URL): Route {
  if (method === 'POST' && url.pathname === '/reports') return { kind: 'submit-report' };
  const decided = method === 'POST' ? /^\/review\/reports\/([\w-]{1,40})$/.exec(url.pathname) : null;
  if (decided) return { kind: 'review-decide', id: decided[1]! };
  if (method !== 'GET') return { kind: 'not-found' };

  switch (url.pathname) {
    case '/health':
      return { kind: 'health' };

    case '/reports':
      return { kind: 'reports' };

    case '/review/reports':
      return { kind: 'review-list' };

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

    case '/ors/route': {
      const profile = ORS_PROFILES.find((candidate) => candidate === url.searchParams.get('profile'));
      const from = parsePoint(url.searchParams.get('from'));
      const to = parsePoint(url.searchParams.get('to'));
      if (!profile) return { kind: 'bad-request', message: `profile must be one of ${ORS_PROFILES.join(', ')}` };
      if (!from || !to) return { kind: 'bad-request', message: 'from and to must be lng,lat inside Greater São Paulo' };
      if (from === to) return { kind: 'bad-request', message: 'from and to are the same point' };
      return { kind: 'ors', profile, from, to };
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
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
      Vary: 'Origin',
    },
  };
}
