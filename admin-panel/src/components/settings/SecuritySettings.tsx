/**
 * Ayarlar → Hesap güvenliği (plan v10 SEC-03, SEC-04).
 *
 * Şifre değiştirme, e-posta değiştirme, diğer cihazlardan çıkış, iki adımlı
 * doğrulama (kurulum, kurtarma kodları, kapatma) ve — sahip/yönetici için —
 * ekibin tamamına zorunlu kılma. Her önemli değişiklik şifreyi yeniden ister;
 * sunucu da ayrıca ister (routes/account.ts).
 *
 * QR kodu tarayıcıda çizilir: gizli anahtar sunucudan bir kez gelir, hiçbir
 * yere gönderilmez ve görüntüsü harici bir servisten istenmez.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import qrcode from 'qrcode-generator';
import { KeyRound, Mail, LogOut, Smartphone, Users, Copy, Download } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { authAPI } from '../../services/api';
import type { MfaStatus } from '../../services/api';
import { errorMessage } from '../../hooks/useAsync';
import { GoogleMark, useGoogleSignIn } from '../auth/GoogleButton';

const input =
  'w-full px-3 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500';
const primary =
  'inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-50';
const secondary =
  'inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-800 dark:text-gray-200 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50';

const Card = ({
  icon: Icon,
  title,
  children
}: {
  icon: typeof KeyRound;
  title: string;
  children: React.ReactNode;
}) => (
  <section className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 transition-colors duration-200">
    <h3 className="flex items-center gap-2 text-lg font-semibold text-gray-900 dark:text-white mb-3">
      <Icon className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
      {title}
    </h3>
    {children}
  </section>
);

const Label = ({ text, children }: { text: string; children: React.ReactNode }) => (
  <label className="block">
    <span className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{text}</span>
    {children}
  </label>
);

/** The otpauth address as an inline SVG, drawn here and nowhere else. */
export const QrCode = ({ value }: { value: string }) => {
  const cells = useMemo(() => {
    const qr = qrcode(0, 'M');
    qr.addData(value);
    qr.make();
    const size = qr.getModuleCount();
    const dark: Array<[number, number]> = [];
    for (let r = 0; r < size; r++)
      for (let c = 0; c < size; c++) if (qr.isDark(r, c)) dark.push([r, c]);
    return { size, dark };
  }, [value]);
  const margin = 2;
  const total = cells.size + margin * 2;
  return (
    <svg
      viewBox={`0 0 ${total} ${total}`}
      className="w-44 h-44 rounded-lg bg-white p-1"
      role="img"
      aria-label="QR"
      shapeRendering="crispEdges"
    >
      <rect width={total} height={total} fill="#fff" />
      {cells.dark.map(([r, c]) => (
        <rect key={`${r}-${c}`} x={c + margin} y={r + margin} width={1} height={1} fill="#111827" />
      ))}
    </svg>
  );
};

const ChangePassword = () => {
  const { t } = useTranslation();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [again, setAgain] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (next !== again) {
      toast.error(t('account.security.password.mismatch'));
      return;
    }
    setBusy(true);
    try {
      // The answer rotates the session cookie and its CSRF twin; the next
      // request reads the new pair by itself (lib/session.ts).
      await authAPI.changePassword(current, next);
      toast.success(t('account.security.password.changed'));
      setCurrent('');
      setNext('');
      setAgain('');
    } catch (error) {
      toast.error(errorMessage(error, t('recovery.error')));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card icon={KeyRound} title={t('account.security.password.title')}>
      <form onSubmit={submit} className="grid gap-3 sm:grid-cols-3 sm:items-end">
        <Label text={t('account.security.password.current')}>
          <input
            className={input}
            type="password"
            autoComplete="current-password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            required
          />
        </Label>
        <Label text={t('account.security.password.next')}>
          <input
            className={input}
            type="password"
            autoComplete="new-password"
            minLength={10}
            value={next}
            onChange={(e) => setNext(e.target.value)}
            required
          />
        </Label>
        <Label text={t('account.security.password.confirm')}>
          <input
            className={input}
            type="password"
            autoComplete="new-password"
            minLength={10}
            value={again}
            onChange={(e) => setAgain(e.target.value)}
            required
          />
        </Label>
        <p className="sm:col-span-2 text-xs text-gray-500 dark:text-gray-400">
          {t('account.security.password.hint')}
        </p>
        <button type="submit" className={primary} disabled={busy}>
          {t('account.security.password.save')}
        </button>
      </form>
    </Card>
  );
};

