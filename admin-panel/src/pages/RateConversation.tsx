/**
 * /rate?t=…  — the page the rating mail opens (plan v10 PRD-04).
 *
 * The reader is a customer's visitor, not a Support.io user: the page is
 * plain, names the customer's site, and asks one question. The token in the
 * link is the only proof; nothing else is needed or stored.
 */
import { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ThumbsDown, ThumbsUp } from 'lucide-react';
import { api } from '../services/http';

interface RatingInfo {
  site: string;
  style: 'thumbs' | 'stars';
  rated: boolean;
}

const RateConversation = () => {
  const { t } = useTranslation();
  const [params] = useSearchParams();
  const token = params.get('t') || '';
  const [info, setInfo] = useState<RatingInfo | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'done' | 'invalid'>('loading');
  const [score, setScore] = useState(0);
  const [feedback, setFeedback] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!token) {
      setState('invalid');
      return;
    }
    api
      .get<RatingInfo>('/widget/rating', { params: { t: token }, cache: false })
      .then(({ data }) => {
        setInfo(data);
        setState(data.rated ? 'done' : 'ready');
      })
      .catch(() => setState('invalid'));
  }, [token]);

  const send = async () => {
    setBusy(true);
    try {
      await api.post('/widget/rating', { t: token, score, feedback });
      setState('done');
    } catch {
      setState('invalid');
    } finally {
      setBusy(false);
    }
  };

  const choice = (value: number, label: string, content: React.ReactNode) => (
    <button
      key={value}
      type="button"
      aria-pressed={info?.style === 'stars' ? value <= score : score === value}
      aria-label={label}
      onClick={() => setScore(value)}
      className={`min-w-[48px] min-h-[48px] px-3 rounded-xl border text-sm font-medium inline-flex items-center justify-center gap-2 transition ${
        (info?.style === 'stars' ? value <= score : score === value)
          ? 'border-indigo-600 bg-indigo-50 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300'
          : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200'
      }`}
    >
      {content}
    </button>
  );

  return (
    <>
      <Helmet>
        <title>{t('account.rating.title')}</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>
      <main className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 sm:p-8">
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
            {t('account.rating.title')}
          </h1>
          {state === 'loading' && (
            <p className="mt-4 text-sm text-gray-500">{t('common.loading')}</p>
          )}
          {state === 'invalid' && (
            <p className="mt-4 text-sm text-gray-600 dark:text-gray-300">
              {t('account.rating.invalid')}
            </p>
          )}
          {state === 'done' && (
            <p className="mt-4 text-sm text-gray-600 dark:text-gray-300" role="status">
              {info?.rated && score === 0
                ? t('account.rating.already')
                : t('account.rating.thanks')}
            </p>
          )}
          {state === 'ready' && info && (
            <div className="mt-4 space-y-4">
              <p className="text-sm text-gray-600 dark:text-gray-300">
                {t('account.rating.subtitle', { site: info.site })}
              </p>
              <div className="flex gap-2" role="group" aria-label={t('account.rating.title')}>
                {info.style === 'stars'
                  ? [1, 2, 3, 4, 5].map((n) =>
                      choice(n, t('account.rating.star', { n }), <span className="text-xl">★</span>)
                    )
                  : [
                      choice(
                        5,
                        t('account.rating.up'),
                        <>
                          <ThumbsUp className="w-4 h-4" /> {t('account.rating.up')}
                        </>
                      ),
                      choice(
                        1,
                        t('account.rating.down'),
                        <>
                          <ThumbsDown className="w-4 h-4" /> {t('account.rating.down')}
                        </>
                      )
                    ]}
              </div>
              <textarea
                rows={3}
                maxLength={1000}
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                aria-label={t('account.rating.feedback')}
                placeholder={t('account.rating.feedback')}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-white"
              />
              <button
                type="button"
                disabled={!score || busy}
                onClick={send}
                className="w-full px-4 py-2.5 rounded-lg bg-indigo-600 text-white text-sm font-semibold disabled:opacity-50"
              >
                {t('account.rating.send')}
              </button>
            </div>
          )}
        </div>
      </main>
    </>
  );
};

export default RateConversation;
