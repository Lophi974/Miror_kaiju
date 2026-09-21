import { Router } from "express";
import { transferResources } from "../controllers/transaction.controller";

const router = Router();

router.post("/transfer", transferResources);

export default router;