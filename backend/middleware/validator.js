export function validateRoomId(req, res, next) {
  const { roomId } = req.body;
  if (!roomId || typeof roomId !== "string" || roomId.length < 4 || roomId.length > 16) {
    return res.status(400).json({ error: "Invalid room ID" });
  }
  if (!/^[a-z0-9-]+$/.test(roomId)) {
    return res.status(400).json({ error: "Room ID contains invalid characters" });
  }
  next();
}
