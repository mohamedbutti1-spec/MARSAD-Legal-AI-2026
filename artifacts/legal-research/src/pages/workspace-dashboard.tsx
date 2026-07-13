import React, { useState } from 'react';
import { AppLayout } from '@/components/layout/app-layout';
import { apiFetch } from '@/lib/api-fetch';
import { useT, useUserContext } from '@/lib/user-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Plus, FolderOpen, Archive, Loader2, Search, Calendar } from 'lucide-react';

interface Project {
  id: number;
  title: string;
  description: string | null;
  status: string;
  ownerId: number;
  createdAt: string;
  updatedAt: string;
}

export default function WorkspaceDashboard() {
  const t = useT();
  const { canUseAi } = useUserContext();
  const qc = useQueryClient();
  const [, navigate] = useLocation();

  const [showNew, setShowNew]       = useState(false);
  const [newTitle, setNewTitle]     = useState('');
  const [newDesc, setNewDesc]       = useState('');
  const [filterQ, setFilterQ]       = useState('');
  const [creating, setCreating]     = useState(false);
  const [createErr, setCreateErr]   = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['workspace.projects'],
    queryFn: () => apiFetch('/api/research/workspace/projects').then((r) => r.json()) as Promise<{ projects: Project[] }>,
    enabled: canUseAi,
  });

  const archiveMut = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      apiFetch(`/api/research/workspace/projects/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      }).then((r) => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['workspace.projects'] }),
  });

  const projects = (data?.projects ?? []).filter((p) =>
    !filterQ || p.title.toLowerCase().includes(filterQ.toLowerCase()) || (p.description ?? '').toLowerCase().includes(filterQ.toLowerCase()),
  );

  async function handleCreate() {
    if (!newTitle.trim()) { setCreateErr(t('العنوان مطلوب', 'Title is required')); return; }
    setCreating(true); setCreateErr(null);
    try {
      const r = await apiFetch('/api/research/workspace/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newTitle.trim(), description: newDesc || undefined }),
      });
      if (r.ok) {
        qc.invalidateQueries({ queryKey: ['workspace.projects'] });
        setShowNew(false); setNewTitle(''); setNewDesc('');
      } else {
        const d = await r.json().catch(() => ({}));
        setCreateErr(d.error ?? t('فشل الإنشاء', 'Creation failed'));
      }
    } finally {
      setCreating(false);
    }
  }

  return (
    <AppLayout>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#1e3a5f]">{t('مساحة البحث القانوني', 'Legal Research Workspace')}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {t('أنشئ مشاريع بحثية وتتبع الأدلة والمصادر القانونية', 'Create research projects and track evidence and legal sources')}
          </p>
        </div>
        <Button
          onClick={() => setShowNew(true)}
          className="bg-[#1e3a5f] hover:bg-[#2d5a8f] text-white gap-2"
        >
          <Plus className="w-4 h-4" />
          {t('مشروع جديد', 'New Project')}
        </Button>
      </div>

      {/* Search */}
      <div className="relative mb-6 max-w-sm">
        <Search className="absolute end-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
        <Input
          value={filterQ}
          onChange={(e) => setFilterQ(e.target.value)}
          placeholder={t('البحث في المشاريع…', 'Filter projects…')}
          className="pe-9"
          dir="auto"
        />
      </div>

      {/* Projects grid */}
      {isLoading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {!isLoading && projects.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <FolderOpen className="w-12 h-12 text-muted-foreground/30 mb-4" />
          <p className="text-muted-foreground text-sm">
            {filterQ
              ? t('لا توجد مشاريع تطابق البحث', 'No projects match your search')
              : t('لا توجد مشاريع بحثية بعد. أنشئ مشروعك الأول!', 'No research projects yet. Create your first one!')}
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {projects.map((project) => (
          <Card
            key={project.id}
            className={`cursor-pointer hover:shadow-md transition-shadow border-l-4 ${
              project.status === 'archived' ? 'border-l-gray-300 opacity-70' : 'border-l-[#1e3a5f]'
            }`}
            onClick={() => navigate(`/workspace/${project.id}`)}
          >
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between gap-2">
                <CardTitle className="text-base font-semibold text-[#1e3a5f] leading-tight line-clamp-2">
                  {project.title}
                </CardTitle>
                <Badge
                  variant={project.status === 'active' ? 'default' : 'secondary'}
                  className={`shrink-0 text-xs ${project.status === 'active' ? 'bg-heading/15 text-heading/75 hover:bg-heading/15' : ''}`}
                >
                  {project.status === 'active' ? t('نشط', 'Active') : t('أرشيف', 'Archived')}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              {project.description && (
                <p className="text-sm text-muted-foreground line-clamp-2 mb-3">{project.description}</p>
              )}
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  {new Date(project.updatedAt).toLocaleDateString('ar-AE')}
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    archiveMut.mutate({ id: project.id, status: project.status === 'active' ? 'archived' : 'active' });
                  }}
                  className="flex items-center gap-1 text-muted-foreground hover:text-gray-700 transition-colors"
                  title={project.status === 'active' ? t('أرشفة', 'Archive') : t('إعادة تفعيل', 'Restore')}
                >
                  <Archive className="w-3.5 h-3.5" />
                  {project.status === 'active' ? t('أرشفة', 'Archive') : t('إعادة تفعيل', 'Restore')}
                </button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* New Project Dialog */}
      <Dialog open={showNew} onOpenChange={(o) => { if (!o) { setShowNew(false); setNewTitle(''); setNewDesc(''); setCreateErr(null); } }}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle>{t('مشروع بحثي جديد', 'New Research Project')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="block text-xs font-medium mb-1 text-muted-foreground">{t('عنوان المشروع', 'Project Title')} *</label>
              <Input
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                placeholder={t('أدخل عنوان المشروع…', 'Enter project title…')}
                dir="auto"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1 text-muted-foreground">{t('الوصف (اختياري)', 'Description (optional)')}</label>
              <textarea
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                rows={3}
                placeholder={t('وصف مختصر للمشروع…', 'Brief project description…')}
                dir="auto"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
              />
            </div>
            {createErr && <p className="text-xs text-red-600">{createErr}</p>}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setShowNew(false); setNewTitle(''); setNewDesc(''); setCreateErr(null); }} disabled={creating}>
              {t('إلغاء', 'Cancel')}
            </Button>
            <Button onClick={handleCreate} disabled={creating} className="bg-[#1e3a5f] hover:bg-[#2d5a8f] text-white">
              {creating && <Loader2 className="w-4 h-4 ml-2 animate-spin" />}
              {t('إنشاء', 'Create')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
