/**
 * The subscription's invoices (BIL-06). Paddle issues them, with the company
 * name and tax number entered at checkout; the PDF link it hands out is
 * short-lived, so it is fetched when the owner clicks.
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { Download, FileText } from 'lucide-react';
import { billingAPI } from '../../services/api';
import { errorMessage, useAsync } from '../../hooks/useAsync';
import type { Invoice } from '../../types/api';

const Invoices = ({ locale }: { locale: string }) => {
  const { t } = useTranslation();
  const state = useAsync<Invoice[]>(() => billingAPI.invoices().then((r) => r.data.invoices), [], {
    initial: [],
    fallbackMessage: t('billing.invoices.loadError')
  });
  const [opening, setOpening] = useState<string | null>(null);

  const open = async (id: string) => {
    // Opened before the request so a pop-up blocker sees the click.
    const tab = window.open('', '_blank');
    setOpening(id);
    try {
      const { data } = await billingAPI.invoicePdf(id);
      if (tab) {
        tab.opener = null;
        tab.location.href = data.url;
      } else {
        window.location.href = data.url;
      }
    } catch (error) {
      tab?.close();
      toast.error(errorMessage(error, t('billing.invoices.openError')));
    } finally {
      setOpening(null);
    }
  };

  const money = (amount: number, currency: string) =>
    new Intl.NumberFormat(locale, { style: 'currency', currency }).format(amount);
  const date = (value: string | null) =>
    value ? new Date(value).toLocaleDateString(locale, { dateStyle: 'medium' }) : '';

  return (
    <section
      aria-labelledby="invoices-title"
      className="mt-6 rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6"
    >
      <h2
        id="invoices-title"
        className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-gray-400"
      >
        <FileText className="w-4 h-4" />
        {t('billing.invoices.title')}
      </h2>
      {state.error ? (
        <p className="mt-4 text-sm text-red-600 dark:text-red-400">{state.error}</p>
      ) : state.loading ? (
        <p className="mt-4 text-sm text-gray-500">{t('common.loading')}</p>
      ) : state.data.length === 0 ? (
        <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">
          {t('billing.invoices.empty')}
        </p>
      ) : (
        <ul className="mt-4 divide-y divide-gray-100 dark:divide-gray-700">
          {state.data.map((invoice) => (
            <li
              key={invoice.id}
              className="flex flex-wrap items-center gap-x-4 gap-y-1 py-3 text-sm"
            >
              <span className="font-medium text-gray-900 dark:text-white">
                {invoice.number ?? t('billing.invoices.pending')}
              </span>
              <span className="text-gray-500 dark:text-gray-400">{date(invoice.billedAt)}</span>
              {invoice.total !== null && (
                <span className="text-gray-700 dark:text-gray-200">
                  {money(invoice.total, invoice.currency)}
                </span>
              )}
              <button
                type="button"
                onClick={() => open(invoice.id)}
                disabled={opening === invoice.id}
                className="ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
              >
                <Download className="w-4 h-4" />
                {t('billing.invoices.download')}
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-4 text-xs text-gray-500 dark:text-gray-400">{t('billing.invoices.note')}</p>
    </section>
  );
};

export default Invoices;
