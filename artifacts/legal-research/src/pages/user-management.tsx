import React, { useState, useEffect, useCallback } from 'react';
import { AppLayout } from '@/components/layout/app-layout';
import { apiFetch } from '@/lib/api-fetch';
import { useT, useUserContext, ALL_ROLES, ROLE_META, type UserRole } from '@/lib/user-context';
import { useGetRolesPermissions } from '@workspace/api-client-react';
import { Users, UserPlus, Loader2, ToggleLeft, ToggleRight, Search, Pencil, Copy, Check, X, KeyRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RoleBadge } from '@/components/ui/status-badge';
import { useToast } from '@/hooks/use-toast';
import { LoadingTable } from '@/components/ui/loading-card';

interface User {
  id: number;
  name: string;
  email: string;
  username?: string | null;
  role: string;
  isActive: boolean;
  createdAt: string;
  lastActiveAt?: string | null;
}

const roleLabel = (role: string, lang: 'ar' | 'en') => {
  const meta = ROLE_META[role as UserRole];
  return meta ? (lang === 'ar' ? meta.ar : meta.en) : role;
};

function RoleSelect({
  value,
  onChange,
  lang,
  canAssignOwner,
}: {
  value: string;
  onChange: (role: string) => void;
  lang: 'ar' | 'en';
  /** Only an owner may grant the owner role — enforced again server-side. */
  canAssignOwner: boolean;
}) {
  // Fetch the live role list (16 built-in + any owner-created custom roles)
  // so a newly-created custom role shows up here immediately, with no code
  // change. Falls back to the static ALL_ROLES list while loading/offline.
  const { data } = useGetRolesPermissions();
  const roles = data?.roles?.length
    ? data.roles.map((r) => ({ key: r.key, ar: r.labelAr, en: r.labelEn }))
    : ALL_ROLES.map((r) => ({ key: r, ar: ROLE_META[r].ar, en: ROLE_META[r].en }));

  const options = roles.filter((r) => r.key !== 'owner' || canAssignOwner || r.key === value);
  return (
    <select
      className="border border-border rounded-lg px-2.5 py-1.5 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-primary"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      {options.map((r) => (
        <option key={r.key} value={r.key} disabled={r.key === 'owner' && !canAssignOwner}>
          {lang === 'ar' ? r.ar : r.en}
        </option>
      ))}
    </select>
  );
}

