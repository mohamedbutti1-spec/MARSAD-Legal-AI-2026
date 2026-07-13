import { createRoot } from 'react-dom/client';
import App from './App';
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
