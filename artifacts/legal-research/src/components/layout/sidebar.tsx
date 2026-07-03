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
  ShieldAlert
} from 'lucide-react';
import { useUserContext } from '@/lib/user-context';

export function Sidebar({ collapsed, setCollapsed }: { collapsed: boolean, setCollapsed: (c: boolean) => void }) {
  const [location] = useLocation();
  const { role, canManageUsers, canManageSettings, canUpload, canUseAi } = useUserContext();

  const links = [
    { href: '/', label: 'Dashboard / الرئيسية', icon: <Library className="w-5 h-5" />, show: true },
    { href: '/documents', label: 'Library / المكتبة', icon: <BookOpenText className="w-5 h-5" />, show: true },
    { href: '/upload', label: 'Upload / رفع ملف', icon: <Upload className="w-5 h-5" />, show: canUpload },
    { href: '/ai-search', label: 'AI Search / بحث ذكي', icon: <BrainCircuit className="w-5 h-5" />, show: canUseAi },
    { href: '/literature-review', label: 'Literature Review / مراجعة أدبيات', icon: <Quote className="w-5 h-5" />, show: canUseAi },
    { href: '/uae-france', label: 'UAE-France / مقارنة إماراتية-فرنسية', icon: <Scale className="w-5 h-5" />, show: canUseAi },
    { href: '/comparisons', label: 'Comparisons / جداول مقارنة', icon: <TableProperties className="w-5 h-5" />, show: true },
    { href: '/citations', label: 'Citations / التوثيق', icon: <Quote className="w-5 h-5" />, show: true },
    { href: '/users', label: 'Users / المستخدمين', icon: <Users className="w-5 h-5" />, show: canManageUsers },
    { href: '/settings', label: 'Settings / الإعدادات', icon: <Settings className="w-5 h-5" />, show: canManageSettings },
  ];

  return (
    <aside 
      className={`bg-sidebar border-r border-sidebar-border transition-all duration-300 flex flex-col justify-between ${
        collapsed ? 'w-20' : 'w-72'
      }`}
    >
      <div>
        <div className={`p-4 h-16 flex items-center ${collapsed ? 'justify-center' : 'justify-between'} border-b border-sidebar-border`}>
          {!collapsed && (
            <div className="flex flex-col">
              <span className="font-serif font-bold text-sidebar-foreground text-lg truncate">منصة البحث القانوني</span>
              <span className="text-sidebar-foreground/70 text-[10px] tracking-widest uppercase mt-0.5">Legal Research Platform</span>
            </div>
          )}
          <button 
            onClick={() => setCollapsed(!collapsed)}
            className="text-sidebar-foreground/50 hover:text-sidebar-foreground p-1 rounded hover:bg-sidebar-accent transition-colors"
          >
            {collapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
          </button>
        </div>

        <nav className="p-3 space-y-1 mt-4">
          {links.filter(l => l.show).map(link => {
            const active = location === link.href;
            return (
              <Link key={link.href} href={link.href} className={`
                flex items-center gap-3 px-3 py-2.5 rounded-md transition-colors
                ${active 
                  ? 'bg-sidebar-accent text-sidebar-accent-foreground shadow-sm' 
                  : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground'}
              `}>
                <div className="shrink-0">{link.icon}</div>
                {!collapsed && <span className="font-medium text-sm truncate">{link.label}</span>}
              </Link>
            )
          })}
        </nav>
      </div>

      <div className={`p-4 border-t border-sidebar-border ${collapsed ? 'text-center' : ''}`}>
        {!collapsed && (
          <div className="mb-2 flex items-center gap-2 text-xs text-sidebar-foreground/50 font-semibold uppercase tracking-wider">
            <ShieldAlert className="w-3.5 h-3.5" /> Workspace Role
          </div>
        )}
        <div className={`flex items-center gap-3 ${collapsed ? 'justify-center' : ''}`}>
          <div className="w-8 h-8 rounded bg-primary/30 text-primary-foreground flex items-center justify-center shrink-0 text-sm font-bold font-serif">
            M
          </div>
          {!collapsed && (
            <div className="flex flex-col overflow-hidden">
              <span className="text-sm font-semibold text-sidebar-foreground truncate">Mohamed Al Shamsi</span>
              <span className="text-xs text-sidebar-foreground/60 capitalize truncate">{role}</span>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
