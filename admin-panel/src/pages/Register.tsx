/**
 * Kayıt.
 *
 * Giriş ekranıyla aynı iki sorunu taşıyordu: siteyle ilgisiz tam ekran
 * gradyan ve açılış `<div>`inin ardında sayfaya basılan kaçak `)` karakteri.
 * Düzen artık AuthLayout'tan geliyor; sağ panel kayıt olurken neye kayıt
 * olunduğunu gösteriyor.
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

const Register = () => {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  const langPrefix = language === 'en' ? '/en' : '';
  const routes = {
    login: langPrefix + '/login',
    dashboard: langPrefix + '/dashboard',
    onboarding: langPrefix + '/onboarding'
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const data = await register(name, email, password);
      // Yeni hesap sahibi once kuruluma gider. Panele yonlendirip guard'in geri
      // atmasini beklemek, kullaniciya bir an gosterge panelini gosterip disari
      // atiyordu.
      const needsOnboarding = data?.user?.role === 'owner' && data?.user?.isOnboarded === false;
      navigate(needsOnboarding ? routes.onboarding : routes.dashboard);
      toast.success(t('register.success'));
    } catch (err) {
      toast.error(err.response?.data?.error || t('register.error'));
    } finally {
      setLoading(false);
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
        title={t('register.title')}
        subtitle={t('register.subtitle')}
        footer={
          <p className="text-[14px] text-gray-600 dark:text-gray-400">
            {t('register.hasAccount')}{' '}
            <Link to={routes.login} className="font-semibold text-indigo-600 dark:text-indigo-400 hover:underline">
              {t('register.login')}
            </Link>
          </p>
        }
      >
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
            minLength={6}
          />
          <Button type="submit" size="lg" disabled={loading} className="w-full">
            {loading ? t('common.loading') : t('register.registerButton')}
          </Button>
          <p className="text-[12.5px] leading-relaxed text-gray-500 dark:text-gray-400 text-center">
            {t('register.noCard')}
          </p>
        </form>
      </AuthLayout>
    </>
  );
};

export default Register;
