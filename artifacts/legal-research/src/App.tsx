import React from 'react';
import { Route, Switch, Router as WouterRouter } from 'wouter';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { UserProvider, useUserContext } from '@/lib/user-context';
import { ErrorBoundary } from '@/components/ui/error-boundary';
import { RouteGuard } from '@/components/ui/route-guard';

// ─── Pages ────────────────────────────────────────────────────────────────────
import NotFound           from '@/pages/not-found';
import Dashboard          from '@/pages/dashboard';

// Research Tools
import LegalResearch      from '@/pages/legal-research';
import AiAssistant        from '@/pages/ai-assistant';
import LiteratureReview   from '@/pages/literature-review';
import LegalOs            from '@/pages/legal-os';
import AdminOs            from '@/pages/admin-os';

// Legal Sources
import UaeLegislation     from '@/pages/uae-legislation';
import UaeCaseLaw         from '@/pages/uae-caselaw';
import FranceLaw          from '@/pages/france-law';
import EuLaw              from '@/pages/eu-law';

// Productivity
import Citations          from '@/pages/citations';
import DocumentComparison from '@/pages/document-comparison';
import PersonalLibrary    from '@/pages/personal-library';

// Admin
import UserManagement     from '@/pages/user-management';
import Settings           from '@/pages/settings';

// Legacy route aliases (keep old URLs working)
import AiSearch           from '@/pages/ai-search';
import UaeFrance          from '@/pages/uae-france';
import Comparisons        from '@/pages/comparisons';
import Documents          from '@/pages/documents';
import UploadPage         from '@/pages/upload';
import Analytics          from '@/pages/analytics';
import AuditLog           from '@/pages/audit-log';
import Users              from '@/pages/users';

// ─── Query Client ─────────────────────────────────────────────────────────────
const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1 },
  },
});

// ─── Router (needs to be inside UserProvider) ─────────────────────────────────
function Router() {
  const {
    canUseAi,
    canManageUsers,
    canManageSettings,
    canViewAudit,
    canUpload,
  } = useUserContext();

  return (
    <ErrorBoundary>
      <Switch>
        {/* ── Main ─────────────────────────────────────────────────── */}
        <Route path="/" component={Dashboard} />

        {/* ── Research Tools (requires canUseAi) ───────────────────── */}
        <Route path="/research">
          <RouteGuard allow={canUseAi}>
            <LegalResearch />
          </RouteGuard>
        </Route>
        <Route path="/assistant">
          <RouteGuard allow={canUseAi}>
            <AiAssistant />
          </RouteGuard>
        </Route>
        <Route path="/literature-review">
          <RouteGuard allow={canUseAi}>
            <LiteratureReview />
          </RouteGuard>
        </Route>
        <Route path="/admin-os">
          <RouteGuard allow={canUseAi}>
            <AdminOs />
          </RouteGuard>
        </Route>
        <Route path="/legal-os">
          <RouteGuard allow={canUseAi}>
            <LegalOs />
          </RouteGuard>
        </Route>

        {/* ── Legal Sources (open to all roles) ────────────────────── */}
        <Route path="/legislation/uae" component={UaeLegislation} />
        <Route path="/caselaw/uae"     component={UaeCaseLaw} />
        <Route path="/law/france"      component={FranceLaw} />
        <Route path="/law/eu"          component={EuLaw} />

        {/* ── Productivity (open to all roles) ─────────────────────── */}
        <Route path="/citations"  component={Citations} />
        <Route path="/comparison" component={DocumentComparison} />
        <Route path="/library"    component={PersonalLibrary} />

        {/* ── Administration (owner-only) ───────────────────────────── */}
        <Route path="/admin/users">
          <RouteGuard allow={canManageUsers}>
            <UserManagement />
          </RouteGuard>
        </Route>
        <Route path="/settings">
          <RouteGuard allow={canManageSettings}>
            <Settings />
          </RouteGuard>
        </Route>

        {/* ── Legacy aliases ────────────────────────────────────────── */}
        <Route path="/ai-search">
          <RouteGuard allow={canUseAi}>
            <AiSearch />
          </RouteGuard>
        </Route>
        <Route path="/uae-france">
          <RouteGuard allow={canUseAi}>
            <UaeFrance />
          </RouteGuard>
        </Route>
        <Route path="/upload">
          <RouteGuard allow={canUpload}>
            <UploadPage />
          </RouteGuard>
        </Route>
        <Route path="/audit">
          <RouteGuard allow={canViewAudit}>
            <AuditLog />
          </RouteGuard>
        </Route>
        <Route path="/users">
          <RouteGuard allow={canManageUsers}>
            <Users />
          </RouteGuard>
        </Route>
        <Route path="/comparisons" component={Comparisons} />
        <Route path="/documents"   component={Documents} />
        <Route path="/analytics"   component={Analytics} />

        <Route component={NotFound} />
      </Switch>
    </ErrorBoundary>
  );
}

// ─── App ──────────────────────────────────────────────────────────────────────
function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <UserProvider>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
            <Router />
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </UserProvider>
    </QueryClientProvider>
  );
}

export default App;
