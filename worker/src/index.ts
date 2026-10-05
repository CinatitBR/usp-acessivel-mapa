/**
 * The app's only backend. It holds the Olho Vivo token and the openrouteservice
 * key, signs in to Olho Vivo, forwards a fixed set of read-only calls, adds
 * CORS headers and caches briefly. Responses are the upstream payloads, untouched: all parsing
 * happens in the app's adapters. The one exception is `/reports`, which passes on only the
 * known columns of the reviewers' spreadsheet (see reports.ts).
 */
import { DATA_TTL_SECONDS, olhoVivo, UpstreamError } from './olhovivo';
import { ORS_ROUTE_TTL_SECONDS, orsRoute } from './ors';
import { MAX_SUBMISSION_BYTES, parseSubmission, reports, REPORTS_TTL_SECONDS, submitReport } from './reports';
import { checkOrigin, matchRoute, type Route } from './routes';

type ErrorCode = 'bad_request' | 'not_found' | 'forbidden' | 'rate_limited' | 'auth' | 'upstream' | 'timeout';

const json = (body: unknown, status: number, headers: Record<string, string>) =>
  new Response(typeof body === 'string' ? body : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...headers },
  });

const failure = (error: ErrorCode, status: number, headers: Record<string, string>, message?: string) =>
  json({ error, status, ...(message && { message }) }, status, { 'Cache-Control': 'no-store', ...headers });

/** Reads, checks and passes on a report. The body is small and bounded, so it is read whole. */
async function acceptReport(request: Request, env: Env, cors: Record<string, string>): Promise<Response> {
  const text = await request.text();
  if (text.length > MAX_SUBMISSION_BYTES) return failure('bad_request', 413, cors, 'the report is too large');
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return failure('bad_request', 400, cors, 'the body must be JSON');
  }
  const submission = parseSubmission(body);
  if ('error' in submission) return failure('bad_request', 400, cors, submission.error);
  // The id lets the app recognise its own report once a reviewer publishes it.
  const id = await submitReport(submission, env);
  return json({ ok: true, id }, 201, { 'Cache-Control': 'no-store', ...cors });
}

async function respond(route: Route, request: Request, env: Env, ctx: ExecutionContext, cors: Record<string, string>): Promise<Response> {
  const cached = { 'Cache-Control': `public, max-age=${DATA_TTL_SECONDS}`, ...cors };
  switch (route.kind) {
    case 'health':
      return json({ ok: true }, 200, { 'Cache-Control': 'no-store', ...cors });
    case 'olhovivo':
      return json(await olhoVivo(route.upstream, env, ctx), 200, cached);
    case 'positions': {
      // Fan-out only: each body is the raw Olho Vivo response for that line code.
      const bodies = await Promise.all(
        route.codes.map((code) => olhoVivo(`/Posicao/Linha?codigoLinha=${code}`, env, ctx)),
      );
      return json(`[${route.codes.map((code, index) => `{"codigo":${code},"body":${bodies[index]}}`).join(',')}]`, 200, cached);
    }
    case 'ors':
      return json(await orsRoute(route.profile, route.from, route.to, env, ctx), 200, {
        'Cache-Control': `public, max-age=${ORS_ROUTE_TTL_SECONDS}`,
        ...cors,
      });
    case 'reports':
      return json(await reports(env, ctx), 200, { 'Cache-Control': `public, max-age=${REPORTS_TTL_SECONDS}`, ...cors });
    case 'submit-report':
      return acceptReport(request, env, cors);
    case 'bad-request':
      return failure('bad_request', 400, cors, route.message);
    case 'not-found':
      return failure('not_found', 404, cors);
  }
}

export default {
  async fetch(request, env, ctx): Promise<Response> {
    const started = Date.now();
    const url = new URL(request.url);
    const origin = checkOrigin(request.headers.get('Origin'), env.ALLOWED_ORIGINS);
    const route = matchRoute(request.method, url);

    let response: Response;
    if (!origin.ok) {
      response = failure('forbidden', 403, {});
    } else if (route.kind === 'submit-report' && !request.headers.get('Origin')) {
      // Reports come from the app in a browser, which always says where it is.
      response = failure('forbidden', 403, {});
    } else if (request.method === 'OPTIONS') {
      response = new Response(null, { status: 204, headers: origin.headers });
    } else if (route.kind === 'olhovivo' || route.kind === 'positions' || route.kind === 'ors' || route.kind === 'reports' || route.kind === 'submit-report') {
      const client = request.headers.get('CF-Connecting-IP') ?? 'unknown';
      // Reading reports shares the general limit; routing and sending a report have stricter ones.
      const limiter = route.kind === 'ors' ? env.ORS_LIMITER : route.kind === 'submit-report' ? env.REPORT_LIMITER : env.OLHOVIVO_LIMITER;
      const { success } = await limiter.limit({ key: client });
      if (!success) {
        response = failure('rate_limited', 429, { 'Retry-After': '60', ...origin.headers });
      } else {
        try {
          response = await respond(route, request, env, ctx, origin.headers);
        } catch (error) {
          const upstream = error instanceof UpstreamError ? error : new UpstreamError('upstream', 502);
          response = failure(upstream.code, upstream.status, origin.headers);
        }
      }
    } else {
      response = await respond(route, request, env, ctx, origin.headers);
    }

    // Path only: the query holds no secrets, but nothing else about the request is needed either.
    console.log(JSON.stringify({ path: url.pathname, route: route.kind, status: response.status, ms: Date.now() - started }));
    return response;
  },
} satisfies ExportedHandler<Env>;
