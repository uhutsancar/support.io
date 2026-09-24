// AI copilot panel for a single conversation.
//
// Everything here is a suggestion. Nothing this component produces reaches the
// customer on its own: a draft is handed to the agent through `onAccept`, which
// drops it into the message box for them to read, edit and send. The four
// controls the product needs — accept, edit, regenerate, reject — are the whole
// interaction model.
//
// The model runs on the team's own GPU and takes minutes to load, so the panel
// asks for its state and keeps asking while it warms up: the buttons appear
// without a page reload once it is ready.
import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Sparkles,
  Loader2,
  RefreshCw,
  Check,
  X,
  Pencil,
  AlertCircle,
  FileText,
  Gauge,
  Languages,
  BookOpen
} from 'lucide-react';
import axios from 'axios';
import { aiAPI } from '../services/api';
import { errorMessage } from '../hooks/useAsync';
import type { AIState, Conversation } from '../types/api';

/**
 * What the analyze task hands back, as this panel renders it.
 *
 * Declared at module scope. Inside the component body — where it was — a type
 * is invisible to every other file, so nothing else could reference the shape
 * the AI endpoint returns, and a reader looking for it had to know which
 * function to open.
 */
export interface ConversationAnalysis {
  sentiment?: string;
  intent?: string;
  category?: string;
  suggestedPriority?: string | null;
  suggestedTags?: string[];
  reason?: string;
}

export interface AIAssistantProps {
  conversation: Conversation | null;
  /** Hands the accepted text to the composer; sending stays the agent's action. */
  onAccept: (text: string) => void;
  disabled?: boolean;
  /** What the agent has typed so far: the input for tone and translation. */
  composerText: string;
  /** Translated instead when the composer is empty. */
  lastVisitorMessage: string | null;
}

/** How often the panel asks again while the model is loading. */
const STATUS_POLL_MS = 15 * 1000;
const TONES = ['professional', 'friendly', 'concise', 'apologetic'] as const;
/** The language names the backend passes to the model. */
const LANGUAGES = { tr: 'Turkish', en: 'English', de: 'German', ar: 'Arabic' } as const;

const buttonClass =
  'inline-flex items-center gap-1 px-2 py-1 text-xs rounded-md bg-white dark:bg-gray-800 border border-indigo-200 dark:border-indigo-800 text-gray-700 dark:text-gray-200 hover:bg-indigo-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors';
const selectClass =
  'px-1.5 py-1 text-xs rounded-md bg-white dark:bg-gray-800 border border-indigo-200 dark:border-indigo-800 text-gray-700 dark:text-gray-200 disabled:opacity-50';
const cardClass =
  'mt-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md px-2.5 py-2';
const cardTitleClass = 'text-[11px] font-semibold text-gray-500 dark:text-gray-400';

const sentimentStyles: Record<string, string> = {
  positive: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  neutral: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
  negative: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
};

/** A read-only result — a summary, a translation, a knowledge-base answer. */
const ResultCard = ({
  title,
  onClose,
  children
}: {
  title: string;
  onClose: () => void;
  children: string;
}) => {
  const { t } = useTranslation();
  return (
    <div className={cardClass}>
      <div className="flex items-start justify-between gap-2">
        <span className={cardTitleClass}>{title}</span>
        <button
          type="button"
          onClick={onClose}
          aria-label={t('ai.close')}
          className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
      <p className="mt-1 text-xs text-gray-800 dark:text-gray-200 whitespace-pre-wrap">
        {children}
      </p>
    </div>
  );
};

