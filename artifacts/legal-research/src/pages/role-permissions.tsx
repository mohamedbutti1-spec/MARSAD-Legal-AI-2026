import React, { useMemo, useState } from 'react';
import { AppLayout } from '@/components/layout/app-layout';
import { useUserContext, useT } from '@/lib/user-context';
import {
  useGetRolesPermissions,
  useUpdateRolePermission,
  useCreateRole,
  useUpdateRole,
  useDeleteRole,
  getGetRolesPermissionsQueryKey,
} from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { ShieldAlert, ShieldCheck, Search, Loader2, Plus, Pencil, Trash2, X } from 'lucide-react';
import { LoadingTable } from '@/components/ui/loading-card';

/** Humanize a permission key like `canReadDecisionList` -> `Read decision list`. */
function humanizePermission(key: string): string {
  const withoutPrefix = key.replace(/^can/, '');
  const spaced = withoutPrefix.replace(/([A-Z])/g, ' $1').trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

const EMPTY_ROLE_FORM = { key: '', labelAr: '', labelEn: '', tier: 'custom' };

export default function RolePermissions() {
  const { canManageSettings } = useUserContext();
  const t = useT();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data, isLoading } = useGetRolesPermissions();
  const updateMutation = useUpdateRolePermission();
  const [search, setSearch] = useState('');

  // Create / rename custom roles
  const [showCreateRole, setShowCreateRole] = useState(false);
  const [roleForm, setRoleForm] = useState(EMPTY_ROLE_FORM);
  const [editingRoleKey, setEditingRoleKey] = useState<string | null>(null);
  const [roleFormError, setRoleFormError] = useState<string | null>(null);
  const [deletingRoleKey, setDeletingRoleKey] = useState<string | null>(null);

  const invalidateRoles = () => queryClient.invalidateQueries({ queryKey: getGetRolesPermissionsQueryKey() });

  const createRoleMutation = useCreateRole({
    mutation: {
      onSuccess: () => {
        setShowCreateRole(false);
        setRoleForm(EMPTY_ROLE_FORM);
        setRoleFormError(null);
        invalidateRoles();
        toast({ title: t('تم إنشاء الدور', 'Role created') });
      },
      onError: (err: unknown) => {
        setRoleFormError(err instanceof Error ? err.message : t('تعذر إنشاء الدور.', 'Could not create the role.'));
      },
    },
  });

  const updateRoleMutation = useUpdateRole({
    mutation: {
      onSuccess: () => {
        setEditingRoleKey(null);
        setRoleFormError(null);
        invalidateRoles();
        toast({ title: t('تم تحديث الدور', 'Role updated') });
      },
      onError: (err: unknown) => {
        setRoleFormError(err instanceof Error ? err.message : t('تعذر تحديث الدور.', 'Could not update the role.'));
      },
    },
  });

  const deleteRoleMutation = useDeleteRole({
    mutation: {
      onSuccess: () => {
        setDeletingRoleKey(null);
        invalidateRoles();
        toast({ title: t('تم حذف الدور', 'Role deleted') });
      },
      onError: (err: unknown) => {
        toast({
          title: t('فشل الحذف', 'Delete failed'),
          description: err instanceof Error ? err.message : t('تعذر حذف الدور.', 'Could not delete the role.'),
          variant: 'destructive',
        });
        setDeletingRoleKey(null);
      },
    },
  });

  // Track in-flight (roleKey:permissionKey) toggles so a specific cell shows
  // its own spinner instead of blocking the whole table.
  const [pending, setPending] = useState<Record<string, boolean>>({});

  const grantMap = useMemo(() => {
    const map = new Map<string, boolean>();
    for (const g of data?.grants ?? []) map.set(`${g.roleKey}:${g.permissionKey}`, g.allowed);
    return map;
  }, [data]);

  const filteredPermissions = useMemo(() => {
    const perms = data?.permissions ?? [];
    if (!search.trim()) return perms;
    const q = search.trim().toLowerCase();
    return perms.filter((p) => p.key.toLowerCase().includes(q) || humanizePermission(p.key).toLowerCase().includes(q));
  }, [data, search]);

  if (!canManageSettings) {
    return (
      <AppLayout>
        <div className="text-center py-20">
          <ShieldAlert className="w-12 h-12 text-destructive mx-auto mb-4" />
          <h2 className="text-xl font-bold text-foreground">{t('منطقة مقيدة', 'Restricted Area')}</h2>
          <p className="text-muted-foreground mt-2">
            {t('يمكن للمالك فقط الوصول إلى صلاحيات الأدوار.', 'Only the owner can access role permissions.')}
          </p>
        </div>
      </AppLayout>
    );
  }

  const handleToggle = (roleKey: string, permissionKey: string, next: boolean) => {
    const cellKey = `${roleKey}:${permissionKey}`;
    setPending((p) => ({ ...p, [cellKey]: true }));
    updateMutation.mutate(
      { data: { roleKey, permissionKey, allowed: next } },
      {
        onSuccess: () => {
          queryClient.setQueryData(getGetRolesPermissionsQueryKey(), (old: typeof data) => {
            if (!old) return old;
            const grants = old.grants.some((g) => g.roleKey === roleKey && g.permissionKey === permissionKey)
              ? old.grants.map((g) => (g.roleKey === roleKey && g.permissionKey === permissionKey ? { ...g, allowed: next } : g))
              : [...old.grants, { roleKey, permissionKey, allowed: next }];
            return { ...old, grants };
          });
        },
        onError: () => {
          toast({
            title: t('فشل التحديث', 'Update failed'),
            description: t('تعذر تحديث الصلاحية. حاول مرة أخرى.', 'Could not update the permission. Please try again.'),
            variant: 'destructive',
          });
        },
        onSettled: () => {
          setPending((p) => {
            const next = { ...p };
            delete next[cellKey];
            return next;
          });
        },
      },
    );
  };

  const openCreateRole = () => {
    setRoleForm(EMPTY_ROLE_FORM);
    setRoleFormError(null);
    setEditingRoleKey(null);
    setShowCreateRole(true);
  };

  const openEditRole = (role: { key: string; labelAr: string; labelEn: string; tier: string }) => {
    setRoleForm({ key: role.key, labelAr: role.labelAr, labelEn: role.labelEn, tier: role.tier });
    setRoleFormError(null);
    setEditingRoleKey(role.key);
    setShowCreateRole(true);
  };

  const handleRoleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingRoleKey) {
      updateRoleMutation.mutate({
        key: editingRoleKey,
        data: { labelAr: roleForm.labelAr, labelEn: roleForm.labelEn, tier: roleForm.tier },
      });
    } else {
      createRoleMutation.mutate({
        data: { key: roleForm.key.trim(), labelAr: roleForm.labelAr, labelEn: roleForm.labelEn, tier: roleForm.tier },
      });
    }
  };

  const closeRoleForm = () => {
    setShowCreateRole(false);
    setEditingRoleKey(null);
    setRoleFormError(null);
  };

  const savingRoleForm = createRoleMutation.isPending || updateRoleMutation.isPending;

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">
                {t('صلاحيات الأدوار', 'Role Permissions')}
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                {t(
                  'تحكم بدقة فيما يمكن لكل دور فعله — دون الحاجة إلى تعديل الكود أو إعادة النشر. تُطبَّق التغييرات فوراً.',
                  'Fine-tune exactly what each role can do — no code change or redeploy required. Changes take effect immediately.',
                )}
              </p>
            </div>
          </div>
          <Button size="sm" className="gap-1.5 shrink-0" onClick={openCreateRole}>
            <Plus className="w-4 h-4" />
            {t('دور جديد', 'New role')}
          </Button>
        </div>

        {showCreateRole && (
          <Card className="border-primary/30">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">
                  {editingRoleKey
                    ? t(`تعديل الدور: ${editingRoleKey}`, `Edit role: ${editingRoleKey}`)
                    : t('إنشاء دور جديد', 'Create a new role')}
                </CardTitle>
                <button type="button" onClick={closeRoleForm} className="text-muted-foreground hover:text-foreground" aria-label={t('إغلاق', 'Close')}>
                  <X className="w-4 h-4" />
                </button>
              </div>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleRoleFormSubmit} className="flex flex-wrap gap-3 items-end">
                {!editingRoleKey && (
                  <div className="min-w-48">
                    <label className="block text-xs font-medium text-muted-foreground mb-1">
                      {t('المفتاح (بالإنجليزية)', 'Key (machine name)')}
                    </label>
                    <input
                      required
                      pattern="[a-z][a-z0-9_]{1,39}"
                      title={t('حروف صغيرة وأرقام وشرطة سفلية فقط', 'Lowercase letters, digits, underscores only')}
                      placeholder="regional_coordinator"
                      className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                      value={roleForm.key}
                      onChange={(e) => setRoleForm((f) => ({ ...f, key: e.target.value.trim().toLowerCase() }))}
                    />
                  </div>
                )}
                <div className="min-w-40">
                  <label className="block text-xs font-medium text-muted-foreground mb-1">{t('التسمية بالعربية', 'Arabic label')}</label>
                  <input
                    required
                    className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                    value={roleForm.labelAr}
                    onChange={(e) => setRoleForm((f) => ({ ...f, labelAr: e.target.value }))}
                  />
                </div>
                <div className="min-w-40">
                  <label className="block text-xs font-medium text-muted-foreground mb-1">{t('التسمية بالإنجليزية', 'English label')}</label>
                  <input
                    required
                    className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                    value={roleForm.labelEn}
                    onChange={(e) => setRoleForm((f) => ({ ...f, labelEn: e.target.value }))}
                  />
                </div>
                <div className="min-w-32">
                  <label className="block text-xs font-medium text-muted-foreground mb-1">{t('الفئة', 'Tier')}</label>
                  <input
                    required
                    className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                    value={roleForm.tier}
                    onChange={(e) => setRoleForm((f) => ({ ...f, tier: e.target.value }))}
                  />
                </div>
                <Button type="submit" size="sm" disabled={savingRoleForm} className="gap-1.5">
                  {savingRoleForm && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  {editingRoleKey ? t('حفظ', 'Save') : t('إنشاء', 'Create')}
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={closeRoleForm}>
                  {t('إلغاء', 'Cancel')}
                </Button>
              </form>
              {roleFormError && <p className="text-xs text-destructive mt-3">{roleFormError}</p>}
              {!editingRoleKey && (
                <p className="text-xs text-muted-foreground mt-3">
                  {t(
                    'يبدأ الدور الجديد بلا صلاحيات — فعّل ما تريد من المصفوفة أدناه بعد الإنشاء.',
                    'The new role starts with every permission unchecked — enable what it needs in the matrix below after creating it.',
                  )}
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {isLoading ? (
          <LoadingTable rows={8} cols={6} />
        ) : !data ? (
          <p className="text-sm text-muted-foreground">{t('تعذر تحميل البيانات.', 'Could not load data.')}</p>
        ) : (
          <Card className="border-border overflow-hidden">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div>
                  <CardTitle className="text-base">
                    {t('مصفوفة الأدوار والصلاحيات', 'Roles × Permissions Matrix')}
                  </CardTitle>
                  <CardDescription>
                    {t(
                      `${data.roles.length} دورًا · ${data.permissions.length} صلاحية`,
                      `${data.roles.length} roles · ${data.permissions.length} permissions`,
                    )}
                  </CardDescription>
                </div>
                <div className="relative w-full max-w-xs">
                  <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden />
                  <input
                    type="text"
                    className="w-full border border-border rounded-lg ps-9 pe-3 py-2 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                    placeholder={t('بحث عن صلاحية...', 'Search a permission...')}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="text-sm border-collapse">
                  <thead>
                    <tr className="border-b border-border bg-muted/40">
                      <th className="sticky start-0 z-10 bg-muted/40 text-start px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider min-w-[220px]">
                        {t('الصلاحية', 'Permission')}
                      </th>
                      {data.roles.map((role) => (
                        <th
                          key={role.key}
                          className="px-3 py-3 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap"
                          title={role.key}
                        >
                          <div className="flex items-center justify-center gap-1.5">
                            <span>{t(role.labelAr, role.labelEn)}</span>
                            {role.isCustom && (
                              <span className="flex items-center gap-0.5 normal-case">
                                <button
                                  type="button"
                                  onClick={() => openEditRole(role)}
                                  className="text-muted-foreground hover:text-foreground"
                                  aria-label={t('تعديل الدور', 'Edit role')}
                                >
                                  <Pencil className="w-3 h-3" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setDeletingRoleKey(role.key)}
                                  className="text-muted-foreground hover:text-destructive"
                                  aria-label={t('حذف الدور', 'Delete role')}
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </span>
                            )}
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPermissions.map((perm, i) => (
                      <tr key={perm.key} className={i % 2 === 0 ? 'bg-background' : 'bg-muted/10'}>
                        <td className="sticky start-0 z-10 bg-inherit px-4 py-2.5 font-medium text-foreground whitespace-nowrap">
                          {humanizePermission(perm.key)}
                          <div className="text-[10px] text-muted-foreground font-normal">{perm.key}</div>
                        </td>
                        {data.roles.map((role) => {
                          const cellKey = `${role.key}:${perm.key}`;
                          const allowed = grantMap.get(cellKey) ?? false;
                          const isPending = pending[cellKey];
                          return (
                            <td key={role.key} className="px-3 py-2.5 text-center">
                              {isPending ? (
                                <Loader2 className="w-4 h-4 animate-spin mx-auto text-muted-foreground" />
                              ) : (
                                <Switch
                                  checked={allowed}
                                  onCheckedChange={(v) => handleToggle(role.key, perm.key, v)}
                                  aria-label={`${role.key}:${perm.key}`}
                                />
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                    {filteredPermissions.length === 0 && (
                      <tr>
                        <td colSpan={data.roles.length + 1} className="px-4 py-8 text-center text-sm text-muted-foreground">
                          {t('لا توجد نتائج مطابقة.', 'No matching permissions.')}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        {deletingRoleKey && (
          <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" role="dialog" aria-modal="true">
            <Card className="max-w-sm w-full">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">{t('حذف الدور', 'Delete role')}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  {t(
                    `هل تريد حذف الدور "${deletingRoleKey}"؟ لا يمكن التراجع عن هذا الإجراء.`,
                    `Delete the role "${deletingRoleKey}"? This cannot be undone.`,
                  )}
                </p>
                <div className="flex justify-end gap-2 mt-4">
                  <Button size="sm" variant="outline" onClick={() => setDeletingRoleKey(null)} disabled={deleteRoleMutation.isPending}>
                    {t('إلغاء', 'Cancel')}
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    disabled={deleteRoleMutation.isPending}
                    onClick={() => deleteRoleMutation.mutate({ key: deletingRoleKey })}
                    className="gap-1.5"
                  >
                    {deleteRoleMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    {t('حذف', 'Delete')}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
