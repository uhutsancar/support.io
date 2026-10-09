/**
 * "Google ile devam et" (plan v10 PRD-14).
 *
 * Düz bir bağlantı: API tarayıcıyı Google'a gönderir, Google geri yollar, API
 * oturumu açıp panele yönlendirir. Sayfada hiçbir Google betiği çalışmaz.
 * Düğme yalnızca sunucuda Google istemcisi tanımlıyken görünür
 * (GET /api/auth/config → googleSignIn).
 */
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { authAPI } from '../../services/api';
import { API_BASE_URL } from '../../lib/runtime';

/** Google's "G", as its sign-in button guidelines draw it. */
export const GoogleMark = ({ className = 'w-[18px] h-[18px]' }: { className?: string }) => (
  <svg viewBox="0 0 48 48" className={className} aria-hidden="true" focusable="false">
    <path
      fill="#EA4335"
      d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
    />
    <path
      fill="#4285F4"
      d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
    />
    <path
      fill="#FBBC05"
      d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
    />
    <path
      fill="#34A853"
      d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
    />
  </svg>
);

/** Whether the server offers sign-in with Google. */
export function useGoogleSignIn(): boolean {
  const [enabled, setEnabled] = useState(false);
  useEffect(() => {
    let live = true;
    authAPI
      .config()
      .then((res) => live && setEnabled(Boolean(res.data.googleSignIn)))
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, []);
  return enabled;
}

const GoogleButton = ({ lang, note }: { lang: 'tr' | 'en'; note?: React.ReactNode }) => {
  const { t } = useTranslation();
  return (
    <div className="space-y-4">
      <a
        href={`${API_BASE_URL}/auth/google/start?lang=${lang}`}
        className="w-full inline-flex items-center justify-center gap-3 h-12 px-5 rounded-xl border border-gray-300 dark:border-white/15 bg-white dark:bg-white/[0.04] text-[15px] font-semibold text-gray-800 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-white/[0.08] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
      >
        <GoogleMark />
        {t('account.google.continue')}
      </a>
      {note}
      <div className="flex items-center gap-3 text-[12.5px] text-gray-500 dark:text-gray-400">
        <span className="h-px flex-1 bg-gray-200 dark:bg-white/10" />
        {t('account.google.or')}
        <span className="h-px flex-1 bg-gray-200 dark:bg-white/10" />
      </div>
    </div>
  );
};

export default GoogleButton;
