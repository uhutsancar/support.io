// GET /internal/metrics (plan v10 OBS-03): the process, the database pool,
// the sockets, the assistant, mail and the last backup, in the Prometheus
// text format — for a scraper on the Docker network (Grafana Alloy, or a
// curl from scripts/watchdog.sh).
//
// Never public. Caddy answers /internal/* with 404 before it proxies
// anything (Caddyfile.prod); here, a request that came through a proxy
// (X-Forwarded-For) or from outside the private ranges gets the same 404,
// and METRICS_TOKEN, when set, must be sent as a bearer token.
// /api/dev/metrics (load tests) stays development-only.

import express from 'express';
import fs from 'fs';
import { getPool } from '../db/pool';
import { prometheusText } from '../config/metrics';
import { currentModelState, platformBlock } from '../services/assistant/availability';
import { assistantConfig } from '../config/assistant';
import type { Gauge } from '../config/metrics';
import type { Request, Response } from 'express';
import type { Server } from 'socket.io';

const PRIVATE = [
  /^127\./,
  /^10\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^::1$/,
  /^f[cd][0-9a-f]{2}:/i
];

function fromInside(req: Request): boolean {
  if (req.headers['x-forwarded-for']) return false;
  const address = String(req.socket.remoteAddress || '').replace(/^::ffff:/, '');
  return PRIVATE.some((rx) => rx.test(address));
}

function tokenOk(req: Request): boolean {
  const token = (process.env.METRICS_TOKEN || '').trim();
  if (!token) return true;
  return (req.get('authorization') || '') === `Bearer ${token}`;
}

/** Seconds since the backup script's last success, from the file it writes. */
function backupTimestamp(): number | null {
  const file = process.env.BACKUP_STATUS_FILE;
  if (!file) return null;
  try {
    const value = Number(fs.readFileSync(file, 'utf8').trim());
    return Number.isFinite(value) && value > 0 ? value : null;
  } catch {
    return null;
  }
}

const MODEL_STATES = ['unchecked', 'ok', 'missing', 'key_invalid', 'preview', 'unreachable'];

export function internalMetricsRoutes(io: Server) {
  const router = express.Router();
  router.get('/internal/metrics', (req: Request, res: Response) => {
    if (!fromInside(req) || !tokenOk(req)) {
      res.status(404).type('text/plain').send('Not found');
      return;
    }
    const pool = getPool() as unknown as {
      totalCount: number;
      idleCount: number;
      waitingCount: number;
      options?: { max?: number };
    };
    const state = currentModelState();
    const gauges: Gauge[] = [
      { name: 'supportio_up', help: 'The API process answers', values: [{ value: 1 }] },
      {
        name: 'supportio_uptime_seconds',
        help: 'Seconds since this process started',
        values: [{ value: Math.round(process.uptime()) }]
      },
      {
        name: 'supportio_db_pool_connections',
        help: 'PostgreSQL pool connections',
        values: [
          { labels: { state: 'total' }, value: pool.totalCount },
          { labels: { state: 'idle' }, value: pool.idleCount },
          { labels: { state: 'waiting' }, value: pool.waitingCount },
          { labels: { state: 'max' }, value: pool.options?.max ?? 0 }
        ]
      },
      {
        name: 'supportio_sockets',
        help: 'Open sockets in this process',
        values: [
          { labels: { namespace: 'widget' }, value: io.of('/widget').sockets.size },
          { labels: { namespace: 'admin' }, value: io.of('/admin').sockets.size }
        ]
      },
      {
        name: 'supportio_assistant_available',
        help: '1 when the assistant can answer (configured, model ok, not killed)',
        values: [{ value: assistantConfig() && !platformBlock() ? 1 : 0 }]
      },
      {
        name: 'supportio_assistant_model_state',
        help: 'The last model check (1 on the current state)',
        values: MODEL_STATES.map((s) => ({ labels: { state: s }, value: s === state ? 1 : 0 }))
      }
    ];
    const backup = backupTimestamp();
    if (backup !== null) {
      gauges.push({
        name: 'supportio_backup_last_success_timestamp_seconds',
        help: 'When scripts/backup-postgres.sh last succeeded',
        values: [{ value: backup }]
      });
    }
    res
      .status(200)
      .set('Cache-Control', 'no-store')
      .type('text/plain; version=0.0.4')
      .send(prometheusText(gauges));
  });
  return router;
}
