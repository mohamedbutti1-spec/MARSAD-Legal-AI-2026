import React, { useState } from 'react';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Lock, User, AlertCircle, ChevronDown, Eye, ShieldOff } from 'lucide-react';
import { useUserContext } from '@/lib/user-context';
import { MarsadEmblem } from '@/components/icons/marsad-emblem';

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

// Password-less demo account entry (dev/staging only — the server blocks this
// route entirely in production). No password ever needs to live in the
// frontend bundle: the server verifies the account is a genuine is_demo row
// and issues the session cookie directly.
async function apiDemoLogin(username: string) {
  const res = await fetch(`${BASE}/api/auth/demo-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ username }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? 'Demo login failed');
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

export default function Login() {
  const [, navigate] = useLocation();
  const { refreshSession, sessionRevoked } = useUserContext();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showDemo, setShowDemo] = useState(false);
  const [guestLoading, setGuestLoading] = useState(false);
  const [registerNote, setRegisterNote] = useState(false);
  const [socialNote, setSocialNote] = useState<string | null>(null);
  const [demoLoadingUser, setDemoLoadingUser] = useState<string | null>(null);

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

  // Demo account quick-login (dev only — the server blocks this route in
  // production). Signs straight in via /api/auth/demo-login — no password is
  // ever sent to or stored in the frontend.
  const fillDemo = async (u: string) => {
    setError('');
    setDemoLoadingUser(u);
    try {
      await apiDemoLogin(u);
      await refreshSession();
      setShowDemo(false);
      navigate('/');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Demo login failed. Please try again.');
    } finally {
      setDemoLoadingUser(null);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="relative w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gold/10 border border-gold/20 mb-4">
            <MarsadEmblem className="w-10 h-10 text-gold" />
          </div>
          <h1 className="text-2xl font-bold text-heading mb-1">مرصد — MARSAD</h1>
          <p className="text-sm text-muted-foreground">
            منصة القرارات الإدارية الذكية
          </p>
          <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed max-w-sm mx-auto" dir="rtl">
            منصة قانونية ذكية تجمع بين التحليل القانوني والمحاكاة المهنية
            والدراسات المقارنة ودعم القرار التنفيذي، لتمنحك أدق المخرجات
            القانونية والمهنية بأعلى درجات الجودة والكفاءة.
          </p>
          <div className="flex items-center justify-center gap-3 mt-3 text-[10px] text-muted-foreground" dir="rtl">
            <span>🛡️ سرية وأمن عالي</span>
            <span>·</span>
            <span>📚 مصادر موثوقة</span>
            <span>·</span>
            <span>⚖️ معايير مهنية</span>
          </div>
        </div>

        {/* Session-revoked notice — shown when this device's session was ended
            remotely (another device signed out, or an admin reset the password) */}
        {sessionRevoked && (
          <div className="mb-4 flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
            <ShieldOff className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
            <div>
              <p className="text-sm font-semibold text-amber-600 dark:text-amber-400">
                تم إنهاء جلستك — Session Ended
              </p>
              <p className="mt-0.5 text-xs text-amber-700/80 dark:text-amber-300/80" dir="rtl">
                تم تسجيل خروجك تلقائياً لأن جلستك أُنهيت من جهاز آخر أو بواسطة المسؤول.
                يرجى تسجيل الدخول مجدداً للمتابعة.
              </p>
              <p className="mt-1 text-xs text-amber-700/80 dark:text-amber-300/80">
                You were signed out because your session was ended on another device or by an administrator.
                Please log in again to continue.
              </p>
            </div>
          </div>
        )}

        {/* Login card */}
        <div className="bg-card border border-border rounded-2xl shadow-xl p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-1.5">
              <Label htmlFor="username" className="text-sm font-medium">
                اسم المستخدم / Username
              </Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="username"
                  className="pl-9"
                  autoComplete="username"
                  required
                  disabled={loading}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-sm font-medium">
                كلمة المرور / Password
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="pl-9"
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
                'تسجيل الدخول / Sign In'
              )}
            </Button>
          </form>

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
                  <span>
                    <span className="block sm:inline">دخول كمقيّم — قراءة فقط</span>
                    <span className="hidden sm:inline"> / </span>
                    <span className="block sm:inline text-[13px] sm:text-sm opacity-90">Guest Evaluation Login (Read-only)</span>
                  </span>
                </span>
              )}
            </Button>
          </div>

          {/* تسجيل جديد — provisioning is admin-managed in Alpha; explain instead of faking a flow */}
          <div className="mt-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => setRegisterNote(!registerNote)}
              className="w-full font-medium"
            >
              تسجيل جديد / New Registration
            </Button>
            {registerNote && (
              <p className="text-[11px] text-muted-foreground mt-2 leading-relaxed text-center" dir="rtl">
                إنشاء الحسابات الجديدة يتم حالياً عبر إدارة المنصة للجهات المعتمدة.
                يمكنك تجربة المنصة كاملة عبر «دخول كمقيّم» أعلاه.
              </p>
            )}
          </div>

          {/* أو تسجيل الدخول عبر — social identity providers (قيد التفعيل) */}
          <div className="mt-5">
            <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
              <span className="flex-1 h-px bg-border" />
              أو تسجيل الدخول عبر
              <span className="flex-1 h-px bg-border" />
            </div>
            <div className="grid grid-cols-4 gap-2 mt-3">
              {[
                { id: 'google',    label: 'Google',   icon: 'G'  },
                { id: 'microsoft', label: 'Microsoft', icon: '⊞' },
                { id: 'apple',     label: 'Apple',    icon: ''  },
                { id: 'uaepass',   label: 'UAE PASS', icon: '🇦🇪' },
              ].map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setSocialNote(p.label)}
                  className="flex flex-col items-center gap-1 rounded-xl border border-border py-2.5 hover:border-gold/40 transition-colors"
                >
                  <span className="text-base leading-none" aria-hidden>{p.icon}</span>
                  <span className="text-[10px] text-muted-foreground">{p.label}</span>
                </button>
              ))}
            </div>
            {socialNote && (
              <p className="text-[11px] text-muted-foreground mt-2 text-center" dir="rtl">
                الدخول عبر {socialNote} قيد التفعيل — استخدم حسابك المعتمد أو «دخول كمقيّم».
              </p>
            )}
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
              <div className="mt-3 space-y-1 max-h-56 overflow-y-auto pr-1">
                {DEMO_ACCOUNTS.map((acc) => (
                  <button
                    key={acc.username}
                    type="button"
                    onClick={() => fillDemo(acc.username)}
                    disabled={demoLoadingUser !== null}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-muted text-xs text-left transition-colors group disabled:opacity-50"
                  >
                    <span className="font-mono text-gold group-hover:text-gold/80">
                      {acc.username}
                    </span>
                    <span className="text-muted-foreground">
                      {demoLoadingUser === acc.username ? '…' : acc.labelAr}
                    </span>
                  </button>
                ))}
                <p className="text-[10px] text-muted-foreground/60 pt-1 px-1">
                  Click any account to sign in directly.
                </p>
              </div>
            )}
          </div>
          )}
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-gold/80 font-semibold mt-6" dir="rtl">
          كن في مجتمع مرصد لحفظ الوطن 🇦🇪
        </p>
        <p className="text-center text-xs text-muted-foreground mt-1.5">
          دولة الإمارات العربية المتحدة — نظام إداري حكومي داخلي
        </p>
      </div>
    </div>
  );
}
