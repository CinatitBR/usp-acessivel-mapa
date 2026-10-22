/** A Chrome trace event, as far as `cpuByThread` reads it. */
type TraceEvent = { ph?: string; name?: string; pid?: number; tid?: number; ts?: number; dur?: number; tdur?: number; args?: { name?: string } };

type Cpu = { main: number; workers: number };

/**
 * Sums the CPU time of the renderer's main thread and of its dedicated workers (MapLibre's),
 * before and after the user-timing mark `split`. Top-level tasks only, so nothing is counted twice;
 * thread time (`tdur`) when the trace has it, else wall time.
 */
export function cpuByThread(events: unknown[], split: string): { before: Cpu; after: Cpu } {
  const list = events as TraceEvent[];
  const threadNames = new Map<string, string>();
  for (const event of list) {
    if (event.ph === 'M' && event.name === 'thread_name') threadNames.set(`${event.pid}:${event.tid}`, event.args?.name ?? '');
  }
  const mark = list.find((event) => event.name === split && event.ts !== undefined);
  const splitAt = mark?.ts ?? Infinity;
  // The page's renderer is the process whose main thread holds the mark.
  const pid = mark?.pid;

  const before: Cpu = { main: 0, workers: 0 };
  const after: Cpu = { main: 0, workers: 0 };
  for (const event of list) {
    if (event.ph !== 'X' || event.name !== 'RunTask' || event.pid !== pid || event.ts === undefined) continue;
    const thread = threadNames.get(`${event.pid}:${event.tid}`) ?? '';
    const kind = thread === 'CrRendererMain' ? 'main' : thread.startsWith('DedicatedWorker') ? 'workers' : undefined;
    if (!kind) continue;
    const phase = event.ts < splitAt ? before : after;
    phase[kind] += (event.tdur ?? event.dur ?? 0) / 1000;
  }
  const round = (cpu: Cpu): Cpu => ({ main: Math.round(cpu.main), workers: Math.round(cpu.workers) });
  return { before: round(before), after: round(after) };
}
