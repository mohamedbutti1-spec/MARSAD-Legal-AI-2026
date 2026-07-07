import React from 'react';
import { Route, Switch, Router as WouterRouter, Redirect } from 'wouter';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { UserProvider, useUserContext } from '@/lib/user-context';
import { ErrorBoundary } from '@/components/ui/error-boundary';
import { RouteGuard } from '@/components/ui/route-guard';
import Login from '@/pages/login';
import { BetaFeedbackWidget } from '@/components/beta/FeedbackWidget';

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

// Phase 57 — Legal Research Workspace
import WorkspaceDashboard from '@/pages/workspace-dashboard';
import WorkspaceProject   from '@/pages/workspace-project';
import WorkspaceItem      from '@/pages/workspace-item';
// Phase 58 — Administrative Decision Knowledge Graph
import AdkgDashboard from '@/pages/adkg-dashboard';
import AdkgDetail    from '@/pages/adkg-detail';
// Phase 59 — KB Cross-Reference Search
import KbSearch from '@/pages/kb-search';
// JRE — Judicial Reasoning Engine
import JrePage    from '@/pages/jre';
import JreSession from '@/pages/jre-session';
// Phase 59 — Judicial Deliberation Chamber
import JdcPage    from '@/pages/jdc';
import JdcChamber from '@/pages/jdc-chamber';
// SPG — Smart Professional Guidance
import SpgPage    from '@/pages/spg';
import SpgSession from '@/pages/spg-session';
// PGF — Professional Guidance Framework
import PgfPage    from '@/pages/pgf';
import PgfSession from '@/pages/pgf-session';

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
    canCreateDecision,
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
          <RouteGuard allow={canCreateDecision}>
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

        {/* ── Phase 58 — ADKG (requires canUseAi) ─────────────────── */}
        <Route path="/adkg/:id">
          <RouteGuard allow={canUseAi}>
            <AdkgDetail />
          </RouteGuard>
        </Route>
        <Route path="/adkg">
          <RouteGuard allow={canUseAi}>
            <AdkgDashboard />
          </RouteGuard>
        </Route>

        {/* ── Phase 57 — Research Workspace (requires canUseAi) ────── */}
        <Route path="/workspace/:projectId/items/:itemId">
          <RouteGuard allow={canUseAi}>
            <WorkspaceItem />
          </RouteGuard>
        </Route>
        <Route path="/workspace/:projectId">
          <RouteGuard allow={canUseAi}>
            <WorkspaceProject />
          </RouteGuard>
        </Route>
        <Route path="/workspace">
          <RouteGuard allow={canUseAi}>
            <WorkspaceDashboard />
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
        <Route path="/comparisons">
          <RouteGuard allow={canUseAi}><Comparisons /></RouteGuard>
        </Route>
        <Route path="/documents">
          <RouteGuard allow={canUseAi}><Documents /></RouteGuard>
        </Route>
        <Route path="/analytics">
          <RouteGuard allow={canUseAi}><Analytics /></RouteGuard>
        </Route>
        {/* Phase 59 — KB Cross-Reference Search */}
        <Route path="/kb-search">
          <RouteGuard allow={canUseAi}><KbSearch /></RouteGuard>
        </Route>
        {/* JRE — Judicial Reasoning Engine */}
        <Route path="/jre/:id">
          <RouteGuard allow={canUseAi}>
            <JreSession />
          </RouteGuard>
        </Route>
        <Route path="/jre">
          <RouteGuard allow={canUseAi}>
            <JrePage />
          </RouteGuard>
        </Route>
        {/* Phase 59 — Judicial Deliberation Chamber */}
        <Route path="/jdc/:id">
          <RouteGuard allow={canUseAi}>
            <JdcChamber />
          </RouteGuard>
        </Route>
        <Route path="/jdc">
          <RouteGuard allow={canUseAi}>
            <JdcPage />
          </RouteGuard>
        </Route>

        {/* SPG — Smart Professional Guidance */}
        <Route path="/spg/:id">
          <RouteGuard allow={canUseAi}>
            <SpgSession />
          </RouteGuard>
        </Route>
        <Route path="/spg">
          <RouteGuard allow={canUseAi}>
            <SpgPage />
          </RouteGuard>
        </Route>

        {/* PGF — Professional Guidance Framework */}
        <Route path="/pgf/:id">
          <RouteGuard allow={canUseAi}>
            <PgfSession />
          </RouteGuard>
        </Route>
        <Route path="/pgf">
          <RouteGuard allow={canUseAi}>
            <PgfPage />
          </RouteGuard>
        </Route>

        <Route component={NotFound} />
      </Switch>
    </ErrorBoundary>
  );
}

// ─── AuthGate ─────────────────────────────────────────────────────────────────
// Blocks the entire app until a valid JWT session is confirmed.
// Unauthenticated users see the login page; authenticated users see the app.
function AuthGate({ children }: { children: React.ReactNode }) {
  const { isLoaded, isAuthenticated } = useUserContext();

  // Still verifying the session cookie — show nothing to avoid flash
  if (!isLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-2 border-amber-500/30 border-t-amber-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Login />;
  }

  return <>{children}</>;
}

// ─── App ──────────────────────────────────────────────────────────────────────
function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <UserProvider>
        <TooltipProvider>
          <AuthGate>
            <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
              <Router />
            </WouterRouter>
            <BetaFeedbackWidget />
          </AuthGate>
          <Toaster />
        </TooltipProvider>
      </UserProvider>
    </QueryClientProvider>
  );
}

export default App;
