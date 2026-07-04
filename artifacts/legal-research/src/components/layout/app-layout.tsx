import React, { useState, useEffect } from 'react';
import { Sidebar } from './sidebar';
import { Header } from './header';
import { useUserContext } from '@/lib/user-context';

interface AppLayoutProps {
  children: React.ReactNode;
  /**
   * "default" (default): children are wrapped in a padded, scrollable, max-width container.
   * "chat": children fill the remaining height directly with no padding or scroll wrapper —
   *          use this for full-height chat / canvas pages that manage their own scrolling.
   */
  variant?: 'default' | 'chat';
}

/** True only in the Replit/dev environment — signals that role-switching is demo scaffolding. */
const IS_DEMO_MODE = import.meta.env.DEV || import.meta.env.MODE === 'development';

export function AppLayout({ children, variant = 'default' }: AppLayoutProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { dir } = useUserContext();

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobileOpen(false);
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, []);

  return (
    <div className="flex h-[100dvh] w-full overflow-hidden bg-background" dir={dir}>
      {/* Desktop sidebar */}
      <div className="hidden lg:flex shrink-0">
        <Sidebar collapsed={collapsed} setCollapsed={setCollapsed} />
      </div>

      {/* Mobile sidebar backdrop */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile sidebar — slides in from the start edge */}
      <div
        className={`lg:hidden fixed inset-y-0 start-0 z-50 transition-transform duration-300 ${
          mobileOpen ? 'translate-x-0' : dir === 'rtl' ? 'translate-x-full' : '-translate-x-full'
        }`}
      >
        <Sidebar
          collapsed={false}
          setCollapsed={() => {}}
          mobileOpen={mobileOpen}
          setMobileOpen={setMobileOpen}
        />
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* P0-1: Demo mode banner — role selector is scaffolding only, not production auth */}
        {IS_DEMO_MODE && (
          <div
            className="shrink-0 bg-amber-500 text-white text-[11px] font-semibold text-center py-1 px-4 flex items-center justify-center gap-2"
            role="banner"
            aria-label="Demo mode notice"
            dir="ltr"
          >
            <span>⚠️</span>
            <span>DEMO MODE — Role selection is scaffolding only. Production deployment requires UAE Pass or enterprise SSO.</span>
            <span>⚠️</span>
          </div>
        )}
        <Header onMenuClick={() => setMobileOpen(true)} />

        {variant === 'chat' ? (
          /* Chat variant — no padding, fills remaining height, page owns scrolling */
          <div className="flex-1 overflow-hidden flex flex-col">
            {children}
          </div>
        ) : (
          /* Default variant — padded, scrollable container */
          <main className="flex-1 overflow-y-auto">
            <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full">
              {children}
            </div>
            {/* Platform footer */}
            <footer className="border-t border-border/40 px-4 sm:px-6 lg:px-8 py-3">
              <p className="text-[10px] text-muted-foreground/40 text-center tracking-wide select-none" dir="ltr">
                مرصد (MARSAD) · منصة القرارات الإدارية الذكية · إطار الشامسي الدستوري™ Alpha 1.0
              </p>
            </footer>
          </main>
        )}
      </div>
    </div>
  );
}
