import { io } from "socket.io-client";

const URL = import.meta.env.VITE_API_URL || "";

export function connectWebSocket() {
  return io(URL, {
    transports: ["websocket", "polling"],
  });
}
