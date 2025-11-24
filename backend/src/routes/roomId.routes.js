import roomIdController from "../controller/roomId.controller.js";

import express from "express";
const router = express.Router();

router.post("/generate-room", roomIdController);

export default router;