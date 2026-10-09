/**
 * Raporlar (plan v10 PRD-22): dosya olarak indirme, saat×gün yoğunluk
 * haritası, SLA ihlalleri listesi ve temsilci karşılaştırma tablosu.
 *
 * Saat ve gün, görüntüleyenin tarayıcısındaki saat dilimine göre sayılır
 * (KARAR-UX-1). İndirme, planda dışa aktarma yoksa sunucuya hiç sorulmaz;
 * yükseltme penceresi açılır.
 */
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Download, Lock } from 'lucide-react';
import { analyticsAPI } from '../../services/api';
import type { SlaBreach } from '../../services/api';
import { PLAN_REQUIRED_EVENT } from '../../services/http';
import { useAuth } from '../../contexts/AuthContext';
import { usePlans } from '../../hooks/usePlans';
import { formatMinutes } from '../../lib/format';
import { errorMessage } from '../../hooks/useAsync';

const card = 'bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700';
const viewerZone = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Istanbul';
  } catch {
    return 'Europe/Istanbul';
  }
};

/* ---------------------------------------------------------------- export */

export const ExportMenu = ({ range }: { range: string }) => {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const { plans } = usePlans();
  const [report, setReport] = useState<'conversations' | 'agents' | 'sla'>('conversations');
  const [busy, setBusy] = useState<string | null>(null);
  const current = plans?.find((p) => p.type === (user?.organization?.planType || 'FREE'));
  const locked = current ? !current.features.includes('export') : false;

  const download = async (format: 'csv' | 'xlsx') => {
    if (locked) {
      window.dispatchEvent(
        new CustomEvent(PLAN_REQUIRED_EVENT, {
          detail: { code: 'PLAN_UPGRADE_REQUIRED', details: null }
        })
      );
      return;
    }
    setBusy(format);
    try {
      const res = await analyticsAPI.exportReport({
        report,
        format,
        range,
        tz: viewerZone(),
        lang: i18n.language === 'en' ? 'en' : 'tr'
      });
      const name =
        /filename="([^"]+)"/.exec(String(res.headers['content-disposition'] || ''))?.[1] ||
        `support-io-${report}.${format}`;
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      toast.error(errorMessage(error, t('reports.export.error')));
    } finally {
      setBusy(null);
    }
  };

  const button =
    'inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-sm font-medium text-gray-800 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50';
  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        aria-label={t('reports.export.which')}
        value={report}
        onChange={(e) => setReport(e.target.value as typeof report)}
        className="px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white"
      >
        <option value="conversations">{t('reports.export.conversations')}</option>
        <option value="agents">{t('reports.export.agents')}</option>
        <option value="sla">{t('reports.export.sla')}</option>
      </select>
      {(['csv', 'xlsx'] as const).map((format) => (
        <button
          key={format}
          type="button"
          onClick={() => void download(format)}
          disabled={busy !== null}
          className={button}
        >
          {locked ? (
            <Lock className="w-4 h-4" aria-hidden="true" />
          ) : (
            <Download className="w-4 h-4" aria-hidden="true" />
          )}
          {t(`reports.export.${format}`)}
        </button>
      ))}
    </div>
  );
};

/* --------------------------------------------------------------- heatmap */

