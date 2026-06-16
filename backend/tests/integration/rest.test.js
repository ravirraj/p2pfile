import { describe, it, expect, afterAll } from "vitest";
import request from "supertest";
import { app, startServer, io, httpServer } from "../../app.js";

describe("REST API", () => {
  afterAll(() => {
    io.close();
    httpServer.close();
  });

  it("GET /health should return ok", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
  });

  it("POST /api/rooms should create a room", async () => {
    const res = await request(app).post("/api/rooms");
    expect(res.status).toBe(200);
    expect(res.body.roomId).toBeDefined();
    expect(typeof res.body.roomId).toBe("string");
  });

  it("GET /api/rooms/stats should return stats", async () => {
    const res = await request(app).get("/api/rooms/stats");
    expect(res.status).toBe(200);
    expect(res.body.activeRooms).toBeDefined();
    expect(Array.isArray(res.body.rooms)).toBe(true);
  });
});
