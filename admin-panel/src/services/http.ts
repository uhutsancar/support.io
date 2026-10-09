// The configured axios instance, its short-lived GET cache, and the helper
// that keeps that cache honest after a write.
//
// Split out of `api.ts` so that file is only a list of endpoints. The transport
// concerns — credentials, CSRF, caching, the 401 redirect — are here, stated
// once.

import axios from 'axios';
import { csrfToken, CSRF_HEADER, purgeLegacyStorage } from '../lib/session';
import { API_BASE_URL } from '../lib/runtime';
import type { AxiosResponse, InternalAxiosRequestConfig } from 'axios';

/** One cached GET response. */
interface CacheEntry {
  data: unknown;
  timestamp: number;
}

const cache = new Map<string, CacheEntry>();
const CACHE_DURATION_MS = 30 * 1000;
const REQUEST_TIMEOUT_MS = 15 * 1000;

/** Dispatched on window when a request is refused for the plan. */
export const PLAN_REQUIRED_EVENT = 'supportio:plan-required';

/** Dispatched on window when the organization requires two-step sign-in. */
export const MFA_SETUP_REQUIRED_EVENT = 'supportio:mfa-setup-required';

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: REQUEST_TIMEOUT_MS,
  headers: { 'Content-Type': 'application/json' },
  // The session is an httpOnly cookie; this is what makes the browser attach it.
  withCredentials: true
});

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  // No Authorization header: the token is in a cookie JavaScript cannot read
  // and the browser attaches it itself. All that travels from here is the CSRF
  // counterpart, which proves the request came from the panel.
  const csrf = csrfToken();
  if (csrf) config.headers[CSRF_HEADER] = csrf;

  if (config.method !== 'get' || config.cache === false) return config;

  // The key includes the CSRF token, which changes with the session. Without
  // it, signing out and into another tenant in the same tab could serve the
  // previous tenant's cached response.
  const cacheKey = `${csrf || 'anonymous'}:${config.url}${JSON.stringify(config.params || {})}`;
  config.__cacheKey = cacheKey;

  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION_MS) {
    config.adapter = () =>
      Promise.resolve({
        data: cached.data,
        status: 200,
        statusText: 'OK (cached)',
        headers: {},
        config
      } as AxiosResponse);
  }

  return config;
});

api.interceptors.response.use(
  (response) => {
    if (response.config.method === 'get' && response.config.cache !== false) {
      const cacheKey = response.config.__cacheKey;
      if (cacheKey) cache.set(cacheKey, { data: response.data, timestamp: Date.now() });
    }
    return response;
  },
  (error) => {
    // A plan gate or limit: the panel offers the upgrade (components/UpgradeDialog).
    const code = error.response?.data?.code;
    if (code === 'PLAN_UPGRADE_REQUIRED' || code === 'PLAN_LIMIT_REACHED') {
      window.dispatchEvent(
        new CustomEvent(PLAN_REQUIRED_EVENT, {
          detail: { code, details: error.response?.data?.details ?? null }
        })
      );
    }
    // An organization that requires two-step verification blocks a member
    // without it; the layout shows the set-up screen (SEC-04).
    if (code === 'MFA_SETUP_REQUIRED') {
      window.dispatchEvent(new CustomEvent(MFA_SETUP_REQUIRED_EVENT));
    }
    // The sign-in endpoints answer 401 for a wrong password or an expired
    // second step; the page that asked shows the reason, so these are not a
    // lost session and must not reload the page.
    const url = String(error.config?.url || '');
    const signingIn =
      /^\/auth\/(login|register|verify-email|resend-verification-link|confirm-email-change)/.test(
        url
      );
    // A request sent with the session a password change or a second-step set-up
    // has just replaced: the browser already holds the new one (the CSRF
    // cookie changed with it), so the request is sent again once instead of
    // signing the person out in the middle of what they were doing.
    const sentWith = error.config?.headers?.[CSRF_HEADER];
    const current = csrfToken();
    if (
      error.response?.status === 401 &&
      !signingIn &&
      sentWith &&
      current &&
      sentWith !== current &&
      !error.config.__renewed
    ) {
      return api.request({ ...error.config, __renewed: true });
    }
    if (error.response?.status === 401 && !signingIn) {
      // The session is gone: drop everything held for it before leaving, or the
      // login page would be served this tenant's cached data on the way back.
      cache.clear();
      purgeLegacyStorage();
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

/** Drops cached GETs whose key contains `pattern`, or all of them. */
export function clearCache(pattern?: string): void {
  if (!pattern) {
    cache.clear();
    return;
  }
  for (const key of cache.keys()) {
    if (key.includes(pattern)) cache.delete(key);
  }
}

/**
 * A write that invalidates the reads it affects.
 *
 * Twenty-seven endpoints wrote this out by hand:
 *
 *     create: async (data) => {
 *       const response = await api.post('/sites', data);
 *       clearCache('/sites');
 *       return response;
 *     }
 *
 * Five lines whose only real content is the verb, the path and which prefix to
 * invalidate — and where forgetting the `clearCache` line leaves the list
 * showing the row the user just deleted for the next thirty seconds. That is a
 * bug nobody reports, because by the time anyone looks again the cache has
 * expired on its own.
 *
 *     create: mutates('/sites', (data: Partial<Site>) => api.post<...>('/sites', data))
 */
export function mutates<TArgs extends unknown[], TResult>(
  invalidates: string | readonly string[],
  request: (...args: TArgs) => Promise<TResult>
): (...args: TArgs) => Promise<TResult> {
  const prefixes = typeof invalidates === 'string' ? [invalidates] : invalidates;
  return async (...args: TArgs) => {
    const result = await request(...args);
    // Only after the write succeeded: invalidating first would make a failed
    // request cost a refetch for nothing.
    for (const prefix of prefixes) clearCache(prefix);
    return result;
  };
}

export default api;
