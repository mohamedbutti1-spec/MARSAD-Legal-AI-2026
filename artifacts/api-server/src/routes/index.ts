import { Router, type IRouter } from "express";
import healthRouter from "./health";
import documentsRouter from "./documents";
import aiRouter from "./ai";
import citationsRouter from "./citations";
import comparisonsRouter from "./comparisons";
import commentsRouter from "./comments";
import usersRouter from "./users";
import settingsRouter from "./settings";
import exportRouter from "./export";

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

export default router;
