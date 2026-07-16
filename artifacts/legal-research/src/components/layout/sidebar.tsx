import React, { useState } from 'react';
import { Link, useLocation, useSearch } from 'wouter';
import {
  LayoutDashboard,
  Search,
  Bot,
  FolderOpen,
  Network,
  ScrollText,
  Gavel,
  Landmark,
  Globe,
  BookOpenText,
  Quote,
  GitCompareArrows,
  Library,
  Users,
  Settings,
  ChevronLeft,
  ChevronRight,
  X,
  Scale,
  ChevronDown,
  BarChart3,
  Sparkles,
  Shield,
  ShieldAlert,
  Target,
  Cpu,
  Brain,
  Compass,
  UserCircle,
  GraduationCap,
} from 'lucide-react';
import { useUserContext } from '@/lib/user-context';

interface SidebarProps {
  collapsed: boolean;
  setCollapsed: (c: boolean) => void;
  mobileOpen?: boolean;
  setMobileOpen?: (o: boolean) => void;
}

interface NavItem {
  href: string;
  labelAr: string;
  labelEn: string;
  icon: React.ReactNode;
  show: boolean;
  badge?: string;
  /** Optional sub-menu — item becomes an expand/collapse toggle instead of a direct link. */
  children?: NavItem[];
}

interface NavSection {
  id: string;
  titleAr: string;
  titleEn: string;
  items: NavItem[];
}

