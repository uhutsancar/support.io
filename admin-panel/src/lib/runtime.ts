// In production the panel and API share an origin, so an unset or empty
// VITE_API_URL produces relative URLs. `npm run dev` talks to the backend on
// its default port unless VITE_API_URL says otherwise.
const configuredOrigin = String(
  import.meta.env.VITE_API_URL ?? (import.meta.env.DEV ? 'http://localhost:5000' : '')
).trim();

export const API_ORIGIN = configuredOrigin.replace(/\/+$/, '');
export const API_BASE_URL = `${API_ORIGIN}/api`;

export const apiAssetUrl = (path: string | null | undefined): string => {
  if (!path) return '';
  if (/^https?:\/\//i.test(path)) return path;
  return `${API_ORIGIN}${path.startsWith('/') ? path : `/${path}`}`;
};

export const socketUrl = (namespace: string): string =>
  `${API_ORIGIN}${namespace.startsWith('/') ? namespace : `/${namespace}`}`;
