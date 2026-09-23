import { Router } from "express";
import { loginUser, me, disconnect } from "../controllers/auth.controller";
import { authenticateToken } from "../middleware/authenticateToken";

const router = Router();

router.post("/login", loginUser);
router.get("/me", authenticateToken, me);
router.post("/disconnect", authenticateToken, disconnect);

export default router;
