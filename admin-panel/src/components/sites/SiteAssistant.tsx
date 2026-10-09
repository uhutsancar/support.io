// A site's automatic first answers: the FAQ assistant (Gemini) and the plain
// keyword FAQ reply. Both are off until the site switches them on.
//
// The assistant answers only from the site's public FAQ entries, in short
// Turkish, and hands the visitor to a person when it has no answer, when the
// visitor asks, or when Gemini is unreachable. It needs a Gemini key on the
// server; without one the switch is shown but cannot be turned on.

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { Bot, X } from 'lucide-react';
import { assistantAPI, sitesAPI } from '../../services/api';
import { errorMessage } from '../../hooks/useAsync';
import type { AssistantStatus, Site } from '../../types/api';
import AssistantConsent from './AssistantConsent';

export interface SiteAssistantProps {
  site: Site;
  onClose: () => void;
  onSaved: (site: Site) => void;
}

export const Toggle = ({
  id,
  checked,
  disabled,
  onChange,
  label,
  help
}: {
  id: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (value: boolean) => void;
  label: string;
  help: string;
}) => (
  <div className="flex items-start gap-3">
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`mt-0.5 relative inline-flex h-6 w-11 shrink-0 rounded-full transition disabled:opacity-40 ${checked ? 'bg-indigo-600' : 'bg-gray-300 dark:bg-gray-600'}`}
    >
      <span
        className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition ${checked ? 'left-[22px]' : 'left-0.5'}`}
      />
    </button>
    <label htmlFor={id} className="min-w-0">
      <span className="block text-sm font-semibold text-gray-900 dark:text-white">{label}</span>
      <span className="block text-xs text-gray-500 dark:text-gray-400 mt-0.5">{help}</span>
    </label>
  </div>
);

const SiteAssistant = ({ site, onClose, onSaved }: SiteAssistantProps) => {
  const { t } = useTranslation();
  const [status, setStatus] = useState<AssistantStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [asking, setAsking] = useState(false);

  useEffect(() => {
    assistantAPI
      .status()
      .then(({ data }) => setStatus(data))
      .catch(() => setStatus({ available: false }));
  }, []);

  const save = async (
    fields: Partial<Pick<Site, 'assistantEnabled' | 'faqAutoReply'>> & {
      assistantConsent?: boolean;
    }
  ) => {
    setBusy(true);
    try {
      const { data } = await sitesAPI.update(site._id, fields);
      onSaved(data.site);
      toast.success(t('assistant.settings.saved'));
    } catch (error) {
      toast.error(errorMessage(error, t('assistant.settings.saveError')));
    } finally {
      setBusy(false);
    }
  };

  const available = Boolean(status?.available);

  return (
    <div
      className="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-center justify-center z-50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="site-assistant-title"
    >
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-lg w-full p-5 sm:p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2
              id="site-assistant-title"
              className="text-xl font-bold text-gray-900 dark:text-white inline-flex items-center gap-2"
            >
              <Bot className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              {t('assistant.settings.title')}
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">{site.name}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('common.close')}
            className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="space-y-5">
          <Toggle
            id="assistant-enabled"
            checked={site.assistantEnabled === true}
            disabled={busy || (!available && site.assistantEnabled !== true)}
            onChange={(value) => (value ? setAsking(true) : save({ assistantEnabled: false }))}
            label={t('assistant.settings.assistant')}
            help={t('assistant.settings.assistantHelp')}
          />
          {status && !available && (
            <p className="text-xs rounded-lg px-3 py-2 bg-amber-50 text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
              {t('assistant.settings.unavailable')}
            </p>
          )}
          <ul className="text-xs text-gray-600 dark:text-gray-400 list-disc pl-5 space-y-1">
            <li>{t('assistant.settings.rule1')}</li>
            <li>{t('assistant.settings.rule2')}</li>
            <li>{t('assistant.settings.rule3')}</li>
            <li>{t('assistant.settings.rule4')}</li>
          </ul>

          <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
            <Toggle
              id="faq-auto-reply"
              checked={site.faqAutoReply === true}
              disabled={busy || site.assistantEnabled === true}
              onChange={(value) => save({ faqAutoReply: value })}
              label={t('assistant.settings.faqAutoReply')}
              help={t('assistant.settings.faqAutoReplyHelp')}
            />
          </div>
        </div>
      </div>
      {asking && (
        <AssistantConsent
          siteName={site.name}
          onCancel={() => setAsking(false)}
          onConfirm={() => {
            setAsking(false);
            void save({ assistantEnabled: true, assistantConsent: true });
          }}
        />
      )}
    </div>
  );
};

export default SiteAssistant;
