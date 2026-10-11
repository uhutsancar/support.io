import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
// Inter from our own origin (plan v10 PERF-08): no request to a font CDN, no
// render-blocking stylesheet; latin and latin-ext (Turkish) load as needed.
import '@fontsource-variable/inter';
import './index.css';
import { languageOfPath, switchLanguage } from './i18n';
import { installErrorReporting, reportError } from './lib/telemetry';
import ErrorBoundary from './components/ErrorBoundary';

const PRELOAD_RELOAD_KEY = 'supbort:preload-reload-attempted';

window.addEventListener('vite:preloadError', (event) => {
  event.preventDefault();
  // A dynamic import also fails while the browser is offline. Reloading then
  // destroys the usable shell and cannot fetch the replacement bundle; the
  // connection indicator should handle that case instead.
  if (!navigator.onLine) return;
  const preloadEvent = event as Event & { payload?: unknown };
  reportError(preloadEvent.payload ?? new Error('Vite preload failed'));
  try {
    if (sessionStorage.getItem(PRELOAD_RELOAD_KEY)) return;
    sessionStorage.setItem(PRELOAD_RELOAD_KEY, '1');
  } catch {
    // Without the guard storage we cannot prove this is the first attempt.
    // Let the route boundary show its localized refresh action instead.
    return;
  }
  window.location.reload();
});

installErrorReporting();
// An English address renders once its texts are here, not in Turkish first.
void switchLanguage(languageOfPath(window.location.pathname)).finally(() => {
  // index.html always carries #root; the app cannot mount without it.
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </React.StrictMode>
  );
});
