import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { KeyRound, Lock, AlertCircle, ShieldAlert } from 'lucide-react';
import { useUserContext } from '@/lib/user-context';

const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');

async function apiChangePassword(currentPassword: string, newPassword: string) {
  const res = await fetch(`${BASE}/api/auth/change-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ currentPassword, newPassword }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? 'Password change failed');
  return data;
}

/**
 * Mandatory gate shown instead of the app whenever the session's
 * mustChangePassword flag is true (admin-issued temporary password —
 * new account or admin "Reset password" action). The backend also enforces
 * this on every other route, so there is no way to skip it by calling the
 * API directly.
 */
export default function ForcePasswordChange() {
  const { refreshSession } = useUserContext();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (newPassword.length < 8) {
      setError('كلمة المرور الجديدة يجب ألا تقل عن 8 أحرف. / New password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('كلمتا المرور غير متطابقتين. / Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      await apiChangePassword(currentPassword, newPassword);
      await refreshSession();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Password change failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="relative w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gold/10 border border-gold/20 mb-4">
            <ShieldAlert className="w-8 h-8 text-gold" />
          </div>
          <h1 className="text-2xl font-bold text-heading mb-1">تعيين كلمة مرور جديدة</h1>
          <p className="text-sm text-muted-foreground">
            Set a New Password
          </p>
        </div>

        <div className="bg-card border border-border rounded-2xl shadow-xl p-8">
          <p className="text-sm text-muted-foreground mb-5 leading-relaxed">
            تسجيل دخولك يستخدم كلمة مرور مؤقتة صادرة من المسؤول. يجب عليك تعيين كلمة مرور خاصة بك قبل متابعة استخدام المنصة.
            <br />
            <span className="text-xs">
              You signed in with an admin-issued temporary password. You must set your own password before continuing.
            </span>
          </p>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-1.5">
              <Label htmlFor="currentPassword" className="text-sm font-medium">
                كلمة المرور المؤقتة / Temporary Password
              </Label>
              <div className="relative">
                <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="currentPassword"
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="pl-9"
                  autoComplete="current-password"
                  required
                  disabled={loading}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="newPassword" className="text-sm font-medium">
                كلمة المرور الجديدة / New Password
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="newPassword"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="pl-9"
                  autoComplete="new-password"
                  minLength={8}
                  required
                  disabled={loading}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="confirmPassword" className="text-sm font-medium">
                تأكيد كلمة المرور / Confirm Password
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="pl-9"
                  autoComplete="new-password"
                  minLength={8}
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
                  جارٍ الحفظ…
                </span>
              ) : (
                'تعيين كلمة المرور والمتابعة / Set Password & Continue'
              )}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
