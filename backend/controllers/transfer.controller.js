import { transferService } from "../services/transferService.js";
import { createTransferToken } from "../services/tokenService.js";
import roomService from "../services/roomService.js";
import logger from "../config/logger.js";

export function createTransfer(req, res) {
  const { files, password } = req.body;
  if (!files || !Array.isArray(files) || files.length === 0) {
    return res.status(400).json({ error: "Files list is required" });
  }

  const roomId = roomService.createRoom();
  const passwordValue = password || null;

  transferService.createTransfer(roomId, files, passwordValue);
  logger.info({ roomId, fileCount: files.length, hasPassword: !!passwordValue }, "Transfer created");

  const publicFiles = files.map((f) => ({
    name: f.name,
    size: f.size,
    type: f.type,
  }));

  res.status(200).json({
    roomId,
    files: publicFiles,
    hasPassword: !!passwordValue,
  });
}

export async function getTransfer(req, res) {
  const { roomId } = req.params;
  const transfer = transferService.getTransfer(roomId);
  if (!transfer) {
    return res.status(404).json({ error: "Transfer not found or expired" });
  }
  res.status(200).json(transfer);
}

export function verifyPassword(req, res) {
  const { roomId, password } = req.body;
  if (!password) {
    return res.status(400).json({ error: "Password is required" });
  }
  const valid = transferService.verifyPassword(roomId, password);
  if (!valid) {
    return res.status(403).json({ error: "Invalid password" });
  }
  res.status(200).json({ verified: true });
}
