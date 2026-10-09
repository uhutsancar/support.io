import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
// Inter from our own origin (plan v10 PERF-08): no request to a font CDN, no
// render-blocking stylesheet; latin and latin-ext (Turkish) load as needed.
import '@fontsource-variable/inter';
import './index.css';
import { languageOfPath, switchLanguage } from './i18n';
import { installErrorReporting } from './lib/telemetry';

installErrorReporting();
// An English address renders once its texts are here, not in Turkish first.
void switchLanguage(languageOfPath(window.location.pathname)).finally(() => {
  // index.html always carries #root; the app cannot mount without it.
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
});
