import { Router } from "express";
import {
  getResssourcesByQuarterId,
  getAllQuarter,
} from "../controllers/ressource.controller";

const router = Router();

router.get("/quarter/:quarterId", getResssourcesByQuarterId);
router.get("/quarters", getAllQuarter);

export default router;
