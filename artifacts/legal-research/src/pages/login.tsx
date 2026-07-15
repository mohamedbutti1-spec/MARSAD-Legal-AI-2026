import React, { useState } from 'react';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Scale, Lock, User, AlertCircle, ChevronDown, Eye,
  ShieldCheck, BookMarked, BadgeCheck, Info,
} from 'lucide-react';
import { useUserContext } from '@/lib/user-context';
import { MARSAD_COMMUNITY_LINE } from '@/lib/marsad-personas';

// True when built for production (Vite replaces this at compile time).
const IS_PROD = import.meta.env.PROD;

const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');

async function apiLogin(username: string, password: string) {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ username, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? 'Login failed');
  return data as { userId: number; name: string; email: string; role: string; org: string };
}

// One-click, password-less entry into the permanent read-only "reviewer"
// account (role "viewer"). Available in every environment, including
// production, so external reviewers/QA/AI agents can exercise the full
// journey without needing credentials or ever creating/editing/deleting data.
async function apiGuestLogin() {
  const res = await fetch(`${BASE}/api/auth/guest-login`, {
    method: 'POST',
    credentials: 'include',
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? 'Guest login failed');
  return data as { userId: number; name: string; email: string; role: string; org: string };
}

const DEMO_ACCOUNTS = [
  { username: 'admin',          role: 'Owner / Platform Administrator',              labelAr: 'مالك المنصة' },
  { username: 'supervisor',     role: 'Supervisor',                                  labelAr: 'مشرف' },
  { username: 'minister',       role: 'Minister',                                    labelAr: 'وزير' },
  { username: 'undersecretary', role: 'Undersecretary',                              labelAr: 'وكيل وزارة' },
  { username: 'dir_general',    role: 'Director General',                            labelAr: 'مدير عام' },
  { username: 'dept_director',  role: 'Department Director',                         labelAr: 'مدير قسم' },
  { username: 'judge',          role: 'Judge',                                       labelAr: 'قاضٍ' },
  { username: 'legal_dept',     role: 'Legal Department',                            labelAr: 'الشؤون القانونية' },
  { username: 'int_auditor',    role: 'Internal Auditor',                            labelAr: 'مدقق داخلي' },
  { username: 'ext_auditor',    role: 'External Auditor',                            labelAr: 'مدقق خارجي' },
  { username: 'const_reviewer', role: 'Constitutional Reviewer',                     labelAr: 'مراجع دستوري' },
  { username: 'asst_undersec',  role: 'Assistant Undersecretary',                    labelAr: 'وكيل وزارة مساعد' },
  { username: 'viewer',         role: 'Viewer (read-only)',                          labelAr: 'مشاهد' },
  { username: 'citizen',        role: 'Citizen (portal only)',                       labelAr: 'مواطن' },
];

// ── طرق الدخول الموحّد — visual entry points per the V2 workflow spec.
// Federated SSO (Google / Microsoft / Apple / UAE Pass) requires an identity
// broker on the backend, which isn't wired yet, so these are presented as
// upcoming channels rather than dead buttons that fail.
const SSO_PROVIDERS = [
  { id: 'google',    label: 'Google',    mark: 'G'  },
  { id: 'microsoft', label: 'Microsoft', mark: '⊞'  },
  { id: 'apple',     label: 'Apple',     mark: ''  },
  { id: 'uaepass',   label: 'UAE PASS',  mark: '🇦🇪' },
];

const TRUST_CHIPS = [
  { icon: ShieldCheck, label: 'سرية وأمن عالي' },
  { icon: BookMarked,  label: 'مصادر موثوقة' },
  { icon: BadgeCheck,  label: 'معايير مهنية' },
];

type AuthTab = 'login' | 'register';

export default function Login() {
  const [, navigate] = useLocation();
  const { refreshSession } = useUserContext();
  const [tab, setTab] = useState<AuthTab>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showDemo, setShowDemo] = useState(false);
  const [guestLoading, setGuestLoading] = useState(false);
  const [ssoNotice, setSsoNotice] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await apiLogin(username.trim(), password);
      // Refresh the UserContext session state in-place — avoids a hard page
      // reload which breaks iOS Safari / PWA standalone mode: the hard
      // navigation triggers a new browsing context where the just-set cookie
      // (SameSite=Lax) may not be forwarded to the following /api/auth/me
      // check, causing an immediate 401 and redirect back to login.
      await refreshSession();
      navigate('/');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleGuestLogin = async () => {
    setError('');
    setGuestLoading(true);
    try {
      await apiGuestLogin();
      await refreshSession();
      navigate('/');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Guest login failed. Please try again.');
    } finally {
      setGuestLoading(false);
    }
  };

  // Demo account quick-fill (dev only — accounts are blocked in production).
  // Passwords match seed.ts DEMO_ACCOUNTS (DEMO_SEED_VERSION = 2).
  const fillDemo = (u: string) => {
    setUsername(u);
    const pwdMap: Record<string, string> = {
      admin:          '7KW@ltkOeo3Qc6Ys',
      supervisor:     'QCBTr&Jnu9sesK11',
      viewer:         'ODT6jy3nz7HxX3@3',
      judge:          '2W8zzGLhWxLysxM&',
      citizen:        'CH94uTB2%Elu8RDA',
      minister:       'sDk9OZ^XR08NmK6a',
      undersecretary: 'iuyVisM7r#pgGCpi',
      asst_undersec:  'YZ9yOO2MId#oiNi1',
      dir_general:    'ATm1W2%8A5yM92rg',
      dept_director:  '0s^mlN3FeOcpwP7i',
      legal_dept:     'O#vlNZVdSGz6jlN7',
      const_reviewer: 'AKN^2YD0Efnlgm2F',
      int_auditor:    'jbSRQc0l1jRiMN&g',
      ext_auditor:    'gJuHBN$VPxg3hFx3',
    };
    setPassword(pwdMap[u] ?? '');
    setShowDemo(false);
    setTab('login');
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4" dir="rtl">
      <div className="relative w-full max-w-md">
        {/* ── الشعار ─────────────────────────────────────────────────── */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gold/10 border border-gold/25 mb-3">
            <Scale className="w-8 h-8 text-gold" />
          </div>
          <h1 className="text-3xl font-black tracking-[0.15em] text-heading leading-none">MARSAD</h1>
          <p className="text-lg font-bold text-gold mt-1" style={{ fontFamily: 'var(--app-font-serif)' }}>
            مرصد
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            منصة القرارات الإدارية الذكية
          </p>
        </div>

        {/* ── النص الرئيسي ───────────────────────────────────────────── */}
        <div className="text-center mb-6">
          <h2 className="text-base font-bold text-heading mb-2">مرحباً بكم في مرصد</h2>
          <p className="text-[12px] text-muted-foreground leading-relaxed">
            منصة قانونية ذكية تجمع بين التحليل القانوني والمحاكاة المهنية والدراسات
            المقارنة ودعم القرار التنفيذي لتمنحكم أدق المخرجات القانونية والمهنية
            بأعلى درجات الجودة والكفاءة.
          </p>
          <p className="text-[11px] text-gold/80 mt-2 font-medium">
            إختر لطفاً ما تراه مناسباً من خلال القوائم ليتسنى لنا مساعدتك بكل سرعة وجودة.
          </p>
          {/* Trust chips */}
          <div className="flex items-center justify-center gap-2 mt-3 flex-wrap">
            {TRUST_CHIPS.map(({ icon: Icon, label }) => (
              <span
                key={label}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-full border border-gold/20 bg-gold/5 text-[10px] font-semibold text-gold/90"
              >
                <Icon className="w-3 h-3" aria-hidden />
                {label}
              </span>
            ))}
          </div>
        </div>

        {/* ── بطاقة الدخول ───────────────────────────────────────────── */}
        <div className="bg-card border border-border rounded-2xl shadow-xl p-6 sm:p-8">
          {/* تسجيل جديد / تسجيل دخول */}
          <div className="grid grid-cols-2 gap-2 mb-6 p-1 rounded-xl bg-muted/40 border border-border/60">
            <button
              type="button"
              onClick={() => setTab('register')}
              className={`py-2 rounded-lg text-sm font-bold transition-colors ${
                tab === 'register'
                  ? 'bg-gold text-background shadow'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              تسجيل جديد
            </button>
            <button
              type="button"
              onClick={() => setTab('login')}
              className={`py-2 rounded-lg text-sm font-bold transition-colors ${
                tab === 'login'
                  ? 'bg-gold text-background shadow'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              تسجيل دخول
            </button>
          </div>

          {tab === 'login' ? (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-1.5">
                <Label htmlFor="username" className="text-sm font-medium">
                  اسم المستخدم
                </Label>
                <div className="relative">
                  <User className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="username"
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="username"
                    className="ps-9"
                    autoComplete="username"
                    required
                    disabled={loading}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-sm font-medium">
                  كلمة المرور
                </Label>
                <div className="relative">
                  <Lock className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="ps-9"
                    autoComplete="current-password"
                    required
                    disabled={loading}
                  />
                </div>
              </div>

              {error && (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                  <AlertCircle className="w-4 h-4 text-destructive mt-0.5 shrink-0" />
                  <p className="text-sm text-destructive">{error}</p>
                </div>
              )}

              <Button
                type="submit"
                className="gold-hover-glow w-full bg-gold hover:opacity-90 text-background font-semibold"
                disabled={loading}
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-background/30 border-t-background rounded-full animate-spin" />
                    جارٍ تسجيل الدخول…
                  </span>
                ) : (
                  'تسجيل الدخول'
                )}
              </Button>
            </form>
          ) : (
            /* تسجيل جديد — account provisioning is centrally managed until
               self-service registration + SSO federation land on the backend. */
            <div className="space-y-4 text-center py-2">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-gold/10 border border-gold/20">
                <Info className="w-6 h-6 text-gold" />
              </div>
              <p className="text-sm font-bold text-heading">التسجيل الجديد</p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                يتم حالياً اعتماد الحسابات الجديدة مركزياً من إدارة المنصة لضمان
                التحقق المهني من الفئات (القضاء، النيابة، الشرطة، المحاماة،
                القيادات، الباحثين). سيتاح التسجيل الذاتي وربط الهوية الرقمية
                UAE PASS قريباً.
              </p>
              <p className="text-[11px] text-gold/80 font-medium">
                يمكنكم الدخول الآن كمقيّم (قراءة فقط) لاستكشاف كامل المنصة.
              </p>
            </div>
          )}

          {/* ── طرق الدخول الموحّد ──────────────────────────────────── */}
          <div className="mt-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="flex-1 h-px bg-border" />
              <span className="text-[10px] text-muted-foreground">أو تسجيل الدخول عبر</span>
              <div className="flex-1 h-px bg-border" />
            </div>
            <div className="grid grid-cols-4 gap-2">
              {SSO_PROVIDERS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setSsoNotice(true)}
                  title={`${p.label} — قريباً`}
                  className="flex flex-col items-center gap-1 py-2.5 rounded-xl border border-border bg-background/60 hover:border-gold/40 hover:bg-gold/5 transition-colors"
                >
                  <span className="text-base leading-none" aria-hidden>{p.mark}</span>
                  <span className="text-[9px] font-semibold text-muted-foreground">{p.label}</span>
                </button>
              ))}
            </div>
            {ssoNotice && (
              <p className="text-[10px] text-gold/80 text-center mt-2 font-medium">
                الدخول الموحّد عبر الهوية الرقمية قيد التفعيل — استخدم حساب المنصة أو دخول المقيّم حالياً.
              </p>
            )}
          </div>

          {/* Guest/demo login — always available, including production. Signs
              directly into the permanent "reviewer" account (role "viewer"):
              full read access to every module and dashboard, plus a narrow
              exception to ask the AI assistant legal questions (capped at
              5/day) — see requireWriteRoleOrGuestDemo on the backend. No
              create/update/delete permissions anywhere else, and no access
              to admin settings, user management, or system configuration. */}
          <div className="mt-5">
            <Button
              type="button"
              variant="outline"
              onClick={handleGuestLogin}
              disabled={guestLoading || loading}
              className="w-full h-auto min-h-10 border-gold/30 text-gold hover:bg-gold/10 font-medium whitespace-normal py-2 px-3"
            >
              {guestLoading ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 shrink-0 border-2 border-gold/30 border-t-gold rounded-full animate-spin" />
                  جارٍ الدخول…
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2 text-center leading-snug">
                  <Eye className="w-4 h-4 shrink-0" />
                  <span>دخول كمقيّم — قراءة فقط</span>
                </span>
              )}
            </Button>
          </div>

          {/* Demo accounts panel — hidden in production (accounts are blocked there) */}
          {!IS_PROD && (
          <div className="mt-6 pt-5 border-t border-border">
            <button
              type="button"
              onClick={() => setShowDemo(!showDemo)}
              className="w-full flex items-center justify-between text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <span>Demo accounts / الحسابات التجريبية</span>
              <ChevronDown
                className={`w-3.5 h-3.5 transition-transform ${showDemo ? 'rotate-180' : ''}`}
              />
            </button>

            {showDemo && (
              <div className="mt-3 space-y-1 max-h-56 overflow-y-auto pe-1">
                {DEMO_ACCOUNTS.map((acc) => (
                  <button
                    key={acc.username}
                    type="button"
                    onClick={() => fillDemo(acc.username)}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-muted text-xs text-start transition-colors group"
                  >
                    <span className="font-mono text-gold group-hover:text-gold/80" dir="ltr">
                      {acc.username}
                    </span>
                    <span className="text-muted-foreground">{acc.labelAr}</span>
                  </button>
                ))}
                <p className="text-[10px] text-muted-foreground/60 pt-1 px-1">
                  Click any account to auto-fill credentials.
                </p>
              </div>
            )}
          </div>
          )}
        </div>

        {/* ── أسفل الصفحة ────────────────────────────────────────────── */}
        <div className="text-center mt-6 space-y-1">
          <p className="text-xs font-bold text-gold/80 tracking-wide">
            {MARSAD_COMMUNITY_LINE}
          </p>
          <p className="text-[10px] text-muted-foreground">
            دولة الإمارات العربية المتحدة — نظام إداري حكومي داخلي
          </p>
        </div>
      </div>
    </div>
  );
}
