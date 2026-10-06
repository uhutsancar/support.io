// Process measurements for load tests (plan §18): event-loop delay, CPU and
// memory of this process, and how long chosen operations take.
//
// Read through GET /api/dev/metrics, which exists only outside production
// (server.ts); scripts/loadtest.ts resets it before a stage and reads it
// after. The cost while nobody reads it is one histogram the runtime fills
// and a bounded list of recent durations per operation.

import { monitorEventLoopDelay } from 'perf_hooks';

const KEEP = 5000;

const loop = monitorEventLoopDelay({ resolution: 10 });
loop.enable();

const durations = new Map<string, number[]>();
let since = { at: process.hrtime.bigint(), cpu: process.cpuUsage() };

/** Records one duration of `name`, in milliseconds. */
export function recordTiming(name: string, ms: number): void {
  let list = durations.get(name);
  if (!list) durations.set(name, (list = []));
  list.push(ms);
  if (list.length > KEEP) list.splice(0, list.length - KEEP);
}

/** Runs `fn` and records how long it took under `name`. */
export async function timed<T>(name: string, fn: () => Promise<T>): Promise<T> {
  const started = process.hrtime.bigint();
  try {
    return await fn();
  } finally {
    recordTiming(name, Number(process.hrtime.bigint() - started) / 1e6);
  }
}

const round = (n: number) => Math.round(n * 10) / 10;

function percentiles(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  const at = (p: number) =>
    sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))];
  return {
    n: sorted.length,
    p50: round(at(50)),
    p95: round(at(95)),
    p99: round(at(99)),
    max: round(sorted[sorted.length - 1])
  };
}

/** Everything measured since the last reset. */
export function metricsSnapshot() {
  const wallMs = Number(process.hrtime.bigint() - since.at) / 1e6;
  const cpu = process.cpuUsage(since.cpu);
  const memory = process.memoryUsage();
  const ns = (v: number) => round(v / 1e6);
  return {
    windowMs: Math.round(wallMs),
    // Share of one core this process used over the window.
    cpuPercent: wallMs > 0 ? round(((cpu.user + cpu.system) / 1000 / wallMs) * 100) : 0,
    rssMb: round(memory.rss / 1024 / 1024),
    heapUsedMb: round(memory.heapUsed / 1024 / 1024),
    eventLoopDelayMs: {
      p50: ns(loop.percentile(50)),
      p99: ns(loop.percentile(99)),
      max: ns(loop.max)
    },
    timings: Object.fromEntries(
      [...durations].filter(([, v]) => v.length).map(([k, v]) => [k, percentiles(v)])
    )
  };
}

export function resetMetrics(): void {
  loop.reset();
  durations.clear();
  since = { at: process.hrtime.bigint(), cpu: process.cpuUsage() };
}
