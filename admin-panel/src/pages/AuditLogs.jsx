import React, { useEffect, useState } from 'react';
import { auditAPI } from '../services/api';
import { format } from 'date-fns';
import { useTranslation } from 'react-i18next';
import {
  ShieldCheck, ShieldAlert, UserPlus, UserMinus,
  UserCog, CreditCard, Settings, Ticket,
  RefreshCcw, AlertCircle, ChevronDown, ChevronUp, Copy,
  Search, Calendar, Filter, Activity, Check,
  TerminalSquare
} from 'lucide-react';
import { toast } from 'react-hot-toast';

const prettyJSON = (obj) => {
  try {
    return JSON.stringify(obj, null, 2);
  } catch (e) {
    return String(obj);
  }
};

const ACTIONS = [
  '', 'LOGIN_SUCCESS', 'LOGIN_FAILED', 'CREATE_AGENT', 'DELETE_AGENT', 'UPDATE_AGENT_ROLE', 'PLAN_CHANGED', 'UPDATE_SLA', 'TICKET_CLOSED', 'TICKET_REOPENED', 'SLA_BREACH'
];

const getActionConfig = (action) => {
  switch (action) {
    case 'LOGIN_SUCCESS': return { icon: ShieldCheck, color: 'text-green-600 bg-green-50 dark:text-green-400 dark:bg-green-500/10 border-green-200 dark:border-green-500/20' };
    case 'LOGIN_FAILED': return { icon: ShieldAlert, color: 'text-red-600 bg-red-50 dark:text-red-400 dark:bg-red-500/10 border-red-200 dark:border-red-500/20' };
    case 'CREATE_AGENT': return { icon: UserPlus, color: 'text-blue-600 bg-blue-50 dark:text-blue-400 dark:bg-blue-500/10 border-blue-200 dark:border-blue-500/20' };
    case 'DELETE_AGENT': return { icon: UserMinus, color: 'text-rose-600 bg-rose-50 dark:text-rose-400 dark:bg-rose-500/10 border-rose-200 dark:border-rose-500/20' };
    case 'UPDATE_AGENT_ROLE': return { icon: UserCog, color: 'text-purple-600 bg-purple-50 dark:text-purple-400 dark:bg-purple-500/10 border-purple-200 dark:border-purple-500/20' };
    case 'PLAN_CHANGED': return { icon: CreditCard, color: 'text-amber-600 bg-amber-50 dark:text-amber-400 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/20' };
    case 'UPDATE_SLA': return { icon: Settings, color: 'text-slate-600 bg-slate-50 dark:text-slate-400 dark:bg-slate-500/10 border-slate-200 dark:border-slate-500/20' };
    case 'TICKET_CLOSED': return { icon: Ticket, color: 'text-indigo-600 bg-indigo-50 dark:text-indigo-400 dark:bg-indigo-500/10 border-indigo-200 dark:border-indigo-500/20' };
    case 'TICKET_REOPENED': return { icon: RefreshCcw, color: 'text-teal-600 bg-teal-50 dark:text-teal-400 dark:bg-teal-500/10 border-teal-200 dark:border-teal-500/20' };
    case 'SLA_BREACH': return { icon: AlertCircle, color: 'text-orange-600 bg-orange-50 dark:text-orange-400 dark:bg-orange-500/10 border-orange-200 dark:border-orange-500/20' };
    default: return { icon: Activity, color: 'text-gray-600 bg-gray-50 dark:text-gray-400 dark:bg-gray-500/10 border-gray-200 dark:border-gray-500/20' };
  }
};

