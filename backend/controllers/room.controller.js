import roomService from "../services/roomService.js";

export function createRoom(req, res) {
  const roomId = roomService.createRoom();
  res.status(200).json({ roomId });
}

export function getStats(req, res) {
  res.status(200).json(roomService.getStats());
}
