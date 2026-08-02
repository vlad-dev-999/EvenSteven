import { Router, type IRouter } from "express";
import healthRouter from "./health";
import hostRouter from "./host";
import housesRouter from "./houses";
import peopleRouter from "./people";
import eventsRouter from "./events";
import membersRouter from "./members";
import familiesRouter from "./families";
import joinRequestsRouter from "./joinRequests";
import expensesRouter from "./expenses";
import settlementsRouter from "./settlements";
import directoryRouter from "./directory";

const router: IRouter = Router();

router.use(healthRouter);
router.use(hostRouter);
router.use(housesRouter);
router.use(peopleRouter);
router.use(directoryRouter);
router.use(eventsRouter);
router.use(membersRouter);
router.use(familiesRouter);
router.use(joinRequestsRouter);
router.use(expensesRouter);
router.use(settlementsRouter);

export default router;
