const configured = import.meta.env.VITE_API_BASE_URL?.trim();

export const API_BASE_URL = configured
  ? configured.replace(/\/$/, '')
  : '';

export function apiUrl(path: string): string {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE_URL}${normalized}`;
}
