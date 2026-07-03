import React, { useState } from 'react';
import { Link, useLocation } from 'wouter';
import {
  LayoutDashboard,
  Search,
  Bot,
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
  const { role, lang, canManageUsers, canManageSettings, canUseAi, canViewAudit } = useUserContext();
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());

  const toggleSection = (id: string) => {
    setCollapsedSections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const sections: NavSection[] = [
    {
      id: 'main',
      titleAr: 'الرئيسية',
      titleEn: 'Main',
      items: [
        {
          href: '/',
          labelAr: 'لوحة القيادة',
          labelEn: 'Dashboard',
          icon: <LayoutDashboard className="w-4.5 h-4.5" />,
          show: true,
        },
      ],
    },
    {
      id: 'research',
      titleAr: 'أدوات البحث',
      titleEn: 'Research Tools',
      items: [
        {
          href: '/research',
          labelAr: 'البحث القانوني',
          labelEn: 'Legal Research',
          icon: <Search className="w-4.5 h-4.5" />,
          show: canUseAi,
        },
        {
          href: '/assistant',
          labelAr: 'المساعد الذكي',
          labelEn: 'AI Assistant',
          icon: <Bot className="w-4.5 h-4.5" />,
          show: canUseAi,
        },
        {
          href: '/literature-review',
          labelAr: 'مراجعة الأدبيات',
          labelEn: 'Literature Review',
          icon: <BookOpenText className="w-4.5 h-4.5" />,
          show: canUseAi,
        },
      ],
    },
    {
      id: 'sources',
      titleAr: 'المصادر القانونية',
      titleEn: 'Legal Sources',
      items: [
        {
          href: '/legislation/uae',
          labelAr: 'التشريعات الإماراتية',
          labelEn: 'UAE Legislation',
          icon: <ScrollText className="w-4.5 h-4.5" />,
          show: true,
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
      ],
    },
    {
      id: 'productivity',
      titleAr: 'أدوات الإنتاجية',
      titleEn: 'Productivity',
      items: [
        {
          href: '/citations',
          labelAr: 'مولّد الاستشهادات',
          labelEn: 'Citation Generator',
          icon: <Quote className="w-4.5 h-4.5" />,
          show: true,
        },
        {
          href: '/comparison',
          labelAr: 'مقارنة الوثائق',
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
    {
      id: 'admin',
      titleAr: 'الإدارة',
      titleEn: 'Administration',
      items: [
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
      ],
    },
  ];

  const isActive = (href: string) =>
    href === '/' ? location === '/' : location.startsWith(href);

  const handleLinkClick = () => {
    if (setMobileOpen) setMobileOpen(false);
  };

  const ROLE_CONFIG: Record<string, { labelAr: string; labelEn: string; color: string }> = {
    owner: { labelAr: 'مالك', labelEn: 'Owner', color: 'bg-amber-400/20 text-amber-300 border-amber-400/30' },
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
            <div className="w-9 h-9 rounded-lg bg-gold/20 border border-gold/30 flex items-center justify-center shrink-0">
              <Scale className="w-5 h-5 text-gold" />
            </div>
            <div className="min-w-0">
              <div className="font-bold text-sidebar-foreground text-base leading-tight">
                مرصد
              </div>
              <div className="text-sidebar-foreground/45 text-[10px] tracking-widest uppercase font-medium leading-tight">
                Marsad · منصة قانونية
              </div>
            </div>
          </div>
        )}

        {collapsed && (
          <div className="w-9 h-9 rounded-lg bg-gold/20 border border-gold/30 flex items-center justify-center">
            <Scale className="w-5 h-5 text-gold" />
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
                  className="w-full flex items-center justify-between px-4 py-1.5 text-[10px] font-bold uppercase tracking-widest text-sidebar-foreground/35 hover:text-sidebar-foreground/55 transition-colors"
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
                    const active = isActive(item.href);
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
                        <div className={`shrink-0 ${active ? 'text-gold' : 'text-sidebar-foreground/50 group-hover:text-sidebar-foreground/80'}`}>
                          {item.icon}
                        </div>
                        {!collapsed && (
                          <div className="flex-1 min-w-0 flex items-center justify-between">
                            <span className={`text-sm font-medium truncate ${active ? 'text-gold' : ''}`}>
                              {lang === 'ar' ? item.labelAr : item.labelEn}
                            </span>
                            {item.badge && (
                              <span className="text-[10px] bg-gold/20 text-gold px-1.5 py-0.5 rounded-full font-bold leading-none">
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
