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

// ---------------------------------------------------------------- counters
//
// Totals since the process started, for GET /internal/metrics (OBS-03):
// model calls by outcome, mails sent and failed. Never reset; Prometheus
// computes rates from them.

const counters = new Map<string, number>();

/** Adds one to `name` with these labels (a short, fixed set of values). */
export function increment(name: string, labels: Record<string, string> = {}): void {
  const key = `${name}${labelText(labels)}`;
  counters.set(key, (counters.get(key) ?? 0) + 1);
}

function labelText(labels: Record<string, string>): string {
  const entries = Object.entries(labels);
  if (!entries.length) return '';
  // A quote, a backslash or a line break would end the value early.
  return `{${entries.map(([k, v]) => `${k}="${String(v).replace(/["\\\r\n]/g, '_')}"`).join(',')}}`;
}

export interface Gauge {
  name: string;
  help: string;
  type?: 'gauge' | 'counter';
  values: Array<{ labels?: Record<string, string>; value: number }>;
}

const COUNTER_HELP: Record<string, string> = {
  supportio_assistant_calls_total: 'Calls to the AI model, by outcome',
  supportio_mail_total: 'Mails handed to the transport, by outcome',
  supportio_billing_webhook_rejected_total: 'Paddle webhooks refused for a bad signature or body'
};

/**
 * Everything in the Prometheus text format: this process, the durations
 * kept since the last reset (p50/p95 per operation), the counters, and the
 * caller's gauges (pool, sockets, backup age …).
 */
export function prometheusText(gauges: Gauge[]): string {
  const lines: string[] = [];
  const emit = (g: Gauge) => {
    lines.push(`# HELP ${g.name} ${g.help}`, `# TYPE ${g.name} ${g.type ?? 'gauge'}`);
    for (const v of g.values) lines.push(`${g.name}${labelText(v.labels ?? {})} ${v.value}`);
  };
  const memory = process.memoryUsage();
  const cpu = process.cpuUsage();
  emit({
    name: 'supportio_process_cpu_seconds_total',
    help: 'CPU time of this process',
    type: 'counter',
    values: [{ value: (cpu.user + cpu.system) / 1e6 }]
  });
  emit({
    name: 'supportio_process_resident_memory_bytes',
    help: 'Resident memory',
    values: [{ value: memory.rss }]
  });
  emit({
    name: 'supportio_heap_used_bytes',
    help: 'V8 heap in use',
    values: [{ value: memory.heapUsed }]
  });
  emit({
    name: 'supportio_event_loop_delay_seconds',
    help: 'Event-loop delay',
    values: [50, 99].map((q) => ({
      labels: { quantile: String(q / 100) },
      value: loop.percentile(q) / 1e9
    }))
  });
  const timingValues: Gauge['values'] = [];
  for (const [operation, list] of durations) {
    if (!list.length) continue;
    const p = percentiles(list);
    timingValues.push(
      { labels: { operation, quantile: '0.5' }, value: p.p50 / 1000 },
      { labels: { operation, quantile: '0.95' }, value: p.p95 / 1000 }
    );
  }
  emit({
    name: 'supportio_operation_seconds',
    help: 'Recent durations of chosen operations (message.insert …)',
    values: timingValues
  });
  const byName = new Map<string, Gauge['values']>();
  for (const [key, value] of counters) {
    const name = key.split('{')[0];
    const labels = key.includes('{')
      ? Object.fromEntries(
          key
            .slice(key.indexOf('{') + 1, -1)
            .split(',')
            .map((pair) => pair.split('=').map((s) => s.replace(/"/g, '')) as [string, string])
        )
      : {};
    if (!byName.has(name)) byName.set(name, []);
    byName.get(name)!.push({ labels, value });
  }
  for (const [name, values] of byName) {
    emit({ name, help: COUNTER_HELP[name] ?? name, type: 'counter', values });
  }
  for (const g of gauges) emit(g);
  return `${lines.join('\n')}\n`;
}
