import { Router } from "express";
import { createTransfer, getTransfer, verifyPassword } from "../controllers/transfer.controller.js";
import { roomCreationLimiter } from "../middleware/rateLimiter.js";

const router = Router();

router.post("/transfers", roomCreationLimiter, createTransfer);
router.get("/transfers/:roomId", getTransfer);
router.post("/transfers/:roomId/verify-password", verifyPassword);

export default router;
