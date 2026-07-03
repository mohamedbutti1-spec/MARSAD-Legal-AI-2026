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

export default router;
