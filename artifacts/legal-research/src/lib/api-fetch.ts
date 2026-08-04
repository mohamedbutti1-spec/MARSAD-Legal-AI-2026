/**
 * Thin wrapper around fetch() that ensures credentials (the HttpOnly JWT
 * session cookie) are always included with every /api/* request.
 *
 * The legacy x-user-role / x-user-id header injection has been removed.
 * Identity is now derived exclusively from the server-verified JWT cookie;
 * those headers are stripped on ingress by the global authenticate middleware.
 *
 * Use this for any raw fetch() call that hits /api/* (e.g. multipart uploads,
 * manual DELETE/GET calls that can't use the generated hooks).
 *
 * Auth-error interception
 * ───────────────────────
 * When a response arrives with HTTP 401 and a JSON body containing a `code`
 * field, the registered auth-error handler (set by UserProvider via
 * setAuthErrorHandler) is called so the context can update its state and the
 * UI can show an appropriate message (e.g. "session ended elsewhere").
 */

type AuthErrorHandler = (code: string) => void;
let _authErrorHandler: AuthErrorHandler | null = null;

/** Called once by UserProvider on mount to register the global handler. */
export function setAuthErrorHandler(handler: AuthErrorHandler): void {
  _authErrorHandler = handler;
}

export async function apiFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const res = await fetch(url, {
    ...init,
    credentials: "include",
  });

  if (res.status === 401 && _authErrorHandler) {
    try {
      const clone = res.clone();
      const body = await clone.json() as { code?: string };
      if (body.code) {
        _authErrorHandler(body.code);
      }
    } catch {
      // Non-JSON 401 — ignore, let the caller handle it normally
    }
  }

  return res;
}