export const WeekHeatmap = ({ range }: { range: string }) => {
  const { t } = useTranslation();
  const [grid, setGrid] = useState<number[][] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let live = true;
    setFailed(false);
    analyticsAPI
      .heatmap(range, viewerZone())
      .then(({ data }) => live && setGrid(data.grid))
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, [range]);

  const max = useMemo(() => Math.max(1, ...(grid ?? []).flat()), [grid]);
  const days = t('reports.heatmap.days', { returnObjects: true }) as string[];
  const total = (grid ?? []).flat().reduce((a, b) => a + b, 0);

  return (
    <section className={`${card} p-6 mb-6`} aria-labelledby="heatmap-title">
      <h3 id="heatmap-title" className="text-lg font-bold text-gray-900 dark:text-white">
        {t('reports.heatmap.title')}
      </h3>
      <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">{t('reports.heatmap.hint')}</p>
      {failed ? (
        <p className="mt-6 text-sm text-gray-600 dark:text-gray-400">{t('stats.noData')}</p>
      ) : !grid ? null : total === 0 ? (
        <p className="mt-6 text-sm text-gray-600 dark:text-gray-400">{t('stats.noData')}</p>
      ) : (
        <div className="mt-5 overflow-x-auto">
          <table className="border-separate border-spacing-[3px] text-[11px]">
            <caption className="sr-only">{t('reports.heatmap.title')}</caption>
            <thead>
              <tr>
                <th scope="col" className="sr-only">
                  {t('reports.heatmap.day')}
                </th>
                {Array.from({ length: 24 }, (_, h) => (
                  <th
                    key={h}
                    scope="col"
                    className="font-normal text-gray-500 dark:text-gray-400 w-6"
                  >
                    {h % 3 === 0 ? String(h).padStart(2, '0') : ''}
                    <span className="sr-only">{h % 3 === 0 ? '' : `${h}:00`}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {grid.map((row, d) => (
                <tr key={d}>
                  <th
                    scope="row"
                    className="pr-2 text-left font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap"
                  >
                    {days[d]}
                  </th>
                  {row.map((n, h) => {
                    const strength = n === 0 ? 0 : 0.15 + 0.85 * (n / max);
                    const label = t('reports.heatmap.cell', {
                      day: days[d],
                      hour: `${String(h).padStart(2, '0')}:00`,
                      count: n
                    });
                    return (
                      <td
                        key={h}
                        title={label}
                        className="w-6 h-6 rounded bg-gray-100 dark:bg-gray-700/60"
                        style={
                          n > 0
                            ? { backgroundColor: `rgba(79, 70, 229, ${strength.toFixed(2)})` }
                            : undefined
                        }
                      >
                        <span className="sr-only">{label}</span>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
};

/* ----------------------------------------------------------- SLA list */

export const SlaBreachList = ({ range }: { range: string }) => {
  const { t, i18n } = useTranslation();
  const [rows, setRows] = useState<SlaBreach[] | null>(null);

  useEffect(() => {
    let live = true;
    analyticsAPI
      .slaBreaches(range)
      .then(({ data }) => live && setRows(data.breaches))
      .catch(() => live && setRows([]));
    return () => {
      live = false;
    };
  }, [range]);

  const prefix = i18n.language === 'en' ? '/en' : '';
  return (
    <section className={`${card} mb-6`} aria-labelledby="sla-list-title">
      <div className="p-6 border-b border-gray-200 dark:border-gray-700">
        <h3 id="sla-list-title" className="text-lg font-bold text-gray-900 dark:text-white">
          {t('reports.sla.title')}
        </h3>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">{t('reports.sla.hint')}</p>
      </div>
      {rows && rows.length === 0 ? (
        <p className="p-6 text-sm text-gray-600 dark:text-gray-400">{t('reports.sla.none')}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-900/50 text-xs uppercase text-gray-600 dark:text-gray-400">
              <tr>
                <th scope="col" className="px-6 py-3 text-left font-medium">
                  {t('reports.sla.ticket')}
                </th>
                <th scope="col" className="px-6 py-3 text-left font-medium">
                  {t('reports.sla.started')}
                </th>
                <th scope="col" className="px-6 py-3 text-left font-medium">
                  {t('reports.sla.waited')}
                </th>
                <th scope="col" className="px-6 py-3 text-left font-medium">
                  {t('reports.sla.agent')}
                </th>
                <th scope="col" className="px-6 py-3 text-left font-medium">
                  {t('reports.sla.department')}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {(rows ?? []).map((r) => (
                <tr key={r.id}>
                  <td className="px-6 py-3">
                    <Link
                      to={`${prefix}/dashboard/conversations?conversation=${r.id}`}
                      className="font-medium text-indigo-700 dark:text-indigo-300 hover:underline"
                    >
                      {r.ticketId || r.id.slice(-6)}
                    </Link>
                    <span className="ml-2 text-gray-500 dark:text-gray-400">{r.site}</span>
                  </td>
                  <td className="px-6 py-3 text-gray-700 dark:text-gray-300">
                    {new Date(r.createdAt).toLocaleString(
                      i18n.language === 'en' ? 'en-GB' : 'tr-TR',
                      {
                        dateStyle: 'short',
                        timeStyle: 'short'
                      }
                    )}
                  </td>
                  <td className="px-6 py-3 font-medium text-red-700 dark:text-red-400">
                    {formatMinutes(r.waitedMinutes)}
                  </td>
                  <td className="px-6 py-3 text-gray-700 dark:text-gray-300">{r.agent || '—'}</td>
                  <td className="px-6 py-3 text-gray-700 dark:text-gray-300">
                    {r.department || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
};

/* ------------------------------------------------------ agent comparison */

interface AgentRow {
  name: string;
  total: number;
  active: number;
  resolved: number;
  sla: number | null;
  avgTime: number | null;
  rating: number | null;
}

export const AgentTable = ({ agents }: { agents: AgentRow[] }) => {
  const { t } = useTranslation();
  const [sortBy, setSortBy] = useState<keyof AgentRow>('resolved');
  const sorted = useMemo(
    () =>
      [...agents].sort((a, b) => {
        const x = a[sortBy];
        const y = b[sortBy];
        if (typeof x === 'string' || typeof y === 'string')
          return String(x).localeCompare(String(y));
        // Faster first response is better; for everything else more is better.
        if (sortBy === 'avgTime') return (x ?? Infinity) - (y ?? Infinity);
        return (y ?? -1) - (x ?? -1);
      }),
    [agents, sortBy]
  );
  if (agents.length === 0) return null;
  const columns: Array<[keyof AgentRow, string]> = [
    ['name', t('reports.agents.name')],
    ['total', t('reports.agents.total')],
    ['resolved', t('reports.agents.resolved')],
    ['sla', t('reports.agents.sla')],
    ['avgTime', t('reports.agents.firstResponse')],
    ['rating', t('reports.agents.rating')]
  ];
  return (
    <div className="mt-6 overflow-x-auto">
      <table className="w-full text-sm">
        <caption className="sr-only">{t('reports.agents.caption')}</caption>
        <thead className="bg-gray-50 dark:bg-gray-900/50 text-xs uppercase text-gray-600 dark:text-gray-400">
          <tr>
            {columns.map(([key, label]) => (
              <th
                key={key}
                scope="col"
                aria-sort={sortBy === key ? 'descending' : 'none'}
                className="px-4 py-3 text-left font-medium"
              >
                <button
                  type="button"
                  onClick={() => setSortBy(key)}
                  className="uppercase hover:text-gray-900 dark:hover:text-white"
                >
                  {label}
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
          {sorted.map((a) => (
            <tr key={a.name}>
              <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{a.name}</td>
              <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{a.total}</td>
              <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{a.resolved}</td>
              <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                {a.sla === null ? '—' : `%${a.sla}`}
              </td>
              <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                {formatMinutes(a.avgTime)}
              </td>
              <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                {a.rating === null ? '—' : `${a.rating} / 5`}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
