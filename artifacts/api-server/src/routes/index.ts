import { Router, type IRouter } from "express";
import healthRouter from "./health";
import eventsRouter from "./events";
import membersRouter from "./members";
import familiesRouter from "./families";
import joinRequestsRouter from "./joinRequests";
import expensesRouter from "./expenses";
import settlementsRouter from "./settlements";

const router: IRouter = Router();

router.use(healthRouter);
router.use(eventsRouter);
router.use(membersRouter);
router.use(familiesRouter);
router.use(joinRequestsRouter);
router.use(expensesRouter);
router.use(settlementsRouter);

export default router;