const ChangeEmail = () => {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await authAPI.changeEmail(email, password, i18n.language);
      toast.success(t('account.security.email.sent'), { duration: 7000 });
      setEmail('');
      setPassword('');
    } catch (error) {
      toast.error(errorMessage(error, t('recovery.error')));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card icon={Mail} title={t('account.security.email.title')}>
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
        {t('account.security.email.current', { email: user?.email })}
      </p>
      <form onSubmit={submit} className="grid gap-3 sm:grid-cols-3 sm:items-end">
        <Label text={t('account.security.email.next')}>
          <input
            className={input}
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </Label>
        <Label text={t('account.security.email.password')}>
          <input
            className={input}
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </Label>
        <button type="submit" className={primary} disabled={busy}>
          {t('account.security.email.send')}
        </button>
      </form>
    </Card>
  );
};

const Sessions = () => {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  const revoke = async () => {
    setBusy(true);
    try {
      await authAPI.revokeSessions();
      toast.success(t('account.security.sessions.done'));
    } catch (error) {
      toast.error(errorMessage(error, t('recovery.error')));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card icon={LogOut} title={t('account.security.sessions.title')}>
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
        {t('account.security.sessions.body')}
      </p>
      <button type="button" onClick={revoke} className={secondary} disabled={busy}>
        {t('account.security.sessions.button')}
      </button>
    </Card>
  );
};

/**
 * Sign-in with Google (PRD-14): connecting is the account owner's consent,
 * given signed in. The API sends the browser to Google and back here with
 * ?google=linked|taken|failed|expired|cancelled.
 */
const GOOGLE_OUTCOMES = ['linked', 'taken', 'failed', 'expired', 'cancelled'];

const GoogleSignIn = () => {
  const { t, i18n } = useTranslation();
  const { user, refresh } = useAuth();
  const enabled = useGoogleSignIn();
  const [busy, setBusy] = useState(false);
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const outcome = params.get('google');
    if (!outcome || !GOOGLE_OUTCOMES.includes(outcome)) return;
    if (outcome === 'linked') toast.success(t('account.google.settings.linked'));
    else toast.error(t(`account.google.settings.${outcome}`));
    params.delete('google');
    const rest = params.toString();
    window.history.replaceState(
      null,
      '',
      window.location.pathname + (rest ? `?${rest}` : '') + window.location.hash
    );
    void refresh();
  }, [t, refresh]);

  if (!enabled && !user?.google) return null;

  const proofFor = async (purpose: 'google-link' | 'google-unlink') => {
    const { data } = await authAPI.recentAuth({
      purpose,
      password,
      ...(user?.mfaEnabled ? { code } : {})
    });
    return data.proof;
  };

  const connect = async () => {
    setBusy(true);
    try {
      const proof = await proofFor('google-link');
      const { data } = await authAPI.googleLink(i18n.language, proof);
      window.location.assign(data.url);
    } catch (error) {
      toast.error(errorMessage(error, t('account.google.settings.failed')));
      setBusy(false);
    }
  };
  const disconnect = async () => {
    setBusy(true);
    try {
      const proof = await proofFor('google-unlink');
      await authAPI.googleUnlink(proof);
      await refresh();
      setPassword('');
      setCode('');
      toast.success(t('account.google.settings.disconnected'));
    } catch (error) {
      toast.error(errorMessage(error, t('recovery.error')));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 transition-colors duration-200">
      <h3 className="flex items-center gap-2 text-lg font-semibold text-gray-900 dark:text-white mb-3">
        <GoogleMark className="w-5 h-5" />
        {t('account.google.settings.title')}
      </h3>
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
        {user?.google
          ? t('account.google.settings.connectedAs', { email: user.google.email ?? '' })
          : t('account.google.settings.body')}
      </p>
      <div className="grid gap-3 sm:grid-cols-2 mb-4">
        <Label text={t('account.google.settings.password')}>
          <input
            className={input}
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
        </Label>
        {user?.mfaEnabled && (
          <Label text={t('account.google.settings.code')}>
            <input
              className={input}
              inputMode="numeric"
              autoComplete="one-time-code"
              value={code}
              onChange={(event) => setCode(event.target.value)}
              required
            />
          </Label>
        )}
      </div>
      {user?.google ? (
        <button
          type="button"
          onClick={disconnect}
          className={secondary}
          disabled={busy || !password || Boolean(user.mfaEnabled && !code)}
        >
          {t('account.google.settings.disconnect')}
        </button>
      ) : (
        <button
          type="button"
          onClick={connect}
          className={secondary}
          disabled={busy || !password || Boolean(user?.mfaEnabled && !code)}
        >
          <GoogleMark />
          {t('account.google.settings.connect')}
        </button>
      )}
    </section>
  );
};

