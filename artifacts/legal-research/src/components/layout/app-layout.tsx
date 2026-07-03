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
          </main>
        )}
      </div>
    </div>
  );
}
