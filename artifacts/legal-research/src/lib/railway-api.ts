export const RAILWAY_API_BASE = "https://workspaceapi-server-production-5183.up.railway.app";

export function railwayApiUrl(path: string): string {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return `${RAILWAY_API_BASE}${normalized}`;
}
