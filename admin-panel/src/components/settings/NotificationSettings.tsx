/**
 * Ayarlar → Bildirimler (plan v10 PRD-01, PRD-02).
 *
 * Yanıtlanmamış sohbet e-postaları (hemen / saatlik / kapalı), masaüstü
 * bildirimleri (izin bir tıklamayla istenir, sayfa açılır açılmaz değil),
 * bildirim sesi ve e-postaların dili. E-postalardaki "Bildirim ayarları"
 * bağlantısı #notifications ile buraya açılır.
 */
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { Bell } from 'lucide-react';
import { authAPI } from '../../services/api';
import type { NotificationPreferences } from '../../services/api';
import { errorMessage } from '../../hooks/useAsync';
import {
  notificationPermission,
  requestNotificationPermission
} from '../../lib/desktopNotifications';

const select =
  'px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-white';

const NotificationSettings = () => {
  const { t } = useTranslation();
  const [prefs, setPrefs] = useState<NotificationPreferences | null>(null);
  const [permission, setPermission] = useState(notificationPermission());

  useEffect(() => {
    authAPI
      .preferences()
      .then(({ data }) => setPrefs(data.preferences))
      .catch(() => setPrefs(null));
    if (window.location.hash === '#notifications') {
      window.setTimeout(
        () => document.getElementById('notifications')?.scrollIntoView({ behavior: 'smooth' }),
        200
      );
    }
  }, []);

  const save = async (patch: Partial<NotificationPreferences>) => {
    if (!prefs) return;
    const next = { ...prefs, ...patch, desktop: { ...prefs.desktop, ...(patch.desktop || {}) } };
    setPrefs(next);
    try {
      const { data } = await authAPI.updatePreferences(next);
      setPrefs(data.preferences);
      toast.success(t('account.notifications.saved'));
    } catch (error) {
      toast.error(errorMessage(error, t('recovery.error')));
    }
  };

  if (!prefs) return null;

  return (
    <section
      id="notifications"
      className="mt-6 bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 transition-colors duration-200 scroll-mt-6"
    >
      <h2 className="flex items-center gap-2 text-xl font-semibold text-gray-900 dark:text-white mb-1">
        <Bell className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
        {t('account.notifications.title')}
      </h2>
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-5">
        {t('account.notifications.description')}
      </p>

      <div className="space-y-5">
        <label className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <span className="text-sm font-medium text-gray-900 dark:text-white">
            {t('account.notifications.missedEmail')}
          </span>
          <select
            className={select}
            value={prefs.missedChatEmail}
            onChange={(e) =>
              save({
                missedChatEmail: e.target.value as NotificationPreferences['missedChatEmail']
              })
            }
          >
            <option value="instant">{t('account.notifications.instant')}</option>
            <option value="hourly">{t('account.notifications.hourly')}</option>
            <option value="off">{t('account.notifications.off')}</option>
          </select>
        </label>

        <div>
          <p className="text-sm font-medium text-gray-900 dark:text-white">
            {t('account.notifications.desktopTitle')}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
            {t('account.notifications.desktopHelp')}
          </p>
          {permission === 'default' && (
            <button
              type="button"
              onClick={async () => setPermission(await requestNotificationPermission())}
              className="mb-3 px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-sm hover:bg-indigo-700"
            >
              {t('account.notifications.allow')}
            </button>
          )}
          {permission === 'granted' && (
            <p className="mb-3 text-xs text-emerald-700 dark:text-emerald-400">
              {t('account.notifications.allowed')}
            </p>
          )}
          {permission === 'denied' && (
            <p className="mb-3 text-xs text-amber-700 dark:text-amber-400">
              {t('account.notifications.blocked')}
            </p>
          )}
          <div className="flex flex-col gap-2 text-sm text-gray-700 dark:text-gray-300">
            {(['newConversation', 'assigned', 'allMessages'] as const).map((key) => (
              <label key={key} className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={prefs.desktop[key]}
                  onChange={(e) => save({ desktop: { ...prefs.desktop, [key]: e.target.checked } })}
                />
                {t(`account.notifications.${key}`)}
              </label>
            ))}
          </div>
        </div>

        <label className="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
          <input
            type="checkbox"
            checked={prefs.notificationSound}
            onChange={(e) => save({ notificationSound: e.target.checked })}
          />
          {t('account.notifications.sound')}
        </label>

        <label className="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
          <input
            type="checkbox"
            checked={prefs.activationEmails}
            onChange={(e) => save({ activationEmails: e.target.checked })}
          />
          {t('account.notifications.activation')}
        </label>

        <label className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <span className="text-sm font-medium text-gray-900 dark:text-white">
            {t('account.notifications.language')}
          </span>
          <select
            className={select}
            value={prefs.locale}
            onChange={(e) => save({ locale: e.target.value as 'tr' | 'en' })}
          >
            <option value="tr">Türkçe</option>
            <option value="en">English</option>
          </select>
        </label>
      </div>
    </section>
  );
};

export default NotificationSettings;
