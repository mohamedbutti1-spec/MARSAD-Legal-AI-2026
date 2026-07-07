import React, { useState } from 'react';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Shield, Lock, User, AlertCircle, ChevronDown } from 'lucide-react';

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
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showDemo, setShowDemo] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await apiLogin(username.trim(), password);
      // Reload to trigger AuthGate re-check which then shows the app
      window.location.href = BASE + '/';
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const fillDemo = (u: string) => {
    setUsername(u);
    // Derive password from username pattern
    const pwdMap: Record<string, string> = {
      admin:          'Admin@MARSAD2024',
      supervisor:     'Supervisor@MARSAD2024',
      minister:       'Minister@MARSAD2024',
      undersecretary: 'Undersec@MARSAD2024',
      dir_general:    'DirGeneral@MARSAD2024',
      dept_director:  'DeptDir@MARSAD2024',
      judge:          'Judge@MARSAD2024',
      legal_dept:     'LegalDept@MARSAD2024',
      int_auditor:    'IntAudit@MARSAD2024',
      ext_auditor:    'ExtAudit@MARSAD2024',
      const_reviewer: 'ConstRev@MARSAD2024',
      asst_undersec:  'AsstUndersec@MARSAD2024',
      viewer:         'Viewer@MARSAD2024',
      citizen:        'Citizen@MARSAD2024',
    };
    setPassword(pwdMap[u] ?? '');
    setShowDemo(false);
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      {/* Background pattern */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full bg-amber-500/5 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 rounded-full bg-amber-500/5 blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 mb-4">
            <Shield className="w-8 h-8 text-amber-500" />
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-1">MARSAD</h1>
          <p className="text-sm text-muted-foreground">
            منصة القرارات الإدارية الذكية
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Intelligent Administrative Decision Platform
          </p>
        </div>

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
              className="w-full bg-amber-500 hover:bg-amber-600 text-white font-semibold"
              disabled={loading}
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  جارٍ تسجيل الدخول…
                </span>
              ) : (
                'تسجيل الدخول / Sign In'
              )}
            </Button>
          </form>

          {/* Demo accounts panel */}
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
                    className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-muted text-xs text-left transition-colors group"
                  >
                    <span className="font-mono text-amber-600 group-hover:text-amber-500">
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
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-muted-foreground mt-6">
          دولة الإمارات العربية المتحدة — نظام إداري حكومي داخلي
        </p>
      </div>
    </div>
  );
}
