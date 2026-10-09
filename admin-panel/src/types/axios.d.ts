// The request-level cache lives in src/services/api.ts. Both flags travel on
// the config object, so they are declared where axios declares the rest of it.
import 'axios';

declare module 'axios' {
  interface AxiosRequestConfig {
    /** false opts a GET out of the short-lived response cache. */
    cache?: boolean;
  }

  interface InternalAxiosRequestConfig {
    cache?: boolean;
    /** The cache key this request was resolved under, set by the interceptor. */
    __cacheKey?: string;
    /** Sent again once after the session was renewed under it (services/http.ts). */
    __renewed?: boolean;
  }
}
