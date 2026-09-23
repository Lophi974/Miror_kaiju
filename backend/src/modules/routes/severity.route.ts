import { Router } from "express";
import {
  getSeverityForOneQuarter,
  changeSeverityForAllQuarters,
} from "../controllers/severity.controller";

const router = Router();

router.get("/", getSeverityForOneQuarter);
router.put("/", changeSeverityForAllQuarters);

export default router;
