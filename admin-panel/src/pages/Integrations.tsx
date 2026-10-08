/**
 * Entegrasyonlar (plan v10 PRD-11): Slack, Telegram ve webhook.
 *
 * Adresler ve anahtarlar sunucuda mühürlü durur; burada yalnızca tanınacak
 * kadarı görünür. Webhook'un imza anahtarı bir kez, eklendiği anda
 * gösterilir. Her entegrasyonun deneme düğmesi ve gönderim geçmişi vardır.
 */
import { useEffect, useId, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { Hash, History, KeyRound, Plug, Plus, Send, Trash2, Webhook } from 'lucide-react';
import Modal from '../components/Modal';
import ConfirmDialog from '../components/ConfirmDialog';
import { integrationsAPI, sitesAPI } from '../services/api';
import { errorMessage } from '../hooks/useAsync';
import { formatDateTime } from '../lib/format';
import type { Integration, IntegrationDelivery, Site } from '../types/api';

type Kind = Integration['kind'];
const KINDS: Kind[] = ['slack', 'telegram', 'webhook'];
const EVENTS = ['conversation.created', 'message.created', 'conversation.closed', 'rating.created'];
const ICONS: Record<Kind, typeof Webhook> = { slack: Hash, telegram: Send, webhook: Webhook };

const field =
  'w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none';
const secondary =
  'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 text-sm text-gray-800 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50';

interface Draft {
  kind: Kind;
  name: string;
  siteId: string;
  events: string[];
  url: string;
  botToken: string;
  chatId: string;
  language: 'tr' | 'en';
}

const emptyDraft = (language: 'tr' | 'en'): Draft => ({
  kind: 'slack',
  name: '',
  siteId: '',
  events: ['conversation.created'],
  url: '',
  botToken: '',
  chatId: '',
  language
});

const Integrations = () => {
  const { t, i18n } = useTranslation();
  const [items, setItems] = useState<Integration[] | null>(null);
  const [sites, setSites] = useState<Site[]>([]);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState<Draft>(emptyDraft(i18n.language === 'en' ? 'en' : 'tr'));
  const [saving, setSaving] = useState(false);
  const [secret, setSecret] = useState<string | null>(null);
  const [log, setLog] = useState<{ item: Integration; rows: IntegrationDelivery[] } | null>(null);
  const [removing, setRemoving] = useState<Integration | null>(null);
  const [rotating, setRotating] = useState<Integration | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const ids = {
    name: useId(),
    site: useId(),
    url: useId(),
    token: useId(),
    chat: useId(),
    language: useId()
  };

  const load = async () => {
    try {
      const { data } = await integrationsAPI.list();
      setItems(data.integrations);
    } catch (error) {
      toast.error(errorMessage(error, t('integrations.error')));
      setItems([]);
    }
  };

  useEffect(() => {
    void load();
    sitesAPI
      .getAll()
      .then(({ data }) => setSites(data.sites || []))
      .catch(() => setSites([]));
  }, []);

  const siteName = (id: string | null) =>
    id ? (sites.find((s) => s._id === id)?.name ?? id) : t('integrations.allSites');

  const create = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        kind: draft.kind,
        name: draft.name,
        events: draft.events,
        siteId: draft.siteId || null,
        language: draft.language
      };
      if (draft.kind === 'telegram') {
        body.botToken = draft.botToken;
        body.chatId = draft.chatId;
      } else {
        body.url = draft.url;
      }
      const { data } = await integrationsAPI.create(body);
      toast.success(t('integrations.created'));
      setAdding(false);
      setDraft(emptyDraft(draft.language));
      if (data.signingSecret) setSecret(data.signingSecret);
      await load();
    } catch (error) {
      toast.error(errorMessage(error, t('integrations.error')));
    } finally {
      setSaving(false);
    }
  };

  const test = async (item: Integration) => {
    setBusy(item._id);
    try {
      const { data } = await integrationsAPI.test(item._id);
      if (data.delivered) toast.success(t('integrations.testOk'));
      else
        toast.error(
          t('integrations.testFailed', {
            reason: data.error || (data.status ? `HTTP ${data.status}` : '—')
          })
        );
      await load();
    } catch (error) {
      toast.error(errorMessage(error, t('integrations.error')));
    } finally {
      setBusy(null);
    }
  };

  const toggle = async (item: Integration) => {
    try {
      await integrationsAPI.update(item._id, { isActive: !item.isActive });
      await load();
    } catch (error) {
      toast.error(errorMessage(error, t('integrations.error')));
    }
  };

  const showLog = async (item: Integration) => {
    try {
      const { data } = await integrationsAPI.deliveries(item._id);
      setLog({ item, rows: data.deliveries });
    } catch (error) {
      toast.error(errorMessage(error, t('integrations.error')));
    }
  };

  const remove = async () => {
    if (!removing) return;
    try {
      await integrationsAPI.remove(removing._id);
      toast.success(t('integrations.removed'));
      await load();
    } catch (error) {
      toast.error(errorMessage(error, t('integrations.error')));
    }
  };

  const rotate = async () => {
    if (!rotating) return;
    try {
      const { data } = await integrationsAPI.rotateSecret(rotating._id);
      setSecret(data.signingSecret);
    } catch (error) {
      toast.error(errorMessage(error, t('integrations.error')));
    }
  };

  const toggleEvent = (name: string) =>
    setDraft((current) => ({
      ...current,
      events: current.events.includes(name)
        ? current.events.filter((e) => e !== name)
        : [...current.events, name]
    }));

  return (
    <>
      <Helmet>
        <title>{`${t('integrations.title')} — Support.io`}</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
              {t('integrations.title')}
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-2">{t('integrations.subtitle')}</p>
          </div>
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700"
          >
            <Plus className="w-4 h-4" aria-hidden="true" />
            {t('integrations.add')}
          </button>
        </div>

        {items === null ? null : items.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-300 dark:border-gray-600 p-10 text-center">
            <Plug className="w-10 h-10 mx-auto text-gray-500" aria-hidden="true" />
            <p className="mt-3 text-gray-700 dark:text-gray-300">{t('integrations.empty')}</p>
          </div>
        ) : (
          <ul className="space-y-3">
            {items.map((item) => {
              const Icon = ICONS[item.kind];
              return (
                <li
                  key={item._id}
                  className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      <span className="w-10 h-10 rounded-lg bg-indigo-50 dark:bg-indigo-500/15 flex items-center justify-center flex-shrink-0">
                        <Icon
                          className="w-5 h-5 text-indigo-700 dark:text-indigo-300"
                          aria-hidden="true"
                        />
                      </span>
                      <div className="min-w-0">
                        <h2 className="font-semibold text-gray-900 dark:text-white">{item.name}</h2>
                        <p className="text-sm text-gray-600 dark:text-gray-400 break-all">
                          {t(`integrations.kinds.${item.kind}`)} · {item.hint} ·{' '}
                          {siteName(item.siteId)}
                        </p>
                        <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">
                          {item.events.map((e) => t(`integrations.eventNames.${e}`)).join(', ')}
                        </p>
                        <p
                          className={`mt-1 text-xs ${item.lastStatus === 'error' ? 'text-red-700 dark:text-red-400' : 'text-gray-600 dark:text-gray-400'}`}
                        >
                          {item.lastStatus === 'ok'
                            ? t('integrations.lastOk')
                            : item.lastStatus === 'error'
                              ? t('integrations.lastError')
                              : t('integrations.neverSent')}
                          {item.lastDeliveryAt ? ` · ${formatDateTime(item.lastDeliveryAt)}` : ''}
                        </p>
                      </div>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-medium ${item.isActive ? 'bg-green-100 text-green-800 dark:bg-green-500/15 dark:text-green-300' : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'}`}
                    >
                      {item.isActive ? t('integrations.active') : t('integrations.paused')}
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      className={secondary}
                      disabled={busy === item._id}
                      onClick={() => test(item)}
                    >
                      <Send className="w-4 h-4" aria-hidden="true" />
                      {t('integrations.test')}
                    </button>
                    <button type="button" className={secondary} onClick={() => showLog(item)}>
                      <History className="w-4 h-4" aria-hidden="true" />
                      {t('integrations.deliveries')}
                    </button>
                    <button type="button" className={secondary} onClick={() => toggle(item)}>
                      {item.isActive ? t('integrations.pause') : t('integrations.resume')}
                    </button>
                    {item.kind === 'webhook' && (
                      <button type="button" className={secondary} onClick={() => setRotating(item)}>
                        <KeyRound className="w-4 h-4" aria-hidden="true" />
                        {t('integrations.rotate')}
                      </button>
                    )}
                    <button
                      type="button"
                      className={`${secondary} text-red-700 dark:text-red-400`}
                      onClick={() => setRemoving(item)}
                    >
                      <Trash2 className="w-4 h-4" aria-hidden="true" />
                      {t('integrations.remove')}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        <p className="mt-6 text-sm text-gray-600 dark:text-gray-400">{t('integrations.docs')}</p>
      </div>

      <Modal
        open={adding}
        onClose={() => setAdding(false)}
        title={t('integrations.add')}
        closeLabel={t('common.close')}
      >
        <form onSubmit={create} className="space-y-4">
          <fieldset>
            <legend className="sr-only">{t('integrations.add')}</legend>
            <div className="grid grid-cols-3 gap-2">
              {KINDS.map((kind) => {
                const Icon = ICONS[kind];
                return (
                  <label
                    key={kind}
                    className={`flex flex-col items-center gap-1 p-3 rounded-lg border cursor-pointer text-sm ${draft.kind === kind ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10' : 'border-gray-200 dark:border-gray-700'}`}
                  >
                    <input
                      type="radio"
                      name="kind"
                      value={kind}
                      checked={draft.kind === kind}
                      onChange={() => setDraft({ ...draft, kind })}
                      className="sr-only"
                    />
                    <Icon className="w-5 h-5" aria-hidden="true" />
                    {t(`integrations.kinds.${kind}`)}
                  </label>
                );
              })}
            </div>
            <p className="mt-2 text-xs text-gray-600 dark:text-gray-400">
              {t(`integrations.kindHelp.${draft.kind}`)}
            </p>
          </fieldset>
          <div>
            <label
              htmlFor={ids.name}
              className="block text-sm font-medium mb-1 text-gray-900 dark:text-white"
            >
              {t('integrations.name')}
            </label>
            <input
              id={ids.name}
              required
              maxLength={60}
              value={draft.name}
              placeholder={t('integrations.namePlaceholder')}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              className={field}
            />
          </div>
          {draft.kind === 'telegram' ? (
            <>
              <div>
                <label
                  htmlFor={ids.token}
                  className="block text-sm font-medium mb-1 text-gray-900 dark:text-white"
                >
                  {t('integrations.botToken')}
                </label>
                <input
                  id={ids.token}
                  required
                  autoComplete="off"
                  value={draft.botToken}
                  onChange={(e) => setDraft({ ...draft, botToken: e.target.value })}
                  className={field}
                />
              </div>
              <div>
                <label
                  htmlFor={ids.chat}
                  className="block text-sm font-medium mb-1 text-gray-900 dark:text-white"
                >
                  {t('integrations.chatId')}
                </label>
                <input
                  id={ids.chat}
                  required
                  value={draft.chatId}
                  onChange={(e) => setDraft({ ...draft, chatId: e.target.value })}
                  className={field}
                />
              </div>
            </>
          ) : (
            <div>
              <label
                htmlFor={ids.url}
                className="block text-sm font-medium mb-1 text-gray-900 dark:text-white"
              >
                {draft.kind === 'slack' ? t('integrations.slackUrl') : t('integrations.url')}
              </label>
              <input
                id={ids.url}
                type="url"
                required
                autoComplete="off"
                value={draft.url}
                placeholder={
                  draft.kind === 'slack' ? 'https://hooks.slack.com/services/…' : 'https://'
                }
                onChange={(e) => setDraft({ ...draft, url: e.target.value })}
                className={field}
              />
            </div>
          )}
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor={ids.site}
                className="block text-sm font-medium mb-1 text-gray-900 dark:text-white"
              >
                {t('integrations.site')}
              </label>
              <select
                id={ids.site}
                value={draft.siteId}
                onChange={(e) => setDraft({ ...draft, siteId: e.target.value })}
                className={field}
              >
                <option value="">{t('integrations.allSites')}</option>
                {sites.map((site) => (
                  <option key={site._id} value={site._id}>
                    {site.name}
                  </option>
                ))}
              </select>
            </div>
            {draft.kind !== 'webhook' && (
              <div>
                <label
                  htmlFor={ids.language}
                  className="block text-sm font-medium mb-1 text-gray-900 dark:text-white"
                >
                  {t('integrations.language')}
                </label>
                <select
                  id={ids.language}
                  value={draft.language}
                  onChange={(e) => setDraft({ ...draft, language: e.target.value as 'tr' | 'en' })}
                  className={field}
                >
                  {/* i18n-ignore: each language by its own name */}
                  <option value="tr">Türkçe</option>
                  <option value="en">English</option>
                </select>
              </div>
            )}
          </div>
          <fieldset>
            <legend className="text-sm font-medium text-gray-900 dark:text-white mb-2">
              {t('integrations.events')}
            </legend>
            <div className="grid sm:grid-cols-2 gap-2">
              {EVENTS.map((name) => (
                <label
                  key={name}
                  className="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300"
                >
                  <input
                    type="checkbox"
                    checked={draft.events.includes(name)}
                    onChange={() => toggleEvent(name)}
                  />
                  {t(`integrations.eventNames.${name}`)}
                </label>
              ))}
            </div>
          </fieldset>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className={secondary} onClick={() => setAdding(false)}>
              {t('integrations.cancel')}
            </button>
            <button
              type="submit"
              disabled={saving || !draft.events.length}
              className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
            >
              {t('integrations.save')}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        open={Boolean(secret)}
        onClose={() => setSecret(null)}
        title={t('integrations.secretTitle')}
        closeLabel={t('common.close')}
        footer={
          <button
            type="button"
            onClick={() => setSecret(null)}
            className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700"
          >
            {t('integrations.done')}
          </button>
        }
      >
        <p className="text-sm text-gray-700 dark:text-gray-300">{t('integrations.secretHelp')}</p>
        <div className="mt-3 flex gap-2">
          <code className="flex-1 min-w-0 break-all rounded-lg bg-gray-100 dark:bg-gray-900 px-3 py-2 text-xs text-gray-900 dark:text-gray-100">
            {secret}
          </code>
          <button
            type="button"
            className={secondary}
            onClick={() => {
              void navigator.clipboard?.writeText(secret || '');
              toast.success(t('integrations.copied'));
            }}
          >
            {t('integrations.copy')}
          </button>
        </div>
      </Modal>

      <Modal
        open={Boolean(log)}
        onClose={() => setLog(null)}
        title={log ? `${t('integrations.deliveries')} · ${log.item.name}` : ''}
        closeLabel={t('common.close')}
      >
        {log && log.rows.length === 0 ? (
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {t('integrations.noDeliveries')}
          </p>
        ) : (
          <div className="max-h-[60vh] overflow-y-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-600 dark:text-gray-400">
                  <th scope="col" className="py-1.5 pr-2">
                    {t('integrations.when')}
                  </th>
                  <th scope="col" className="py-1.5 pr-2">
                    {t('integrations.event')}
                  </th>
                  <th scope="col" className="py-1.5">
                    {t('integrations.result')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {log?.rows.map((row) => (
                  <tr
                    key={row._id}
                    className="border-t border-gray-100 dark:border-gray-700 align-top"
                  >
                    <td className="py-1.5 pr-2 text-gray-700 dark:text-gray-300 whitespace-nowrap">
                      {formatDateTime(row.createdAt)}
                    </td>
                    <td className="py-1.5 pr-2 text-gray-700 dark:text-gray-300">
                      {row.event === 'integration.test'
                        ? t('integrations.eventTest')
                        : t(`integrations.eventNames.${row.event}`)}
                    </td>
                    <td
                      className={`py-1.5 ${row.status === 'failed' ? 'text-red-700 dark:text-red-400' : 'text-gray-700 dark:text-gray-300'}`}
                    >
                      {t(`integrations.status.${row.status}`)}
                      {row.statusCode ? ` · HTTP ${row.statusCode}` : ''}
                      {row.attempts > 1
                        ? ` · ${t('integrations.attempts', { n: row.attempts })}`
                        : ''}
                      {row.error && row.status !== 'delivered' ? (
                        <span className="block text-xs">{row.error}</span>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        isOpen={Boolean(removing)}
        onClose={() => setRemoving(null)}
        onConfirm={remove}
        title={t('integrations.removeTitle')}
        message={t('integrations.removeMessage', { name: removing?.name ?? '' })}
        confirmText={t('integrations.remove')}
        cancelText={t('integrations.cancel')}
        type="danger"
      />
      <ConfirmDialog
        isOpen={Boolean(rotating)}
        onClose={() => setRotating(null)}
        onConfirm={rotate}
        title={t('integrations.rotate')}
        message={t('integrations.rotateConfirm')}
        confirmText={t('integrations.rotate')}
        cancelText={t('integrations.cancel')}
        type="warning"
      />
    </>
  );
};

export default Integrations;
