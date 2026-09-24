// A site's AI settings: who may answer on its behalf, and how the assistant
// sounds. Opened from the site card; the integrations the assistant needs for
// order questions sit underneath, in their own component.
//
// Switching the assistant to automatic replies is deliberate: it asks for an
// explicit confirmation, because from that moment it talks to customers
// without an agent reading first.

import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { X } from 'lucide-react';
import { aiAPI, sitesAPI } from '../../services/api';
import { errorMessage } from '../../hooks/useAsync';
import SiteIntegrations from './SiteIntegrations';
import type { AIMode, AIState, Site, SiteAiSettings } from '../../types/api';

export interface SiteAISettingsProps {
  site: Site;
  onClose: () => void;
  /** Called with the site as the server returned it after a save. */
  onSaved: (site: Site) => void;
}

const MODES: AIMode[] = ['off', 'copilot', 'auto'];

const DEFAULTS: SiteAiSettings = {
  mode: 'off',
  answerLength: 'short',
  tone: 'professional',
  maxBotReplies: 8,
  blockedTerms: [],
  botName: null,
  handoffMessage: null
};

const STATE_STYLES: Record<AIState, string> = {
  ready: 'bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-400',
  warming_up: 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300',
  unavailable: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300',
  disabled: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
};

const inputClass =
  'w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none';
const labelClass = 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1';

const SiteAISettings = ({ site, onClose, onSaved }: SiteAISettingsProps) => {
  const { t } = useTranslation();
  const [current, setCurrent] = useState<Site>(site);
  const [form, setForm] = useState<SiteAiSettings>({ ...DEFAULTS, ...site.aiSettings });
  const [blockedText, setBlockedText] = useState((site.aiSettings?.blockedTerms ?? []).join(', '));
  const [autoConfirmed, setAutoConfirmed] = useState(site.aiSettings?.mode === 'auto');
  const [state, setState] = useState<AIState | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    aiAPI
      .status()
      .then(({ data }) => !cancelled && setState(data.state))
      .catch(() => !cancelled && setState('unavailable'));
    return () => {
      cancelled = true;
    };
  }, []);

  const update = <K extends keyof SiteAiSettings>(key: K, value: SiteAiSettings[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.mode === 'auto' && !autoConfirmed) {
      toast.error(t('ai.settings.autoConfirmRequired'));
      return;
    }
    setSaving(true);
    try {
      const { data } = await sitesAPI.update(current._id, {
        aiSettings: {
          ...form,
          blockedTerms: blockedText
            .split(',')
            .map((term) => term.trim())
            .filter(Boolean),
          botName: form.botName?.trim() || null,
          handoffMessage: form.handoffMessage?.trim() || null
        }
      });
      setCurrent(data.site);
      onSaved(data.site);
      toast.success(t('ai.settings.saved'));
    } catch (error) {
      toast.error(errorMessage(error, t('ai.settings.saveError')));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 dark:bg-opacity-70 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto modal-scrollbar">
        <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">
              {t('ai.settings.title')}
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">{current.name}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('ai.close')}
            className="p-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSave} className="px-4 sm:px-6 py-4 space-y-4">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-gray-600 dark:text-gray-400">
              {t('ai.settings.modelStatus')}:
            </span>
            {state && (
              <span className={`px-2 py-0.5 rounded text-xs font-medium ${STATE_STYLES[state]}`}>
                {t(`ai.state.${state}`)}
              </span>
            )}
          </div>

          <fieldset>
            <legend className={labelClass}>{t('ai.settings.mode')}</legend>
            <div className="space-y-2">
              {MODES.map((mode) => (
                <label
                  key={mode}
                  className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer ${
                    form.mode === mode
                      ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-900/20'
                      : 'border-gray-200 dark:border-gray-700'
                  }`}
                >
                  <input
                    type="radio"
                    name="ai-mode"
                    value={mode}
                    checked={form.mode === mode}
                    onChange={() => {
                      update('mode', mode);
                      // Leaving automatic replies withdraws the confirmation:
                      // choosing it again asks again.
                      if (mode !== 'auto') setAutoConfirmed(false);
                    }}
                    className="mt-1"
                  />
                  <span>
                    <span className="block text-sm font-medium text-gray-900 dark:text-white">
                      {t(`ai.settings.modes.${mode}`)}
                    </span>
                    <span className="block text-xs text-gray-500 dark:text-gray-400">
                      {t(`ai.settings.modeHelp.${mode}`)}
                    </span>
                  </span>
                </label>
              ))}
            </div>
            {form.mode === 'auto' && (
              <label className="mt-3 flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
                <input
                  type="checkbox"
                  checked={autoConfirmed}
                  onChange={(e) => setAutoConfirmed(e.target.checked)}
                  className="mt-0.5"
                />
                <span>{t('ai.settings.autoConfirm')}</span>
              </label>
            )}
          </fieldset>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass} htmlFor="ai-length">
                {t('ai.settings.answerLength')}
              </label>
              <select
                id="ai-length"
                value={form.answerLength}
                onChange={(e) =>
                  update('answerLength', e.target.value as SiteAiSettings['answerLength'])
                }
                className={inputClass}
              >
                <option value="short">{t('ai.settings.lengths.short')}</option>
                <option value="normal">{t('ai.settings.lengths.normal')}</option>
              </select>
            </div>
            <div>
              <label className={labelClass} htmlFor="ai-tone">
                {t('ai.settings.tone')}
              </label>
              <select
                id="ai-tone"
                value={form.tone}
                onChange={(e) => update('tone', e.target.value as SiteAiSettings['tone'])}
                className={inputClass}
              >
                <option value="professional">{t('ai.settings.tones.professional')}</option>
                <option value="friendly">{t('ai.settings.tones.friendly')}</option>
              </select>
            </div>
            <div>
              <label className={labelClass} htmlFor="ai-bot-name">
                {t('ai.settings.botName')}
              </label>
              <input
                id="ai-bot-name"
                maxLength={40}
                value={form.botName ?? ''}
                placeholder={t('ai.settings.botNamePlaceholder')}
                onChange={(e) => update('botName', e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass} htmlFor="ai-max-replies">
                {t('ai.settings.maxBotReplies')}
              </label>
              <input
                id="ai-max-replies"
                type="number"
                min={1}
                max={20}
                value={form.maxBotReplies}
                onChange={(e) => update('maxBotReplies', Number(e.target.value))}
                className={inputClass}
              />
            </div>
          </div>

          <div>
            <label className={labelClass} htmlFor="ai-handoff">
              {t('ai.settings.handoffMessage')}
            </label>
            <textarea
              id="ai-handoff"
              rows={2}
              maxLength={300}
              value={form.handoffMessage ?? ''}
              placeholder={t('ai.settings.handoffPlaceholder')}
              onChange={(e) => update('handoffMessage', e.target.value)}
              className={inputClass}
            />
          </div>

          <div>
            <label className={labelClass} htmlFor="ai-blocked">
              {t('ai.settings.blockedTerms')}
            </label>
            <input
              id="ai-blocked"
              value={blockedText}
              onChange={(e) => setBlockedText(e.target.value)}
              className={inputClass}
            />
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              {t('ai.settings.blockedTermsHelp')}
            </p>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition"
            >
              {t('ai.settings.save')}
            </button>
          </div>
        </form>

        <SiteIntegrations
          site={current}
          onChanged={(updated) => {
            setCurrent(updated);
            onSaved(updated);
          }}
        />
      </div>
    </div>
  );
};

export default SiteAISettings;
