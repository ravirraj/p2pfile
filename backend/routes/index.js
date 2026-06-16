import { Router } from "express";
import roomRoutes from "./room.routes.js";
import transferRoutes from "./transfer.routes.js";

const router = Router();
router.use(roomRoutes);
router.use(transferRoutes);

export default router;
