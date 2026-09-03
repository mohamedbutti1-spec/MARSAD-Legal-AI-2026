import React from 'react';
import { Link, useLocation } from 'wouter';
import {
  Bot,
  BookOpenText,
  ChevronLeft,
  ChevronRight,
  FileSearch,
  FolderOpen,
  Gavel,
  GitCompareArrows,
  Library,
  Quote,
  Scale,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Users,
  X,
  Archive,
  History,
  BarChart3,
  LifeBuoy,
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
}

interface NavSection {
  id: string;
  titleAr: string;
  titleEn: string;
  items: NavItem[];
}

export function Sidebar({ collapsed, setCollapsed, mobileOpen, setMobileOpen }: SidebarProps) {
  const [location] = useLocation();
  const {
    role,
    lang,
    canManageUsers,
    canManageSettings,
    canUseAi,
    canUseShamsiFramework,
  } = useUserContext();

  const isOwner = role === 'owner';

  const sections: NavSection[] = [
    {
      id: 'core',
      titleAr: 'مرصد',
      titleEn: 'MARSAD',
      items: [
        {
          href: '/',
          labelAr: 'مساحة مرصد',
          labelEn: 'MARSAD Workspace',
          icon: <Scale className="w-4.5 h-4.5" />,
          show: true,
        },
        {
          href: '/assistant',
          labelAr: 'التحليل الذكي',
          labelEn: 'Intelligent Analysis',
          icon: <Bot className="w-4.5 h-4.5" />,
          show: canUseAi,
        },
        {
          href: '/search',
          labelAr: 'البحث القانوني',
          labelEn: 'Legal Search',
          icon: <Search className="w-4.5 h-4.5" />,
          show: canUseAi,
        },
        {
          href: '/decisions',
          labelAr: 'القرارات الإدارية',
          labelEn: 'Administrative Decisions',
          icon: <Gavel className="w-4.5 h-4.5" />,
          show: canUseAi,
        },
        {
          href: '/library',
          labelAr: 'المكتبة والسجل',
          labelEn: 'Library & Record',
          icon: <Library className="w-4.5 h-4.5" />,
          show: true,
        },
      ],
    },
    {
      id: 'tools',
      titleAr: 'الأدوات',
      titleEn: 'Tools',
      items: [
        {
          href: '/journey-services',
          labelAr: 'الخدمات المتخصصة',
          labelEn: 'Specialized Services',
          icon: <FileSearch className="w-4.5 h-4.5" />,
          show: true,
        },
        {
          href: '/workspace',
          labelAr: 'مساحة البحث',
          labelEn: 'Research Workspace',
          icon: <FolderOpen className="w-4.5 h-4.5" />,
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
          href: '/citations',
          labelAr: 'الاستشهادات',
          labelEn: 'Citations',
          icon: <Quote className="w-4.5 h-4.5" />,
          show: true,
        },
        {
          href: '/literature-review',
          labelAr: 'مراجعة الأدبيات',
          labelEn: 'Literature Review',
          icon: <BookOpenText className="w-4.5 h-4.5" />,
          show: canUseAi,
        },
        {
          href: '/archive',
          labelAr: 'الأرشيف',
          labelEn: 'Archive',
          icon: <Archive className="w-4.5 h-4.5" />,
          show: canUseAi,
        },
        {
          href: '/previous-requests',
          labelAr: 'الطلبات السابقة',
          labelEn: 'Previous Requests',
          icon: <History className="w-4.5 h-4.5" />,
          show: canUseAi,
        },
        {
          href: '/reports',
          labelAr: 'التقارير والإحصاءات',
          labelEn: 'Reports & Statistics',
          icon: <BarChart3 className="w-4.5 h-4.5" />,
          show: canUseAi,
        },
        {
          href: '/support',
          labelAr: 'الدعم',
          labelEn: 'Support',
          icon: <LifeBuoy className="w-4.5 h-4.5" />,
          show: true,
        },
      ],
    },
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
          show: canUseShamsiFramework,
          badge: 'خاص',
        },
        {
          href: '/admin/users',
          labelAr: 'إدارة المستخدمين',
          labelEn: 'User Management',
          icon: <Users className="w-4.5 h-4.5" />,
          show: canManageUsers,
        },
        {
          href: '/settings',
          labelAr: 'الإعدادات',
          labelEn: 'Settings',
          icon: <Settings className="w-4.5 h-4.5" />,
          show: canManageSettings,
        },
        {
          href: '/settings/roles',
          labelAr: 'صلاحيات الأدوار',
          labelEn: 'Role Permissions',
          icon: <ShieldCheck className="w-4.5 h-4.5" />,
          show: canManageSettings,
        },
      ],
    },
  ];

  const isActive = (href: string) => {
    if (href === '/') return location === '/';
    return location.startsWith(href);
  };

  const handleLinkClick = () => setMobileOpen?.(false);

  const ROLE_CONFIG: Record<string, { labelAr: string; labelEn: string; color: string }> = {
    owner: { labelAr: 'مالك', labelEn: 'Owner', color: 'bg-gold/20 text-gold border-gold/30' },
    supervisor: { labelAr: 'مشرف', labelEn: 'Supervisor', color: 'bg-sky-400/20 text-sky-300 border-sky-400/30' },
    viewer: { labelAr: 'مراجع', labelEn: 'Reviewer', color: 'bg-slate-400/20 text-slate-300 border-slate-400/30' },
    admin: { labelAr: 'مسؤول النظام', labelEn: 'Admin', color: 'bg-violet-400/20 text-violet-300 border-violet-400/30' },
    professional_user: { labelAr: 'مستخدم تنفيذي', labelEn: 'Executive User', color: 'bg-teal-400/20 text-teal-300 border-teal-400/30' },
    prosecutor: { labelAr: 'النيابة العامة', labelEn: 'Prosecutor', color: 'bg-rose-400/20 text-rose-300 border-rose-400/30' },
    lawyer: { labelAr: 'محامٍ', labelEn: 'Lawyer', color: 'bg-amber-400/20 text-amber-300 border-amber-400/30' },
    researcher: { labelAr: 'باحث', labelEn: 'Researcher', color: 'bg-indigo-400/20 text-indigo-300 border-indigo-400/30' },
    student: { labelAr: 'طالب', labelEn: 'Student', color: 'bg-cyan-400/20 text-cyan-300 border-cyan-400/30' },
    guest: { labelAr: 'زائر', labelEn: 'Guest', color: 'bg-neutral-400/20 text-neutral-300 border-neutral-400/30' },
  };

  const roleConf = ROLE_CONFIG[role] ?? ROLE_CONFIG.viewer;

  return (
    <aside
      className={`bg-sidebar flex flex-col h-full transition-all duration-300 border-e border-sidebar-border ${
        collapsed ? 'w-[4.5rem]' : 'w-72'
      }`}
    >
      <div
        className={`flex items-center h-16 px-4 border-b border-sidebar-border shrink-0 ${
          collapsed ? 'justify-center' : 'justify-between'
        }`}
      >
        {!collapsed ? (
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-accent/20 border border-accent/30 flex items-center justify-center shrink-0">
              <Scale className="w-5 h-5 text-accent" />
            </div>
            <div className="min-w-0">
              <div className="flex items-baseline gap-1.5 leading-none mb-0.5">
                <span className="font-black text-lg tracking-[0.08em] text-sidebar-foreground">MARSAD</span>
                <span className="text-sidebar-foreground/30 text-xs">·</span>
                <span className="font-bold text-xs text-sidebar-foreground/80">مرصد</span>
              </div>
              <div className="text-sidebar-foreground/45 text-[9px] leading-tight" dir="ltr">
                Observe · Analyse · Decide
              </div>
            </div>
          </div>
        ) : (
          <div className="w-9 h-9 rounded-lg bg-accent/20 border border-accent/30 flex items-center justify-center">
            <Scale className="w-5 h-5 text-accent" />
          </div>
        )}

        <div className="flex items-center gap-1 shrink-0">
          {mobileOpen !== undefined && (
            <button
              type="button"
              onClick={() => setMobileOpen?.(false)}
              className="lg:hidden text-sidebar-foreground/40 hover:text-sidebar-foreground p-1.5 rounded"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <button
            type="button"
            onClick={() => setCollapsed(!collapsed)}
            className="hidden lg:flex text-sidebar-foreground/40 hover:text-sidebar-foreground p-1.5 rounded hover:bg-white/5 transition-colors"
          >
            {collapsed ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto py-3 space-y-4">
        {sections.map((section) => {
          const visibleItems = section.items.filter((item) => item.show);
          if (!visibleItems.length) return null;
          return (
            <div key={section.id}>
              {!collapsed && (
                <div className="px-5 pb-1.5 text-[10px] font-black uppercase tracking-widest text-sidebar-foreground/35">
                  {lang === 'ar' ? section.titleAr : section.titleEn}
                </div>
              )}
              <div className="px-2 space-y-0.5">
                {visibleItems.map((item) => {
                  const active = isActive(item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={handleLinkClick}
                      title={collapsed ? (lang === 'ar' ? item.labelAr : item.labelEn) : undefined}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-md transition-all duration-150 relative group ${
                        active ? 'nav-item-active' : 'text-sidebar-foreground/60 hover:nav-item-hover'
                      }`}
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
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <div className="p-3 border-t border-sidebar-border shrink-0">
        <div className={`flex items-center gap-3 ${collapsed ? 'justify-center' : ''}`}>
          <div className="w-8 h-8 rounded-lg bg-gold/20 border border-gold/30 flex items-center justify-center shrink-0 text-gold font-bold font-serif text-sm">
            م
          </div>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-sidebar-foreground truncate leading-tight">
                مرصد
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