/** Shows the recovery codes once, with copy and download. */
const RecoveryCodes = ({ codes, onDone }: { codes: string[]; onDone: () => void }) => {
  const { t } = useTranslation();
  const text = codes.join('\n');
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(t('account.security.mfa.copied'));
    } catch {
      /* the codes stay on screen */
    }
  };
  const download = () => {
    const url = URL.createObjectURL(new Blob([`Support.io\n\n${text}\n`], { type: 'text/plain' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'support-io-recovery-codes.txt';
    a.click();
    URL.revokeObjectURL(url);
  };
  return (
    <div className="space-y-3">
      <h4 className="font-semibold text-gray-900 dark:text-white">
        {t('account.security.mfa.recoveryTitle')}
      </h4>
      <p className="text-sm text-gray-600 dark:text-gray-400">
        {t('account.security.mfa.recoveryBody')}
      </p>
      <ul className="grid grid-cols-2 gap-2 font-mono text-sm bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
        {codes.map((code) => (
          <li key={code} className="text-gray-900 dark:text-gray-100">
            {code}
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={copy} className={secondary}>
          <Copy className="w-4 h-4" /> {t('account.security.mfa.copy')}
        </button>
        <button type="button" onClick={download} className={secondary}>
          <Download className="w-4 h-4" /> {t('account.security.mfa.download')}
        </button>
        <button type="button" onClick={onDone} className={primary}>
          {t('account.security.mfa.saved')}
        </button>
      </div>
    </div>
  );
};

/**
 * Turning two-step sign-in on: password → QR code → first code → recovery
 * codes. Used in the settings page and in the "your organization requires
 * it" screen.
 */
export const MfaEnrolment = ({ onEnabled }: { onEnabled: () => void }) => {
  const { t } = useTranslation();
  const [step, setStep] = useState<'password' | 'scan' | 'codes'>('password');
  const [password, setPassword] = useState('');
  const [setup, setSetup] = useState<{ secret: string; otpauthUri: string } | null>(null);
  const [code, setCode] = useState('');
  const [codes, setCodes] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const begin = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await authAPI.mfaSetup(password);
      setSetup(res.data);
      setPassword('');
      setStep('scan');
    } catch (error) {
      toast.error(errorMessage(error, t('recovery.error')));
    } finally {
      setBusy(false);
    }
  };

  const confirm = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await authAPI.mfaConfirm(code.replace(/\s/g, ''));
      setCodes(res.data.recoveryCodes);
      setSetup(null);
      setStep('codes');
    } catch (error) {
      toast.error(errorMessage(error, t('recovery.error')));
    } finally {
      setBusy(false);
    }
  };

  if (step === 'password') {
    return (
      <form onSubmit={begin} className="flex flex-col sm:flex-row gap-3 sm:items-end">
        <Label text={t('account.security.mfa.passwordPrompt')}>
          <input
            className={input}
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </Label>
        <button type="submit" className={primary} disabled={busy}>
          {t('account.security.mfa.continue')}
        </button>
      </form>
    );
  }
  if (step === 'scan' && setup) {
    return (
      <form onSubmit={confirm} className="grid gap-4 sm:grid-cols-[auto,1fr] sm:items-start">
        <QrCode value={setup.otpauthUri} />
        <div className="space-y-3">
          <p className="text-sm text-gray-700 dark:text-gray-300">
            {t('account.security.mfa.scan')}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {t('account.security.mfa.manual')}
          </p>
          <code
            data-testid="totp-secret"
            className="block break-all font-mono text-sm bg-gray-50 dark:bg-gray-900 rounded px-3 py-2 text-gray-900 dark:text-gray-100 select-all"
          >
            {setup.secret.replace(/(.{4})/g, '$1 ').trim()}
          </code>
          <Label text={t('account.security.mfa.codeLabel')}>
            <input
              className={input}
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9 ]{6,7}"
              maxLength={7}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              required
            />
          </Label>
          <button type="submit" className={primary} disabled={busy}>
            {t('account.security.mfa.confirm')}
          </button>
        </div>
      </form>
    );
  }
  return (
    <RecoveryCodes
      codes={codes}
      onDone={() => {
        toast.success(t('account.security.mfa.enabled'));
        onEnabled();
      }}
    />
  );
};

