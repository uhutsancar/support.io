import React from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { reportError } from '../lib/telemetry';

const CHUNK_ERROR =
  /failed to fetch dynamically imported module|loading chunk [\w-]+ failed|importing a module script failed/i;

interface Props {
  children: React.ReactNode;
  compact?: boolean;
}

interface State {
  error: Error | null;
}

const ErrorFallback = ({ error, compact }: { error: Error; compact: boolean }) => {
  const { t } = useTranslation();
  const staleChunk = CHUNK_ERROR.test(error.message);

  return (
    <div
      className={`${compact ? 'min-h-[18rem]' : 'min-h-screen'} flex items-center justify-center px-4 py-12 bg-gray-50 dark:bg-gray-900`}
      role="alert"
    >
      <div className="w-full max-w-md rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-7 text-center shadow-sm">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400">
          <AlertTriangle className="h-6 w-6" aria-hidden="true" />
        </span>
        <h1 className="mt-4 text-lg font-semibold text-gray-900 dark:text-white">
          {staleChunk ? t('common.newVersionTitle') : t('common.unexpectedErrorTitle')}
        </h1>
        <p className="mt-2 text-sm leading-6 text-gray-600 dark:text-gray-300">
          {staleChunk ? t('common.newVersionBody') : t('common.unexpectedErrorBody')}
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-5 inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800"
        >
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          {t('common.reloadPage')}
        </button>
      </div>
    </div>
  );
};

export default class ErrorBoundary extends React.Component<Props, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error): void {
    reportError(error);
  }

  override render(): React.ReactNode {
    if (this.state.error) {
      return <ErrorFallback error={this.state.error} compact={this.props.compact === true} />;
    }
    return this.props.children;
  }
}
