import { Helmet } from 'react-helmet-async';
import { ArrowLeft } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Shell from '../components/marketing/Shell';
import { pageTitle } from '../lib/brand';

const NotFound = () => {
  const { t } = useTranslation();
  const location = useLocation();
  const home = location.pathname.startsWith('/en') ? '/en' : '/';

  return (
    <Shell>
      <Helmet>
        <title>{pageTitle(t('notFound.title'))}</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>
      <section className="min-h-[70vh] px-5 pt-36 pb-20 sm:px-8 sm:pt-44">
        <div className="mx-auto max-w-xl text-center">
          <p className="text-sm font-semibold tracking-[0.16em] text-indigo-600">404</p>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight text-gray-950 dark:text-white sm:text-4xl">
            {t('notFound.title')}
          </h1>
          <p className="mt-4 text-base leading-7 text-gray-600 dark:text-gray-300">
            {t('notFound.body')}
          </p>
          <Link
            to={home}
            className="mt-8 inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            {t('notFound.home')}
          </Link>
        </div>
      </section>
    </Shell>
  );
};

export default NotFound;
