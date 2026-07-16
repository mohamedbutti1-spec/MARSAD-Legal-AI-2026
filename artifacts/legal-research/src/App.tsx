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
import NotFound from '@/pages/not-found';
import JourneyHome from '@/pages/journey-home';
const LegalSearchHub = React.lazy(() => import('@/pages/legal-search-hub'));

// رحلة مرصد الموجهة (قوالب المرفق ١ — الشاشات ٢ إلى ٨)
const MarsadServicesPage = React.lazy(() =>
  import('@/pages/journey-home').then((m) => ({ default: m.MarsadServicesPage })),
);
const JourneyCategory      = React.lazy(() => import('@/pages/journey-category'));
const JourneyServices      = React.lazy(() => import('@/pages/journey-services'));
const JourneyServiceDetail = React.lazy(() => import('@/pages/journey-service-detail'));
const JourneyIncident      = React.lazy(() => import('@/pages/journey-incident'));
const JourneyCase          = React.lazy(() => import('@/pages/journey-case'));
const JourneyResult        = React.lazy(() => import('@/pages/journey-result'));
const NafePage             = React.lazy(() => import('@/pages/nafe'));
const CommunityPage        = React.lazy(() => import('@/pages/community'));

// Research Tools
const LegalResearch = React.lazy(() => import('@/pages/legal-research'));
const AiAssistant = React.lazy(() => import('@/pages/ai-assistant'));
const LiteratureReview = React.lazy(() => import('@/pages/literature-review'));
const LegalOs = React.lazy(() => import('@/pages/legal-os'));
const AdminOs = React.lazy(() => import('@/pages/admin-os'));
const AdminOsCompliance = React.lazy(() => import('@/pages/admin-os-compliance'));

// Legal Sources
const UaeLegislation = React.lazy(() => import('@/pages/uae-legislation'));
const UaeCaseLaw = React.lazy(() => import('@/pages/uae-caselaw'));
const FranceLaw = React.lazy(() => import('@/pages/france-law'));
const EuLaw = React.lazy(() => import('@/pages/eu-law'));

// Productivity
const Citations = React.lazy(() => import('@/pages/citations'));
const DocumentComparison = React.lazy(() => import('@/pages/document-comparison'));
const PersonalLibrary = React.lazy(() => import('@/pages/personal-library'));

// Theory & Governance
const ShamsiTheory = React.lazy(() => import('@/pages/shamsi-theory'));
const ConstitutionalPrinciples = React.lazy(() => import('@/pages/constitutional-principles'));
// Module 1 — Intelligent Administrative Decision
const Decisions = React.lazy(() => import('@/pages/decisions'));
const DecisionWorkspace = React.lazy(() => import('@/pages/decision-workspace'));
const GovernanceHub = React.lazy(() => import('@/pages/governance-hub'));
const CitizenPortal = React.lazy(() => import('@/pages/citizen-portal'));
// NRME — National Risk Modeling Engine
const RiskEngine = React.lazy(() => import('@/pages/risk-engine'));
// Phase 42 — Constitutional Intelligence Layer (CIL)
const ConstitutionalIntelligence = React.lazy(() => import('@/pages/constitutional-intelligence'));
// Phase 44 — Judicial Digital Twin (JDT)
const JdtPage = React.lazy(() => import('@/pages/jdt'));

// Phase 57 — Legal Research Workspace
const WorkspaceDashboard = React.lazy(() => import('@/pages/workspace-dashboard'));
const WorkspaceProject = React.lazy(() => import('@/pages/workspace-project'));
const WorkspaceItem = React.lazy(() => import('@/pages/workspace-item'));
// Phase 58 — Administrative Decision Knowledge Graph
const AdkgDashboard = React.lazy(() => import('@/pages/adkg-dashboard'));
const AdkgDetail = React.lazy(() => import('@/pages/adkg-detail'));
// Phase 59 — KB Cross-Reference Search
const KbSearch = React.lazy(() => import('@/pages/kb-search'));
// JRE — Judicial Reasoning Engine
const JrePage = React.lazy(() => import('@/pages/jre'));
const JreSession = React.lazy(() => import('@/pages/jre-session'));
// Phase 59 — Judicial Deliberation Chamber
const JdcPage = React.lazy(() => import('@/pages/jdc'));
const JdcChamber = React.lazy(() => import('@/pages/jdc-chamber'));
// Stage 4 — Legal Intelligence Brain
const LegalBrain = React.lazy(() => import('@/pages/legal-brain'));
// SPG — Smart Professional Guidance
const SpgPage = React.lazy(() => import('@/pages/spg'));
const SpgSession = React.lazy(() => import('@/pages/spg-session'));
// PGF — Professional Guidance Framework
const PgfPage = React.lazy(() => import('@/pages/pgf'));
const PgfSession = React.lazy(() => import('@/pages/pgf-session'));

