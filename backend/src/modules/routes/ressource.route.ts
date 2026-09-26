import { Router } from "express";
import {
  getResssourcesByQuarterId,
  getAllQuarter,
  updateThreshold,
  getAdjacentQuarters,
} from "../controllers/ressource.controller";
import { authenticateToken } from "../middleware/authenticateToken";
import { authorize } from "../middleware/authorize";
import { ACTION } from "../middleware/rules";

const router = Router();

router.get("/quarter/:quarterId", getResssourcesByQuarterId);
router.get("/quarters", getAllQuarter);
router.get("/quarter/:quarterId/adjacent", getAdjacentQuarters);
router.put(
  "/threshold",
  authenticateToken,
  authorize(ACTION.TRESHOLD),
  updateThreshold,
);

export default router;
