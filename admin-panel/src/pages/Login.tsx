/**
 * Giriş.
 *
 * Eskiden tam ekran indigo→mor→pembe gradyanın ortasında duran bir kutuydu;
 * sitenin hiçbir yerinde o gradyan yoktu. Ayrıca açılış `<div>`inin hemen
 * ardında kaçak bir `)` karakteri vardı ve sayfada görünür şekilde
 * basılıyordu. İkisi de gitti; düzen artık AuthLayout'tan geliyor.
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

const Login = () => {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const langPrefix = language === 'en' ? '/en' : '';
  const routes = {
    register: langPrefix + '/register',
    dashboard: langPrefix + '/dashboard',
    onboarding: langPrefix + '/onboarding'
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const data = await login(email, password);
      // Kurulumu yarim kalmis sahip dogrudan kuruluma gider; panele girip geri
      // atilmasi gereksiz bir sicrama yaratiyordu.
      const needsOnboarding = data?.user?.role === 'owner' && data?.user?.isOnboarded === false;
      navigate(needsOnboarding ? routes.onboarding : routes.dashboard);
      toast.success(t('login.success'));
    } catch (err) {
      toast.error(err.response?.data?.error || t('login.error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Helmet>
        <title>{t('login.metaTitle')}</title>
        <meta name="description" content={t('login.metaDescription')} />
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>

      <AuthLayout
        side="login"
        title={t('login.title')}
        subtitle={t('login.subtitle')}
        footer={
          <p className="text-[14px] text-gray-600 dark:text-gray-400">
            {t('login.noAccount')}{' '}
            <Link to={routes.register} className="font-semibold text-indigo-600 dark:text-indigo-400 hover:underline">
              {t('login.register')}
            </Link>
          </p>
        }
      >
        <form onSubmit={handleSubmit} className="space-y-5">
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
          <Button type="submit" size="lg" disabled={loading} className="w-full">
            {loading ? t('common.loading') : t('login.loginButton')}
          </Button>
        </form>
      </AuthLayout>
    </>
  );
};

export default Login;