export function Sidebar({ collapsed, setCollapsed, mobileOpen, setMobileOpen }: SidebarProps) {
  const [location] = useLocation();
  const search = useSearch();
  const { role, lang, canManageUsers, canManageSettings, canUseAi, canViewAudit, canViewGovernanceDashboard, canViewRiskDashboard, canViewCilDashboard, canViewNaipDashboard, canViewJdtSimulation, canUseShamsiFramework } = useUserContext();
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());
  // Sub-menu expand/collapse state, keyed by parent href (e.g. training scenarios).
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  const toggleSection = (id: string) => {
    setCollapsedSections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleItem = (href: string) => {
    setExpandedItems((prev) => {
      const next = new Set(prev);
      if (next.has(href)) next.delete(href);
      else next.add(href);
      return next;
    });
  };

  const isOwner = role === 'owner';

  const sections: NavSection[] = [
    // ── الرئيسية — command center home ──────────────────────────────────────
    {
      id: 'main',
      titleAr: 'الرئيسية',
      titleEn: 'Home',
      items: [
        {
          href: '/',
          labelAr: 'لوحة القيادة',
          labelEn: 'Dashboard',
          icon: <LayoutDashboard className="w-4.5 h-4.5" />,
          show: true,
        },
        {
          href: '/assistant',
          labelAr: 'المساعد الذكي',
          labelEn: 'AI Assistant',
          icon: <Bot className="w-4.5 h-4.5" />,
          show: canUseAi,
        },
        // الأدوات الثانوية — التخطيط التنفيذي المعتمد ينقلها إلى القائمة الجانبية
        {
          href: '/journey',
          labelAr: 'رحلة مرصد الموجهة',
          labelEn: 'Guided Journey',
          icon: <Compass className="w-4.5 h-4.5" />,
          show: true,
        },
        {
          href: '/nafe',
          labelAr: 'خدمة نافع',
          labelEn: 'Nafe Awareness',
          icon: <Shield className="w-4.5 h-4.5" />,
          show: true,
        },
        {
          href: '/community',
          labelAr: 'المجتمع المهني',
          labelEn: 'Professional Community',
          icon: <Users className="w-4.5 h-4.5" />,
          show: true,
        },
      ],
    },
    // ── المرجعية القانونية — legal reference material ───────────────────────
    {
      id: 'legal-reference',
      titleAr: 'المرجعية القانونية',
      titleEn: 'Legal Reference',
      items: [
        {
          href: '/constitutional-principles',
          labelAr: 'المبادئ الدستورية',
          labelEn: 'Constitutional Principles',
          icon: <Shield className="w-4.5 h-4.5" />,
          show: true,
          badge: 'دستوري',
        },
        {
          href: '/caselaw/uae',
          labelAr: 'الاجتهاد القضائي',
          labelEn: 'UAE Case Law',
          icon: <Gavel className="w-4.5 h-4.5" />,
          show: true,
        },
        {
          href: '/law/france',
          labelAr: 'القانون الفرنسي',
          labelEn: 'French Law',
          icon: <Landmark className="w-4.5 h-4.5" />,
          show: true,
        },
        {
          href: '/law/eu',
          labelAr: 'القانون الأوروبي',
          labelEn: 'EU Law',
          icon: <Globe className="w-4.5 h-4.5" />,
          show: true,
        },
        {
          href: '/citations',
          labelAr: 'مولّد الاستشهادات',
          labelEn: 'Citation Generator',
          icon: <Quote className="w-4.5 h-4.5" />,
          show: true,
        },
      ],
    },
    // ── البحث والمعرفة — research & knowledge tools ──────────────────────────
    {
      id: 'research-knowledge',
      titleAr: 'البحث والمعرفة',
      titleEn: 'Research & Knowledge',
      items: [
        {
          href: '/legal-brain',
          labelAr: 'الدماغ القانوني',
          labelEn: 'Legal Intelligence Brain',
          icon: <Brain className="w-4.5 h-4.5" />,
          show: canUseAi,
          badge: 'Stage 4',
        },
        {
          href: '/adkg',
          labelAr: 'سجل القرارات الإدارية',
          labelEn: 'Decision Knowledge Graph',
          icon: <Network className="w-4.5 h-4.5" />,
          show: canUseAi,
          badge: 'جديد',
        },
        {
          // Canonical search entry point — replaces the previously scattered
          // ai-search / kb-search / naip-search / legacy "/research" links.
          // "/research" and "/ai-search" still resolve (backward compatible),
          // they are just no longer separate menu entries.
          href: '/search',
          labelAr: 'البحث القانوني الذكي',
          labelEn: 'Smart Legal Search',
          icon: <Search className="w-4.5 h-4.5" />,
          show: canUseAi,
        },
        {
          href: '/workspace',
          labelAr: 'مساحة البحث',
          labelEn: 'Research Workspace',
          icon: <FolderOpen className="w-4.5 h-4.5" />,
          show: canUseAi,
        },
        {
          href: '/literature-review',
          labelAr: 'مراجعة الأدبيات',
          labelEn: 'Literature Review',
          icon: <BookOpenText className="w-4.5 h-4.5" />,
          show: canUseAi,
        },
        {
          href: '/comparison',
          labelAr: 'مقارنة المستندات',
          labelEn: 'Document Comparison',
          icon: <GitCompareArrows className="w-4.5 h-4.5" />,
          show: true,
        },
        {
          href: '/library',
          labelAr: 'مكتبتي الشخصية',
          labelEn: 'Personal Library',
          icon: <Library className="w-4.5 h-4.5" />,
          show: true,
        },
      ],
    },
    // ── القرارات والحوكمة — Module 1 decisions + executive oversight ────────
    {
      id: 'decisions-governance',
      titleAr: 'القرارات والحوكمة',
      titleEn: 'Decisions & Governance',
      items: [
        {
          href: '/decisions',
          labelAr: 'القرارات الإدارية',
          labelEn: 'Administrative Decisions',
          icon: <Gavel className="w-4.5 h-4.5" />,
          show: canUseAi,
        },
        {
          href: '/governance',
          labelAr: 'مركز الحوكمة التنفيذية',
          labelEn: 'Executive Governance Hub',
          icon: <Landmark className="w-4.5 h-4.5" />,
          show: canViewGovernanceDashboard,
        },
        {
          href: '/risk-engine',
          labelAr: 'محرك المخاطر الوطني',
          labelEn: 'National Risk Modeling Engine',
          icon: <ShieldAlert className="w-4.5 h-4.5" />,
          show: canViewRiskDashboard,
        },
      ],
    },
    // ── التأهيل والتطوير — training & judicial reasoning tools ───────────────
    {
      id: 'training',
      titleAr: 'التأهيل والتطوير',
      titleEn: 'Training & Development',
      items: [
        {
          href: '/admin/legal-os',
          labelAr: 'فهرس السيناريوهات',
          labelEn: 'Scenario Catalog',
          icon: <Compass className="w-4.5 h-4.5" />,
          show: canManageUsers,
        },
        {
          href: '/legal-os',
          labelAr: 'نظام العمليات القانونية',
          labelEn: 'Legal Operations System',
          icon: <Cpu className="w-4.5 h-4.5" />,
          show: canUseAi,
        },
        {
          href: '/spg',
          labelAr: 'الإرشاد المهني الذكي',
          labelEn: 'Smart Professional Guidance',
          icon: <Compass className="w-4.5 h-4.5" />,
          show: canUseAi,
          badge: 'جديد',
        },
        {
          href: '/jre',
          labelAr: 'محرك التفكير القضائي',
          labelEn: 'Judicial Reasoning Engine',
          icon: <Gavel className="w-4.5 h-4.5" />,
          show: canUseAi,
          badge: 'جديد',
        },
        {
          href: '/jdc',
          labelAr: 'غرفة المداولة القضائية',
          labelEn: 'Judicial Deliberation Chamber',
          icon: <Users className="w-4.5 h-4.5" />,
          show: canUseAi,
          badge: 'v2',
        },
        // ── سيناريوهات التدريب والمراجعة القضائية — merged from the home page.
        // Same logic/output as before (see ai-assistant.tsx TRAINING_OUTPUT_CFG),
        // just relocated here as a sub-menu; each child opens the dedicated
        // training workspace at /assistant?train=<type>.
        {
          href: '/assistant?train=legal_memorandum',
          labelAr: 'سيناريوهات التدريب والمراجعة القضائية',
          labelEn: 'Training & Mock Judicial Review Scenarios',
          icon: <GraduationCap className="w-4.5 h-4.5" />,
          show: canUseAi,
          children: [
            {
              href: '/assistant?train=legal_memorandum',
              labelAr: 'مذكرة قانونية',
              labelEn: 'Legal Memorandum',
              icon: <ScrollText className="w-4 h-4" />,
              show: true,
            },
            {
              href: '/assistant?train=judicial_judgment',
              labelAr: 'حكم قضائي',
              labelEn: 'Judicial Judgment',
              icon: <Gavel className="w-4 h-4" />,
              show: true,
            },
            {
              href: '/assistant?train=legislative_draft',
              labelAr: 'مسودة تشريعية',
              labelEn: 'Legislative Draft',
              icon: <Landmark className="w-4 h-4" />,
              show: true,
            },
            {
              href: '/assistant?train=executive_report',
              labelAr: 'تقرير تنفيذي',
              labelEn: 'Executive Report',
              icon: <BarChart3 className="w-4 h-4" />,
              show: true,
            },
            {
              href: '/assistant?train=comparative_study',
              labelAr: 'دراسة مقارنة',
              labelEn: 'Comparative Study',
              icon: <GitCompareArrows className="w-4 h-4" />,
              show: true,
            },
            {
              href: '/assistant?train=mini_academic_research',
              labelAr: 'بحث علمي مصغر',
              labelEn: 'Mini Academic Research',
              icon: <BookOpenText className="w-4 h-4" />,
              show: true,
            },
          ],
        },
      ],
    },
    // ── الخدمات — public-facing services ─────────────────────────────────────
    {
      id: 'services',
      titleAr: 'الخدمات',
      titleEn: 'Services',
      items: [
        {
          href: '/citizen',
          labelAr: 'بوابة المواطن',
          labelEn: 'Citizen Portal',
          icon: <UserCircle className="w-4.5 h-4.5" />,
          show: true,
        },
        {
          href: '/settings',
          labelAr: 'الإعدادات',
          labelEn: 'Settings',
          icon: <Settings className="w-4.5 h-4.5" />,
          show: canManageSettings,
        },
      ],
    },
    // ── خاص — owner-only command surfaces ────────────────────────────────────
    {
      id: 'private',
      titleAr: 'خاص',
      titleEn: 'Private',
      items: [
        {
          href: '/shamsi-theory',
          labelAr: 'نظرية الشامسي',
          labelEn: 'Al-Shamsi Theory',
          icon: <Sparkles className="w-4.5 h-4.5" />,
          show: isOwner,
          badge: 'خاص',
        },
        {
          href: '/constitutional-intelligence',
          labelAr: 'المراجعة الدستورية',
          labelEn: 'Constitutional Review',
          icon: <Scale className="w-4.5 h-4.5" />,
          show: isOwner,
          badge: 'خاص',
        },
        {
          href: '/naip',
          labelAr: 'منصة الذكاء الوطني',
          labelEn: 'National Intelligence Platform',
          icon: <Cpu className="w-4.5 h-4.5" />,
          show: isOwner,
          badge: 'خاص',
        },
        {
          href: '/naip/kpi',
          labelAr: 'مركز المؤشرات الوطنية',
          labelEn: 'National KPI Center',
          icon: <Target className="w-4.5 h-4.5" />,
          show: isOwner,
          badge: 'خاص',
        },
        {
          href: '/admin/users',
          labelAr: 'إدارة المستخدمين',
          labelEn: 'User Management',
          icon: <Users className="w-4.5 h-4.5" />,
          show: canManageUsers,
          badge: 'خاص',
        },
        {
          href: '/admin-os',
          labelAr: 'نظام القرارات الإدارية',
          labelEn: 'Administrative Decision OS',
          icon: <ShieldAlert className="w-4.5 h-4.5" />,
          show: canUseShamsiFramework,
          badge: 'خاص',
        },
      ],
    },
    // ── Hidden — code and routes preserved, removed from navigation only ────
    // لوحة الوزير/الوكيل/المدير العام/مسؤول المخاطر/القاضي (NAIP role
    // dashboards), الإطار الاحترافي الموجَّه ('/pgf'), لوحة الامتثال القانوني
    // ('/admin-os/compliance'), التشريعات الإماراتية ('/legislation/uae'),
    // لوحة الذكاء الوطني ('/naip/dashboard') — all unreachable from the
    // sidebar per the visual rebuild, routes remain intact.
  ];

  const isActive = (href: string) => {
    const [path, query] = href.split('?');
    if (path === '/') return location === '/' && !query;
    if (!location.startsWith(path)) return false;
    return query ? search === query : true;
  };

  const handleLinkClick = () => {
    if (setMobileOpen) setMobileOpen(false);
  };

  const ROLE_CONFIG: Record<string, { labelAr: string; labelEn: string; color: string }> = {
    owner: { labelAr: 'مالك', labelEn: 'Owner', color: 'bg-gold/20 text-gold/40 border-gold/30' },
    supervisor: { labelAr: 'مشرف', labelEn: 'Supervisor', color: 'bg-sky-400/20 text-sky-300 border-sky-400/30' },
    viewer: { labelAr: 'مشاهد', labelEn: 'Viewer', color: 'bg-slate-400/20 text-slate-300 border-slate-400/30' },
  };

  const roleConf = ROLE_CONFIG[role] ?? ROLE_CONFIG.viewer;

  return (
    <aside
      className={`bg-sidebar flex flex-col h-full transition-all duration-300 border-e border-sidebar-border ${
        collapsed ? 'w-[4.5rem]' : 'w-72'
      }`}
    >
      {/* ─── Logo ────────────────────────────────────────────────────── */}
      <div
        className={`flex items-center h-16 px-4 border-b border-sidebar-border shrink-0 ${
          collapsed ? 'justify-center' : 'justify-between'
        }`}
      >
        {!collapsed && (
          <div className="flex items-center gap-3 min-w-0">
            {/* Emblem */}
            <div className="w-10 h-10 rounded-xl bg-accent/20 border border-accent/30 flex items-center justify-center shrink-0">
              <Scale className="w-5 h-5 text-accent" />
            </div>
            <div className="min-w-0">
              {/* MLOS badge */}
              <div className="flex items-baseline gap-1.5 leading-none mb-0.5">
                <span className="font-black text-lg tracking-[0.1em] text-sidebar-foreground">MLOS</span>
                <span className="text-sidebar-foreground/30 text-xs select-none">·</span>
                <span className="font-bold text-xs text-sidebar-foreground/80">مرصد</span>
              </div>
              <div className="text-sidebar-foreground/55 text-[10px] font-medium leading-tight truncate">
                Marsad Legal Operating System
              </div>
              <div className="text-sidebar-foreground/40 text-[9px] leading-tight truncate" dir="rtl">
                نظام مرصد للتشغيل القانوني الذكي
              </div>
            </div>
          </div>
        )}

        {collapsed && (
          <div className="w-9 h-9 rounded-lg bg-accent/20 border border-accent/30 flex items-center justify-center">
            <Scale className="w-5 h-5 text-accent" />
          </div>
        )}

        <div className="flex items-center gap-1 shrink-0">
          {mobileOpen !== undefined && (
            <button
              onClick={() => setMobileOpen?.(false)}
              className="lg:hidden text-sidebar-foreground/40 hover:text-sidebar-foreground p-1.5 rounded"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="hidden lg:flex text-sidebar-foreground/40 hover:text-sidebar-foreground p-1.5 rounded hover:bg-white/5 transition-colors"
            title={collapsed ? 'Expand' : 'Collapse'}
          >
            {collapsed ? (
              <ChevronLeft className="w-4 h-4" />
            ) : (
              <ChevronRight className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>

      {/* ─── Navigation ──────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto py-3 space-y-0.5">
        {sections.map((section) => {
          const visibleItems = section.items.filter((i) => i.show);
          if (visibleItems.length === 0) return null;

          const isSectionCollapsed = collapsedSections.has(section.id);

          return (
            <div key={section.id}>
              {/* Section header */}
              {!collapsed && (
                <button
                  onClick={() => toggleSection(section.id)}
                  className="w-full flex items-center justify-between px-4 py-1.5 text-[10px] font-bold uppercase tracking-widest text-heading/50 hover:text-heading/80 transition-colors"
                >
                  <span>{lang === 'ar' ? section.titleAr : section.titleEn}</span>
                  <ChevronDown
                    className={`w-3 h-3 transition-transform ${isSectionCollapsed ? '-rotate-90' : ''}`}
                  />
                </button>
              )}
              {collapsed && section.id !== 'main' && (
                <div className="section-divider" />
              )}

              {/* Items */}
              {!isSectionCollapsed && (
                <div className={`${collapsed ? 'px-2' : 'px-2'} space-y-0.5`}>
                  {visibleItems.map((item) => {
                    const visibleChildren = item.children?.filter((c) => c.show) ?? [];
                    const hasChildren = visibleChildren.length > 0;
                    const childActive = hasChildren && visibleChildren.some((c) => isActive(c.href));
                    const active = hasChildren ? childActive : isActive(item.href);
                    const isOpen = hasChildren && (expandedItems.has(item.href) || childActive);

                    if (hasChildren) {
                      return (
                        <div key={item.href}>
                          <button
                            type="button"
                            onClick={() => toggleItem(item.href)}
                            title={collapsed ? (lang === 'ar' ? item.labelAr : item.labelEn) : undefined}
                            className={`
                              w-full flex items-center gap-3 px-3 py-2.5 rounded-md transition-all duration-150 relative group
                              ${active ? 'nav-item-active' : 'text-sidebar-foreground/60 hover:nav-item-hover'}
                            `}
                          >
                            <div className={`shrink-0 ${active ? 'text-white' : 'text-sidebar-foreground/50 group-hover:text-sidebar-foreground/80'}`}>
                              {item.icon}
                            </div>
                            {!collapsed && (
                              <div className="flex-1 min-w-0 flex items-center justify-between gap-2">
                                <span className={`text-sm font-medium truncate ${active ? 'text-white' : ''}`}>
                                  {lang === 'ar' ? item.labelAr : item.labelEn}
                                </span>
                                <div className="flex items-center gap-1.5 shrink-0">
                                  {item.badge && (
                                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded border border-gold/30 bg-gold/10 text-gold">
                                      {item.badge}
                                    </span>
                                  )}
                                  <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isOpen ? '' : '-rotate-90'} ${active ? 'text-white' : 'text-sidebar-foreground/40'}`} />
                                </div>
                              </div>
                            )}
                            {collapsed && (
                              <div className="absolute start-full ms-2 px-2 py-1 bg-sidebar-primary text-sidebar-primary-foreground text-xs rounded whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50 shadow-lg border border-sidebar-border">
                                {lang === 'ar' ? item.labelAr : item.labelEn}
                              </div>
                            )}
                          </button>

                          {/* Sub-menu — one item visible/open at a time per the source spec */}
                          {!collapsed && isOpen && (
                            <div className="mt-0.5 ms-4 ps-3 border-s border-sidebar-border space-y-0.5">
                              {visibleChildren.map((child) => {
                                const childIsActive = isActive(child.href);
                                return (
                                  <Link
                                    key={child.href}
                                    href={child.href}
                                    onClick={handleLinkClick}
                                    className={`
                                      flex items-center gap-2.5 px-3 py-2 rounded-md transition-all duration-150 group
                                      ${childIsActive ? 'nav-item-active' : 'text-sidebar-foreground/55 hover:nav-item-hover'}
                                    `}
                                  >
                                    <div className={`shrink-0 ${childIsActive ? 'text-white' : 'text-sidebar-foreground/45 group-hover:text-sidebar-foreground/75'}`}>
                                      {child.icon}
                                    </div>
                                    <span className={`text-[13px] font-medium truncate ${childIsActive ? 'text-white' : ''}`}>
                                      {lang === 'ar' ? child.labelAr : child.labelEn}
                                    </span>
                                  </Link>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    }

                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={handleLinkClick}
                        title={collapsed ? (lang === 'ar' ? item.labelAr : item.labelEn) : undefined}
                        className={`
                          flex items-center gap-3 px-3 py-2.5 rounded-md transition-all duration-150 relative group
                          ${active ? 'nav-item-active' : 'text-sidebar-foreground/60 hover:nav-item-hover'}
                        `}
                      >
                        <div className={`shrink-0 ${active ? 'text-white' : 'text-sidebar-foreground/50 group-hover:text-sidebar-foreground/80'}`}>
                          {item.icon}
                        </div>
                        {!collapsed && (
                          <div className="flex-1 min-w-0 flex items-center justify-between gap-2">
                            <span className={`text-sm font-medium truncate ${active ? 'text-white' : ''}`}>
                              {lang === 'ar' ? item.labelAr : item.labelEn}
                            </span>
                            {item.badge && (
                              <span className="shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded border border-gold/30 bg-gold/10 text-gold">
                                {item.badge}
                              </span>
                            )}
                          </div>
                        )}
                        {/* Tooltip for collapsed state */}
                        {collapsed && (
                          <div className="absolute start-full ms-2 px-2 py-1 bg-sidebar-primary text-sidebar-primary-foreground text-xs rounded whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50 shadow-lg border border-sidebar-border">
                            {lang === 'ar' ? item.labelAr : item.labelEn}
                          </div>
                        )}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ─── User Info ───────────────────────────────────────────────── */}
      <div className={`p-3 border-t border-sidebar-border shrink-0`}>
        <div className={`flex items-center gap-3 ${collapsed ? 'justify-center' : ''}`}>
          <div className="w-8 h-8 rounded-lg bg-gold/20 border border-gold/30 flex items-center justify-center shrink-0 text-gold font-bold font-serif text-sm">
            م
          </div>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-sidebar-foreground truncate leading-tight">
                محمد الشامسي
              </div>
              <span className={`inline-flex items-center mt-0.5 px-1.5 py-0.5 text-[10px] font-semibold rounded border ${roleConf.color}`}>
                {lang === 'ar' ? roleConf.labelAr : roleConf.labelEn}
              </span>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