export default function UserManagement() {
  const t = useT();
  const { lang, role: myRole, canManageUsers } = useUserContext();
  const { toast } = useToast();

  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');

  // Create
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createForm, setCreateForm] = useState({ name: '', email: '', role: 'viewer' as string });
  const [tempPasswordModal, setTempPasswordModal] = useState<{ email: string; password: string } | null>(null);
  const [copied, setCopied] = useState(false);

  // Edit
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editForm, setEditForm] = useState({ name: '', email: '', role: 'viewer' as string });
  const [savingEdit, setSavingEdit] = useState(false);

  // Reset password
  const [resettingUser, setResettingUser] = useState<User | null>(null);
  const [resettingPassword, setResettingPassword] = useState(false);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const r = await apiFetch('/api/users?limit=200');
      if (r.ok) {
        const d = await r.json();
        setUsers(Array.isArray(d) ? d : (d.users ?? []));
      }
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    try {
      const r = await apiFetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(createForm),
      });
      const d = await r.json().catch(() => ({}));
      if (r.ok) {
        toast({ title: t('تمت إضافة المستخدم', 'User added') });
        setShowCreate(false);
        setCreateForm({ name: '', email: '', role: 'viewer' });
        fetchUsers();
        if (d.temporaryPassword) {
          setTempPasswordModal({ email: d.email, password: d.temporaryPassword });
        }
      } else {
        toast({ title: d.error ?? t('فشل الإنشاء', 'Creation failed'), variant: 'destructive' });
      }
    } finally { setCreating(false); }
  }

  function openEdit(user: User) {
    setEditingUser(user);
    setEditForm({ name: user.name, email: user.email, role: user.role });
  }

  async function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingUser) return;
    setSavingEdit(true);
    try {
      const r = await apiFetch(`/api/users/${editingUser.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      });
      if (r.ok) {
        const updated = await r.json();
        setUsers(prev => prev.map(u => u.id === editingUser.id ? { ...u, ...updated } : u));
        setEditingUser(null);
        toast({ title: t('تم حفظ التعديلات', 'Changes saved') });
      } else {
        const d = await r.json().catch(() => ({}));
        toast({ title: d.error ?? t('فشل التحديث', 'Update failed'), variant: 'destructive' });
      }
    } finally { setSavingEdit(false); }
  }

  async function handleResetPassword() {
    if (!resettingUser) return;
    setResettingPassword(true);
    try {
      const tempPassword = crypto.randomUUID().replace(/-/g, '').slice(0, 16);
      const r = await apiFetch(`/api/users/${resettingUser.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: tempPassword }),
      });
      if (r.ok) {
        setTempPasswordModal({ email: resettingUser.email, password: tempPassword });
        setResettingUser(null);
        toast({ title: t('تم إعادة تعيين كلمة المرور', 'Password reset') });
      } else {
        const d = await r.json().catch(() => ({}));
        toast({ title: d.error ?? t('فشلت إعادة التعيين', 'Reset failed'), variant: 'destructive' });
      }
    } finally { setResettingPassword(false); }
  }

  async function handleToggleActive(user: User) {
    const r = await apiFetch(`/api/users/${user.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !user.isActive }),
    });
    if (r.ok) {
      setUsers(prev => prev.map(u => u.id === user.id ? { ...u, isActive: !u.isActive } : u));
      toast({ title: !user.isActive ? t('تم تفعيل المستخدم', 'User enabled') : t('تم تعطيل المستخدم', 'User disabled') });
    }
  }

  const filtered = users.filter(u =>
    u.name.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase())
  );

  const activeCount   = users.filter(u => u.isActive).length;
  const adminSeats    = users.filter(u => u.role === 'owner' || u.role === 'admin').length;
  const professionalSeats = users.filter(u => u.role === 'professional_user').length;

  const canAssignOwner = myRole === 'owner';

  return (
    <AppLayout>
      <div className="space-y-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
              <Users className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">{t('إدارة المستخدمين', 'User Management')}</h1>
              <p className="text-sm text-muted-foreground">{t('إضافة المستخدمين وتغيير أدوارهم وإدارة وصولهم إلى المنصة.', 'Add users, change their roles, and manage platform access.')}</p>
            </div>
          </div>
          {canManageUsers && (
            <Button size="sm" className="gap-1.5 shrink-0" onClick={() => setShowCreate(true)}>
              <UserPlus className="w-4 h-4" />
              {t('إضافة مستخدم', 'Add User')}
            </Button>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { val: activeCount,          labelAr: 'مستخدم نشط',            labelEn: 'Active users' },
            { val: adminSeats,           labelAr: 'مالك / مسؤول',          labelEn: 'Owners / Admins' },
            { val: professionalSeats,    labelAr: 'مستخدم محترف',          labelEn: 'Professional users' },
          ].map((stat, i) => (
            <Card key={i} className="border-border">
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-foreground">{stat.val}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{t(stat.labelAr, stat.labelEn)}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Create form */}
        {showCreate && (
          <Card className="border-primary/20 bg-primary/3">
            <CardHeader className="px-5 pt-5 pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">{t('إضافة مستخدم جديد', 'Add New User')}</CardTitle>
                <button type="button" onClick={() => setShowCreate(false)} className="text-muted-foreground hover:text-foreground text-xs">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </CardHeader>
            <CardContent className="px-5 pb-5">
              <form onSubmit={handleCreate} className="flex flex-wrap gap-3 items-end">
                <div className="flex-1 min-w-40">
                  <label className="block text-xs font-medium text-muted-foreground mb-1">{t('الاسم', 'Name')}</label>
                  <input required className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                    value={createForm.name} onChange={e => setCreateForm(f => ({ ...f, name: e.target.value }))} />
                </div>
                <div className="flex-1 min-w-40">
                  <label className="block text-xs font-medium text-muted-foreground mb-1">{t('البريد الإلكتروني', 'Email')}</label>
                  <input required type="email" className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                    value={createForm.email} onChange={e => setCreateForm(f => ({ ...f, email: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">{t('الدور', 'Role')}</label>
                  <RoleSelect
                    value={createForm.role}
                    lang={lang}
                    onChange={(role) => setCreateForm(f => ({ ...f, role }))}
                    canAssignOwner={canAssignOwner}
                  />
                </div>
                <Button type="submit" size="sm" disabled={creating} className="gap-1.5">
                  {creating && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  {t('إضافة', 'Add')}
                </Button>
              </form>
              <p className="text-xs text-muted-foreground mt-3">
                {t(
                  'سيتم إنشاء كلمة مرور مؤقتة للمستخدم الجديد — ستظهر مرة واحدة فقط بعد الإنشاء.',
                  'A temporary password will be generated for the new user — it is shown once, right after creation.',
                )}
              </p>
            </CardContent>
          </Card>
        )}

        {/* Search */}
        <div className="relative max-w-xs">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden />
          <input
            type="text"
            className="w-full border border-border rounded-lg ps-9 pe-3 py-2 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-primary"
            placeholder={t('بحث بالاسم أو البريد...', 'Search by name or email...')}
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        {/* Table */}
        {loading ? (
          <LoadingTable rows={4} />
        ) : (
          <Card className="border-border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 border-b border-border">
                  <tr>
                    <th className="text-start px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t('المستخدم', 'User')}</th>
                    <th className="text-start px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t('الدور', 'Role')}</th>
                    <th className="text-start px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t('الحالة', 'Status')}</th>
                    <th className="text-start px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t('الانضمام', 'Joined')}</th>
                    {canManageUsers && <th className="px-4 py-3"></th>}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(user => (
                    <tr key={user.id} className={`border-b border-border/40 hover:bg-muted/10 transition-colors ${!user.isActive ? 'opacity-50' : ''}`}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                            <span className="text-xs font-bold text-primary">{user.name.charAt(0)}</span>
                          </div>
                          <div>
                            <p className="font-medium text-foreground">{user.name}</p>
                            <p className="text-xs text-muted-foreground">{user.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <RoleBadge role={user.role} lang={lang} />
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${user.isActive ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-muted text-muted-foreground border-border'}`}>
                          {user.isActive ? t('نشط', 'Active') : t('معطّل', 'Inactive')}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {new Date(user.createdAt).toLocaleDateString('ar-AE')}
                      </td>
                      {canManageUsers && (
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1 justify-end">
                            <button
                              type="button"
                              onClick={() => openEdit(user)}
                              className="p-1.5 rounded hover:bg-muted/30 text-muted-foreground hover:text-foreground transition-colors"
                              aria-label={t('تعديل', 'Edit')}
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleToggleActive(user)}
                              className="p-1.5 rounded hover:bg-muted/30 transition-colors"
                              aria-label={user.isActive ? t('تعطيل', 'Deactivate') : t('تفعيل', 'Activate')}
                            >
                              {user.isActive
                                ? <ToggleRight className="w-4 h-4 text-emerald-600" />
                                : <ToggleLeft className="w-4 h-4 text-muted-foreground" />}
                            </button>
                            {(user.role !== 'owner' || myRole === 'owner') && (
                              <button
                                type="button"
                                onClick={() => setResettingUser(user)}
                                className="p-1.5 rounded hover:bg-muted/30 text-muted-foreground hover:text-foreground transition-colors"
                                aria-label={t('إعادة تعيين كلمة المرور', 'Reset password')}
                                title={t(
                                  'إعادة تعيين كلمة المرور تسجل خروج المستخدم فوراً من جميع الجلسات',
                                  'Resetting the password signs the user out of all sessions immediately',
                                )}
                              >
                                <KeyRound className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={canManageUsers ? 5 : 4} className="py-12 text-center text-sm text-muted-foreground">
                        {t('لا توجد نتائج', 'No results')}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>

      {/* Edit modal */}
      {editingUser && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setEditingUser(null)}>
          <Card className="max-w-md w-full" onClick={(e) => e.stopPropagation()}>
            <CardHeader className="px-5 pt-5 pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">{t('تعديل المستخدم', 'Edit User')}</CardTitle>
                <button type="button" onClick={() => setEditingUser(null)} className="text-muted-foreground hover:text-foreground">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </CardHeader>
            <CardContent className="px-5 pb-5">
              <form onSubmit={handleSaveEdit} className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">{t('الاسم', 'Name')}</label>
                  <input required className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                    value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">{t('البريد الإلكتروني', 'Email')}</label>
                  <input required type="email" className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                    value={editForm.email} onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">{t('الدور', 'Role')}</label>
                  <RoleSelect
                    value={editForm.role}
                    lang={lang}
                    onChange={(role) => setEditForm(f => ({ ...f, role }))}
                    canAssignOwner={canAssignOwner}
                  />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => setEditingUser(null)}>
                    {t('إلغاء', 'Cancel')}
                  </Button>
                  <Button type="submit" size="sm" disabled={savingEdit} className="gap-1.5">
                    {savingEdit && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    {t('حفظ', 'Save')}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Reset password confirmation modal */}
      {resettingUser && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setResettingUser(null)}>
          <Card className="max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
            <CardHeader className="px-5 pt-5 pb-3">
              <CardTitle className="text-sm">{t('إعادة تعيين كلمة المرور', 'Reset Password')}</CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-5 space-y-4">
              <p className="text-sm text-muted-foreground">
                {t(
                  `سيتم إنشاء كلمة مرور مؤقتة جديدة لـ ${resettingUser.name} (${resettingUser.email})، وسيتم إبطال كلمة المرور الحالية فوراً.`,
                  `A new temporary password will be generated for ${resettingUser.name} (${resettingUser.email}), and their current password will be invalidated immediately.`,
                )}
              </p>
              <p className="text-xs text-amber-600 dark:text-amber-500 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
                {t(
                  'تنبيه: سيؤدي هذا إلى تسجيل خروج المستخدم فوراً من جميع الأجهزة والجلسات النشطة.',
                  'Heads up: this will immediately sign the user out of all active sessions and devices.',
                )}
              </p>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setResettingUser(null)} disabled={resettingPassword}>
                  {t('إلغاء', 'Cancel')}
                </Button>
                <Button type="button" size="sm" disabled={resettingPassword} className="gap-1.5" onClick={handleResetPassword}>
                  {resettingPassword && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  {t('إعادة التعيين', 'Reset Password')}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Temporary password modal */}
      {tempPasswordModal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setTempPasswordModal(null)}>
          <Card className="max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
            <CardHeader className="px-5 pt-5 pb-3">
              <CardTitle className="text-sm">{t('كلمة المرور المؤقتة', 'Temporary Password')}</CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-5 space-y-3">
              <p className="text-xs text-muted-foreground">
                {t(
                  `شارك كلمة المرور هذه مع ${tempPasswordModal.email} — لن تظهر مرة أخرى. سيُطلب من المستخدم تعيين كلمة مرور خاصة به عند أول تسجيل دخول.`,
                  `Share this password with ${tempPasswordModal.email} — it will not be shown again. The user will be required to set their own password on first login.`,
                )}
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 bg-muted rounded-lg px-3 py-2 text-sm font-mono break-all">{tempPasswordModal.password}</code>
                <button
                  type="button"
                  className="p-2 rounded-lg border border-border hover:bg-muted/40 shrink-0"
                  aria-label={t('نسخ', 'Copy')}
                  onClick={() => {
                    navigator.clipboard.writeText(tempPasswordModal.password);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 1500);
                  }}
                >
                  {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
              <div className="flex justify-end pt-1">
                <Button size="sm" onClick={() => setTempPasswordModal(null)}>{t('تم', 'Done')}</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </AppLayout>
  );
}
