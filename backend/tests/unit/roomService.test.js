import { describe, it, expect, beforeEach } from "vitest";
import { RoomService } from "../../services/roomService.js";

describe("RoomService", () => {
  let service;

  beforeEach(() => {
    service = new RoomService();
  });

  it("should create a room with valid id", () => {
    const id = service.createRoom();
    expect(id).toBeDefined();
    expect(typeof id).toBe("string");
    expect(id.length).toBeGreaterThanOrEqual(4);
  });

  it("should return null for non-existent room", () => {
    expect(service.getRoom("nonexistent")).toBeNull();
  });

  it("should claim a room successfully", () => {
    const roomId = service.createRoom();
    const result = service.claimRoom(roomId, "socket-1");
    expect(result.success).toBe(true);
    const room = service.getRoom(roomId);
    expect(room.owner).toBe("socket-1");
    expect(room.used).toBe(true);
  });

  it("should reject double claim", () => {
    const roomId = service.createRoom();
    service.claimRoom(roomId, "socket-1");
    const result = service.claimRoom(roomId, "socket-2");
    expect(result.success).toBe(false);
    expect(result.message).toContain("already claimed");
  });

  it("should allow a guest to join", () => {
    const roomId = service.createRoom();
    service.claimRoom(roomId, "socket-1");
    const result = service.joinRoom(roomId, "socket-2");
    expect(result.success).toBe(true);
    expect(result.owner).toBe("socket-1");
  });

  it("should reject guest when room is full", () => {
    const roomId = service.createRoom();
    service.claimRoom(roomId, "socket-1");
    service.joinRoom(roomId, "socket-2");
    const result = service.joinRoom(roomId, "socket-3");
    expect(result.success).toBe(false);
    expect(result.message).toContain("full");
  });

  it("should reject join to non-existent room", () => {
    const result = service.joinRoom("fake", "socket-1");
    expect(result.success).toBe(false);
  });

  it("should find peer for owner", () => {
    const roomId = service.createRoom();
    service.claimRoom(roomId, "socket-1");
    service.joinRoom(roomId, "socket-2");
    expect(service.getPeer(roomId, "socket-1")).toBe("socket-2");
    expect(service.getPeer(roomId, "socket-2")).toBe("socket-1");
  });

  it("should return null for unknown socket", () => {
    const roomId = service.createRoom();
    expect(service.getPeer(roomId, "unknown")).toBeNull();
  });

  it("should remove socket and clean up empty rooms", () => {
    const roomId = service.createRoom();
    service.claimRoom(roomId, "socket-1");
    service.removeSocket("socket-1");
    expect(service.getRoom(roomId)).toBeNull();
  });

  it("should not delete room if other peer remains", () => {
    const roomId = service.createRoom();
    service.claimRoom(roomId, "socket-1");
    service.joinRoom(roomId, "socket-2");
    service.removeSocket("socket-2");
    expect(service.getRoom(roomId)).not.toBeNull();
    const room = service.getRoom(roomId);
    expect(room.guest).toBeNull();
    expect(room.owner).toBe("socket-1");
  });

  it("should clean up stale rooms", () => {
    const roomId = service.createRoom();
    const room = service.getRoom(roomId);
    room.createdAt = Date.now() - 5000;
    service.cleanupStaleRooms(1000);
    expect(service.getRoom(roomId)).toBeNull();
  });

  it("should return stats", () => {
    service.createRoom();
    const stats = service.getStats();
    expect(stats.activeRooms).toBe(1);
    expect(stats.rooms[0]).toHaveProperty("id");
    expect(stats.rooms[0]).toHaveProperty("hasOwner");
    expect(stats.rooms[0]).toHaveProperty("hasGuest");
  });
});
