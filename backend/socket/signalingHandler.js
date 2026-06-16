import logger from "../config/logger.js";
import roomService from "../services/roomService.js";

export function registerSignalingHandlers(io, socket) {
  logger.info({ socketId: socket.id }, "Socket connected");
  socket.data.roomId = null;

  socket.on("claim-room", ({ roomId, password }) => {
    if (!roomId || typeof roomId !== "string") {
      return socket.emit("room-claimed", {
        status: "failed",
        message: "Invalid room ID",
      });
    }
    const result = roomService.claimRoom(roomId, socket.id, password);
    if (result.success) {
      socket.data.roomId = roomId;
      socket.join(roomId);
      socket.emit("room-claimed", { status: "success", role: "owner" });
    } else {
      socket.emit("room-claimed", { status: "failed", message: result.message });
    }
  });

  socket.on("room-join", ({ roomId, password }) => {
    if (!roomId || typeof roomId !== "string") {
      return socket.emit("room-joined", {
        status: "failed",
        message: "Invalid room ID",
      });
    }
    const result = roomService.joinRoom(roomId, socket.id, password);
    if (result.success) {
      socket.data.roomId = roomId;
      socket.join(roomId);
      socket.emit("room-joined", { status: "success", role: "guest", roomId });
      io.to(result.owner).emit("room-joined", { roomId });
    } else {
      socket.emit("room-joined", { status: "failed", message: result.message });
    }
  });

  socket.on("signal", ({ roomId, type, data }) => {
    const targetId = roomService.getPeer(roomId, socket.id);
    if (!targetId) return;
    io.to(targetId).emit("signal", { type, data, roomId });
  });

  socket.on("disconnect", () => {
    const roomId = roomService.removeSocket(socket.id);
    if (roomId) {
      socket.to(roomId).emit("peer-disconnected", { roomId });
    }
    logger.info({ socketId: socket.id, roomId }, "Socket disconnected");
  });
}
