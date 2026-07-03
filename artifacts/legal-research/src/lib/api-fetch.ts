/**
 * Thin wrapper around fetch() that automatically injects X-User-Role and
 * X-User-Id headers from localStorage — mirroring what customFetch does for
 * the generated API-client hooks.
 *
 * Use this for any raw fetch() call that hits /api/* (e.g. multipart uploads,
 * manual DELETE/GET calls that can't use the generated hooks).
 */
export function apiFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const role = localStorage.getItem('userRole') || 'owner';
  const userId = localStorage.getItem('userId') || '1';

  // Merge headers without overwriting any the caller already set.
  const headers = new Headers(init.headers as HeadersInit | undefined);
  if (!headers.has('x-user-role')) headers.set('x-user-role', role);
  if (!headers.has('x-user-id')) headers.set('x-user-id', userId);

  // ⚠️  Do NOT set Content-Type when sending FormData — the browser must set
  //     it so it can include the multipart boundary parameter.

  return fetch(url, { ...init, headers });
}
