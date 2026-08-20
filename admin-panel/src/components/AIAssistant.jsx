import React, { useState, useEffect, useCallback } from 'react';
import {
  Sparkles,
  Loader2,
  RefreshCw,
  Check,
  X,
  Pencil,
  AlertCircle,
  FileText,
  Gauge
} from 'lucide-react';
import { aiAPI } from '../services/api';

// AI copilot panel for a single conversation.
//
// Everything here is a suggestion. Nothing this component produces reaches the
// customer on its own: a draft is handed to the agent through `onAccept`, which
// drops it into the message box for them to read, edit and send. The four
// controls the product needs — accept, edit, regenerate, reject — are the whole
// interaction model.
const AIAssistant = ({ conversation, onAccept, disabled }) => {
  const [available, setAvailable] = useState(null); // null = not yet known
  const [task, setTask] = useState(null);           // which task is running
  const [error, setError] = useState(null);
  const [summary, setSummary] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [draft, setDraft] = useState(null);
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState('');

  // Asked once per mount: if no provider is configured the controls are hidden
  // rather than offered and then failing.
  useEffect(() => {
    let cancelled = false;
    aiAPI.status()
      .then(({ data }) => { if (!cancelled) setAvailable(Boolean(data.enabled)); })
      .catch(() => { if (!cancelled) setAvailable(false); });
    return () => { cancelled = true; };
  }, []);

  // Suggestions belong to the conversation they were generated from; switching
  // threads must not leave the previous one's draft on screen.
  useEffect(() => {
    setSummary(null);
    setAnalysis(null);
    setDraft(null);
    setEditing(false);
    setError(null);
  }, [conversation?._id]);

  const run = useCallback(async (name, fn) => {
    setTask(name);
    setError(null);
    try {
      return await fn();
    } catch (err) {
      const body = err.response?.data;
      setError(body?.error || 'AI isteği başarısız oldu.');
      return null;
    } finally {
      setTask(null);
    }
  }, []);

  const handleSummarize = () => run('summary', async () => {
    const { data } = await aiAPI.summarize(conversation._id);
    setSummary(data.summary);
  });

  const handleAnalyze = () => run('analyze', async () => {
    const { data } = await aiAPI.analyze(conversation._id);
    setAnalysis(data.analysis);
  });

  const handleSuggest = () => run('suggest', async () => {
    const { data } = await aiAPI.suggestReply(conversation._id);
    setDraft(data.reply);
    setEditing(false);
  });

  const handleAccept = () => {
    const text = editing ? editText : draft;
    if (!text?.trim()) return;
    // Hands the text to the composer. Sending stays the agent's action.
    onAccept(text);
    setDraft(null);
    setEditing(false);
  };

  const handleEdit = () => {
    setEditText(draft || '');
    setEditing(true);
  };

  const handleReject = () => {
    setDraft(null);
    setEditing(false);
  };

  if (available === false) return null;
  if (available === null) return null;

  const busy = task !== null;

  const sentimentStyles = {
    positive: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
    neutral: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
    negative: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
  };
  const sentimentLabels = { positive: 'Olumlu', neutral: 'Nötr', negative: 'Olumsuz' };
  const priorityLabels = { low: 'Düşük', normal: 'Normal', high: 'Yüksek', urgent: 'Acil' };

  return (
    <div className="border-t border-gray-200 dark:border-gray-700 bg-indigo-50/40 dark:bg-indigo-950/20 px-2 sm:px-3 py-2 flex-shrink-0">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-700 dark:text-indigo-300">
          <Sparkles className="w-3.5 h-3.5" />
          AI Asistan
        </span>

        <button
          type="button"
          onClick={handleSummarize}
          disabled={busy || disabled}
          className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-md bg-white dark:bg-gray-800 border border-indigo-200 dark:border-indigo-800 text-gray-700 dark:text-gray-200 hover:bg-indigo-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {task === 'summary' ? <Loader2 className="w-3 h-3 animate-spin" /> : <FileText className="w-3 h-3" />}
          Özetle
        </button>

        <button
          type="button"
          onClick={handleSuggest}
          disabled={busy || disabled}
          className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-md bg-white dark:bg-gray-800 border border-indigo-200 dark:border-indigo-800 text-gray-700 dark:text-gray-200 hover:bg-indigo-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {task === 'suggest' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
          Yanıt öner
        </button>

        <button
          type="button"
          onClick={handleAnalyze}
          disabled={busy || disabled}
          className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-md bg-white dark:bg-gray-800 border border-indigo-200 dark:border-indigo-800 text-gray-700 dark:text-gray-200 hover:bg-indigo-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {task === 'analyze' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Gauge className="w-3 h-3" />}
          Analiz
        </button>
      </div>

      {error && (
        <div className="mt-2 flex items-start gap-2 text-xs text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-md px-2 py-1.5">
          <AlertCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
          <span className="flex-1">{error}</span>
          <button type="button" onClick={() => setError(null)} className="flex-shrink-0">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {summary && (
        <div className="mt-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md px-2.5 py-2">
          <div className="flex items-start justify-between gap-2">
            <span className="text-[11px] font-semibold text-gray-500 dark:text-gray-400">Özet</span>
            <button type="button" onClick={() => setSummary(null)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <p className="mt-1 text-xs text-gray-800 dark:text-gray-200 whitespace-pre-wrap">{summary}</p>
        </div>
      )}

      {analysis && (
        <div className="mt-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md px-2.5 py-2">
          <div className="flex items-start justify-between gap-2">
            <span className="text-[11px] font-semibold text-gray-500 dark:text-gray-400">Analiz</span>
            <button type="button" onClick={() => setAnalysis(null)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <span className={`px-1.5 py-0.5 rounded text-[11px] font-medium ${sentimentStyles[analysis.sentiment]}`}>
              {sentimentLabels[analysis.sentiment] || analysis.sentiment}
            </span>
            {analysis.category && (
              <span className="px-1.5 py-0.5 rounded text-[11px] bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                {analysis.category}
              </span>
            )}
            {/* A suggestion only — the agent still changes priority themselves. */}
            {analysis.suggestedPriority && (
              <span className="px-1.5 py-0.5 rounded text-[11px] bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300">
                Önerilen öncelik: {priorityLabels[analysis.suggestedPriority]}
              </span>
            )}
            {analysis.suggestedTags?.map((tag) => (
              <span key={tag} className="px-1.5 py-0.5 rounded text-[11px] bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300">
                #{tag}
              </span>
            ))}
          </div>
          {analysis.reason && (
            <p className="mt-1.5 text-[11px] text-gray-500 dark:text-gray-400 italic">{analysis.reason}</p>
          )}
        </div>
      )}

      {draft && (
        <div className="mt-2 bg-white dark:bg-gray-800 border border-indigo-200 dark:border-indigo-800 rounded-md px-2.5 py-2">
          <span className="text-[11px] font-semibold text-gray-500 dark:text-gray-400">
            Önerilen yanıt · gönderilmeden önce siz onaylarsınız
          </span>

          {editing ? (
            <textarea
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              rows={4}
              className="mt-1.5 w-full text-xs px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
            />
          ) : (
            <p className="mt-1.5 text-xs text-gray-800 dark:text-gray-200 whitespace-pre-wrap">{draft}</p>
          )}

          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={handleAccept}
              className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-md bg-indigo-600 text-white hover:bg-indigo-700 transition-colors"
            >
              <Check className="w-3 h-3" />
              Mesaj kutusuna aktar
            </button>

            {!editing && (
              <button
                type="button"
                onClick={handleEdit}
                className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-md bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
              >
                <Pencil className="w-3 h-3" />
                Düzenle
              </button>
            )}

            <button
              type="button"
              onClick={handleSuggest}
              disabled={busy}
              className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-md bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 transition-colors"
            >
              {task === 'suggest' ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
              Yeniden üret
            </button>

            <button
              type="button"
              onClick={handleReject}
              className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-md text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
            >
              <X className="w-3 h-3" />
              Reddet
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AIAssistant;
