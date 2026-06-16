import { Router } from "express";
import { createRoom, getStats } from "../controllers/room.controller.js";
import { roomCreationLimiter } from "../middleware/rateLimiter.js";

const router = Router();

router.post("/rooms", roomCreationLimiter, createRoom);
router.get("/rooms/stats", getStats);

export default router;
