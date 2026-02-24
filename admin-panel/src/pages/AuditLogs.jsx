import React, { useEffect, useState } from 'react';
import { auditAPI } from '../services/api';
import { format } from 'date-fns';
import { useTranslation } from 'react-i18next';

// Helper to pretty-print JSON safely
const prettyJSON = (obj) => {
  try {
    return JSON.stringify(obj, null, 2);
  } catch (e) {
    return String(obj);
  }
};

  const ACTIONS = [
    '', 'LOGIN_SUCCESS','LOGIN_FAILED','CREATE_AGENT','DELETE_AGENT','UPDATE_AGENT_ROLE','PLAN_CHANGED','UPDATE_SLA','TICKET_CLOSED','TICKET_REOPENED','SLA_BREACH'
  ];

export default function AuditLogs() {
  const { t } = useTranslation();
  const [filters, setFilters] = useState({ action: '', start: '', end: '' });
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [total, setTotal] = useState(0);
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState({});

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
      console.error('Failed to load audit logs', e);
      setDocs([]);
      setTotal(0);
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

  const copyToClipboard = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch (e) {
      console.error('Copy failed', e);
    }
  };

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-semibold">{t('sidebar.auditLogs')}</h2>
      </div>

      <form className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4" onSubmit={handleSearch}>
        <div>
          <label className="block text-sm text-gray-600 mb-1">Action</label>
          <select value={filters.action} onChange={(e) => setFilters({ ...filters, action: e.target.value })} className="w-full border rounded-md px-3 py-2 bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-sm">
            {ACTIONS.map(a => <option key={a} value={a}>{a || 'All'}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-sm text-gray-600 mb-1">Start date</label>
          <input type="date" value={filters.start} onChange={(e) => setFilters({ ...filters, start: e.target.value })} className="w-full border rounded-md px-3 py-2 bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-sm" />
        </div>

        <div>
          <label className="block text-sm text-gray-600 mb-1">End date</label>
          <input type="date" value={filters.end} onChange={(e) => setFilters({ ...filters, end: e.target.value })} className="w-full border rounded-md px-3 py-2 bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-sm" />
        </div>

        <div className="flex items-end space-x-2">
          <button type="submit" className="inline-flex items-center px-3 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700">Filter</button>
          <button type="button" className="inline-flex items-center px-3 py-2 bg-white border border-gray-200 rounded-md text-gray-700 hover:bg-gray-50" onClick={() => { setFilters({ action: '', start: '', end: '' }); setPage(1); fetchLogs({ page:1 }); }}>Reset</button>
        </div>
      </form>

      <div className="bg-white dark:bg-gray-800 shadow overflow-hidden sm:rounded-lg">
        <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
          <div className="text-sm text-gray-600">Total: {total}</div>
          <div className="text-sm text-gray-600">Page {page} • Limit {limit}</div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-900">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">{t('audit.time') || 'Time'}</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">{t('audit.action') || 'Action'}</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">{t('audit.entity') || 'Entity'}</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">{t('audit.entityId') || 'Entity ID'}</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">{t('audit.user') || 'User'}</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">{t('audit.ip') || 'IP'}</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">{t('audit.metadata') || 'Metadata'}</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200 dark:bg-gray-800 dark:divide-gray-700">
              {loading ? (
                <tr><td colSpan={7} className="p-6 text-center">Loading...</td></tr>
              ) : docs.length === 0 ? (
                <tr><td colSpan={7} className="p-6 text-center">{t('audit.noRecords') || 'No records'}</td></tr>
              ) : docs.map(d => (
                <tr key={d._id}>
                  <td className="px-4 py-2 text-sm text-gray-600">{d.createdAt ? format(new Date(d.createdAt), 'yyyy-MM-dd HH:mm') : '-'}</td>
                  <td className="px-4 py-2 text-sm">{d.action}</td>
                  <td className="px-4 py-2 text-sm">{d.entityType || '-'}</td>
                  <td className="px-4 py-2 text-sm break-words max-w-xs">{d.entityId || '-'}</td>
                  <td className="px-4 py-2 text-sm">{d.userId || '-'}</td>
                  <td className="px-4 py-2 text-sm">{d.ipAddress || '-'}</td>
                  <td className="px-4 py-2 text-sm truncate max-w-xl">
                    {d.metadata ? (
                      <div className="space-y-1">
                        <div className="flex items-center space-x-2">
                          <button onClick={() => toggleExpand(d._id)} className="text-xs text-indigo-600 hover:underline">{expanded[d._id] ? (t('audit.collapse')||'Collapse') : (t('audit.expand')||'Expand')}</button>
                          <button onClick={() => copyToClipboard(prettyJSON(d.metadata))} className="text-xs text-gray-600 hover:underline">{t('audit.copy')||'Copy'}</button>
                        </div>
                        {expanded[d._id] ? (
                          <pre className="bg-gray-50 dark:bg-gray-900 p-2 rounded text-xs overflow-auto max-h-48">{prettyJSON(d.metadata)}</pre>
                        ) : (
                          <div className="text-xs text-gray-500 truncate max-w-xl">{JSON.stringify(d.metadata)}</div>
                        )}
                      </div>
                    ) : ('-')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="px-4 py-3 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <button className="inline-flex items-center px-3 py-2 bg-white border border-gray-200 rounded-md text-gray-700 hover:bg-gray-50 disabled:opacity-50" disabled={page <= 1} onClick={() => { const np = Math.max(1, page-1); setPage(np); fetchLogs({ page: np }); }}>Prev</button>
            <button className="inline-flex items-center px-3 py-2 bg-white border border-gray-200 rounded-md text-gray-700 hover:bg-gray-50 disabled:opacity-50" disabled={(page*limit) >= total} onClick={() => { const np = page+1; setPage(np); fetchLogs({ page: np }); }}>Next</button>
          </div>
          <div>
            <label className="text-sm text-gray-600 mr-2">Limit</label>
            <select value={limit} onChange={(e) => { const v = parseInt(e.target.value,10); setLimit(v); setPage(1); fetchLogs({ page:1, limit: v }); }} className="border rounded-md px-2 py-1 bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-sm">
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
