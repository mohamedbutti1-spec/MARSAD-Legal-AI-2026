import { useLocation } from 'wouter';

export interface BackInfo {
  /** Fallback URL to navigate to if window.history is empty */
  parentPath: string;
  labelAr: string;
  labelEn: string;
}

// ---------------------------------------------------------------------------
// Route → parent mapping table.
// Each entry tests `path` against a regex; the first match wins.
// Capture groups are passed to `getParent` so dynamic segments can be re-used.
// ---------------------------------------------------------------------------
type RouteEntry = {
  pattern: RegExp;
  getParent: (groups: string[], path: string) => BackInfo;
};

const ROUTE_MAP: RouteEntry[] = [
  // ── Decisions ────────────────────────────────────────────────────────────
  {
    pattern: /^\/decisions\/(new|[^/]+)$/,
    getParent: () => ({ parentPath: '/decisions', labelAr: 'القرارات', labelEn: 'Decisions' }),
  },

  // ── ADKG ─────────────────────────────────────────────────────────────────
  {
    pattern: /^\/adkg\/[^/]+$/,
    getParent: () => ({ parentPath: '/adkg', labelAr: 'ADKG', labelEn: 'ADKG' }),
  },

  // ── Research Workspace ───────────────────────────────────────────────────
  {
    pattern: /^\/workspace\/([^/]+)\/items\/[^/]+$/,
    getParent: (g) => ({ parentPath: `/workspace/${g[1]}`, labelAr: 'المشروع', labelEn: 'Project' }),
  },
  {
    pattern: /^\/workspace\/[^/]+$/,
    getParent: () => ({ parentPath: '/workspace', labelAr: 'مساحة العمل', labelEn: 'Workspace' }),
  },

  // ── JRE ──────────────────────────────────────────────────────────────────
  {
    pattern: /^\/jre\/[^/]+$/,
    getParent: () => ({ parentPath: '/jre', labelAr: 'التفكير القضائي', labelEn: 'JRE' }),
  },

  // ── JDC ──────────────────────────────────────────────────────────────────
  {
    pattern: /^\/jdc\/[^/]+$/,
    getParent: () => ({ parentPath: '/jdc', labelAr: 'غرفة المداولة', labelEn: 'JDC' }),
  },

  // ── SPG ──────────────────────────────────────────────────────────────────
  {
    pattern: /^\/spg\/[^/]+$/,
    getParent: () => ({ parentPath: '/spg', labelAr: 'التوجيه المهني', labelEn: 'SPG' }),
  },

  // ── PGF ──────────────────────────────────────────────────────────────────
  {
    pattern: /^\/pgf\/[^/]+$/,
    getParent: () => ({ parentPath: '/pgf', labelAr: 'الإطار المهني', labelEn: 'PGF' }),
  },

  // ── JDT (Judicial Digital Twin) ──────────────────────────────────────────
  {
    pattern: /^\/jdt\/[^/]+$/,
    getParent: () => ({ parentPath: '/decisions', labelAr: 'القرارات', labelEn: 'Decisions' }),
  },

  // ── NAIP sub-pages ───────────────────────────────────────────────────────
  {
    pattern: /^\/naip\/(minister|undersecretary|director-general|risk-officer|judge|dashboard|kpi|search)$/,
    getParent: () => ({ parentPath: '/naip', labelAr: 'NAIP', labelEn: 'NAIP' }),
  },

  // ── Admin sub-pages ──────────────────────────────────────────────────────
  {
    pattern: /^\/admin\/legal-os$/,
    getParent: () => ({ parentPath: '/admin-os', labelAr: 'النظام الإداري', labelEn: 'Admin OS' }),
  },
  {
    pattern: /^\/admin\/users$/,
    getParent: () => ({ parentPath: '/settings', labelAr: 'الإعدادات', labelEn: 'Settings' }),
  },

  // ── Settings sub-pages ───────────────────────────────────────────────────
  {
    pattern: /^\/settings\/roles$/,
    getParent: () => ({ parentPath: '/settings', labelAr: 'الإعدادات', labelEn: 'Settings' }),
  },

  // ── Account ──────────────────────────────────────────────────────────────
  {
    pattern: /^\/account$/,
    getParent: () => ({ parentPath: '/', labelAr: 'الرئيسية', labelEn: 'Home' }),
  },

  // ── Journey (deepest first so more-specific patterns win) ────────────────
  {
    pattern: /^\/journey\/result\/[^/]+$/,
    getParent: () => ({ parentPath: '/', labelAr: 'الرئيسية', labelEn: 'Home' }),
  },
  {
    pattern: /^\/journey\/([^/]+)\/([^/]+)\/([^/]+)\/incident\/[^/]+$/,
    getParent: (g) => ({
      parentPath: `/journey/${g[1]}/${g[2]}/${g[3]}/incident`,
      labelAr: 'الحوادث',
      labelEn: 'Incidents',
    }),
  },
  {
    pattern: /^\/journey\/([^/]+)\/([^/]+)\/([^/]+)\/incident$/,
    getParent: (g) => ({
      parentPath: `/journey/${g[1]}/${g[2]}/${g[3]}`,
      labelAr: 'الخدمة',
      labelEn: 'Service',
    }),
  },
  {
    pattern: /^\/journey\/([^/]+)\/([^/]+)\/([^/]+)$/,
    getParent: (g) => ({
      parentPath: `/journey/${g[1]}/${g[2]}`,
      labelAr: 'الخدمات',
      labelEn: 'Services',
    }),
  },
  {
    pattern: /^\/journey\/([^/]+)\/([^/]+)$/,
    getParent: (g) => ({
      parentPath: `/journey/${g[1]}`,
      labelAr: 'الفئة',
      labelEn: 'Category',
    }),
  },
  {
    pattern: /^\/journey\/[^/]+$/,
    getParent: () => ({ parentPath: '/', labelAr: 'الرئيسية', labelEn: 'Home' }),
  },
];

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Returns back-navigation info when the current path is a sub-page, or `null`
 * when on a top-level page (no back button needed).
 */
export function useBackNavigation(): BackInfo | null {
  const [rawPath] = useLocation();

  // Strip the BASE_URL prefix (e.g. "/legal-research") that wouter may prepend
  // in development, so the patterns can stay clean.
  const base = import.meta.env.BASE_URL?.replace(/\/$/, '') ?? '';
  const path = base && rawPath.startsWith(base) ? rawPath.slice(base.length) || '/' : rawPath;

  for (const entry of ROUTE_MAP) {
    const match = path.match(entry.pattern);
    if (match) {
      // Pass capture groups (index 1+) to the factory
      return entry.getParent(match.slice(1), path);
    }
  }

  return null;
}
