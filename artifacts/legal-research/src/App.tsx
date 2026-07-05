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
import AdminOsCompliance  from '@/pages/admin-os-compliance';

// Legal Sources
import UaeLegislation     from '@/pages/uae-legislation';
import UaeCaseLaw         from '@/pages/uae-caselaw';
import FranceLaw          from '@/pages/france-law';
import EuLaw              from '@/pages/eu-law';

// Productivity
import Citations          from '@/pages/citations';
import DocumentComparison from '@/pages/document-comparison';
import PersonalLibrary    from '@/pages/personal-library';

// Theory & Governance
import ShamsiTheory              from '@/pages/shamsi-theory';
import ConstitutionalPrinciples  from '@/pages/constitutional-principles';
// Module 1 — Intelligent Administrative Decision
import Decisions                 from '@/pages/decisions';
import DecisionWorkspace         from '@/pages/decision-workspace';
import GovernanceHub             from '@/pages/governance-hub';
import CitizenPortal             from '@/pages/citizen-portal';
// NRME — National Risk Modeling Engine
import RiskEngine                from '@/pages/risk-engine';
// Phase 42 — Constitutional Intelligence Layer (CIL)
import ConstitutionalIntelligence from '@/pages/constitutional-intelligence';
// Phase 44 — Judicial Digital Twin (JDT)
import JdtPage from '@/pages/jdt';

// NAIP — Role-Specific Executive Dashboards
import NaipMinister        from '@/pages/naip-minister';
import NaipUndersecretary  from '@/pages/naip-undersecretary';
import NaipDirectorGeneral from '@/pages/naip-director-general';
import NaipRiskOfficer     from '@/pages/naip-risk-officer';
import NaipJudge           from '@/pages/naip-judge';

// Phase 43 — NAIP (National Administrative Intelligence Platform)
import NaipHome      from '@/pages/naip-home';
import NaipDashboard from '@/pages/naip-dashboard';
import NaipKpi       from '@/pages/naip-kpi';
import NaipSearch    from '@/pages/naip-search';

// Admin
import UserManagement     from '@/pages/user-management';
import Settings           from '@/pages/settings';
import AdminLegalOS       from '@/pages/admin-legal-os';

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
        <Route path="/shamsi-theory"             component={ShamsiTheory} />
        <Route path="/constitutional-principles" component={ConstitutionalPrinciples} />

        {/* ── Phase 2 — Executive Governance Hub ───────────────────── */}
        {/* Governance requires canViewGovernanceDashboard — enforced inside GovernanceHub */}
        <Route path="/governance" component={GovernanceHub} />
        <Route path="/citizen"    component={CitizenPortal} />

        {/* ── NRME — National Risk Modeling Engine ─────────────────── */}
        <Route path="/risk-engine" component={RiskEngine} />

        {/* ── Phase 42 — Constitutional Intelligence Layer (CIL) ────── */}
        <Route path="/constitutional-intelligence" component={ConstitutionalIntelligence} />

        {/* ── Phase 44 — Judicial Digital Twin (JDT) ───────────────── */}
        <Route path="/jdt/:id" component={JdtPage} />

        {/* ── NAIP — Role-Specific Executive Dashboards ─────────────── */}
        <Route path="/naip/minister"        component={NaipMinister} />
        <Route path="/naip/undersecretary"  component={NaipUndersecretary} />
        <Route path="/naip/director-general" component={NaipDirectorGeneral} />
        <Route path="/naip/risk-officer"    component={NaipRiskOfficer} />
        <Route path="/naip/judge"           component={NaipJudge} />

        {/* ── Phase 43 — NAIP (National Administrative Intelligence Platform) ── */}
        <Route path="/naip"           component={NaipHome} />
        <Route path="/naip/dashboard" component={NaipDashboard} />
        <Route path="/naip/kpi"       component={NaipKpi} />
        <Route path="/naip/search"    component={NaipSearch} />

        {/* ── Module 1 — Intelligent Administrative Decision ───────── */}
        <Route path="/decisions/new">
          <RouteGuard allow={canUseAi}>
            <DecisionWorkspace />
          </RouteGuard>
        </Route>
        <Route path="/decisions/:id">
          <RouteGuard allow={canUseAi}>
            <DecisionWorkspace />
          </RouteGuard>
        </Route>
        <Route path="/decisions">
          <RouteGuard allow={canUseAi}>
            <Decisions />
          </RouteGuard>
        </Route>

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
        <Route path="/admin-os/compliance">
          <RouteGuard allow={canUseAi}>
            <AdminOsCompliance />
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
        <Route path="/admin/legal-os">
          <RouteGuard allow={canManageUsers}>
            <AdminLegalOS />
          </RouteGuard>
        </Route>
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