const TwoStep = () => {
  const { t } = useTranslation();
  const { refresh } = useAuth();
  const [status, setStatus] = useState<MfaStatus | null>(null);
  const [mode, setMode] = useState<'idle' | 'enrol' | 'disable' | 'regenerate'>('idle');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [newCodes, setNewCodes] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);

  const load = () =>
    authAPI
      .mfaStatus()
      .then((res) => setStatus(res.data))
      .catch(() => setStatus(null));

  useEffect(() => {
    load();
  }, []);

  const secondStep = () => {
    const cleaned = code.replace(/\s/g, '');
    return /^\d{6}$/.test(cleaned) ? { code: cleaned } : { recoveryCode: code.trim() };
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === 'disable') {
        await authAPI.mfaDisable({ password, ...secondStep() });
        toast.success(t('account.security.mfa.disabled'));
        setMode('idle');
        await refresh();
      } else {
        const res = await authAPI.mfaRecoveryCodes({ password, ...secondStep() });
        setNewCodes(res.data.recoveryCodes);
      }
      setPassword('');
      setCode('');
      await load();
    } catch (error) {
      toast.error(errorMessage(error, t('recovery.error')));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card icon={Smartphone} title={t('account.security.mfa.title')}>
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
        {t('account.security.mfa.body')}
      </p>
      <p className="text-sm mb-4">
        <span
          className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${
            status?.enabled
              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300'
              : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
          }`}
        >
          {status?.enabled ? t('account.security.mfa.on') : t('account.security.mfa.off')}
        </span>
        {status?.enabled && (
          <span className="ml-3 text-gray-500 dark:text-gray-400">
            {t('account.security.mfa.recoveryLeft', { count: status.recoveryCodesLeft })}
          </span>
        )}
      </p>

      {newCodes ? (
        <RecoveryCodes
          codes={newCodes}
          onDone={() => {
            setNewCodes(null);
            setMode('idle');
          }}
        />
      ) : !status?.enabled ? (
        mode === 'enrol' ? (
          <MfaEnrolment
            onEnabled={async () => {
              setMode('idle');
              await load();
              await refresh();
            }}
          />
        ) : (
          <button type="button" className={primary} onClick={() => setMode('enrol')}>
            {t('account.security.mfa.enable')}
          </button>
        )
      ) : mode === 'disable' || mode === 'regenerate' ? (
        <form onSubmit={submit} className="space-y-3">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {mode === 'disable'
              ? t('account.security.mfa.disableBody')
              : t('account.security.mfa.regenerateBody')}
          </p>
          <div className="grid gap-3 sm:grid-cols-3 sm:items-end">
            <Label text={t('account.security.email.password')}>
              <input
                className={input}
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </Label>
            <Label text={t('account.login.code')}>
              <input
                className={input}
                autoComplete="one-time-code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                required
              />
            </Label>
            <div className="flex gap-2">
              <button type="submit" className={primary} disabled={busy}>
                {mode === 'disable'
                  ? t('account.security.mfa.disable')
                  : t('account.security.mfa.regenerate')}
              </button>
              <button type="button" className={secondary} onClick={() => setMode('idle')}>
                {t('settings.cancel')}
              </button>
            </div>
          </div>
        </form>
      ) : (
        <div className="flex flex-wrap gap-2">
          <button type="button" className={secondary} onClick={() => setMode('regenerate')}>
            {t('account.security.mfa.regenerate')}
          </button>
          {status.enforcedByOrganization ? (
            <p className="text-xs text-gray-500 dark:text-gray-400 self-center">
              {t('account.security.mfa.enforcedNote')}
            </p>
          ) : (
            <button type="button" className={secondary} onClick={() => setMode('disable')}>
              {t('account.security.mfa.disable')}
            </button>
          )}
        </div>
      )}
    </Card>
  );
};

const TeamRequirement = () => {
  const { t } = useTranslation();
  const { user, refresh } = useAuth();
  const [busy, setBusy] = useState(false);
  if (!user || !['owner', 'admin'].includes(user.role)) return null;
  const on = Boolean(user.organization?.enforce2fa);
  const enterprise = user.organization?.planType === 'ENTERPRISE';

  const toggle = async () => {
    setBusy(true);
    try {
      await authAPI.setOrganizationSecurity(!on);
      await refresh();
      toast.success(t('account.security.enforce.updated'));
    } catch (error) {
      toast.error(errorMessage(error, t('recovery.error')));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card icon={Users} title={t('account.security.enforce.title')}>
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
        {t('account.security.enforce.body')}
      </p>
      {enterprise ? (
        <button type="button" className={on ? secondary : primary} onClick={toggle} disabled={busy}>
          {on ? t('account.security.enforce.turnOff') : t('account.security.enforce.turnOn')}
        </button>
      ) : (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {t('account.security.enforce.enterpriseOnly')}
        </p>
      )}
    </Card>
  );
};

const SecuritySettings = () => {
  const { t } = useTranslation();
  return (
    <div id="security" className="mt-6 space-y-6 scroll-mt-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
          {t('account.security.title')}
        </h2>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
          {t('account.security.description')}
        </p>
      </div>
      <ChangePassword />
      <ChangeEmail />
      <GoogleSignIn />
      <TwoStep />
      <TeamRequirement />
      <Sessions />
    </div>
  );
};

export default SecuritySettings;
