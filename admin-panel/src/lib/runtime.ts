const configuredOrigin = String(import.meta.env.VITE_API_URL || '').trim();

// In production the panel and API normally share an origin. An empty Vite
// variable must therefore produce relative URLs, never "undefined/api".
export const API_ORIGIN = configuredOrigin.replace(/\/+$/, '');
export const API_BASE_URL = `${API_ORIGIN}/api`;

export const apiAssetUrl = (path: string | null | undefined): string => {
  if (!path) return '';
  if (/^https?:\/\//i.test(path)) return path;
  return `${API_ORIGIN}${path.startsWith('/') ? path : `/${path}`}`;
};

export const socketUrl = (namespace: string): string =>
  `${API_ORIGIN}${namespace.startsWith('/') ? namespace : `/${namespace}`}`;
