import { existsSync, readFileSync } from 'node:fs';

const API = 'https://api.olhovivo.sptrans.com.br/v2.1';
const DEV_VARS = 'worker/.dev.vars';

/** One entry of Olho Vivo's /Linha/Buscar. */
export type LineSearchEntry = {
  /** Line code used by the positions endpoint. */
  cl: number;
  /** First part of the sign, e.g. `8082`. */
  lt: string;
  /** Second part of the sign, e.g. `10`. */
  tl: number;
  /** 1 = main terminal to secondary, 2 = the way back. */
  sl: number;
};

/**
 * Maps `<line id>:<GTFS direction>` to the Olho Vivo code. Direction 0 in the
 * GTFS is "sentido 1" in Olho Vivo (checked on 8022-10 against GTFS stop order).
 */
export function lineCodes(lineId: string, entries: LineSearchEntry[]): [string, number][] {
  return entries
    .filter((entry) => `${entry.lt}-${entry.tl}` === lineId && (entry.sl === 1 || entry.sl === 2))
    .map((entry) => [`${lineId}:${entry.sl - 1}`, entry.cl]);
}

/** The token comes from the environment or from the Worker's local secrets file; it is never written anywhere. */
function readToken(): string | undefined {
  if (process.env.OLHOVIVO_TOKEN) return process.env.OLHOVIVO_TOKEN;
  if (!existsSync(DEV_VARS)) return undefined;
  const match = /^OLHOVIVO_TOKEN\s*=\s*"?([^"\r\n]+)"?\s*$/m.exec(readFileSync(DEV_VARS, 'utf8'));
  return match?.[1];
}

/** Returns `undefined` when there is no token or Olho Vivo cannot be reached, so the caller can keep older codes. */
export async function resolveLineCodes(lineIds: string[]): Promise<Map<string, number> | undefined> {
  const token = readToken();
  if (!token) return undefined;
  try {
    const login = await fetch(`${API}/Login/Autenticar?token=${encodeURIComponent(token)}`, {
      method: 'POST',
      signal: AbortSignal.timeout(15_000),
    });
    const cookie = login.headers.getSetCookie().map((value) => value.split(';')[0]).join('; ');
    if (!login.ok || (await login.text()).trim() !== 'true' || !cookie) throw new Error('authentication refused');

    const codes = new Map<string, number>();
    for (const lineId of lineIds) {
      const response = await fetch(`${API}/Linha/Buscar?termosBusca=${encodeURIComponent(lineId.split('-')[0]!)}`, {
        headers: { Cookie: cookie },
        signal: AbortSignal.timeout(15_000),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status} for ${lineId}`);
      for (const [key, code] of lineCodes(lineId, (await response.json()) as LineSearchEntry[])) codes.set(key, code);
    }
    return codes;
  } catch (error) {
    console.warn(`  warning: could not resolve Olho Vivo line codes (${error instanceof Error ? error.message : String(error)})`);
    return undefined;
  }
}
