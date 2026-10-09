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
import { useAuth } from '../../contexts/AuthContext';
import {
  notificationPermission,
  requestNotificationPermission
} from '../../lib/desktopNotifications';
import {
  disablePush,
  enablePush,
  needsHomeScreen,
  pushAvailable,
  pushEnabledHere
} from '../../lib/pushNotifications';

const select =
  'px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-white';

const NotificationSettings = () => {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [prefs, setPrefs] = useState<NotificationPreferences | null>(null);
  const [permission, setPermission] = useState(notificationPermission());
  // Push on this device (PRD-09): null until known; 'unavailable' hides the block.
  const [push, setPush] = useState<'on' | 'off' | 'unavailable' | null>(null);
  const [pushNote, setPushNote] = useState<string | null>(null);
  const [pushBusy, setPushBusy] = useState(false);

  useEffect(() => {
    let live = true;
    (async () => {
      const available = await pushAvailable();
      const on = available && (await pushEnabledHere().catch(() => false));
      if (live) setPush(!available ? 'unavailable' : on ? 'on' : 'off');
    })();
    return () => {
      live = false;
    };
  }, []);

  const togglePush = async () => {
    setPushBusy(true);
    setPushNote(null);
    try {
      if (push === 'on') {
        await disablePush();
        setPush('off');
      } else {
        const result = await enablePush();
        if (result === 'enabled') setPush('on');
        else if (result === 'denied') setPushNote(t('account.notifications.pushDenied'));
        else setPushNote(t('account.notifications.pushUnavailable'));
      }
    } catch (error) {
      toast.error(errorMessage(error, t('account.notifications.pushError')));
    } finally {
      setPushBusy(false);
    }
  };

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

        {push && push !== 'unavailable' && (
          <div>
            <p className="text-sm font-medium text-gray-900 dark:text-white">
              {t('account.notifications.pushTitle')}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
              {t('account.notifications.pushHelp')}
            </p>
            {needsHomeScreen() ? (
              <p className="text-xs text-amber-800 dark:text-amber-300">
                {t('account.notifications.pushHomeScreen')}
              </p>
            ) : (
              <>
                <button
                  type="button"
                  onClick={togglePush}
                  disabled={pushBusy}
                  aria-pressed={push === 'on'}
                  className={
                    push === 'on'
                      ? 'px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 text-sm text-gray-800 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50'
                      : 'px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-sm hover:bg-indigo-700 disabled:opacity-50'
                  }
                >
                  {push === 'on'
                    ? t('account.notifications.pushOff')
                    : t('account.notifications.pushOn')}
                </button>
                {push === 'on' && (
                  <p className="mt-2 text-xs text-emerald-700 dark:text-emerald-400">
                    {t('account.notifications.pushEnabled')}
                  </p>
                )}
                {pushNote && (
                  <p className="mt-2 text-xs text-amber-800 dark:text-amber-300" role="status">
                    {pushNote}
                  </p>
                )}
              </>
            )}
          </div>
        )}

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

        {['owner', 'admin', 'manager'].includes(String(user?.role)) && (
          <label className="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
            <input
              type="checkbox"
              checked={prefs.weeklyReport !== false}
              onChange={(e) => save({ weeklyReport: e.target.checked })}
            />
            {t('account.notifications.weeklyReport')}
          </label>
        )}

        <label className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <span className="text-sm font-medium text-gray-900 dark:text-white">
            {t('account.notifications.language')}
          </span>
          <select
            className={select}
            value={prefs.locale}
            onChange={(e) => save({ locale: e.target.value as 'tr' | 'en' })}
          >
            {/* i18n-ignore: each language by its own name */}
            <option value="tr">Türkçe</option>
            <option value="en">English</option>
          </select>
        </label>
      </div>
    </section>
  );
};

export default NotificationSettings;
