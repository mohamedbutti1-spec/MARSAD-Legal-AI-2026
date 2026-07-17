/**
 * NAIP Executive Homepage — منصة الذكاء الإداري الوطني
 * ──────────────────────────────────────────────────────
 * Flagship entry point for all NAIP platform executives.
 * Phase 43 · نظرية الشامسي™ · MARSAD NAIP v1.0
 */
import React from 'react';
import { Link } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { AppLayout } from '@/components/layout/app-layout';
import {
  Scale, Shield, ShieldAlert, RefreshCw, Sparkles, BookOpen,
  AlertTriangle, ChevronRight, Loader2, Activity, BarChart3,
  Eye, Users, Gavel,
} from 'lucide-react';
import { useUserContext, useT } from '@/lib/user-context';

// ─── Types ────────────────────────────────────────────────────────────────────

interface NaipOverview {
  totalDecisions: number;
  activeWarnings: number;
  avgRiskIndex: number | null;
  avgComplianceScore: number | null;
  criticalWarnings: number;
  humanOversightQueue: number;
  activeDecisions: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getHeaders(role: string, userId: number, org: string) {
  return {
    'Content-Type': 'application/json',
    'x-user-role': role,
    'x-user-id': String(userId),
    'x-user-org': org,
  };
}

function fmt(val: number | null | undefined, suffix = ''): string {
  if (val === null || val === undefined) return '—';
  return `${val}${suffix}`;
}

// ─── Module Tile ──────────────────────────────────────────────────────────────

interface ModuleTileProps {
  icon: React.ReactNode;
  nameAr: string;
  nameEn: string;
  badge?: string;
  href: string;
  subtitle?: string;
  statusColor?: string;
}

function ModuleTile({ icon, nameAr, nameEn, badge, href, subtitle, statusColor = 'bg-heading' }: ModuleTileProps) {
  const t = useT();
  return (
    <Link href={href}>
      <div className="bg-card border border-border rounded-xl p-5 hover:border-accent/40 hover:bg-accent/5 transition-all cursor-pointer group h-full flex flex-col gap-3">
        <div className="flex items-start justify-between">
          <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center text-muted-foreground group-hover:bg-accent/15 group-hover:text-accent transition-all">
            {icon}
          </div>
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${statusColor}`} />
            {badge && <span className="text-[10px] bg-muted text-muted-foreground px-2 py-0.5 rounded font-bold tracking-wider">{badge}</span>}
          </div>
        </div>
        <div className="flex-1">
          <div className="text-sm font-bold text-foreground leading-snug">{t(nameAr, nameEn)}</div>
          <div className="text-xs text-muted-foreground mt-0.5">{nameEn}</div>
          {subtitle && <div className="text-xs text-muted-foreground mt-1 font-mono tabular-nums">{subtitle}</div>}
        </div>
        <div className="flex items-center gap-1 text-xs text-muted-foreground group-hover:text-gold transition-colors">
          <ChevronRight className="w-3 h-3" />
          <span>{t('فتح الوحدة', 'Open Module')}</span>
        </div>
      </div>
    </Link>
  );
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({ value, label, labelEn, colorClass = 'text-foreground' }: {
  value: string; label: string; labelEn: string; colorClass?: string;
}) {
  const t = useT();
  return (
    <div className="bg-card border border-border rounded-xl p-5 flex flex-col gap-1">
      <div className={`text-3xl font-bold tabular-nums ${colorClass}`}>{value}</div>
      <div className="text-xs text-muted-foreground">{t(label, labelEn)}</div>
    </div>
  );
}

// ─── Role Dashboard Shortcuts ─────────────────────────────────────────────────

interface RoleShortcut {
  label: string; labelEn: string; href: string; icon: React.ReactNode;
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function NaipHome() {
  const {
    role, userId, userOrg,
    canViewNaipDashboard,
    canViewRiskDashboard,
    canViewCilDashboard,
    canViewGovernanceDashboard,
  } = useUserContext() as any;
  const t = useT();
  const headers = getHeaders(role, userId, userOrg);

  // Determine canViewNaipDashboard — fallback to canViewGovernanceDashboard for roles without explicit permission
  // Judicial Command Center rebuild: NAIP is owner-only regardless of the broader permission set.
  const hasAccess = role === 'owner' && (canViewNaipDashboard ?? canViewGovernanceDashboard);

  const { data: overview, isLoading } = useQuery<NaipOverview>({
    queryKey: ['naip-overview'],
    queryFn: async () => {
      const res = await fetch(`${import.meta.env.BASE_URL}api/naip/overview`, { headers });
      if (!res.ok) throw new Error('Failed to load NAIP overview');
      return res.json();
    },
    enabled: hasAccess,
    staleTime: 60_000,
  });

  // ── Permission gate ──────────────────────────────────────────────────────────
  if (!hasAccess) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center h-96 gap-4 text-muted-foreground">
          <Shield className="w-14 h-14 opacity-20" />
          <p className="text-sm font-medium">{t('ليس لديك صلاحية الوصول.', 'You do not have access.')}</p>
        </div>
      </AppLayout>
    );
  }

  // ── Role shortcuts ───────────────────────────────────────────────────────────
  const roleShortcuts: RoleShortcut[] = [
    ...(hasAccess ? [{ label: 'لوحة NAIP', labelEn: 'NAIP Dashboard', href: '/naip/dashboard', icon: <BarChart3 className="w-4 h-4" /> }] : []),
    ...(canViewRiskDashboard ? [{ label: 'ضابط المخاطر', labelEn: 'Risk Officer', href: '/naip/risk-officer', icon: <ShieldAlert className="w-4 h-4" /> }] : []),
    ...(canViewCilDashboard ? [{ label: 'الذكاء الدستوري', labelEn: 'Constitutional Intelligence', href: '/constitutional-intelligence', icon: <Scale className="w-4 h-4" /> }] : []),
    ...(role === 'minister' ? [{ label: 'لوحة الوزير', labelEn: 'Minister Dashboard', href: '/naip/minister', icon: <Gavel className="w-4 h-4" /> }] : []),
    ...(role === 'undersecretary' ? [{ label: 'لوحة وكيل الوزارة', labelEn: 'Undersecretary Dashboard', href: '/naip/undersecretary', icon: <Users className="w-4 h-4" /> }] : []),
    ...(role === 'director_general' ? [{ label: 'لوحة المدير العام', labelEn: 'Director General Dashboard', href: '/naip/director-general', icon: <Eye className="w-4 h-4" /> }] : []),
    ...(role === 'judge' ? [{ label: 'لوحة القضاء', labelEn: 'Judge Dashboard', href: '/naip/judge', icon: <Scale className="w-4 h-4" /> }] : []),
  ];

  const criticalWarnings = overview?.criticalWarnings ?? 0;

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-8">

        {/* ── Hero Section ───────────────────────────────────────────────────── */}
        <div className="bg-gradient-to-br from-card via-card to-gold/5 border border-border rounded-2xl p-8 relative overflow-hidden">
          <div className="absolute inset-0 opacity-5 bg-[radial-gradient(circle_at_30%_50%,_var(--tw-gradient-stops))] from-gold via-transparent to-transparent pointer-events-none" />
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-2xl bg-gold/20 border border-gold/30 flex items-center justify-center">
                <Shield className="w-6 h-6 text-gold" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-foreground leading-tight">
                  {t('منصة الذكاء الإداري الوطني', 'National Administrative Intelligence Platform')}
                </h1>
                <p className="text-sm text-muted-foreground font-mono tracking-wide mt-0.5">
                  NAIP · {t('نظرية الشامسي™ · المرحلة 43', 'Al-Shamsi Theory™ · Phase 43')}
                </p>
              </div>
            </div>
            <p className="text-sm text-muted-foreground max-w-2xl leading-relaxed">
              {t(
                'المنصة التنفيذية الموحدة لإدارة القرار الإداري الذكي وتقييم المخاطر الوطنية والامتثال الدستوري عبر جميع وحدات MARSAD.',
                'The unified executive platform for intelligent administrative decision management, national risk assessment, and constitutional compliance across all MARSAD modules.'
              )}
            </p>
          </div>
        </div>

        {/* ── Critical Alert Banner ───────────────────────────────────────────── */}
        {criticalWarnings > 0 && (
          <div className="bg-destructive/10 dark:bg-destructive/30 border border-destructive/30 dark:border-destructive/40 rounded-xl p-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-destructive shrink-0" />
              <div>
                <span className="text-sm font-bold text-destructive">
                  {t('تحذيرات دستورية حرجة', 'Critical Constitutional Warnings')}
                </span>
                <span className="text-sm text-destructive ms-2">
                  — {criticalWarnings} {t('تحذير نشط', 'active warnings')}
                </span>
              </div>
            </div>
            <Link href="/constitutional-intelligence">
              <button className="text-xs bg-destructive hover:bg-destructive text-white px-3 py-1.5 rounded-lg transition-colors shrink-0">
                {t('عرض التحذيرات', 'View Warnings')}
              </button>
            </Link>
          </div>
        )}

        {/* ── Hero Stats Bar ──────────────────────────────────────────────────── */}
        {isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => <div key={i} className="h-24 bg-muted/30 rounded-xl animate-pulse" />)}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <StatCard
              value={fmt(overview?.totalDecisions)}
              label="إجمالي القرارات"
              labelEn="Total Decisions"
            />
            <StatCard
              value={fmt(overview?.activeWarnings)}
              label="تحذيرات نشطة"
              labelEn="Active Warnings"
              colorClass={overview?.activeWarnings ? 'text-gold' : 'text-foreground'}
            />
            <StatCard
              value={fmt(overview?.avgRiskIndex, '%')}
              label="متوسط مؤشر المخاطر"
              labelEn="Avg Risk Index"
              colorClass="text-gold"
            />
            <StatCard
              value={fmt(overview?.avgComplianceScore, '%')}
              label="متوسط الامتثال الدستوري"
              labelEn="Avg Compliance Score"
              colorClass="text-heading"
            />
          </div>
        )}

        {/* ── Module Grid ────────────────────────────────────────────────────── */}
        <div>
          <h2 className="text-sm font-bold text-foreground mb-4 flex items-center gap-2">
            <Activity className="w-4 h-4 text-muted-foreground" />
            {t('وحدات المنصة', 'Platform Modules')}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <ModuleTile
              icon={<Scale className="w-5 h-5" />}
              nameAr="القرار الإداري الذكي"
              nameEn="Intelligent Decision"
              badge="الوحدة 1"
              href="/decisions"
              statusColor="bg-heading"
            />
            <ModuleTile
              icon={<Shield className="w-5 h-5" />}
              nameAr="مركز الحوكمة التنفيذية"
              nameEn="Executive Governance"
              href="/governance"
              statusColor="bg-heading"
            />
            <ModuleTile
              icon={<ShieldAlert className="w-5 h-5" />}
              nameAr="تقييم المخاطر"
              nameEn="Risk Assessment"
              href="/risk-engine"
              subtitle={overview?.avgRiskIndex !== null && overview?.avgRiskIndex !== undefined ? `NRI: ${overview.avgRiskIndex}%` : undefined}
              statusColor="bg-gold"
            />
            <ModuleTile
              icon={<Scale className="w-5 h-5" />}
              nameAr="المراجعة الدستورية"
              nameEn="Constitutional Review"
              href="/constitutional-intelligence"
              subtitle={overview?.avgComplianceScore !== null && overview?.avgComplianceScore !== undefined ? `CCS: ${overview.avgComplianceScore}%` : undefined}
              statusColor="bg-heading"
            />
            <ModuleTile
              icon={<RefreshCw className="w-5 h-5" />}
              nameAr="محرك إعادة التشغيل"
              nameEn="Decision Replay Engine"
              badge="Replay"
              href="/decisions"
              statusColor="bg-heading"
            />
            <ModuleTile
              icon={<Sparkles className="w-5 h-5" />}
              nameAr="نظرية الشامسي"
              nameEn="Al-Shamsi Theory"
              badge="مرجع"
              href="/shamsi-theory"
              statusColor="bg-gold/80"
            />
            <ModuleTile
              icon={<BookOpen className="w-5 h-5" />}
              nameAr="المبادئ الدستورية"
              nameEn="Constitutional Principles"
              badge="دستوري"
              href="/constitutional-principles"
              statusColor="bg-heading"
            />
          </div>
        </div>

        {/* ── Live Queues ────────────────────────────────────────────────────── */}
        <div>
          <h2 className="text-sm font-bold text-foreground mb-4 flex items-center gap-2">
            <Activity className="w-4 h-4 text-muted-foreground" />
            {t('الطوابير الحية', 'Live Queues')}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Human Oversight Queue */}
            <div className="bg-card border border-border rounded-xl p-5 flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-gold/15 dark:bg-gold/40 flex items-center justify-center">
                  <Users className="w-4 h-4 text-gold/80" />
                </div>
                <div>
                  <div className="text-sm font-bold text-foreground">{t('طابور المراجعة البشرية', 'Human Oversight Queue')}</div>
                  <div className="text-xs text-muted-foreground">{t('قرارات تنتظر مراجعة بشرية', 'Decisions awaiting human review')}</div>
                </div>
              </div>
              <div className="flex items-end justify-between">
                <div className={`text-4xl font-bold tabular-nums ${(overview?.humanOversightQueue ?? 0) > 0 ? 'text-gold' : 'text-foreground'}`}>
                  {isLoading ? <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /> : fmt(overview?.humanOversightQueue)}
                </div>
                <Link href="/decisions">
                  <button className="text-xs bg-muted hover:bg-muted/70 text-foreground px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1">
                    {t('عرض', 'View')} <ChevronRight className="w-3 h-3" />
                  </button>
                </Link>
              </div>
            </div>

            {/* Active Decisions */}
            <div className="bg-card border border-border rounded-xl p-5 flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-heading/15 dark:bg-heading/40 flex items-center justify-center">
                  <Scale className="w-4 h-4 text-heading" />
                </div>
                <div>
                  <div className="text-sm font-bold text-foreground">{t('القرارات النشطة', 'Active Decisions')}</div>
                  <div className="text-xs text-muted-foreground">{t('قرارات قيد المعالجة', 'Decisions under processing')}</div>
                </div>
              </div>
              <div className="flex items-end justify-between">
                <div className="text-4xl font-bold tabular-nums text-heading">
                  {isLoading ? <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /> : fmt(overview?.activeDecisions)}
                </div>
                <Link href="/decisions">
                  <button className="text-xs bg-muted hover:bg-muted/70 text-foreground px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1">
                    {t('عرض', 'View')} <ChevronRight className="w-3 h-3" />
                  </button>
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* ── Role Dashboard Shortcuts ───────────────────────────────────────── */}
        {roleShortcuts.length > 0 && (
          <div>
            <h2 className="text-sm font-bold text-foreground mb-4 flex items-center gap-2">
              <Eye className="w-4 h-4 text-muted-foreground" />
              {t('لوحات الأدوار', 'Role Dashboards')}
            </h2>
            <div className="flex flex-wrap gap-3">
              {roleShortcuts.map((s) => (
                <Link key={s.href} href={s.href}>
                  <div className="flex items-center gap-2 bg-card border border-border hover:border-gold/40 hover:bg-gold/5 rounded-xl px-4 py-3 cursor-pointer transition-all group">
                    <span className="text-muted-foreground group-hover:text-gold transition-colors">{s.icon}</span>
                    <span className="text-sm font-medium text-foreground">{t(s.label, s.labelEn)}</span>
                    <ChevronRight className="w-3 h-3 text-muted-foreground group-hover:text-gold transition-colors" />
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* ── Footer ─────────────────────────────────────────────────────────── */}
        <div className="border-t border-border pt-6 text-center">
          <p className="text-xs text-muted-foreground">
            NAIP · {t('منصة الذكاء الإداري الوطني', 'National Administrative Intelligence Platform')} · {t('نظرية الشامسي™', 'Al-Shamsi Theory™')} · MARSAD Alpha 1.0
          </p>
        </div>

      </div>
    </AppLayout>
  );
}
