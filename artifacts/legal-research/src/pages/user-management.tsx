import React, { useState, useEffect, useCallback } from 'react';
import { AppLayout } from '@/components/layout/app-layout';
import { apiFetch } from '@/lib/api-fetch';
import { useT, useUserContext } from '@/lib/user-context';
import { Users, UserPlus, ShieldCheck, Eye, Edit3, Loader2, ToggleLeft, ToggleRight, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RoleBadge } from '@/components/ui/status-badge';
import { useToast } from '@/hooks/use-toast';
import { LoadingTable } from '@/components/ui/loading-card';

interface User { id: number; name: string; email: string; role: string; isActive: boolean; createdAt: string; lastActiveAt?: string | null; }

type UserRole = 'owner' | 'supervisor' | 'viewer';

const ROLE_ICONS: Record<UserRole, React.ReactNode> = {
  owner:      <ShieldCheck className="w-3.5 h-3.5" />,
  supervisor: <Edit3 className="w-3.5 h-3.5" />,
  viewer:     <Eye className="w-3.5 h-3.5" />,
};

export default function UserManagement() {
  const t = useT();
  const { role: myRole, canManageUsers } = useUserContext();
  const { toast } = useToast();

  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [showInvite, setShowInvite] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [inviteForm, setInviteForm] = useState({ name: '', email: '', role: 'viewer' as UserRole });
  const [editingId, setEditingId] = useState<number | null>(null);

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

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    setInviting(true);
    try {
      const r = await apiFetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(inviteForm),
      });
      if (r.ok) {
        toast({ title: t('تمت إضافة المستخدم', 'User added') });
        setShowInvite(false);
        setInviteForm({ name: '', email: '', role: 'viewer' });
        fetchUsers();
      } else {
        const d = await r.json().catch(() => ({}));
        toast({ title: d.error ?? t('فشل الإنشاء', 'Creation failed'), variant: 'destructive' });
      }
    } finally { setInviting(false); }
  }

  async function handleRoleChange(user: User, newRole: UserRole) {
    const r = await apiFetch(`/api/users/${user.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: newRole }),
    });
    if (r.ok) {
      setUsers(prev => prev.map(u => u.id === user.id ? { ...u, role: newRole } : u));
      setEditingId(null);
      toast({ title: t('تم تحديث الدور', 'Role updated') });
    }
  }

  async function handleToggleActive(user: User) {
    const r = await apiFetch(`/api/users/${user.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !user.isActive }),
    });
    if (r.ok) {
      setUsers(prev => prev.map(u => u.id === user.id ? { ...u, isActive: !u.isActive } : u));
    }
  }

  const filtered = users.filter(u =>
    u.name.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase())
  );

  const activeCount   = users.filter(u => u.isActive).length;
  const ownerCount    = users.filter(u => u.role === 'owner').length;
  const supervisorCount = users.filter(u => u.role === 'supervisor').length;

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
            <Button size="sm" className="gap-1.5 shrink-0" onClick={() => setShowInvite(true)}>
              <UserPlus className="w-4 h-4" />
              {t('إضافة مستخدم', 'Add User')}
            </Button>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { val: activeCount,    labelAr: 'مستخدم نشط',     labelEn: 'Active users' },
            { val: ownerCount,     labelAr: 'مالك',            labelEn: 'Owners' },
            { val: supervisorCount,labelAr: 'مشرف',            labelEn: 'Supervisors' },
          ].map((stat, i) => (
            <Card key={i} className="border-border">
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-foreground">{stat.val}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{t(stat.labelAr, stat.labelEn)}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Invite form */}
        {showInvite && (
          <Card className="border-primary/20 bg-primary/3">
            <CardHeader className="px-5 pt-5 pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">{t('إضافة مستخدم جديد', 'Add New User')}</CardTitle>
                <button type="button" onClick={() => setShowInvite(false)} className="text-muted-foreground hover:text-foreground text-xs">✕</button>
              </div>
            </CardHeader>
            <CardContent className="px-5 pb-5">
              <form onSubmit={handleInvite} className="flex flex-wrap gap-3 items-end">
                <div className="flex-1 min-w-40">
                  <label className="block text-xs font-medium text-muted-foreground mb-1">{t('الاسم', 'Name')}</label>
                  <input required className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                    value={inviteForm.name} onChange={e => setInviteForm(f => ({ ...f, name: e.target.value }))} />
                </div>
                <div className="flex-1 min-w-40">
                  <label className="block text-xs font-medium text-muted-foreground mb-1">{t('البريد الإلكتروني', 'Email')}</label>
                  <input required type="email" className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                    value={inviteForm.email} onChange={e => setInviteForm(f => ({ ...f, email: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">{t('الدور', 'Role')}</label>
                  <select className="border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                    value={inviteForm.role} onChange={e => setInviteForm(f => ({ ...f, role: e.target.value as UserRole }))}>
                    <option value="viewer">{t('مشاهد', 'Viewer')}</option>
                    <option value="supervisor">{t('مشرف', 'Supervisor')}</option>
                    {myRole === 'owner' && <option value="owner">{t('مالك', 'Owner')}</option>}
                  </select>
                </div>
                <Button type="submit" size="sm" disabled={inviting} className="gap-1.5">
                  {inviting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  {t('إضافة', 'Add')}
                </Button>
              </form>
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
                        {editingId === user.id && canManageUsers ? (
                          <div className="flex items-center gap-1">
                            <select
                              className="border border-border rounded px-1.5 py-1 text-xs bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                              defaultValue={user.role}
                              onChange={e => handleRoleChange(user, e.target.value as UserRole)}
                            >
                              <option value="viewer">{t('مشاهد', 'Viewer')}</option>
                              <option value="supervisor">{t('مشرف', 'Supervisor')}</option>
                              {myRole === 'owner' && <option value="owner">{t('مالك', 'Owner')}</option>}
                            </select>
                            <button type="button" onClick={() => setEditingId(null)} className="text-xs text-muted-foreground hover:text-foreground">✕</button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5">
                            <span className="text-muted-foreground">{ROLE_ICONS[user.role as UserRole]}</span>
                            <RoleBadge role={user.role as UserRole} />
                          </div>
                        )}
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
                              onClick={() => setEditingId(user.id)}
                              className="p-1.5 rounded hover:bg-muted/30 text-muted-foreground hover:text-foreground transition-colors"
                              aria-label={t('تعديل الدور', 'Edit role')}
                            >
                              <Edit3 className="w-3.5 h-3.5" />
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
    </AppLayout>
  );
}
