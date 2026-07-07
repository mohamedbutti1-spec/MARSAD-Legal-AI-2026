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
 */
export function apiFetch(url: string, init: RequestInit = {}): Promise<Response> {
  return fetch(url, {
    ...init,
    credentials: "include",
  });
}
