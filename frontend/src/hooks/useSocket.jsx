import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { connectWebSocket } from "../helper/ws.js";

const SocketContext = createContext(null);

export function SocketProvider({ children }) {
  const socketRef = useRef(null);
  const [connected, setConnected] = useState(false);
  const [socketId, setSocketId] = useState(null);

  useEffect(() => {
    const s = connectWebSocket();
    socketRef.current = s;

    s.on("connect", () => {
      setConnected(true);
      setSocketId(s.id);
    });
    s.on("disconnect", () => setConnected(false));

    return () => {
      s.off("connect");
      s.off("disconnect");
      s.disconnect();
      socketRef.current = null;
    };
  }, []);

  const ctx = useMemo(
    () => ({ socket: socketRef, connected, socketId }),
    [connected, socketId]
  );

  return (
    <SocketContext.Provider value={ctx}>
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  return useContext(SocketContext);
}
