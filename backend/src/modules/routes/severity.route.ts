import { Router } from "express";
import { getSeverityForOneQuarter } from "../controllers/severity.controller";

const router = Router();

router.get('/', getSeverityForOneQuarter);

export default router;