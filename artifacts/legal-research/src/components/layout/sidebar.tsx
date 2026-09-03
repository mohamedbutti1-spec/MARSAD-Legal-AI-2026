import React from 'react';
import { Link, useLocation } from 'wouter';
import {
  ChevronLeft,
  ChevronRight,
  Files,
  GraduationCap,
  History,
  Home,
  Library,
  Scale,
  Settings,
  X,
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
}

export function Sidebar({ collapsed, setCollapsed, mobileOpen, setMobileOpen }: SidebarProps) {
  const [location] = useLocation();
  const { role, lang, canManageSettings, canUseAi } = useUserContext();

  const items: NavItem[] = [
    {
      href: '/',
      labelAr: 'الرئيسية',
      labelEn: 'Home',
      icon: <Home className="w-4.5 h-4.5" />,
      show: true,
    },
    {
      href: '/previous-requests',
      labelAr: 'الطلبات السابقة',
      labelEn: 'Previous Requests',
      icon: <History className="w-4.5 h-4.5" />,
      show: canUseAi,
    },
    {
      href: '/workspace',
      labelAr: 'ملفاتي',
      labelEn: 'My Files',
      icon: <Files className="w-4.5 h-4.5" />,
      show: canUseAi,
    },
    {
      href: '/library',
      labelAr: 'مكتبتي',
      labelEn: 'My Library',
      icon: <Library className="w-4.5 h-4.5" />,
      show: true,
    },
    {
      href: '/pgf',
      labelAr: 'التدريب',
      labelEn: 'Training',
      icon: <GraduationCap className="w-4.5 h-4.5" />,
      show: canUseAi,
    },
    {
      href: '/settings',
      labelAr: 'الإعدادات',
      labelEn: 'Settings',
      icon: <Settings className="w-4.5 h-4.5" />,
      show: canManageSettings,
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
        collapsed ? 'w-[4.5rem]' : 'w-64'
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
              aria-label={lang === 'ar' ? 'إغلاق القائمة' : 'Close menu'}
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <button
            type="button"
            onClick={() => setCollapsed(!collapsed)}
            className="hidden lg:flex text-sidebar-foreground/40 hover:text-sidebar-foreground p-1.5 rounded hover:bg-white/5 transition-colors"
            aria-label={lang === 'ar' ? 'طي القائمة' : 'Collapse sidebar'}
          >
            {collapsed ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </button>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-1" aria-label={lang === 'ar' ? 'التنقل الرئيسي' : 'Main navigation'}>
        {items.filter((item) => item.show).map((item) => {
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={handleLinkClick}
              title={collapsed ? (lang === 'ar' ? item.labelAr : item.labelEn) : undefined}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-md transition-all duration-150 group ${
                active ? 'nav-item-active' : 'text-sidebar-foreground/60 hover:nav-item-hover'
              }`}
            >
              <div className={`shrink-0 ${active ? 'text-white' : 'text-sidebar-foreground/50 group-hover:text-sidebar-foreground/80'}`}>
                {item.icon}
              </div>
              {!collapsed && (
                <span className={`text-sm font-medium truncate ${active ? 'text-white' : ''}`}>
                  {lang === 'ar' ? item.labelAr : item.labelEn}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="p-3 border-t border-sidebar-border shrink-0">
        <div className={`flex items-center gap-3 ${collapsed ? 'justify-center' : ''}`}>
          <div className="w-8 h-8 rounded-lg bg-gold/20 border border-gold/30 flex items-center justify-center shrink-0 text-gold font-bold font-serif text-sm">
            م
          </div>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-sidebar-foreground truncate leading-tight">مرصد</div>
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
