const API = 'https://api.olhovivo.sptrans.com.br/v2.1';
const UPSTREAM_TIMEOUT_MS = 8_000;

/** Olho Vivo lets a session cookie be reused for 20 minutes; renew a little earlier. */
const SESSION_TTL_SECONDS = 15 * 60;
/** Many phones polling every 20 s collapse into one upstream call per path in this window. */
export const DATA_TTL_SECONDS = 15;

// Synthetic keys in the Cache API. They are never served to clients: the
// Worker only reads them itself. This keeps the session out of module-level
// state and needs no database.
const SESSION_KEY = 'https://olhovivo.internal/session';
/** Set after a refused sign-in, so a bad token does not make every request retry the login. */
const LOGIN_REFUSED_KEY = 'https://olhovivo.internal/login-refused';
const LOGIN_REFUSED_TTL_SECONDS = 60;
const dataKey = (path: string) => `https://olhovivo.internal/data${path}`;

export class UpstreamError extends Error {
  constructor(
    readonly code: 'auth' | 'upstream' | 'timeout' | 'rate_limited',
    readonly status: number,
  ) {
    super(code);
  }
}

async function login(env: Env, ctx: ExecutionContext): Promise<string> {
  const response = await fetch(`${API}/Login/Autenticar?token=${encodeURIComponent(env.OLHOVIVO_TOKEN)}`, {
    method: 'POST',
    signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
  });
  const cookie = response.headers.getSetCookie().map((value) => value.split(';')[0]).join('; ');
  if (!response.ok || (await response.text()).trim() !== 'true' || !cookie) {
    ctx.waitUntil(
      caches.default.put(
        LOGIN_REFUSED_KEY,
        new Response('refused', { headers: { 'Cache-Control': `max-age=${LOGIN_REFUSED_TTL_SECONDS}` } }),
      ),
    );
    throw new UpstreamError('auth', 502);
  }

  ctx.waitUntil(
    caches.default.put(
      SESSION_KEY,
      new Response(cookie, { headers: { 'Cache-Control': `max-age=${SESSION_TTL_SECONDS}` } }),
    ),
  );
  return cookie;
}

async function session(env: Env, ctx: ExecutionContext): Promise<string> {
  const cached = await caches.default.match(SESSION_KEY);
  if (cached) return cached.text();
  if (await caches.default.match(LOGIN_REFUSED_KEY)) throw new UpstreamError('auth', 502);
  return login(env, ctx);
}

const get = (path: string, cookie: string) =>
  fetch(`${API}${path}`, { headers: { Cookie: cookie }, signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS) });

/**
 * Fetches one Olho Vivo path (already validated by matchRoute) and returns its
 * JSON text unchanged. Results are cached briefly; an expired session is
 * renewed once.
 */
export async function olhoVivo(path: string, env: Env, ctx: ExecutionContext): Promise<string> {
  const key = dataKey(path);
  const cached = await caches.default.match(key);
  if (cached) return cached.text();

  try {
    let response = await get(path, await session(env, ctx));
    if (response.status === 401) response = await get(path, await login(env, ctx));
    if (!response.ok) throw new UpstreamError(response.status === 401 ? 'auth' : 'upstream', 502);

    // Small, bounded JSON documents (one stop or one line), so buffering is fine.
    const body = await response.text();
    ctx.waitUntil(
      caches.default.put(
        key,
        new Response(body, {
          headers: { 'Content-Type': 'application/json', 'Cache-Control': `max-age=${DATA_TTL_SECONDS}` },
        }),
      ),
    );
    return body;
  } catch (error) {
    if (error instanceof UpstreamError) throw error;
    const timedOut = error instanceof DOMException && error.name === 'TimeoutError';
    throw new UpstreamError(timedOut ? 'timeout' : 'upstream', timedOut ? 504 : 502);
  }
}
