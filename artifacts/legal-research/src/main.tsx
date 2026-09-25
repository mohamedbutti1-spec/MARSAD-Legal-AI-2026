import { createRoot } from 'react-dom/client';
import App from './App';

// ── Brand fonts — self-hosted (@fontsource), served same-origin ──────────────
// Previously loaded from the Google Fonts CDN via a render-blocking @import in
// index.css. Self-hosting keeps typography working on restricted government
// networks, stops sending visitor IPs to a third party, and lets the bundler
// fingerprint + cache the font files like any other asset.
// IBM Plex Sans Arabic — primary UI face (--app-font-sans)
import '@fontsource/ibm-plex-sans-arabic/300.css';
import '@fontsource/ibm-plex-sans-arabic/400.css';
import '@fontsource/ibm-plex-sans-arabic/500.css';
import '@fontsource/ibm-plex-sans-arabic/600.css';
import '@fontsource/ibm-plex-sans-arabic/700.css';
// Amiri — serif face for legal/scholarly passages (--app-font-serif)
import '@fontsource/amiri/400.css';
import '@fontsource/amiri/400-italic.css';
import '@fontsource/amiri/700.css';
import '@fontsource/amiri/700-italic.css';

import './index.css';

/**
 * Authentication model: JWT stored in HTTP-only cookie (set by POST /api/auth/login).
 * The browser sends the cookie automatically with every same-origin /api/* request.
 *
 * We no longer inject X-User-Role or X-User-Id headers — those were the
 * insecure placeholder mechanism replaced by real JWT auth.
 * The API server derives identity exclusively from the verified JWT payload.
 */

createRoot(document.getElementById('root')!).render(<App />);

// Register the PWA service worker in production only — in dev it would
// intercept Vite's HMR/module requests and cause stale-module confusion.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // Non-fatal: the app works fully online without the service worker.
    });
  });
}
