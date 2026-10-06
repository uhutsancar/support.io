/**
 * The owner's "delete account": it deletes the whole workspace
 * (backend/src/services/organizationDeletion.ts), so it says what goes with
 * it, points at the data export first, and asks for the password again.
 */
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { authAPI } from '../services/api';
import { errorMessage } from '../hooks/useAsync';

const DeleteWorkspaceDialog = ({
  isOpen,
  onClose,
  onDeleted,
  base
}: {
  isOpen: boolean;
  onClose: () => void;
  /** Called once the workspace is gone; the caller signs out. */
  onDeleted: () => void;
  /** The dashboard root, with the language prefix. */
  base: string;
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  if (!isOpen) return null;

  const close = () => {
    setPassword('');
    setProblem(null);
    onClose();
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setProblem(null);
    try {
      await authAPI.deleteAccount(password);
      onDeleted();
    } catch (error) {
      const code = (error as { response?: { data?: { code?: string } } }).response?.data?.code;
      const message = errorMessage(error, t('account.deleteFailed'));
      if (code === 'SUBSCRIPTION_ACTIVE') {
        toast.error(message, { duration: 8000 });
        close();
        navigate(`${base}/billing`);
      } else {
        setProblem(message);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <form
        onSubmit={submit}
        className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full"
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-workspace-title"
      >
        <div className="flex items-start justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
              <AlertTriangle className="w-6 h-6 text-red-600 dark:text-red-400" />
            </div>
            <h3
              id="delete-workspace-title"
              className="text-xl font-bold text-gray-900 dark:text-white"
            >
              {t('account.workspace.title')}
            </h3>
          </div>
          <button
            type="button"
            onClick={close}
            aria-label={t('common.cancel')}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6 space-y-4">
          <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
            {t('account.workspace.body')}
          </p>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {t('account.workspace.export')}{' '}
            <Link
              to={`${base}/settings`}
              onClick={close}
              className="font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
            >
              {t('account.workspace.exportLink')}
            </Link>
          </p>
          <label className="block">
            <span className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              {t('account.workspace.password')}
            </span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
              className="w-full px-3 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none"
            />
          </label>
          {problem && (
            <p role="alert" className="text-sm text-red-600 dark:text-red-400">
              {problem}
            </p>
          )}
        </div>
        <div className="flex items-center justify-end gap-3 p-6 bg-gray-50 dark:bg-gray-900/50 rounded-b-2xl">
          <button
            type="button"
            onClick={close}
            className="px-6 py-2.5 rounded-lg font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            {t('common.cancel')}
          </button>
          <button
            type="submit"
            disabled={busy || !password}
            className="px-6 py-2.5 rounded-lg font-medium text-white bg-red-600 hover:bg-red-700 disabled:opacity-50"
          >
            {busy ? t('common.loading') : t('account.workspace.confirm')}
          </button>
        </div>
      </form>
    </div>
  );
};

export default DeleteWorkspaceDialog;
