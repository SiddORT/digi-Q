import { Router, type IRouter } from "express";
import healthRouter from "./health";
import { identityRouter } from "./identity";
import { publicRouter } from "./public";
import { resourcesRouter } from "./resources";
import { appointmentsRouter } from "./appointments";
import { queueRouter } from "./queue";
import { reportingRouter } from "./reporting";
import otpRouter from "./otp";
import { appointmentQrRouter } from "./appointment-qr";

const router: IRouter = Router();

router.use(healthRouter);
router.use(publicRouter);
router.use(identityRouter);
router.use(otpRouter);
router.use(resourcesRouter);
router.use(appointmentsRouter);
router.use(appointmentQrRouter);
router.use(queueRouter);
router.use(reportingRouter);

export default router;
