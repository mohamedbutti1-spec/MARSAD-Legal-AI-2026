import { Router, type IRouter } from "express";
// Auth — no JWT required (these routes establish the session)
import authRouter          from "./auth";
import healthRouter        from "./health";
import documentsRouter     from "./documents";
import aiRouter            from "./ai";
import citationsRouter     from "./citations";
import comparisonsRouter   from "./comparisons";
import commentsRouter      from "./comments";
import usersRouter         from "./users";
import settingsRouter      from "./settings";
import exportRouter        from "./export";
import auditRouter         from "./audit";
import backupRouter        from "./backup";
// New in Tasks #2, #3, #4
import legalSourcesRouter  from "./legal-sources";
import assistantRouter     from "./assistant";
import researchRouter      from "./research";
import libraryRouter       from "./library";
import dashboardRouter     from "./dashboard";
import legalOsRouter       from "./legal-os";
import adminOsRouter       from "./admin-os";
import legalOsAdminRouter  from "./legal-os-admin";
// Module 1 — Intelligent Administrative Decision
import decisionsRouter     from "./decisions";
// Phase 2 — Executive Governance Layer
import governanceRouter    from "./governance";
// Phase 3 — Decision Chain of Custody
import custodyRouter       from "./custody";
// Phase 3 — Constitutional Memory (CM)
import memoryRouter        from "./memory";
// Phase 4 — Constitutional Chain of Custody and Evidence Ledger
import evidenceRouter      from "./evidence";
// Phase 5 — Constitutional Judicial Intelligence (CJI)
import judicialReviewRouter from "./judicial-review";
// NRME — National Risk Modeling Engine
import riskRouter          from "./risk";
// Phase 42 — Constitutional Intelligence Layer (CIL)
import cilRouter           from "./cil";
// Phase 44 — Judicial Digital Twin (JDT)
import jdtRouter           from "./jdt";
// NAIP — National Administrative Intelligence Platform
import naipRouter          from "./naip";
// Phase 57 — Legal Research Workspace
import workspaceRouter     from "./workspace";
// Phase 58 — Administrative Decision Knowledge Graph
import adkgRouter          from "./adkg";
// Phase 59 — KB Cross-Reference Graph Traversal
import kbRouter            from "./kb";
// JRE — Judicial Reasoning Engine
import jreRouter           from "./jre";
// Phase 59 — Judicial Deliberation Chamber
import jdcRouter           from "./jdc";
// SPG — Smart Professional Guidance
import spgRouter           from "./spg";
// PGF — Professional Guidance Framework
import pgfRouter           from "./pgf";
// PCS — Professional Case Simulator
import pcsRouter           from "./pcs";
// Beta — Reviewer Feedback
import betaRouter          from "./beta";

const router: IRouter = Router();

// Auth routes — must be registered FIRST and require no JWT
router.use(authRouter);
router.use(healthRouter);
router.use(documentsRouter);
router.use(aiRouter);
router.use(citationsRouter);
router.use(comparisonsRouter);
router.use(commentsRouter);
router.use(usersRouter);
router.use(settingsRouter);
router.use(exportRouter);
router.use(auditRouter);
router.use(backupRouter);
// New routes
router.use(legalSourcesRouter);
router.use(assistantRouter);
router.use(researchRouter);
router.use(libraryRouter);
router.use(dashboardRouter);
router.use(legalOsRouter);
router.use(adminOsRouter);
router.use(legalOsAdminRouter);
// Module 1
router.use(decisionsRouter);
// Phase 2 — Executive Governance Layer
router.use(governanceRouter);
// Phase 3 — Decision Chain of Custody
router.use(custodyRouter);
// Phase 3 — Constitutional Memory (CM)
router.use(memoryRouter);
// Phase 4 — Constitutional Chain of Custody and Evidence Ledger
router.use(evidenceRouter);
// Phase 5 — Constitutional Judicial Intelligence (CJI)
router.use(judicialReviewRouter);
// NRME — National Risk Modeling Engine
router.use(riskRouter);
// Phase 42 — Constitutional Intelligence Layer (CIL)
router.use(cilRouter);
// Phase 44 — Judicial Digital Twin (JDT)
router.use(jdtRouter);
// NAIP — National Administrative Intelligence Platform
router.use(naipRouter);
// Beta — Reviewer Feedback (must come before workspace/kb/adkg which apply
// requireAnyRole globally; citizen reviewers must reach /beta/* routes)
router.use(betaRouter);
// Phase 57 — Legal Research Workspace
router.use(workspaceRouter);
// Phase 58 — Administrative Decision Knowledge Graph
router.use(adkgRouter);
// Phase 59 — KB Cross-Reference Graph Traversal
router.use(kbRouter);
// JRE — Judicial Reasoning Engine
router.use(jreRouter);
// Phase 59 — Judicial Deliberation Chamber
router.use(jdcRouter);
// SPG — Smart Professional Guidance
router.use(spgRouter);
// PGF — Professional Guidance Framework
router.use(pgfRouter);
// PCS — Professional Case Simulator
router.use(pcsRouter);

export default router;
