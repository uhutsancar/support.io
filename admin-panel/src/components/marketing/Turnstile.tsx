/**
 * Cloudflare Turnstile, the bot check on the sign-up form (plan v10 SEC-06).
 *
 * Rendered only when the server hands out a site key (GET /api/auth/config);
 * without one — local development — nothing is loaded and the form works as
 * before. The script comes from Cloudflare once per page and is allowed by
 * the panel's CSP only while a key is configured.
 */
import { useEffect, useRef } from 'react';

interface TurnstileApi {
  render(
    container: HTMLElement,
    options: {
      sitekey: string;
      callback: (token: string) => void;
      'expired-callback'?: () => void;
      'error-callback'?: () => void;
      theme?: 'auto' | 'light' | 'dark';
      language?: string;
    }
  ): string;
  reset(widgetId?: string): void;
  remove(widgetId: string): void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
let loading: Promise<TurnstileApi> | null = null;

function loadTurnstile(): Promise<TurnstileApi> {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  if (!loading) {
    loading = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = SCRIPT_SRC;
      script.async = true;
      script.onload = () =>
        window.turnstile ? resolve(window.turnstile) : reject(new Error('Turnstile missing'));
      script.onerror = () => {
        loading = null;
        reject(new Error('Turnstile could not load'));
      };
      document.head.appendChild(script);
    });
  }
  return loading;
}

const Turnstile = ({
  siteKey,
  language,
  onToken,
  resetSignal
}: {
  siteKey: string;
  language: string;
  onToken: (token: string | null) => void;
  /** Changes when the form wants a fresh challenge (after a failed submit). */
  resetSignal?: number;
}) => {
  const container = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadTurnstile()
      .then((api) => {
        if (cancelled || !container.current) return;
        widgetId.current = api.render(container.current, {
          sitekey: siteKey,
          theme: 'auto',
          language,
          callback: (token) => onToken(token),
          'expired-callback': () => onToken(null),
          'error-callback': () => onToken(null)
        });
      })
      .catch(() => onToken(null));
    return () => {
      cancelled = true;
      if (widgetId.current && window.turnstile) window.turnstile.remove(widgetId.current);
      widgetId.current = null;
    };
    // The widget is drawn once per key and language.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteKey, language]);

  useEffect(() => {
    if (resetSignal && widgetId.current && window.turnstile) {
      window.turnstile.reset(widgetId.current);
      onToken(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetSignal]);

  return <div ref={container} className="min-h-[65px]" />;
};

export default Turnstile;
