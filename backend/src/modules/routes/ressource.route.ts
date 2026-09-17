import { Router } from "express";
import { getResssourcesByQuarterId } from "../controllers/ressource.controller";


const router = Router();

router.get('/quarter/:quarterId', getResssourcesByQuarterId);

export default router;