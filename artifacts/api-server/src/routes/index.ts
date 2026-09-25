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
import { authRouter } from "./auth";
import { durationRouter } from "./duration";
import { guestRequestsRouter } from "./guest-requests";
import { clinicExpansionRouter } from "./clinic-expansion";
import { presenceRouter } from "./presence";
import { demoRouter } from "./demo";

const router: IRouter = Router();

router.use(healthRouter);
router.use(clinicExpansionRouter);
router.use(presenceRouter);
router.use(publicRouter);
router.use(guestRequestsRouter);
router.use(authRouter);
router.use(demoRouter);
router.use(identityRouter);
router.use(otpRouter);
router.use(resourcesRouter);
router.use(durationRouter);
router.use(appointmentsRouter);
router.use(appointmentQrRouter);
router.use(queueRouter);
router.use(reportingRouter);

export default router;
