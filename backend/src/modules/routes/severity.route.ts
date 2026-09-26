import { Router } from "express";
import {
  getSeverityForOneQuarter,
  changeSeverityForAllQuarters,
} from "../controllers/severity.controller";
import { authenticateToken } from "../middleware/authenticateToken";

const router = Router();

router.get("/", authenticateToken, getSeverityForOneQuarter);
router.put("/", authenticateToken, changeSeverityForAllQuarters);

export default router;
