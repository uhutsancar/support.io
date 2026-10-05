/**
 * /invite/accept?token=… — where an invitation e-mail leads.
 *
 * Shows which workspace and role the invitation is for, then lets the person
 * choose their name and their own password. Accepting signs them in.
 */
import React, { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import AuthLayout, { Field } from '../components/marketing/AuthLayout';
import { Button } from '../components/marketing/kit';
import { invitationsAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { errorMessage } from '../hooks/useAsync';

interface Preview {
  email: string;
  role: string;
  organization: string | null;
}

const AcceptInvitation = () => {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const prefix = language === 'en' ? '/en' : '';
  const navigate = useNavigate();
  const { refresh } = useAuth();
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const [preview, setPreview] = useState<Preview | null>(null);
  const [invalid, setInvalid] = useState(!token);
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!token) return;
    invitationsAPI
      .preview(token)
      .then(({ data }) => setPreview(data))
      .catch(() => setInvalid(true));
  }, [token]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await invitationsAPI.accept(token, name, password);
      await refresh();
      toast.success(t('acceptInvite.welcome'));
      navigate(`${prefix}/dashboard`);
    } catch (error) {
      toast.error(errorMessage(error, t('acceptInvite.error')));
    } finally {
      setLoading(false);
    }
  };

  const subtitle = invalid
    ? t('acceptInvite.invalid')
    : preview
      ? t('acceptInvite.subtitle', {
          organization: preview.organization || 'Support.io',
          role: t(`team.filters.${preview.role}`)
        })
      : t('common.loading');

  return (
    <>
      <Helmet>
        <title>{`${t('acceptInvite.title')} — Support.io`}</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>
      <AuthLayout
        side="login"
        title={t('acceptInvite.title')}
        subtitle={subtitle}
        footer={
          <p className="text-[14px] text-gray-600 dark:text-gray-400">
            <Link
              to={`${prefix}/login`}
              className="font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
            >
              {t('recovery.backToLogin')}
            </Link>
          </p>
        }
      >
        {preview && !invalid && (
          <form onSubmit={submit} className="space-y-5">
            <Field label={t('login.email')} type="email" value={preview.email} disabled readOnly />
            <Field
              label={t('acceptInvite.name')}
              type="text"
              value={name}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
              autoComplete="name"
              required
            />
            <Field
              label={t('acceptInvite.password')}
              type="password"
              value={password}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
              autoComplete="new-password"
              minLength={8}
              required
            />
            <Button type="submit" size="lg" disabled={loading} className="w-full">
              {loading ? t('common.loading') : t('acceptInvite.join')}
            </Button>
          </form>
        )}
      </AuthLayout>
    </>
  );
};

export default AcceptInvitation;