export default function AuditLogs() {
  const { t } = useTranslation();
  const [filters, setFilters] = useState({ action: '', start: '', end: '' });
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [total, setTotal] = useState(0);
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState({});
  const [copiedId, setCopiedId] = useState(null);

  const fetchLogs = async (opts = {}) => {
    setLoading(true);
    try {
      const params = {
        action: filters.action || undefined,
        start: filters.start || undefined,
        end: filters.end || undefined,
        page: opts.page || page,
        limit: opts.limit || limit
      };
      const res = await auditAPI.getAll(params);
      setTotal(res.data.total || 0);
      setDocs(res.data.docs || []);
      setPage(res.data.page || 1);
      setLimit(res.data.limit || 25);
    } catch (e) {
      setDocs([]);
      setTotal(0);
      toast.error(t('audit.fetchError', 'Gelişmiş analitik verileri alınırken bir hata oluştu'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs({ page: 1 });
  }, []);

  const handleSearch = (e) => {
    e.preventDefault();
    fetchLogs({ page: 1 });
  };

  const toggleExpand = (id) => {
    setExpanded(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const copyToClipboard = async (id, text) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
      toast.success(t('audit.copy') + ' Başarılı');
    } catch (e) {
      toast.error(t('audit.copyFailed', 'Kopyalama başarısız'));
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-gray-900 dark:text-white flex items-center gap-3">
            <TerminalSquare className="w-8 h-8 text-indigo-600 dark:text-indigo-400" />
            {t('audit.title') || 'İşlem Kayıtları'}
          </h2>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            {t('audit.subtitle') || 'Sistem içindeki tüm kritik işlemleri İzleyin'}
          </p>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden mb-8 transition-colors duration-200">
        <div className="p-4 sm:p-5 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
          <form className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-5 gap-4 items-end" onSubmit={handleSearch}>
            <div className="lg:col-span-2">
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5 uppercase tracking-wider flex items-center gap-1.5">
                <Filter className="w-3.5 h-3.5" /> {t('audit.action')}
              </label>
              <div className="relative">
                <select
                  value={filters.action}
                  onChange={(e) => setFilters({ ...filters, action: e.target.value })}
                  className="w-full pl-3 pr-10 py-2.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white appearance-none transition-colors duration-200"
                >
                  <option value="">{t('audit.actions.all', 'Tümü (All)')}</option>
                  {ACTIONS.filter(a => a).map(a => (
                    <option key={a} value={a}>{t('audit.actions.' + a) || a}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5 uppercase tracking-wider flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5" /> {t('audit.startDate', 'Başlangıç / Start')}
              </label>
              <input
                type="date"
                value={filters.start}
                onChange={(e) => setFilters({ ...filters, start: e.target.value })}
                className="w-full px-3 py-2.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-colors duration-200 [color-scheme:light] dark:[color-scheme:dark]"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5 uppercase tracking-wider flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5" /> {t('audit.endDate', 'Bitiş / End')}
              </label>
              <input
                type="date"
                value={filters.end}
                onChange={(e) => setFilters({ ...filters, end: e.target.value })}
                className="w-full px-3 py-2.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-colors duration-200 [color-scheme:light] dark:[color-scheme:dark]"
              />
            </div>

            <div className="flex items-center gap-2">
              <button
                type="submit"
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors shadow-sm"
              >
                <Search className="w-4 h-4" /> {t('audit.filterBtn', 'Filtrele')}
              </button>
              <button
                type="button"
                className="flex items-center justify-center px-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 text-sm font-medium rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors"
                onClick={() => { setFilters({ action: '', start: '', end: '' }); setPage(1); fetchLogs({ page: 1, action: '', start: '', end: '' }); }}
              >
                {t('audit.resetBtn', 'Sıfırla')}
              </button>
            </div>
          </form>
        </div>

        <div className="overflow-x-auto min-h-[400px]">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50/50 dark:bg-gray-800/50 backdrop-blur-sm shadow-sm sticky top-0 z-10">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider w-40">{t('audit.time')}</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('audit.action')}</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider hidden sm:table-cell">{t('audit.entity')}</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider hidden md:table-cell">{t('audit.user')} & {t('audit.ip')}</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider w-1/3">{t('audit.metadata')}</th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
                    <RefreshCcw className="w-8 h-8 animate-spin mx-auto text-indigo-500 mb-3" />
                    <p>{t('audit.loadingLogs', 'Loglar yükleniyor...')}</p>
                  </td>
                </tr>
              ) : docs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
                    <Activity className="w-10 h-10 mx-auto text-gray-300 dark:text-gray-600 mb-3" />
                    <p className="text-sm font-medium">{t('audit.noRecords')}</p>
                  </td>
                </tr>
              ) : (
                docs.map((d) => {
                  const conf = getActionConfig(d.action);
                  const Icon = conf.icon;
                  const isExpanded = expanded[d._id];

                  return (
                    <tr key={d._id} className="hover:bg-gray-50/50 dark:hover:bg-gray-700/50 transition-colors group">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {d.createdAt ? (
                          <>
                            <span className="block font-medium text-gray-900 dark:text-white">{format(new Date(d.createdAt), 'dd MMM yyyy')}</span>
                            <span className="block text-xs">{format(new Date(d.createdAt), 'HH:mm:ss')}</span>
                          </>
                        ) : '-'}
                      </td>
                      <td className="px-6 py-4">
                        <div className={`inline-flex items-center gap-2 px-2.5 py-1.5 rounded-md border ${conf.color}`}>
                          <Icon className="w-4 h-4 shrink-0" />
                          <span className="text-xs font-semibold whitespace-nowrap">
                            {t('audit.actions.' + d.action) || d.action}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300 hidden sm:table-cell">
                        <div className="flex flex-col">
                          <span className="font-medium">{d.entityType || '-'}</span>
                          <span className="text-xs text-gray-400 dark:text-gray-500 break-words max-w-[150px] truncate" title={d.entityId}>{d.entityId || '-'}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300 hidden md:table-cell">
                        <div className="flex flex-col">
                          <span className="font-medium truncate max-w-[150px]" title={d.userId}>{d.userId || 'System'}</span>
                          <span className="text-xs text-gray-400 dark:text-gray-500">{d.ipAddress || '-'}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm w-1/3 max-w-sm">
                        {Object.keys(d.metadata || {}).length > 0 ? (
                          <div className="bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-100 dark:border-gray-700 overflow-hidden">
                            <button
                              onClick={() => toggleExpand(d._id)}
                              className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors focus:outline-none"
                            >
                              <span className="flex items-center gap-1.5">
                                {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                                {isExpanded ? t('audit.collapse', 'Daralt') : t('audit.expand', 'Genişlet')}
                              </span>
                              <span className="text-gray-400 font-normal">
                                {Object.keys(d.metadata).length} {t('audit.fields', 'Alan')}
                              </span>
                            </button>

                            {isExpanded && (
                              <div className="px-3 pb-3 pt-1 relative group/code">
                                <pre className="text-[11px] leading-relaxed text-indigo-700 dark:text-indigo-300 font-mono whitespace-pre-wrap overflow-x-auto break-all">
                                  {prettyJSON(d.metadata)}
                                </pre>
                                <button
                                  onClick={(e) => { e.stopPropagation(); copyToClipboard(d._id, prettyJSON(d.metadata)); }}
                                  className="absolute top-1 right-2 p-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-md text-gray-500 hover:text-indigo-600 dark:hover:text-indigo-400 shadow-sm opacity-0 group-hover/code:opacity-100 transition-opacity"
                                  title={t('audit.copy')}
                                >
                                  {copiedId === d._id ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                                </button>
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-gray-400 dark:text-gray-500 italic text-xs">{t('audit.noDetails', 'Detay yok')}</span>
                        )}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 flex flex-col sm:flex-row items-center justify-between gap-4 transition-colors duration-200">
          <div className="text-sm text-gray-500 dark:text-gray-400 font-medium">
            {t('audit.total', 'Toplam')}: <span className="text-gray-900 dark:text-white">{total}</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              className="px-3 py-1.5 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
              disabled={page <= 1}
              onClick={() => { const np = Math.max(1, page - 1); setPage(np); fetchLogs({ page: np }); }}
            >
              {t('audit.previous', 'Önceki')}
            </button>
            <span className="px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300">
              {t('audit.page', 'Sayfa')} {page}
            </span>
            <button
              className="px-3 py-1.5 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
              disabled={(page * limit) >= total}
              onClick={() => { const np = page + 1; setPage(np); fetchLogs({ page: np }); }}
            >
              {t('audit.next', 'Sonraki')}
            </button>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-500 dark:text-gray-400 font-medium">{t('audit.show', 'Göster')}:</label>
            <select
              value={limit}
              onChange={(e) => { const v = parseInt(e.target.value, 10); setLimit(v); setPage(1); fetchLogs({ page: 1, limit: v }); }}
              className="pl-3 pr-8 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors shadow-sm"
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  );
}

