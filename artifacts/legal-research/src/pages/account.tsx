import React, { useState } from 'react';
import { AppLayout } from '@/components/layout/app-layout';
import { useUserContext, ROLE_META, type UserRole } from '@/lib/user-context';
import { apiFetch } from '@/lib/api-fetch';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { KeyRound, Lock, ShieldOff, Loader2, User, CheckCircle2 } from 'lucide-react';

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

async function apiSignOutOtherSessions() {
  const res = await apiFetch('/api/auth/sign-out-other-sessions', { method: 'POST' });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? 'Could not sign out other sessions.');
  return data;
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
    } catch (err: unknown) {
      setPwError(err instanceof Error ? err.message : 'Password change failed.');
    } finally {
      setPwSaving(false);
    }
  };

  // ── Sign out of other sessions ───────────────────────────────────────────
  const [signOutLoading, setSignOutLoading] = useState(false);

  const handleSignOutOthers = async () => {
    setSignOutLoading(true);
    try {
      await apiSignOutOtherSessions();
      // Refresh so this tab's context picks up the freshly-issued cookie.
      await refreshSession();
      toast({
        title: isAr ? 'تم تسجيل الخروج من الجلسات الأخرى' : 'Other sessions signed out',
        description: isAr
          ? 'تم إنهاء كل جلسة نشطة أخرى. هذه الجلسة لا تزال مفتوحة.'
          : 'Every other active session has been ended. This session remains active.',
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
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldOff className="w-5 h-5 text-primary" />
              {isAr ? 'الجلسات النشطة' : 'Active Sessions'}
            </CardTitle>
            <CardDescription>
              {isAr
                ? 'إذا تركت حسابك مسجّلاً على جهاز آخر أو حاسوب مشترك، يمكنك إنهاء تلك الجلسات دون التأثير على هذه الجلسة.'
                : "If you left yourself signed in on another device or a shared computer, you can end those sessions without affecting this one."}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex items-start justify-between gap-4">
            <p className="text-sm text-muted-foreground max-w-md">
              {isAr
                ? 'سيتم تسجيل الخروج فورًا من كل جلسة أخرى نشطة على أي جهاز. ستبقى هذه الجلسة مفتوحة.'
                : 'Every other active session on any device is signed out immediately. This session stays active.'}
            </p>
            <Button
              variant="outline"
              className="gap-2 border-destructive/30 text-destructive hover:bg-destructive/10 shrink-0"
              onClick={handleSignOutOthers}
              disabled={signOutLoading}
            >
              {signOutLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldOff className="w-4 h-4" />}
              {signOutLoading
                ? (isAr ? 'جارٍ التنفيذ…' : 'Signing out…')
                : (isAr ? 'تسجيل الخروج من الجلسات الأخرى' : 'Sign out of all other sessions')}
            </Button>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
