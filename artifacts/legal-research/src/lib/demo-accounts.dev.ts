/**
 * DEV-ONLY demo account quick-fill data.
 *
 * ⚠️ This module contains development seed credentials and must NEVER be
 * imported statically. The only permitted entry point is the dynamic,
 * `import.meta.env.DEV`-guarded import in pages/login.tsx. Vite replaces
 * that guard with `false` at build time, dead-code-eliminates the import,
 * and excludes this chunk from production bundles entirely — so no
 * credential in this file can ship to a production browser.
 *
 * Passwords match seed.ts DEMO_ACCOUNTS (DEMO_SEED_VERSION = 2). Demo
 * account logins are additionally blocked server-side in production
 * (users.isDemo + NODE_ENV check in routes/auth.ts).
 */

export interface DemoAccount {
  username: string;
  role: string;
  labelAr: string;
  password: string;
}

export const DEMO_ACCOUNTS: DemoAccount[] = [
  { username: 'admin',          role: 'Owner / Platform Administrator', labelAr: 'مالك المنصة',        password: '7KW@ltkOeo3Qc6Ys' },
  { username: 'supervisor',     role: 'Supervisor',                     labelAr: 'مشرف',               password: 'QCBTr&Jnu9sesK11' },
  { username: 'minister',       role: 'Minister',                       labelAr: 'وزير',               password: 'sDk9OZ^XR08NmK6a' },
  { username: 'undersecretary', role: 'Undersecretary',                 labelAr: 'وكيل وزارة',         password: 'iuyVisM7r#pgGCpi' },
  { username: 'dir_general',    role: 'Director General',               labelAr: 'مدير عام',           password: 'ATm1W2%8A5yM92rg' },
  { username: 'dept_director',  role: 'Department Director',            labelAr: 'مدير قسم',           password: '0s^mlN3FeOcpwP7i' },
  { username: 'judge',          role: 'Judge',                          labelAr: 'قاضٍ',               password: '2W8zzGLhWxLysxM&' },
  { username: 'legal_dept',     role: 'Legal Department',               labelAr: 'الشؤون القانونية',   password: 'O#vlNZVdSGz6jlN7' },
  { username: 'int_auditor',    role: 'Internal Auditor',               labelAr: 'مدقق داخلي',         password: 'jbSRQc0l1jRiMN&g' },
  { username: 'ext_auditor',    role: 'External Auditor',               labelAr: 'مدقق خارجي',         password: 'gJuHBN$VPxg3hFx3' },
  { username: 'const_reviewer', role: 'Constitutional Reviewer',        labelAr: 'مراجع دستوري',       password: 'AKN^2YD0Efnlgm2F' },
  { username: 'asst_undersec',  role: 'Assistant Undersecretary',       labelAr: 'وكيل وزارة مساعد',   password: 'YZ9yOO2MId#oiNi1' },
  { username: 'viewer',         role: 'Viewer (read-only)',             labelAr: 'مشاهد',              password: 'ODT6jy3nz7HxX3@3' },
  { username: 'citizen',        role: 'Citizen (portal only)',          labelAr: 'مواطن',              password: 'CH94uTB2%Elu8RDA' },
];
