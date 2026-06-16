import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { io as ioc } from "socket.io-client";
import { app, httpServer, io } from "../../app.js";

const PORT = 3099;

describe("Socket.IO signaling", () => {
  beforeAll((done) => {
    httpServer.listen(PORT, done);
  });

  afterAll((done) => {
    io.close();
    httpServer.close(done);
  });

  it("should connect and create a room", (done) => {
    const client = ioc(`http://localhost:${PORT}`);
    client.on("connect", async () => {
      const res = await fetch(`http://localhost:${PORT}/api/rooms`, { method: "POST" });
      const { roomId } = await res.json();
      expect(roomId).toBeDefined();
      client.emit("claim-room", { roomId });
    });
    client.on("room-claimed", (data) => {
      expect(data.status).toBe("success");
      expect(data.role).toBe("owner");
      client.close();
      done();
    });
  });

  it("should reject non-existent room claim", (done) => {
    const client = ioc(`http://localhost:${PORT}`);
    client.on("connect", () => {
      client.emit("room-join", { roomId: "nonexistent" });
    });
    client.on("room-joined", (data) => {
      expect(data.status).toBe("failed");
      client.close();
      done();
    });
  });
});