// NAIP — Role-Specific Executive Dashboards
const NaipMinister = React.lazy(() => import('@/pages/naip-minister'));
const NaipUndersecretary = React.lazy(() => import('@/pages/naip-undersecretary'));
const NaipDirectorGeneral = React.lazy(() => import('@/pages/naip-director-general'));
const NaipRiskOfficer = React.lazy(() => import('@/pages/naip-risk-officer'));
const NaipJudge = React.lazy(() => import('@/pages/naip-judge'));

// Phase 43 — NAIP (National Administrative Intelligence Platform)
const NaipHome = React.lazy(() => import('@/pages/naip-home'));
const NaipDashboard = React.lazy(() => import('@/pages/naip-dashboard'));
const NaipKpi = React.lazy(() => import('@/pages/naip-kpi'));

// Admin
const UserManagement = React.lazy(() => import('@/pages/user-management'));
const Settings = React.lazy(() => import('@/pages/settings'));
const AdminLegalOS = React.lazy(() => import('@/pages/admin-legal-os'));

// Legacy route aliases (keep old URLs working)
const UaeFrance = React.lazy(() => import('@/pages/uae-france'));
const Comparisons = React.lazy(() => import('@/pages/comparisons'));
const Documents = React.lazy(() => import('@/pages/documents'));
const UploadPage = React.lazy(() => import('@/pages/upload'));
const Analytics = React.lazy(() => import('@/pages/analytics'));
const AuditLog = React.lazy(() => import('@/pages/audit-log'));
// NOTE: `Users` (pages/users.tsx) is superseded by UserManagement at /admin/users.
// The component file is kept intact (no module deletion); /users now redirects there.

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
    canUseShamsiFramework,
  } = useUserContext();

  return (
    <ErrorBoundary>
      <React.Suspense
        fallback={
          <div className="min-h-screen flex items-center justify-center bg-background">
            <div className="w-8 h-8 border-2 border-gold/30 border-t-gold rounded-full animate-spin" />
          </div>
        }
      >
      <Switch>
        {/* ── المنتج = سير العمل ذو الشاشات الثماني (المرجع المعتمد الوحيد) ──
            الشاشة ١: التسجيل (AuthGate/Login) ← قبل الدخول
            الشاشة ٢: الصفحة الرئيسية (/) ← بعد الدخول مباشرة
            الشاشات ٣→٨: التقدم الطبيعي عبر /journey/… حتى النتيجة الذكية */}
        <Route path="/" component={JourneyHome} />
        <Route path="/journey-services" component={MarsadServicesPage} />
        <Route path="/journey/result/:sessionId" component={JourneyResult} />
        <Route path="/journey/:pathId/:categoryId/:serviceId/incident/:incidentId" component={JourneyCase} />
        <Route path="/journey/:pathId/:categoryId/:serviceId/incident" component={JourneyIncident} />
        <Route path="/journey/:pathId/:categoryId/:serviceId" component={JourneyServiceDetail} />
        <Route path="/journey/:pathId/:categoryId" component={JourneyServices} />
        <Route path="/journey/:pathId" component={JourneyCategory} />

        {/* ── خدمة نافع + المجتمع المهني ─────────────────────────────── */}
        <Route path="/nafe" component={NafePage} />
        <Route path="/community" component={CommunityPage} />
        <Route path="/shamsi-theory">
          <RouteGuard allow={canUseShamsiFramework}>
            <ShamsiTheory />
          </RouteGuard>
        </Route>
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
        <Route path="/naip/search">
          <Redirect to="/search" />
        </Route>

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
          <RouteGuard allow={canUseShamsiFramework}>
            <AdminOsCompliance />
          </RouteGuard>
        </Route>
        <Route path="/admin-os">
          <RouteGuard allow={canUseShamsiFramework}>
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

        {/* ── Unified search hub ───────────────────────────────────── */}
        <Route path="/search">
          <RouteGuard allow={canUseAi}>
            <LegalSearchHub />
          </RouteGuard>
        </Route>

        {/* ── Legacy aliases (redirect into the unified hub) ─────────── */}
        <Route path="/ai-search">
          <Redirect to="/search" />
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

        {/* Stage 4 — Legal Intelligence Brain */}
        <Route path="/legal-brain">
          <RouteGuard allow={canUseAi}>
            <LegalBrain />
          </RouteGuard>
        </Route>

        <Route component={NotFound} />
      </Switch>
      </React.Suspense>
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
        <div className="w-8 h-8 border-2 border-gold/30 border-t-gold rounded-full animate-spin" />
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
