/**
 * Giriş.
 *
 * Eskiden tam ekran indigo→mor→pembe gradyanın ortasında duran bir kutuydu;
 * sitenin hiçbir yerinde o gradyan yoktu. Ayrıca açılış `<div>`inin hemen
 * ardında kaçak bir `)` karakteri vardı ve sayfada görünür şekilde
 * basılıyordu. İkisi de gitti; düzen artık AuthLayout'tan geliyor.
 *
 * İki ek durum (plan v10 SEC-04/06): adresi henüz doğrulanmamış hesap
 * sahibine yeni bağlantı gönderme düğmesi gösterilir; iki adımlı doğrulaması
 * açık hesap şifreden sonra uygulamadaki kodu (ya da bir kurtarma kodunu)
 * girer.
 */
import React, { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { useNavigate, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import AuthLayout, { Field } from '../components/marketing/AuthLayout';
import { Button } from '../components/marketing/kit';
import { errorMessage } from '../hooks/useAsync';
import { authAPI, isPendingSecondStep } from '../services/api';
import type { AuthResponse } from '../services/api';

const errorCode = (error: unknown): string =>
  String((error as { response?: { data?: { code?: unknown } } })?.response?.data?.code || '');

const Login = () => {
  const { t, i18n } = useTranslation();
  const { language } = useLanguage();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [unverified, setUnverified] = useState(false);
  const [mfaToken, setMfaToken] = useState<string | null>(null);
  const [useRecovery, setUseRecovery] = useState(false);
  const [code, setCode] = useState('');
  const { login, loginSecondStep } = useAuth();
  const navigate = useNavigate();

  const langPrefix = language === 'en' ? '/en' : '';
  const routes = {
    register: langPrefix + '/register',
    dashboard: langPrefix + '/dashboard',
    onboarding: langPrefix + '/onboarding'
  };

  const enter = (data: AuthResponse) => {
    // Kurulumu yarim kalmis sahip dogrudan kuruluma gider; panele girip geri
    // atilmasi gereksiz bir sicrama yaratiyordu.
    const needsOnboarding = data.user?.role === 'owner' && data.user?.isOnboarded === false;
    navigate(needsOnboarding ? routes.onboarding : routes.dashboard);
    toast.success(t('login.success'));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setUnverified(false);
    try {
      const data = await login(email, password);
      if (isPendingSecondStep(data)) {
        setMfaToken(data.mfaToken);
        setCode('');
        return;
      }
      enter(data);
    } catch (error) {
      if (errorCode(error) === 'EMAIL_NOT_VERIFIED') {
        setUnverified(true);
        return;
      }
      toast.error(errorMessage(error, t('login.error')));
    } finally {
      setLoading(false);
    }
  };

  const submitSecondStep = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mfaToken) return;
    setLoading(true);
    try {
      const data = await loginSecondStep(
        useRecovery ? { mfaToken, recoveryCode: code } : { mfaToken, code: code.replace(/\s/g, '') }
      );
      enter(data);
    } catch (error) {
      const failed = errorCode(error);
      toast.error(errorMessage(error, t('login.error')));
      if (failed === 'MFA_EXPIRED' || failed === 'TOO_MANY_MFA_ATTEMPTS') setMfaToken(null);
    } finally {
      setLoading(false);
    }
  };

  const sendLink = async () => {
    try {
      await authAPI.resendVerificationLink(email, i18n.language);
      toast.success(t('account.login.linkSent'));
    } catch (error) {
      toast.error(errorMessage(error, t('recovery.error')));
    }
  };

  const secondStep = Boolean(mfaToken);

  return (
    <>
      <Helmet>
        <title>{t('login.metaTitle')}</title>
        <meta name="description" content={t('login.metaDescription')} />
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>

      <AuthLayout
        side="login"
        title={secondStep ? t('account.login.mfaTitle') : t('login.title')}
        subtitle={
          secondStep
            ? useRecovery
              ? t('account.login.mfaRecoverySubtitle')
              : t('account.login.mfaSubtitle')
            : t('login.subtitle')
        }
        footer={
          <p className="text-[14px] text-gray-600 dark:text-gray-400">
            {t('login.noAccount')}{' '}
            <Link
              to={routes.register}
              className="font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
            >
              {t('login.register')}
            </Link>
          </p>
        }
      >
        {secondStep ? (
          <form onSubmit={submitSecondStep} className="space-y-5">
            <Field
              label={useRecovery ? t('account.login.recoveryCode') : t('account.login.code')}
              type="text"
              value={code}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCode(e.target.value)}
              inputMode={useRecovery ? 'text' : 'numeric'}
              autoComplete="one-time-code"
              pattern={useRecovery ? undefined : '[0-9 ]{6,7}'}
              maxLength={useRecovery ? 16 : 7}
              autoFocus
              required
            />
            <Button type="submit" size="lg" disabled={loading} className="w-full">
              {loading ? t('common.loading') : t('account.login.verify')}
            </Button>
            <div className="flex flex-col items-center gap-2 text-[13px]">
              <button
                type="button"
                onClick={() => {
                  setUseRecovery((v) => !v);
                  setCode('');
                }}
                className="font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
              >
                {useRecovery ? t('account.login.useApp') : t('account.login.useRecovery')}
              </button>
              <button
                type="button"
                onClick={() => {
                  setMfaToken(null);
                  setUseRecovery(false);
                  setPassword('');
                }}
                className="text-gray-500 dark:text-gray-400 hover:underline"
              >
                {t('account.login.startOver')}
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            {unverified && (
              <div
                role="alert"
                className="rounded-xl border border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 p-4 text-[14px] text-amber-900 dark:text-amber-200 space-y-3"
              >
                <p>{t('account.login.notVerified')}</p>
                <button
                  type="button"
                  onClick={sendLink}
                  className="font-semibold underline hover:no-underline"
                >
                  {t('account.login.sendLink')}
                </button>
              </div>
            )}
            <Field
              label={t('login.email')}
              type="email"
              value={email}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
              placeholder={t('login.emailPlaceholder')}
              autoComplete="email"
              required
            />
            <Field
              label={t('login.password')}
              type="password"
              value={password}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
              placeholder={t('login.passwordPlaceholder')}
              autoComplete="current-password"
              required
            />
            <div className="flex justify-end -mt-2">
              <Link
                to={langPrefix + '/forgot-password'}
                className="text-[13px] font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
              >
                {t('login.forgotPassword')}
              </Link>
            </div>
            <Button type="submit" size="lg" disabled={loading} className="w-full">
              {loading ? t('common.loading') : t('login.loginButton')}
            </Button>
          </form>
        )}
      </AuthLayout>
    </>
  );
};

export default Login;
