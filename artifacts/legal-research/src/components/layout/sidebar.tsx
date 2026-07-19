import React from 'react';
import { Link, useLocation } from 'wouter';
import {
  LayoutDashboard,
  LayoutGrid,
  MessagesSquare,
  FolderOpen,
  FileText,
  BarChart3,
  Star,
  History,
  Bell,
  Settings,
  LifeBuoy,
  Info,
  LogOut,
  ChevronLeft,
  ChevronRight,
  X,
  Scale,
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

const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');

async function apiLogout() {
  await fetch(`${BASE}/api/auth/logout`, {
    method: 'POST',
    credentials: 'include',
  });
  window.location.href = BASE + '/';
}

// ─── القائمة الجانبية — الهيكل المعتمد (MLOS Legal AI) ────────────────────────
// قائمة مسطحة واحدة: الرئيسية، الخدمات، المحادثات، مشاريعي، ملفاتي، تقاريري،
// المفضلة، آخر أعمالي، الإشعارات، الإعدادات، المساعدة، عن مرصد، تسجيل الخروج.
// كل عنصر يشير إلى وحدة قائمة فعلاً — الصلاحيات كما هي بلا أي تغيير.

export function Sidebar({ collapsed, setCollapsed, mobileOpen, setMobileOpen }: SidebarProps) {
  const [location] = useLocation();
  const { role, lang, canUseAi, canManageSettings, canViewAudit, refreshSession } = useUserContext();

  const items: NavItem[] = [
    { href: '/',              labelAr: 'الرئيسية',    labelEn: 'Home',           icon: <LayoutDashboard className="w-4.5 h-4.5" />, show: true },
    { href: '/services',      labelAr: 'الخدمات',     labelEn: 'Services',       icon: <LayoutGrid className="w-4.5 h-4.5" />,      show: true },
    { href: '/assistant',     labelAr: 'المحادثات',   labelEn: 'Conversations',  icon: <MessagesSquare className="w-4.5 h-4.5" />,  show: canUseAi },
    { href: '/workspace',     labelAr: 'مشاريعي',     labelEn: 'My Projects',    icon: <FolderOpen className="w-4.5 h-4.5" />,      show: canUseAi },
    { href: '/documents',     labelAr: 'ملفاتي',      labelEn: 'My Files',       icon: <FileText className="w-4.5 h-4.5" />,        show: canUseAi },
    { href: '/analytics',     labelAr: 'تقاريري',     labelEn: 'My Reports',     icon: <BarChart3 className="w-4.5 h-4.5" />,       show: canUseAi },
    { href: '/library',       labelAr: 'المفضلة',     labelEn: 'Favorites',      icon: <Star className="w-4.5 h-4.5" />,            show: true },
    { href: '/audit',         labelAr: 'آخر أعمالي',  labelEn: 'Recent Activity',icon: <History className="w-4.5 h-4.5" />,         show: canViewAudit },
    { href: '/notifications', labelAr: 'الإشعارات',   labelEn: 'Notifications',  icon: <Bell className="w-4.5 h-4.5" />,            show: true },
    { href: '/settings',      labelAr: 'الإعدادات',   labelEn: 'Settings',       icon: <Settings className="w-4.5 h-4.5" />,        show: canManageSettings },
    { href: '/help',          labelAr: 'المساعدة',    labelEn: 'Help',           icon: <LifeBuoy className="w-4.5 h-4.5" />,        show: true },
    { href: '/about',         labelAr: 'عن مرصد',     labelEn: 'About Marsad',   icon: <Info className="w-4.5 h-4.5" />,            show: true },
  ];

  const isActive = (href: string) => {
    if (href === '/') return location === '/';
    return location.startsWith(href);
  };

  const handleLinkClick = () => {
    if (setMobileOpen) setMobileOpen(false);
  };

  const handleLogout = async () => {
    if (setMobileOpen) setMobileOpen(false);
    await apiLogout();
    await refreshSession();
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
                MLOS — Legal AI
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
      <div className="flex-1 overflow-y-auto py-3">
        <div className="px-2 space-y-0.5">
          {items.filter((i) => i.show).map((item) => {
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
                <div className={`shrink-0 ${active ? 'text-white' : 'text-sidebar-foreground/50 group-hover:text-sidebar-foreground/80'}`}>
                  {item.icon}
                </div>
                {!collapsed && (
                  <span className={`text-sm font-medium truncate ${active ? 'text-white' : ''}`}>
                    {lang === 'ar' ? item.labelAr : item.labelEn}
                  </span>
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

          {/* ─── تسجيل الخروج ─────────────────────────────────────────── */}
          <button
            type="button"
            onClick={handleLogout}
            title={collapsed ? (lang === 'ar' ? 'تسجيل الخروج' : 'Sign out') : undefined}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md transition-all duration-150 relative group text-destructive/80 hover:text-destructive hover:bg-destructive/10"
          >
            <div className="shrink-0">
              <LogOut className="w-4.5 h-4.5" />
            </div>
            {!collapsed && (
              <span className="text-sm font-medium truncate">
                {lang === 'ar' ? 'تسجيل الخروج' : 'Sign out'}
              </span>
            )}
            {collapsed && (
              <div className="absolute start-full ms-2 px-2 py-1 bg-sidebar-primary text-sidebar-primary-foreground text-xs rounded whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50 shadow-lg border border-sidebar-border">
                {lang === 'ar' ? 'تسجيل الخروج' : 'Sign out'}
              </div>
            )}
          </button>
        </div>
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
