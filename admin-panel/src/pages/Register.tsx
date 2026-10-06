/**
 * Kayıt.
 *
 * Giriş ekranıyla aynı iki sorunu taşıyordu: siteyle ilgisiz tam ekran
 * gradyan ve açılış `<div>`inin ardında sayfaya basılan kaçak `)` karakteri.
 * Düzen artık AuthLayout'tan geliyor; sağ panel kayıt olurken neye kayıt
 * olunduğunu gösteriyor.
 *
 * Kayıt e-posta önceliklidir (plan v10 SEC-06): form yalnızca doğrulama
 * bağlantısını gönderir ve "gelen kutunuzu kontrol edin" ekranına geçer;
 * oturum bağlantı açılınca başlar. Sunucu adres kayıtlı olsa da olmasa da
 * aynı cevabı verir, bu ekran da öyle. Sunucu bir Turnstile anahtarı
 * verdiyse form gönderilmeden önce bot doğrulaması istenir.
 */
import React, { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { MailCheck } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useMarketingRoutes } from '../components/marketing/Shell';
import AuthLayout, { Field } from '../components/marketing/AuthLayout';
import Turnstile from '../components/marketing/Turnstile';
import { Button } from '../components/marketing/kit';
import { errorMessage } from '../hooks/useAsync';
import { authAPI } from '../services/api';

const Register = () => {
  const marketing = useMarketingRoutes();
  const { t, i18n } = useTranslation();
  const { language } = useLanguage();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [siteKey, setSiteKey] = useState<string | null>(null);
  const [minLength, setMinLength] = useState(10);
  const [captcha, setCaptcha] = useState<string | null>(null);
  const [captchaReset, setCaptchaReset] = useState(0);
  const { register } = useAuth();

  const langPrefix = language === 'en' ? '/en' : '';
  const routes = { login: langPrefix + '/login' };

  useEffect(() => {
    authAPI
      .config()
      .then((res) => {
        setSiteKey(res.data.turnstileSiteKey);
        setMinLength(res.data.passwordMinLength || 10);
      })
      .catch(() => {
        /* the form still works; the server decides */
      });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await register({
        name,
        email,
        password,
        locale: i18n.language,
        ...(captcha ? { turnstileToken: captcha } : {})
      });
      setSentTo(email);
    } catch (error) {
      toast.error(errorMessage(error, t('register.error')));
      // A Turnstile answer works once; a new one is needed for the retry.
      if (siteKey) setCaptchaReset((n) => n + 1);
    } finally {
      setLoading(false);
    }
  };

  const resend = async () => {
    if (!sentTo) return;
    try {
      await authAPI.resendVerificationLink(sentTo, i18n.language);
      toast.success(t('account.register.resent'));
    } catch (error) {
      toast.error(errorMessage(error, t('recovery.error')));
    }
  };

  return (
    <>
      <Helmet>
        <title>{t('register.metaTitle')}</title>
        <meta name="description" content={t('register.metaDescription')} />
        <meta name="keywords" content={t('register.metaKeywords')} />
        <meta property="og:title" content={t('register.metaOgTitle')} />
        <meta property="og:description" content={t('register.metaOgDescription')} />
      </Helmet>

      <AuthLayout
        side="register"
        title={sentTo ? t('account.register.checkInboxTitle') : t('register.title')}
        subtitle={
          sentTo ? t('account.register.checkInboxBody', { email: sentTo }) : t('register.subtitle')
        }
        footer={
          <p className="text-[14px] text-gray-600 dark:text-gray-400">
            {t('register.hasAccount')}{' '}
            <Link
              to={routes.login}
              className="font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
            >
              {t('register.login')}
            </Link>
          </p>
        }
      >
        {sentTo ? (
          <div className="space-y-5" role="status">
            <div className="flex items-start gap-3 rounded-xl border border-indigo-100 dark:border-indigo-500/20 bg-indigo-50/60 dark:bg-indigo-500/10 p-4">
              <MailCheck className="w-5 h-5 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
              <p className="text-[14px] text-gray-700 dark:text-gray-300">
                {t('account.register.checkInboxHint')}
              </p>
            </div>
            <Button type="button" size="lg" variant="secondary" onClick={resend} className="w-full">
              {t('account.register.resend')}
            </Button>
            <button
              type="button"
              onClick={() => {
                setSentTo(null);
                setPassword('');
                setCaptchaReset((n) => n + 1);
              }}
              className="w-full text-[13.5px] font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
            >
              {t('account.register.otherAddress')}
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            <Field
              label={t('register.name')}
              type="text"
              value={name}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
              placeholder={t('register.namePlaceholder')}
              autoComplete="name"
              required
            />
            <Field
              label={t('register.email')}
              type="email"
              value={email}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
              placeholder={t('register.emailPlaceholder')}
              autoComplete="email"
              required
            />
            <Field
              label={t('register.password')}
              type="password"
              value={password}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
              placeholder={t('register.passwordPlaceholder')}
              autoComplete="new-password"
              hint={t('register.passwordHint')}
              required
              minLength={minLength}
            />
            {siteKey && (
              <Turnstile
                siteKey={siteKey}
                language={language}
                onToken={setCaptcha}
                resetSignal={captchaReset}
              />
            )}
            <Button
              type="submit"
              size="lg"
              disabled={loading || Boolean(siteKey && !captcha)}
              className="w-full"
            >
              {loading ? t('common.loading') : t('register.registerButton')}
            </Button>
            <p className="text-[12.5px] leading-relaxed text-gray-500 dark:text-gray-400 text-center">
              {t('account.register.trialNote')} {t('register.noCard')}{' '}
              <Link
                to={marketing.terms}
                className="underline hover:text-gray-700 dark:hover:text-gray-200"
              >
                {t('legal.terms.title')}
              </Link>
              {' · '}
              <Link
                to={marketing.privacy}
                className="underline hover:text-gray-700 dark:hover:text-gray-200"
              >
                {t('legal.privacy.title')}
              </Link>
            </p>
          </form>
        )}
      </AuthLayout>
    </>
  );
};

export default Register;