const AIAssistant = ({
  conversation,
  onAccept,
  disabled,
  composerText,
  lastVisitorMessage
}: AIAssistantProps) => {
  const { t } = useTranslation();
  const [state, setState] = useState<AIState | null>(null); // null = not yet known
  const [task, setTask] = useState<string | null>(null); // which task is running
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<ConversationAnalysis | null>(null);
  const [draft, setDraft] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState('');
  const [translation, setTranslation] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);
  const [question, setQuestion] = useState('');
  const [knowledge, setKnowledge] = useState<string | null>(null);
  const [tone, setTone] = useState<(typeof TONES)[number]>('professional');
  const [language, setLanguage] = useState<keyof typeof LANGUAGES>('en');
  // What produced the current draft, so "regenerate" repeats that.
  const lastDraftTask = useRef<() => void>(() => undefined);
  const inFlight = useRef<AbortController | null>(null);

  // Asked on mount, and again every 15 s while the model is configured but not
  // ready yet. Once ready the loop stops; nothing polls a model that answers.
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const check = () => {
      aiAPI
        .status()
        .then(({ data }) => {
          if (cancelled) return;
          setState(data.state);
          if (data.configured && data.state !== 'ready') timer = setTimeout(check, STATUS_POLL_MS);
        })
        .catch(() => {
          if (!cancelled) setState('disabled');
        });
    };
    check();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, []);

  // Suggestions belong to the conversation they were generated from; switching
  // threads must not leave the previous one's draft on screen, nor let a
  // request for it land afterwards.
  useEffect(() => {
    inFlight.current?.abort();
    setSummary(null);
    setAnalysis(null);
    setDraft(null);
    setTranslation(null);
    setKnowledge(null);
    setAsking(false);
    setEditing(false);
    setError(null);
  }, [conversation?._id]);

  useEffect(() => () => inFlight.current?.abort(), []);

  /**
   * Runs one AI task against the open conversation, with a way to cancel it.
   *
   * The conversation id is resolved here rather than in each task, so none of
   * the callers can forget that there may not be one.
   */
  const run = useCallback(
    async (name: string, work: (conversationId: string, signal: AbortSignal) => Promise<void>) => {
      const conversationId = conversation?._id;
      if (!conversationId) return;

      inFlight.current?.abort();
      const controller = new AbortController();
      inFlight.current = controller;
      setTask(name);
      setError(null);
      try {
        await work(conversationId, controller.signal);
      } catch (err) {
        if (axios.isCancel(err)) return;
        setError(
          axios.isAxiosError(err) && err.code === 'ECONNABORTED'
            ? t('ai.timedOut')
            : errorMessage(err, t('ai.requestFailed'))
        );
      } finally {
        if (inFlight.current === controller) {
          inFlight.current = null;
          setTask(null);
        }
      }
    },
    [conversation?._id, t]
  );

  const showDraft = (text: string, again: () => void) => {
    setDraft(text);
    setEditing(false);
    lastDraftTask.current = again;
  };

  const handleSummarize = () =>
    run('summary', async (id, signal) => {
      const { data } = await aiAPI.summarize(id, { signal });
      setSummary(data.summary);
    });

  const handleAnalyze = () =>
    run('analyze', async (id, signal) => {
      const { data } = await aiAPI.analyze(id, { signal });
      setAnalysis(data.analysis as ConversationAnalysis);
    });

  const handleSuggest = () =>
    run('suggest', async (id, signal) => {
      const { data } = await aiAPI.suggestReply(id, null, { signal });
      showDraft(data.reply, handleSuggest);
    });

  // Tone works on the agent's own words: what is in the draft card, or else in
  // the message box.
  const handleTone = () => {
    const source = (editing ? editText : draft) || composerText;
    if (!source.trim()) return setError(t('ai.needsText'));
    return run('tone', async (id, signal) => {
      const { data } = await aiAPI.rewrite(id, source, tone, { signal });
      showDraft(data.reply, handleTone);
    });
  };

  // The agent's reply, or when there is none, the customer's last message so
  // the agent can read it.
  const handleTranslate = () => {
    const outgoing = composerText.trim();
    const source = outgoing || lastVisitorMessage?.trim() || '';
    if (!source) return setError(t('ai.needsText'));
    return run('translate', async (id, signal) => {
      const { data } = await aiAPI.translate(id, source, LANGUAGES[language], { signal });
      if (outgoing) showDraft(data.text, handleTranslate);
      else setTranslation(data.text);
    });
  };

  const handleAsk = () => {
    if (!question.trim()) return;
    return run('knowledge', async (id, signal) => {
      const { data } = await aiAPI.knowledgeAnswer(id, question.trim(), { signal });
      setKnowledge(data.answered && data.answer ? data.answer : t('ai.noKnowledgeAnswer'));
    });
  };

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

  // Not configured on this server: the controls are not offered at all.
  if (state === null || state === 'disabled') return null;

  const ready = state === 'ready';
  const busy = task !== null;
  const off = busy || disabled || !ready;
  const spinner = (name: string, Icon: typeof Sparkles) =>
    task === name ? <Loader2 className="w-3 h-3 animate-spin" /> : <Icon className="w-3 h-3" />;

  return (
    <div className="border-t border-gray-200 dark:border-gray-700 bg-indigo-50/40 dark:bg-indigo-950/20 px-2 sm:px-3 py-2 flex-shrink-0">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-700 dark:text-indigo-300">
          <Sparkles className="w-3.5 h-3.5" />
          {t('ai.assistant')}
        </span>

        {!ready && (
          <span className="text-[11px] text-amber-700 dark:text-amber-300">
            {t(`ai.state.${state}`)}
          </span>
        )}

        <button type="button" onClick={handleSummarize} disabled={off} className={buttonClass}>
          {spinner('summary', FileText)}
          {t('ai.summarize')}
        </button>
        <button type="button" onClick={handleSuggest} disabled={off} className={buttonClass}>
          {spinner('suggest', Sparkles)}
          {t('ai.suggest')}
        </button>
        <button type="button" onClick={handleAnalyze} disabled={off} className={buttonClass}>
          {spinner('analyze', Gauge)}
          {t('ai.analyze')}
        </button>

        <span className="inline-flex items-center gap-1">
          <select
            value={tone}
            onChange={(e) => setTone(e.target.value as (typeof TONES)[number])}
            disabled={off}
            aria-label={t('ai.tone')}
            className={selectClass}
          >
            {TONES.map((value) => (
              <option key={value} value={value}>
                {t(`ai.toneOptions.${value}`)}
              </option>
            ))}
          </select>
          <button type="button" onClick={handleTone} disabled={off} className={buttonClass}>
            {spinner('tone', Pencil)}
            {t('ai.tone')}
          </button>
        </span>

        <span className="inline-flex items-center gap-1" title={t('ai.translateSource')}>
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value as keyof typeof LANGUAGES)}
            disabled={off}
            aria-label={t('ai.translate')}
            className={selectClass}
          >
            {Object.keys(LANGUAGES).map((code) => (
              <option key={code} value={code}>
                {t(`ai.languages.${code}`)}
              </option>
            ))}
          </select>
          <button type="button" onClick={handleTranslate} disabled={off} className={buttonClass}>
            {spinner('translate', Languages)}
            {t('ai.translate')}
          </button>
        </span>

        <button
          type="button"
          onClick={() => setAsking((open) => !open)}
          disabled={off}
          className={buttonClass}
        >
          {spinner('knowledge', BookOpen)}
          {t('ai.askKnowledge')}
        </button>

        {busy && (
          <button
            type="button"
            onClick={() => inFlight.current?.abort()}
            className="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            {t('ai.cancel')}
          </button>
        )}
      </div>

      {asking && (
        <form
          className="mt-2 flex gap-1.5"
          onSubmit={(e) => {
            e.preventDefault();
            void handleAsk();
          }}
        >
          <input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            maxLength={500}
            placeholder={t('ai.askPlaceholder')}
            className="flex-1 text-xs px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <button type="submit" disabled={off || !question.trim()} className={buttonClass}>
            {t('ai.ask')}
          </button>
        </form>
      )}

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
        <ResultCard title={t('ai.summary')} onClose={() => setSummary(null)}>
          {summary}
        </ResultCard>
      )}
      {translation && (
        <ResultCard title={t('ai.translation')} onClose={() => setTranslation(null)}>
          {translation}
        </ResultCard>
      )}
      {knowledge && (
        <ResultCard title={t('ai.knowledge')} onClose={() => setKnowledge(null)}>
          {knowledge}
        </ResultCard>
      )}

      {analysis && (
        <div className={cardClass}>
          <div className="flex items-start justify-between gap-2">
            <span className={cardTitleClass}>{t('ai.analysis')}</span>
            <button
              type="button"
              onClick={() => setAnalysis(null)}
              aria-label={t('ai.close')}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            {analysis.sentiment && (
              <span
                className={`px-1.5 py-0.5 rounded text-[11px] font-medium ${sentimentStyles[analysis.sentiment] ?? sentimentStyles.neutral}`}
              >
                {t(`ai.sentiments.${analysis.sentiment}`, analysis.sentiment)}
              </span>
            )}
            {analysis.category && (
              <span className="px-1.5 py-0.5 rounded text-[11px] bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                {analysis.category}
              </span>
            )}
            {/* A suggestion only — the agent still changes priority themselves. */}
            {analysis.suggestedPriority && (
              <span className="px-1.5 py-0.5 rounded text-[11px] bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300">
                {t('ai.suggestedPriority')}:{' '}
                {t(`ai.priorities.${analysis.suggestedPriority}`, analysis.suggestedPriority)}
              </span>
            )}
            {analysis.suggestedTags?.map((tag) => (
              <span
                key={tag}
                className="px-1.5 py-0.5 rounded text-[11px] bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300"
              >
                #{tag}
              </span>
            ))}
          </div>
          {analysis.reason && (
            <p className="mt-1.5 text-[11px] text-gray-500 dark:text-gray-400 italic">
              {analysis.reason}
            </p>
          )}
        </div>
      )}

      {draft && (
        <div className="mt-2 bg-white dark:bg-gray-800 border border-indigo-200 dark:border-indigo-800 rounded-md px-2.5 py-2">
          <span className={cardTitleClass}>{t('ai.draftTitle')}</span>

          {editing ? (
            <textarea
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              rows={4}
              className="mt-1.5 w-full text-xs px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
            />
          ) : (
            <p className="mt-1.5 text-xs text-gray-800 dark:text-gray-200 whitespace-pre-wrap">
              {draft}
            </p>
          )}

          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={handleAccept}
              className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-md bg-indigo-600 text-white hover:bg-indigo-700 transition-colors"
            >
              <Check className="w-3 h-3" />
              {t('ai.accept')}
            </button>

            {!editing && (
              <button type="button" onClick={handleEdit} className={buttonClass}>
                <Pencil className="w-3 h-3" />
                {t('ai.edit')}
              </button>
            )}

            <button
              type="button"
              onClick={() => lastDraftTask.current()}
              disabled={busy}
              className={buttonClass}
            >
              {busy ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <RefreshCw className="w-3 h-3" />
              )}
              {t('ai.regenerate')}
            </button>

            <button
              type="button"
              onClick={handleReject}
              className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-md text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
            >
              <X className="w-3 h-3" />
              {t('ai.reject')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AIAssistant;
