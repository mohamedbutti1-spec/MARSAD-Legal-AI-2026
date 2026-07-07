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
