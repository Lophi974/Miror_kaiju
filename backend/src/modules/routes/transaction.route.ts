import { Router } from "express";
import {
  transferRessources,
  requestRessources,
  reserveResources,
  requisitionRessources,
} from "../controllers/transaction.controller";
import { authenticateToken } from "../middleware/authenticateToken";
import { ACTION } from "../middleware/rules";
import { authorize } from "../middleware/authorize";

const router = Router();


router.post(
    "/reserve",
    authenticateToken,
    authorize(ACTION.RESERVE),
    reserveResources,
);

router.post(
  "/request",
  authenticateToken,
  authorize(ACTION.REQUEST),
  requestRessources,
);


router.post(
  "/transfer",
  authenticateToken,
  authorize(ACTION.TRANSFER),
  transferRessources,
);

router.post(
  "/requisition",
  authenticateToken,
  authorize(ACTION.REQUISITION),
  requisitionRessources,
);

export default router;
