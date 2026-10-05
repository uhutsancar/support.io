/**
 * The three pages an e-mail link leads to, or that lead to an e-mail:
 *
 *   ForgotPassword  ask for a reset link (same answer for every address)
 *   ResetPassword   /reset-password?token=…  choose a new password
 *   VerifyEmail     /verify-email?token=…    prove the address
 *
 * They share the sign-in screens' shell (AuthLayout). The token only ever
 * lives in the URL the mail opened; it is sent once and not stored.
 */
import React, { useEffect, useRef, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import AuthLayout, { Field } from '../components/marketing/AuthLayout';
import { Button } from '../components/marketing/kit';
import { authAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { errorMessage } from '../hooks/useAsync';

function usePrefix() {
  const { language } = useLanguage();
  return language === 'en' ? '/en' : '';
}

const linkClass = 'font-semibold text-indigo-600 dark:text-indigo-400 hover:underline';

export const ForgotPassword = () => {
  const { t, i18n } = useTranslation();
  const prefix = usePrefix();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await authAPI.forgotPassword(email, i18n.language);
      // The server answers the same for every address; so does this page.
      setSent(true);
    } catch (error) {
      toast.error(errorMessage(error, t('recovery.error')));
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Helmet>
        <title>{`${t('recovery.forgotTitle')} — Support.io`}</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>
      <AuthLayout
        side="login"
        title={t('recovery.forgotTitle')}
        subtitle={sent ? t('recovery.forgotSent') : t('recovery.forgotSubtitle')}
        footer={
          <p className="text-[14px] text-gray-600 dark:text-gray-400">
            <Link to={`${prefix}/login`} className={linkClass}>
              {t('recovery.backToLogin')}
            </Link>
          </p>
        }
      >
        {!sent && (
          <form onSubmit={submit} className="space-y-5">
            <Field
              label={t('login.email')}
              type="email"
              value={email}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
              placeholder={t('login.emailPlaceholder')}
              autoComplete="email"
              required
            />
            <Button type="submit" size="lg" disabled={loading} className="w-full">
              {loading ? t('common.loading') : t('recovery.sendLink')}
            </Button>
          </form>
        )}
      </AuthLayout>
    </>
  );
};

export const ResetPassword = () => {
  const { t } = useTranslation();
  const prefix = usePrefix();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) {
      toast.error(t('recovery.mismatch'));
      return;
    }
    setLoading(true);
    try {
      await authAPI.resetPassword(token, password);
      toast.success(t('recovery.resetDone'));
      navigate(`${prefix}/login`);
    } catch (error) {
      toast.error(errorMessage(error, t('recovery.invalidLink')));
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Helmet>
        <title>{`${t('recovery.resetTitle')} — Support.io`}</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>
      <AuthLayout
        side="login"
        title={t('recovery.resetTitle')}
        subtitle={token ? t('recovery.resetSubtitle') : t('recovery.invalidLink')}
        footer={
          <p className="text-[14px] text-gray-600 dark:text-gray-400">
            <Link to={`${prefix}/forgot-password`} className={linkClass}>
              {t('recovery.newLink')}
            </Link>
          </p>
        }
      >
        {token && (
          <form onSubmit={submit} className="space-y-5">
            <Field
              label={t('recovery.newPassword')}
              type="password"
              value={password}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
              autoComplete="new-password"
              minLength={8}
              required
            />
            <Field
              label={t('recovery.confirmPassword')}
              type="password"
              value={confirm}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setConfirm(e.target.value)}
              autoComplete="new-password"
              minLength={8}
              required
            />
            <p className="text-[13px] text-gray-500 dark:text-gray-400">
              {t('recovery.signsOutEverywhere')}
            </p>
            <Button type="submit" size="lg" disabled={loading} className="w-full">
              {loading ? t('common.loading') : t('recovery.savePassword')}
            </Button>
          </form>
        )}
      </AuthLayout>
    </>
  );
};

export const VerifyEmail = () => {
  const { t } = useTranslation();
  const prefix = usePrefix();
  const [params] = useSearchParams();
  const { user, patchUser } = useAuth();
  const token = params.get('token') || '';
  const [state, setState] = useState<'working' | 'done' | 'failed'>(token ? 'working' : 'failed');
  // React 18 runs effects twice in development; a token is single-use, so
  // the second run must not spend it again and report failure.
  const started = useRef(false);

  useEffect(() => {
    if (!token || started.current) return;
    started.current = true;
    authAPI
      .verifyEmail(token)
      .then(() => {
        setState('done');
        if (user) patchUser({ emailVerified: true });
      })
      .catch(() => setState('failed'));
  }, [token]);

  return (
    <>
      <Helmet>
        <title>{`${t('recovery.verifyTitle')} — Support.io`}</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>
      <AuthLayout
        side="login"
        title={t('recovery.verifyTitle')}
        subtitle={
          state === 'working'
            ? t('common.loading')
            : state === 'done'
              ? t('recovery.verifyDone')
              : t('recovery.verifyFailed')
        }
        footer={
          <p className="text-[14px] text-gray-600 dark:text-gray-400">
            <Link to={user ? `${prefix}/dashboard` : `${prefix}/login`} className={linkClass}>
              {user ? t('recovery.toDashboard') : t('recovery.backToLogin')}
            </Link>
          </p>
        }
      />
    </>
  );
};

/**
 * The strip across the dashboard while the owner's address is unverified:
 * the panel works, but the widget and billing wait for this.
 */
export const VerifyEmailBanner = () => {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const [sending, setSending] = useState(false);
  if (!user || user.emailVerified !== false) return null;

  const resend = async () => {
    setSending(true);
    try {
      await authAPI.resendVerification(i18n.language);
      toast.success(t('recovery.resent', { email: user.email }));
    } catch (error) {
      toast.error(errorMessage(error, t('recovery.error')));
    } finally {
      setSending(false);
    }
  };

  return (
    <div
      role="status"
      className="mb-4 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 px-4 py-3 rounded-lg border border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200 text-sm"
    >
      <span className="flex-1">{t('recovery.banner', { email: user.email })}</span>
      <button
        type="button"
        onClick={resend}
        disabled={sending}
        className="self-start sm:self-auto px-3 py-1.5 rounded-md bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-50 transition"
      >
        {t('recovery.resend')}
      </button>
    </div>
  );
};
