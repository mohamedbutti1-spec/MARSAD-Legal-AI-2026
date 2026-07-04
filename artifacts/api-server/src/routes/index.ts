import { Router, type IRouter } from "express";
import healthRouter      from "./health";
import documentsRouter   from "./documents";
import aiRouter          from "./ai";
import citationsRouter   from "./citations";
import comparisonsRouter from "./comparisons";
import commentsRouter    from "./comments";
import usersRouter       from "./users";
import settingsRouter    from "./settings";
import exportRouter      from "./export";
import auditRouter       from "./audit";
import backupRouter      from "./backup";
// New in Tasks #2, #3, #4
import legalSourcesRouter from "./legal-sources";
import assistantRouter    from "./assistant";
import researchRouter     from "./research";
import libraryRouter      from "./library";
import dashboardRouter    from "./dashboard";
import legalOsRouter      from "./legal-os";
import adminOsRouter      from "./admin-os";
import legalOsAdminRouter from "./legal-os-admin";
// Module 1 — Intelligent Administrative Decision
import decisionsRouter from "./decisions";
// Phase 2 — Executive Governance Layer
import governanceRouter from "./governance";
// Phase 3 — Decision Chain of Custody
import custodyRouter from "./custody";

const router: IRouter = Router();

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

export default router;
