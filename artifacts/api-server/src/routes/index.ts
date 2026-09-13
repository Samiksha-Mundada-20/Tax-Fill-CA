import { Router, type IRouter } from "express";
import healthRouter from "./health";
import taxSathiRouter from "./tax-sathi";

const router: IRouter = Router();

router.use(healthRouter);
router.use(taxSathiRouter);

export default router;
