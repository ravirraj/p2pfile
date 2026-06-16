import path from "node:path";
import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";
import helmet from "helmet";

import env from "./config/env.js";
import logger from "./config/logger.js";
import roomService from "./services/roomService.js";
import routes from "./routes/index.js";
import { registerSignalingHandlers } from "./socket/signalingHandler.js";
import { generalLimiter } from "./middleware/rateLimiter.js";

const app = express();
const httpServer = createServer(app);

app.use(helmet());
app.use(cors({ origin: env.corsOrigins }));
app.use(express.json({ limit: "1mb" }));
app.use(generalLimiter);

app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok", uptime: process.uptime() });
});

app.use("/api", routes);

if (env.nodeEnv === "production") {
  const frontendDist = path.resolve(process.cwd(), "frontend", "dist");
  app.use(express.static(frontendDist));
  app.get("*", (req, res) => {
    if (!req.path.startsWith("/api") && !req.path.startsWith("/socket.io")) {
      res.sendFile(path.join(frontendDist, "index.html"));
    }
  });
}

const io = new Server(httpServer, {
  cors: { origin: env.corsOrigins, methods: ["GET", "POST"] },
  maxHttpBufferSize: 1e8,
});

io.on("connection", (socket) => {
  registerSignalingHandlers(io, socket);
});

const cleanupInterval = setInterval(() => {
  roomService.cleanupStaleRooms(env.roomTtlMs);
}, env.roomCleanupIntervalMs);

export function startServer(port = env.port) {
  return new Promise((resolve) => {
    httpServer.listen(port, () => {
      logger.info({ port, env: env.nodeEnv }, "Server listening");
      resolve(httpServer);
    });
  });
}

function shutdown() {
  logger.info("Shutting down gracefully...");
  clearInterval(cleanupInterval);
  io.close();
  httpServer.close(() => {
    logger.info("Server closed");
    process.exit(0);
  });
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

if (process.env.VITEST !== "true") {
  startServer();
}

export { app, httpServer, io, cleanupInterval };
