import { io } from "socket.io-client";

export function connectWebSocket() {
  return io({
    transports: ["websocket", "polling"],
  });
}
