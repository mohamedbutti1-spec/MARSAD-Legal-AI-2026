import React, { useState, useEffect, useCallback } from 'react';
import { AppLayout } from '@/components/layout/app-layout';
import { useUserContext, ROLE_META, type UserRole } from '@/lib/user-context';
import { apiFetch } from '@/lib/api-fetch';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import {
  KeyRound, Lock, ShieldOff, Loader2, User,
  Monitor, Smartphone, Globe, Clock, Wifi,
} from 'lucide-react';

// ── Types ────────────────────────────────────────────────────────────────────
interface SessionRow {
  id: number;
  sid: string;
  isCurrent: boolean;
  userAgent: string | null;
  ip: string | null;
  createdAt: string;
  lastSeenAt: string;
}

// ── API helpers ───────────────────────────────────────────────────────────────
async function apiChangePassword(currentPassword: string, newPassword: string) {
  const res = await apiFetch('/api/auth/change-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ currentPassword, newPassword }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? 'Password change failed');
  return data;
}

async function apiSignOutOtherSessions(): Promise<{ revokedCount?: number }> {
  const res = await apiFetch('/api/auth/sign-out-other-sessions', { method: 'POST' });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? 'Could not sign out other sessions.');
  return data;
}

async function apiGetSessions(): Promise<SessionRow[]> {
  const res = await apiFetch('/api/auth/sessions');
  const data = await res.json().catch(() => ({ sessions: [] }));
  if (!res.ok) return [];
  return (data.sessions as SessionRow[]) ?? [];
}

// ── Device label heuristic ────────────────────────────────────────────────────
function parseDeviceLabel(ua: string | null): { label: string; icon: React.ReactNode } {
  if (!ua) return { label: 'Unknown device', icon: <Globe className="w-4 h-4" /> };
  const u = ua.toLowerCase();
  const isPhone = /iphone|android.*mobile|windows phone/.test(u);
  const isTablet = /ipad|android(?!.*mobile)/.test(u);

  let browser = 'Browser';
  if (u.includes('edg/') || u.includes('edge/')) browser = 'Edge';
  else if (u.includes('chrome/') && !u.includes('chromium')) browser = 'Chrome';
  else if (u.includes('firefox/')) browser = 'Firefox';
  else if (u.includes('safari/') && !u.includes('chrome')) browser = 'Safari';
  else if (u.includes('opr/') || u.includes('opera/')) browser = 'Opera';

  let os = '';
  if (u.includes('windows nt')) os = 'Windows';
  else if (u.includes('macintosh') || u.includes('mac os x')) os = 'macOS';
  else if (u.includes('iphone') || u.includes('ipad')) os = 'iOS';
  else if (u.includes('android')) os = 'Android';
  else if (u.includes('linux')) os = 'Linux';

  const label = [browser, os].filter(Boolean).join(' on ') || 'Unknown device';
  const icon = isPhone
    ? <Smartphone className="w-4 h-4" />
    : isTablet
    ? <Smartphone className="w-4 h-4" />
    : <Monitor className="w-4 h-4" />;

  return { label, icon };
}

