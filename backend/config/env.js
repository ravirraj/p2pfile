import dotenv from "dotenv";
dotenv.config();

const env = {
  port: parseInt(process.env.PORT || "3000", 10),
  nodeEnv: process.env.NODE_ENV || "development",
  corsOrigin: process.env.CORS_ORIGIN || "http://localhost:5173",
  get corsOrigins() {
    const origin = this.corsOrigin;
    if (origin === "auto") {
      return this.nodeEnv === "production" ? true : "http://localhost:5173";
    }
    if (typeof origin === "string" && !origin.startsWith("http")) {
      return `https://${origin}`;
    }
    return origin;
  },
  logLevel: process.env.LOG_LEVEL || "info",
  roomCleanupIntervalMs: parseInt(process.env.ROOM_CLEANUP_INTERVAL_MS || "300000", 10),
  roomTtlMs: parseInt(process.env.ROOM_TTL_MS || "3600000", 10),
  rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || "60000", 10),
  rateLimitMaxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || "20", 10),
  jwtSecret: process.env.JWT_SECRET || "peerflow-dev-secret",
  transferTokenTTL: process.env.TRANSFER_TOKEN_TTL || "1h",
};

export default env;
