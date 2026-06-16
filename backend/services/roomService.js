import { v4 as uuidv4 } from "uuid";
import logger from "../config/logger.js";

class RoomService {
  constructor() {
    this.rooms = new Map();
  }

  createRoom() {
    const roomId = uuidv4().slice(0, 8);
    this.rooms.set(roomId, {
      owner: null,
      guest: null,
      createdAt: Date.now(),
      used: false,
      password: null,
    });
    logger.info({ roomId }, "Room created");
    return roomId;
  }

  getRoom(roomId) {
    return this.rooms.get(roomId) || null;
  }

  claimRoom(roomId, socketId, password) {
    const room = this.rooms.get(roomId);
    if (!room) return { success: false, message: "Room does not exist" };
    if (room.owner) return { success: false, message: "Room already claimed" };
    if (room.password && room.password !== password) {
      return { success: false, message: "Invalid password" };
    }
    room.owner = socketId;
    room.used = true;
    logger.info({ roomId, socketId }, "Room claimed");
    return { success: true };
  }

  joinRoom(roomId, socketId, password) {
    const room = this.rooms.get(roomId);
    if (!room) return { success: false, message: "Room does not exist" };
    if (room.guest) return { success: false, message: "Room is full" };
    if (!room.used) return { success: false, message: "Room is not claimed yet" };
    if (room.password && room.password !== password) {
      return { success: false, message: "Invalid password" };
    }
    room.guest = socketId;
    logger.info({ roomId, socketId }, "Guest joined room");
    return { success: true, owner: room.owner };
  }

  setRoomPassword(roomId, password) {
    const room = this.rooms.get(roomId);
    if (!room) return false;
    room.password = password;
    return true;
  }

  getPeer(roomId, socketId) {
    const room = this.rooms.get(roomId);
    if (!room) return null;
    if (socketId === room.owner) return room.guest;
    if (socketId === room.guest) return room.owner;
    return null;
  }

  removeSocket(socketId) {
    for (const [roomId, room] of this.rooms.entries()) {
      if (room.owner === socketId || room.guest === socketId) {
        logger.info({ roomId, socketId }, "Removing socket from room");
        if (room.owner === socketId) {
          room.owner = null;
          room.used = false;
        }
        if (room.guest === socketId) {
          room.guest = null;
        }
        if (!room.owner && !room.guest) {
          this.rooms.delete(roomId);
          logger.info({ roomId }, "Room deleted (empty)");
        }
        return roomId;
      }
    }
    return null;
  }

  cleanupStaleRooms(ttlMs) {
    const now = Date.now();
    for (const [roomId, room] of this.rooms.entries()) {
      if (now - room.createdAt > ttlMs) {
        this.rooms.delete(roomId);
        logger.info({ roomId }, "Room deleted (stale)");
      }
    }
  }

  getStats() {
    return {
      activeRooms: this.rooms.size,
      rooms: Array.from(this.rooms.entries()).map(([id, r]) => ({
        id,
        hasOwner: !!r.owner,
        hasGuest: !!r.guest,
        hasPassword: !!r.password,
        age: Date.now() - r.createdAt,
      })),
    };
  }
}

export { RoomService };
export const roomService = new RoomService();
export default roomService;
