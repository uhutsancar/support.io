// A site's chat behaviour (plan v10 PRD-01, PRD-04, PRD-05, PRD-06):
// unanswered-chat mails, the offline e-mail question, e-mailed replies, the
// pre-chat form with its privacy-notice consent box, satisfaction ratings,
// transcripts and spam protection. Read from and saved to
// /api/sites/:id/chat-settings; the server checks every field.

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { MessageSquare, X } from 'lucide-react';
import { sitesAPI } from '../../services/api';
import type { ChatSettings } from '../../services/api';
import { errorMessage } from '../../hooks/useAsync';
import { Toggle } from './SiteAssistant';
import type { Site } from '../../types/api';

const input =
  'w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/40';

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="pt-4 border-t border-gray-200 dark:border-gray-700 first:border-0 first:pt-0 space-y-3">
    <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{title}</h3>
    {children}
  </section>
);

const Select = <T extends string>({
  id,
  label,
  value,
  options,
  onChange
}: {
  id: string;
  label: string;
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (value: T) => void;
}) => (
  <label htmlFor={id} className="block">
    <span className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">{label}</span>
    <select id={id} className={input} value={value} onChange={(e) => onChange(e.target.value as T)}>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  </label>
);

const SiteChatSettings = ({ site, onClose }: { site: Site; onClose: () => void }) => {
  const { t } = useTranslation();
  const [settings, setSettings] = useState<ChatSettings | null>(null);
  const [customText, setCustomText] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    sitesAPI
      .getChatSettings(site._id)
      .then(({ data }) => {
        setSettings(data.settings);
        setCustomText(data.settings.preChat.customFields.join('\n'));
      })
      .catch((error) => toast.error(errorMessage(error, t('recovery.error'))));
  }, [site._id, t]);

  if (!settings) {
    return null;
  }

  const set = (patch: (s: ChatSettings) => ChatSettings) => setSettings((s) => (s ? patch(s) : s));
  const modes = [
    { value: 'off' as const, label: t('account.chatSettings.modeOff') },
    { value: 'optional' as const, label: t('account.chatSettings.modeOptional') },
    { value: 'required' as const, label: t('account.chatSettings.modeRequired') }
  ];

  const save = async () => {
    setBusy(true);
    try {
      const body: ChatSettings = {
        ...settings,
        preChat: {
          ...settings.preChat,
          customFields: customText
            .split('\n')
            .map((l) => l.trim())
            .filter(Boolean)
            .slice(0, 3)
        }
      };
      const { data } = await sitesAPI.updateChatSettings(site._id, body);
      setSettings(data.settings);
      setCustomText(data.settings.preChat.customFields.join('\n'));
      toast.success(t('account.chatSettings.saved'));
    } catch (error) {
      toast.error(errorMessage(error, t('recovery.error')));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-center justify-center z-50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="site-chat-settings-title"
    >
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-lg w-full p-5 sm:p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2
              id="site-chat-settings-title"
              className="text-xl font-bold text-gray-900 dark:text-white inline-flex items-center gap-2"
            >
              <MessageSquare className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              {t('account.chatSettings.title')}
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

        <div className="space-y-4">
          <Section title={t('account.chatSettings.missedTitle')}>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {t('account.chatSettings.missedHelp')}
            </p>
            <div className="grid grid-cols-2 gap-3">
              <label htmlFor="missed-delay" className="block">
                <span className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                  {t('account.chatSettings.delay')}
                </span>
                <input
                  id="missed-delay"
                  type="number"
                  min={1}
                  max={120}
                  className={input}
                  value={settings.missedChat.delayMinutes}
                  onChange={(e) =>
                    set((s) => ({
                      ...s,
                      missedChat: { ...s.missedChat, delayMinutes: Number(e.target.value) || 3 }
                    }))
                  }
                />
              </label>
              <Select
                id="missed-notify"
                label={t('account.chatSettings.notify')}
                value={settings.missedChat.notify}
                options={[
                  { value: 'all', label: t('account.chatSettings.notifyAll') },
                  { value: 'assigned', label: t('account.chatSettings.notifyAssigned') },
                  { value: 'off', label: t('account.chatSettings.notifyOff') }
                ]}
                onChange={(notify) =>
                  set((s) => ({ ...s, missedChat: { ...s.missedChat, notify } }))
                }
              />
            </div>
            <Toggle
              id="offline-form"
              checked={settings.offlineForm}
              onChange={(offlineForm) => set((s) => ({ ...s, offlineForm }))}
              label={t('account.chatSettings.offlineForm')}
              help={t('account.chatSettings.offlineFormHelp')}
            />
            <Toggle
              id="email-replies"
              checked={settings.emailReplies}
              onChange={(emailReplies) => set((s) => ({ ...s, emailReplies }))}
              label={t('account.chatSettings.emailReplies')}
              help={t('account.chatSettings.emailRepliesHelp')}
            />
          </Section>

          <Section title={t('account.chatSettings.preChatTitle')}>
            <Select
              id="prechat-mode"
              label={t('account.chatSettings.preChatMode')}
              value={settings.preChat.mode}
              options={modes}
              onChange={(mode) => set((s) => ({ ...s, preChat: { ...s.preChat, mode } }))}
            />
            {settings.preChat.mode !== 'off' && (
              <>
                <div className="flex flex-wrap gap-4 text-sm text-gray-700 dark:text-gray-300">
                  {(['name', 'email', 'phone'] as const).map((field) => (
                    <label key={field} className="inline-flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={settings.preChat[field]}
                        onChange={(e) =>
                          set((s) => ({
                            ...s,
                            preChat: { ...s.preChat, [field]: e.target.checked }
                          }))
                        }
                      />
                      {t(`account.chatSettings.field${field[0].toUpperCase()}${field.slice(1)}`)}
                    </label>
                  ))}
                </div>
                <label htmlFor="prechat-custom" className="block">
                  <span className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                    {t('account.chatSettings.customFields')}
                  </span>
                  <textarea
                    id="prechat-custom"
                    rows={3}
                    className={input}
                    value={customText}
                    onChange={(e) => setCustomText(e.target.value)}
                  />
                </label>
              </>
            )}
            <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 pt-1">
              {t('account.chatSettings.consentTitle')}
            </h4>
            <Select
              id="consent-mode"
              label={t('account.chatSettings.consentMode')}
              value={settings.preChat.consent.mode}
              options={modes}
              onChange={(mode) =>
                set((s) => ({
                  ...s,
                  preChat: { ...s.preChat, consent: { ...s.preChat.consent, mode } }
                }))
              }
            />
            {settings.preChat.consent.mode !== 'off' && (
              <label htmlFor="consent-url" className="block">
                <span className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                  {t('account.chatSettings.policyUrl')}
                </span>
                <input
                  id="consent-url"
                  type="url"
                  className={input}
                  placeholder="https://"
                  value={settings.preChat.consent.policyUrl}
                  onChange={(e) =>
                    set((s) => ({
                      ...s,
                      preChat: {
                        ...s.preChat,
                        consent: { ...s.preChat.consent, policyUrl: e.target.value }
                      }
                    }))
                  }
                />
                <span className="block text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {t('account.chatSettings.policyUrlHelp')}
                </span>
              </label>
            )}
          </Section>

          <Section title={t('account.chatSettings.csatTitle')}>
            <Toggle
              id="csat-enabled"
              checked={settings.csat.enabled}
              onChange={(enabled) => set((s) => ({ ...s, csat: { ...s.csat, enabled } }))}
              label={t('account.chatSettings.csatEnabled')}
              help=""
            />
            {settings.csat.enabled && (
              <>
                <Select
                  id="csat-style"
                  label={t('account.chatSettings.csatStyle')}
                  value={settings.csat.style}
                  options={[
                    { value: 'thumbs', label: t('account.chatSettings.styleThumbs') },
                    { value: 'stars', label: t('account.chatSettings.styleStars') }
                  ]}
                  onChange={(style) => set((s) => ({ ...s, csat: { ...s.csat, style } }))}
                />
                <Toggle
                  id="csat-email"
                  checked={settings.csat.askByEmail}
                  onChange={(askByEmail) => set((s) => ({ ...s, csat: { ...s.csat, askByEmail } }))}
                  label={t('account.chatSettings.csatEmail')}
                  help=""
                />
              </>
            )}
            <Toggle
              id="transcript"
              checked={settings.transcript}
              onChange={(transcript) => set((s) => ({ ...s, transcript }))}
              label={t('account.chatSettings.transcript')}
              help=""
            />
            <Toggle
              id="spam-mode"
              checked={settings.spamMode}
              onChange={(spamMode) => set((s) => ({ ...s, spamMode }))}
              label={t('account.chatSettings.spamMode')}
              help={t('account.chatSettings.spamModeHelp')}
            />
          </Section>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-sm text-gray-700 dark:text-gray-200"
            >
              {t('common.cancel')}
            </button>
            <button
              type="button"
              onClick={save}
              disabled={busy}
              className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
            >
              {t('account.chatSettings.save')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SiteChatSettings;
