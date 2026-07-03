import React from 'react';
import { Link, useLocation } from 'wouter';
import {
  Library,
  Upload,
  BrainCircuit,
  BookOpenText,
  Scale,
  TableProperties,
  Quote,
  Users,
  Settings,
  ChevronLeft,
  ChevronRight,
  ShieldAlert,
  BarChart2,
  Activity,
  X,
} from 'lucide-react';
import { useUserContext } from '@/lib/user-context';

interface SidebarProps {
  collapsed: boolean;
  setCollapsed: (c: boolean) => void;
  mobileOpen?: boolean;
  setMobileOpen?: (o: boolean) => void;
}

export function Sidebar({ collapsed, setCollapsed, mobileOpen, setMobileOpen }: SidebarProps) {
  const [location] = useLocation();
  const { role, canManageUsers, canManageSettings, canUpload, canUseAi } = useUserContext();

  const links = [
    { href: '/', label: 'Dashboard / الرئيسية', icon: <Library className="w-5 h-5" />, show: true },
    { href: '/documents', label: 'Library / المكتبة', icon: <BookOpenText className="w-5 h-5" />, show: true },
    { href: '/upload', label: 'Upload / رفع ملف', icon: <Upload className="w-5 h-5" />, show: canUpload },
    { href: '/ai-search', label: 'AI Search / بحث ذكي', icon: <BrainCircuit className="w-5 h-5" />, show: canUseAi },
    { href: '/literature-review', label: 'Literature Review / مراجعة أدبيات', icon: <Quote className="w-5 h-5" />, show: canUseAi },
    { href: '/uae-france', label: 'UAE-France / مقارنة قانونية', icon: <Scale className="w-5 h-5" />, show: canUseAi },
    { href: '/comparisons', label: 'Comparisons / جداول مقارنة', icon: <TableProperties className="w-5 h-5" />, show: true },
    { href: '/citations', label: 'Citations / التوثيق', icon: <Quote className="w-5 h-5" />, show: true },
    { href: '/analytics', label: 'Analytics / المؤشرات', icon: <BarChart2 className="w-5 h-5" />, show: true },
    { href: '/audit', label: 'Audit Log / سجل العمليات', icon: <Activity className="w-5 h-5" />, show: canManageUsers || role === 'supervisor' },
    { href: '/users', label: 'Users / المستخدمين', icon: <Users className="w-5 h-5" />, show: canManageUsers },
    { href: '/settings', label: 'Settings / الإعدادات', icon: <Settings className="w-5 h-5" />, show: canManageSettings },
  ];

  const handleLinkClick = () => {
    if (setMobileOpen) setMobileOpen(false);
  };

  const sidebarContent = (
    <aside
      className={`bg-sidebar border-r border-sidebar-border flex flex-col justify-between h-full transition-all duration-300 ${
        collapsed ? 'w-16' : 'w-72'
      }`}
    >
      <div className="overflow-y-auto">
        <div
          className={`p-4 h-16 flex items-center ${
            collapsed ? 'justify-center' : 'justify-between'
          } border-b border-sidebar-border shrink-0`}
        >
          {!collapsed && (
            <div className="flex flex-col min-w-0">
              <span className="font-serif font-bold text-sidebar-foreground text-base truncate">
                منصة البحث القانوني
              </span>
              <span className="text-sidebar-foreground/60 text-[9px] tracking-widest uppercase mt-0.5">
                Legal Research Platform
              </span>
            </div>
          )}
          <div className="flex items-center gap-1 shrink-0">
            {mobileOpen !== undefined && (
              <button
                onClick={() => setMobileOpen?.(false)}
                className="lg:hidden text-sidebar-foreground/50 hover:text-sidebar-foreground p-1 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            )}
            <button
              onClick={() => setCollapsed(!collapsed)}
              className="hidden lg:block text-sidebar-foreground/50 hover:text-sidebar-foreground p-1 rounded hover:bg-sidebar-accent transition-colors"
            >
              {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
            </button>
          </div>
        </div>

        <nav className="p-2 space-y-0.5 mt-2">
          {links
            .filter((l) => l.show)
            .map((link) => {
              const active = location === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={handleLinkClick}
                  className={`
                    flex items-center gap-3 px-3 py-2.5 rounded-md transition-colors
                    ${
                      active
                        ? 'bg-sidebar-accent text-sidebar-accent-foreground shadow-sm'
                        : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground'
                    }
                  `}
                >
                  <div className="shrink-0">{link.icon}</div>
                  {!collapsed && (
                    <span className="font-medium text-sm truncate">{link.label}</span>
                  )}
                </Link>
              );
            })}
        </nav>
      </div>

      {/* User info at bottom */}
      <div
        className={`p-4 border-t border-sidebar-border shrink-0 ${collapsed ? 'text-center' : ''}`}
      >
        {!collapsed && (
          <div className="mb-2 flex items-center gap-2 text-xs text-sidebar-foreground/50 font-semibold uppercase tracking-wider">
            <ShieldAlert className="w-3.5 h-3.5" /> Workspace Role
          </div>
        )}
        <div className={`flex items-center gap-3 ${collapsed ? 'justify-center' : ''}`}>
          <div className="w-8 h-8 rounded bg-primary/30 text-primary-foreground flex items-center justify-center shrink-0 text-sm font-bold font-serif">
            م
          </div>
          {!collapsed && (
            <div className="flex flex-col overflow-hidden">
              <span className="text-sm font-semibold text-sidebar-foreground truncate">
                محمد الشامسي
              </span>
              <span className="text-xs text-sidebar-foreground/60 capitalize">{role}</span>
            </div>
          )}
        </div>
      </div>
    </aside>
  );

  return sidebarContent;
}
