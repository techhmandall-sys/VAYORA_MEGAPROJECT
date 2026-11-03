import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { loadLanguage, storedLanguage } from './lib/i18n';
import { reloadOnStaleBuild } from './lib/staleBuild';
import './index.css';

// A tab left open across a release asks for screens that no longer exist: fetch the new one.
reloadOnStaleBuild();

// A Hindi or Marathi reader's table first, so the first screen is already in their language.
// If it cannot be fetched the app starts in English rather than not at all.
void loadLanguage(storedLanguage())
  .catch(() => undefined)
  .then(() =>
    ReactDOM.createRoot(document.getElementById('root')!).render(
      <React.StrictMode>
        <App />
      </React.StrictMode>,
    ),
  );

// The service worker (public/sw.js) stands in a "you are offline" page for one that cannot be
// fetched, and with the manifest makes the app installable. Built app only, once the page has
// loaded, so it never competes with the first paint; push registers the same worker.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // Without it the app works as before; only the offline page and installing are lost.
    });
  });
}