function relativeTime(iso: string, isAr: boolean): string {
  const ms = Date.now() - new Date(iso).getTime();
  const sec = Math.floor(ms / 1000);
  if (sec < 60) return isAr ? 'الآن' : 'Just now';
  const min = Math.floor(sec / 60);
  if (min < 60) return isAr ? `منذ ${min} دقيقة` : `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return isAr ? `منذ ${hr} ساعة` : `${hr}h ago`;
  const days = Math.floor(hr / 24);
  return isAr ? `منذ ${days} يوم` : `${days}d ago`;
}

/**
 * Self-service account settings — available to every authenticated user
 * (not gated behind canManageSettings, which is for owner-only platform
 * configuration). Covers voluntary password changes and ending one's own
 * other active sessions (e.g. a shared/public computer left signed in).
 */
export default function Account() {
  const { role, lang, refreshSession } = useUserContext();
  const { toast } = useToast();
  const isAr = lang === 'ar';
  const meta = ROLE_META[role as UserRole];

  // ── Change password ──────────────────────────────────────────────────────
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwError, setPwError] = useState('');
  const [pwSaving, setPwSaving] = useState(false);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwError('');

    if (newPassword.length < 8) {
      setPwError(isAr ? 'كلمة المرور الجديدة يجب ألا تقل عن 8 أحرف.' : 'New password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwError(isAr ? 'كلمتا المرور غير متطابقتين.' : 'Passwords do not match.');
      return;
    }

    setPwSaving(true);
    try {
      await apiChangePassword(currentPassword, newPassword);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      toast({ title: isAr ? 'تم تغيير كلمة المرور' : 'Password changed', description: isAr ? 'تم تحديث كلمة مرورك بنجاح.' : 'Your password has been updated successfully.' });
      // Refresh session list — other sessions are now gone
      loadSessions();
    } catch (err: unknown) {
      setPwError(err instanceof Error ? err.message : 'Password change failed.');
    } finally {
      setPwSaving(false);
    }
  };

  // ── Sessions ─────────────────────────────────────────────────────────────
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [signOutLoading, setSignOutLoading] = useState(false);

  const loadSessions = useCallback(async () => {
    setSessionsLoading(true);
    try {
      const rows = await apiGetSessions();
      setSessions(rows);
    } catch {
      // non-fatal
    } finally {
      setSessionsLoading(false);
    }
  }, []);

  useEffect(() => { loadSessions(); }, [loadSessions]);

  const otherSessionCount = sessions.filter((s) => !s.isCurrent).length;

  const handleSignOutOthers = async () => {
    setSignOutLoading(true);
    try {
      const result = await apiSignOutOtherSessions();
      // Refresh so this tab's context picks up the freshly-issued cookie.
      await refreshSession();
      await loadSessions();
      const count = result.revokedCount ?? 0;
      toast({
        title: isAr ? 'تم تسجيل الخروج من الجلسات الأخرى' : 'Other sessions signed out',
        description: isAr
          ? `تم إنهاء ${count} جلسة أخرى. هذه الجلسة لا تزال مفتوحة.`
          : `${count} other session${count !== 1 ? 's' : ''} ended. This session remains active.`,
      });
    } catch (err: unknown) {
      toast({ title: isAr ? 'خطأ' : 'Error', description: err instanceof Error ? err.message : 'Failed to sign out other sessions.', variant: 'destructive' });
    } finally {
      setSignOutLoading(false);
    }
  };

  return (
    <AppLayout>
      <div className="space-y-8 max-w-2xl mx-auto">
        <div>
          <h1 className="text-3xl font-serif font-bold text-foreground">
            {isAr ? 'إعدادات الحساب' : 'Account Settings'}
            <span className="text-muted-foreground font-sans font-normal text-xl ml-2">
              {isAr ? '/ Account Settings' : '/ إعدادات الحساب'}
            </span>
          </h1>
          <p className="text-muted-foreground mt-2 font-serif">
            {isAr ? 'إدارة أمان حسابك وجلساتك النشطة.' : 'Manage your account security and active sessions.'}
          </p>
        </div>

        {/* ── Identity ──────────────────────────────────────────────────── */}
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0">
              <User className="w-4 h-4" />
            </div>
            <div>
              <div className="font-semibold text-foreground text-sm">{isAr ? meta?.ar : meta?.en}</div>
              <div className="text-xs text-muted-foreground">{role}</div>
            </div>
          </CardContent>
        </Card>

        {/* ── Change password ──────────────────────────────────────────── */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <KeyRound className="w-5 h-5 text-primary" />
              {isAr ? 'تغيير كلمة المرور' : 'Change Password'}
            </CardTitle>
            <CardDescription>
              {isAr
                ? 'يتطلب إدخال كلمة المرور الحالية. سيتم تسجيل خروجك من أي جلسات أخرى بعد التغيير.'
                : 'Requires your current password. Any other active sessions are signed out once you change it.'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleChangePassword} className="space-y-4" autoComplete="off">
              <div className="space-y-1.5">
                <Label htmlFor="currentPassword">{isAr ? 'كلمة المرور الحالية' : 'Current Password'}</Label>
                <div className="relative">
                  <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="currentPassword"
                    type="password"
                    className="pl-9"
                    autoComplete="current-password"
                    required
                    disabled={pwSaving}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="newPassword">{isAr ? 'كلمة المرور الجديدة' : 'New Password'}</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="newPassword"
                    type="password"
                    className="pl-9"
                    autoComplete="new-password"
                    minLength={8}
                    required
                    disabled={pwSaving}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="confirmPassword">{isAr ? 'تأكيد كلمة المرور' : 'Confirm Password'}</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="confirmPassword"
                    type="password"
                    className="pl-9"
                    autoComplete="new-password"
                    minLength={8}
                    required
                    disabled={pwSaving}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                  />
                </div>
              </div>

              {pwError && <p className="text-sm text-destructive">{pwError}</p>}

              <div className="flex justify-end pt-1">
                <Button type="submit" disabled={pwSaving} className="gap-2">
                  {pwSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
                  {pwSaving ? (isAr ? 'جارٍ الحفظ…' : 'Saving…') : (isAr ? 'تحديث كلمة المرور' : 'Update Password')}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* ── Active sessions ──────────────────────────────────────────── */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between gap-4">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <ShieldOff className="w-5 h-5 text-primary" />
                  {isAr ? 'الجلسات النشطة' : 'Active Sessions'}
                </CardTitle>
                <CardDescription className="mt-1">
                  {isAr
                    ? 'الأجهزة والمتصفحات التي تملك جلسة نشطة حالياً في حسابك.'
                    : 'Devices and browsers that currently have an active session on your account.'}
                </CardDescription>
              </div>
              {otherSessionCount > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2 border-destructive/30 text-destructive hover:bg-destructive/10 shrink-0 mt-0.5"
                  onClick={handleSignOutOthers}
                  disabled={signOutLoading}
                >
                  {signOutLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShieldOff className="w-3.5 h-3.5" />}
                  {signOutLoading
                    ? (isAr ? 'جارٍ التنفيذ…' : 'Signing out…')
                    : (isAr ? `إنهاء ${otherSessionCount} جلسة أخرى` : `Sign out ${otherSessionCount} other session${otherSessionCount !== 1 ? 's' : ''}`)}
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            {sessionsLoading ? (
              <div className="flex items-center gap-2 py-6 justify-center text-muted-foreground text-sm">
                <Loader2 className="w-4 h-4 animate-spin" />
                {isAr ? 'جارٍ التحميل…' : 'Loading sessions…'}
              </div>
            ) : sessions.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                {isAr ? 'لا توجد جلسات نشطة مسجّلة.' : 'No active sessions on record.'}
              </p>
            ) : (
              <ul className="space-y-2">
                {sessions.map((s) => {
                  const { label, icon } = parseDeviceLabel(s.userAgent);
                  return (
                    <li
                      key={s.id}
                      className={`flex items-start gap-3 rounded-lg px-3 py-3 border transition-colors ${
                        s.isCurrent
                          ? 'bg-primary/5 border-primary/20'
                          : 'bg-muted/30 border-border/50'
                      }`}
                    >
                      <div className={`mt-0.5 shrink-0 ${s.isCurrent ? 'text-primary' : 'text-muted-foreground'}`}>
                        {icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium text-foreground truncate">{label}</span>
                          {s.isCurrent && (
                            <span className="text-[11px] font-medium px-1.5 py-0.5 rounded-full bg-primary/15 text-primary border border-primary/20 shrink-0">
                              {isAr ? 'هذه الجلسة' : 'This session'}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-1 flex-wrap">
                          {s.ip && (
                            <span className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Wifi className="w-3 h-3" />
                              {s.ip}
                            </span>
                          )}
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Clock className="w-3 h-3" />
                            {isAr ? 'آخر نشاط: ' : 'Last active: '}
                            {relativeTime(s.lastSeenAt, isAr)}
                          </span>
                          <span className="text-xs text-muted-foreground/60">
                            {isAr ? 'بدأت: ' : 'Started: '}
                            {relativeTime(s.createdAt, isAr)}
                          </span>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}

            {/* Show the sign-out button at the bottom too when there are other sessions */}
            {!sessionsLoading && otherSessionCount === 0 && sessions.length > 0 && (
              <p className="text-xs text-muted-foreground mt-3 text-center">
                {isAr
                  ? 'لا توجد جلسات أخرى نشطة.'
                  : 'No other active sessions.'}
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
