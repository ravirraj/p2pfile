import { useEffect, useRef, useState, useCallback } from "react";
import api from "./api.js";
import { connectWebSocket } from "./helper/ws.js";
import { useWebRTC } from "./hooks/useWebRTC.js";
import { useFileTransfer } from "./hooks/useFileTransfer.js";
import FilePicker from "./components/FilePicker.jsx";
import FileList from "./components/FileList.jsx";
import { CHUNK_SIZE } from "./constants.js";
import { getFileMetadata } from "./utils/chunker.js";

const QUALITY_MAP = {
  connected: { label: "Excellent", color: "bg-green-400" },
  checking: { label: "Connecting", color: "bg-yellow-400" },
  disconnected: { label: "Disconnected", color: "bg-red-400" },
  failed: { label: "Failed", color: "bg-red-500" },
  closed: { label: "Closed", color: "bg-gray-500" },
  "new": { label: "New", color: "bg-blue-400" },
};

function getPreviewData(file) {
  if (file.type.startsWith("image/")) {
    return { type: "image", url: URL.createObjectURL(file) };
  }
  if (file.type.startsWith("text/")) {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve({ type: "text", content: reader.result.slice(0, 2000) });
      reader.readAsText(file);
    });
  }
  return null;
}

function App() {
  const socketRef = useRef(null);
  const [role, setRole] = useState(null);
  const [roomId, setRoomId] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState("idle");
  const [error, setError] = useState(null);
  const [peerConnected, setPeerConnected] = useState(false);
  const [previews, setPreviews] = useState({});
  const [fileCount, setFileCount] = useState(0);

  const webrtc = useWebRTC();
  const fileTransfer = useFileTransfer(webrtc.dcRef);

  const createRoom = useCallback(async () => {
    try {
      setError(null);
      const res = await api.post("/api/rooms");
      const newRoomId = res.data.roomId;
      setRoomId(newRoomId);
      setConnectionStatus("room-created");
      socketRef.current?.emit("claim-room", { roomId: newRoomId });
    } catch (err) {
      setError(err.response?.data?.error || "Failed to create room");
    }
  }, []);

  const handleFilesSelect = useCallback(async (files) => {
    const previewMap = {};
    for (const file of files) {
      const preview = await getPreviewData(file);
      if (preview) previewMap[file.name] = preview;
    }
    setPreviews((prev) => ({ ...prev, ...previewMap }));
    setFileCount((prev) => prev + files.length);
    fileTransfer.enqueueFiles(files);
  }, [fileTransfer]);

  const handleCancel = useCallback((fileName) => {
    fileTransfer.abortTransfer(fileName);
  }, [fileTransfer]);

  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  useEffect(() => {
    const s = connectWebSocket();
    socketRef.current = s;
    webrtc.setSocket(s);

    const params = new URLSearchParams(window.location.search);
    const idFromUrl = params.get("roomId");
    const initialRole = idFromUrl ? "guest" : "owner";
    let reconnectAttempts = 0;

    setRole(initialRole);

    function attemptRejoin() {
      if (reconnectAttempts > 3) return;
      reconnectAttempts++;
      if (initialRole === "owner" && roomIdRef.current) {
        s.emit("claim-room", { roomId: roomIdRef.current });
      } else if (initialRole === "guest" && roomIdRef.current) {
        s.emit("room-join", { roomId: roomIdRef.current });
      }
    }

    const roomIdRef = { current: idFromUrl };

    s.on("connect", () => {
      setConnectionStatus("connected");
      reconnectAttempts = 0;
      if (initialRole === "guest" && idFromUrl) {
        setRoomId(idFromUrl);
        roomIdRef.current = idFromUrl;
        setConnectionStatus("joining");
        s.emit("room-join", { roomId: idFromUrl });
      }
    });

    s.on("disconnect", () => {
      setConnectionStatus("disconnected");
      setPeerConnected(false);
    });

    s.on("reconnect_attempt", () => {
      setConnectionStatus("reconnecting");
    });

    s.on("reconnect", () => {
      setConnectionStatus("reconnected");
      attemptRejoin();
    });

    s.on("room-claimed", ({ status, message }) => {
      if (status === "success") {
        setConnectionStatus("waiting-for-peer");
      } else {
        setError(message);
        setConnectionStatus("error");
      }
    });

    s.on("room-joined", async ({ status, message, roomId: rid }) => {
      if (status === "failed") {
        setError(message);
        setConnectionStatus("error");
        return;
      }

      if (initialRole === "owner") {
        setConnectionStatus("starting-webrtc");
        webrtc.createPeerConnection(rid || idFromUrl);
        webrtc.onDataChannel((dc) => {
          fileTransfer.setupReceiver(dc);
          dc.onopen = () => setPeerConnected(true);
        });
        const dc = webrtc.createDataChannel();
        if (dc) {
          dc.onopen = () => setPeerConnected(true);
        }
        const offer = await webrtc.createOffer();
        if (offer) {
          s.emit("signal", { roomId: rid || idFromUrl, type: "offer", data: offer });
        }
      }
    });

    s.on("signal", async ({ type, data, roomId: rid }) => {
      const currentRoomId = rid || idFromUrl;
      if (type === "offer" && initialRole === "guest") {
        webrtc.createPeerConnection(currentRoomId);
        webrtc.onDataChannel((dc) => {
          fileTransfer.setupReceiver(dc);
          dc.onopen = () => setPeerConnected(true);
        });
        const answer = await webrtc.handleOffer(data);
        if (answer) {
          s.emit("signal", { roomId: currentRoomId, type: "answer", data: answer });
        }
      } else if (type === "answer" && initialRole === "owner") {
        await webrtc.handleAnswer(data);
        setPeerConnected(true);
      } else if (type === "candidate") {
        await webrtc.addIceCandidate(data);
      }
    });

    s.on("peer-disconnected", () => {
      setPeerConnected(false);
      setConnectionStatus("peer-disconnected");
      if (initialRole === "owner") {
        setConnectionStatus("waiting-for-peer");
      }
    });

    s.on("error-msg", ({ reason }) => {
      setError(reason);
    });

    return () => {
      s.off("connect");
      s.off("disconnect");
      s.off("reconnect_attempt");
      s.off("reconnect");
      s.off("room-claimed");
      s.off("room-joined");
      s.off("signal");
      s.off("peer-disconnected");
      s.off("error-msg");
      s.disconnect();
      webrtc.close();
    };
  }, []);

  const quality = QUALITY_MAP[webrtc.connectionState] || { label: "Unknown", color: "bg-gray-500" };
  const inviteLink = roomId ? `${window.location.origin}/?roomId=${roomId}` : null;
  const canSend = peerConnected && role === "owner";
  const showQueueBadge = fileTransfer.queueLength > 0;

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100">
      <div className="max-w-lg mx-auto px-4 py-12">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold tracking-tight">PeerFlow</h1>
          <p className="text-gray-400 mt-1">Peer-to-peer file sharing</p>
        </div>

        <div className="bg-gray-800 rounded-xl p-4 mb-6 border border-gray-700/50 space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-400">
              {role === "owner" ? "Sender" : "Receiver"}
            </span>
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${
                peerConnected
                  ? "bg-green-400"
                  : connectionStatus === "connected" || connectionStatus === "waiting-for-peer" || connectionStatus === "room-created" || connectionStatus === "reconnecting"
                    ? "bg-yellow-400"
                    : connectionStatus === "error" || connectionStatus === "disconnected"
                      ? "bg-red-400"
                      : "bg-gray-500"
              }`} />
              <span className="text-gray-400 capitalize">
                {connectionStatus === "room-created"
                  ? "Room ready"
                  : connectionStatus === "waiting-for-peer"
                    ? "Waiting for peer"
                    : peerConnected
                      ? "Connected"
                      : connectionStatus === "peer-disconnected"
                        ? "Peer disconnected"
                        : connectionStatus === "reconnecting"
                          ? "Reconnecting..."
                          : connectionStatus}
              </span>
            </div>
          </div>

          {peerConnected && (
            <div className="flex items-center justify-between text-xs border-t border-gray-700/50 pt-2">
              <span className="text-gray-500">Connection quality</span>
              <div className="flex items-center gap-1.5">
                <span className={`w-1.5 h-1.5 rounded-full ${quality.color}`} />
                <span className="text-gray-400">{quality.label}</span>
              </div>
            </div>
          )}

          {showQueueBadge && (
            <div className="text-xs text-gray-500 border-t border-gray-700/50 pt-2">
              {fileTransfer.queueLength} file{fileTransfer.queueLength !== 1 ? "s" : ""} queued
            </div>
          )}
        </div>

        {error && (
          <div className="bg-red-900/30 border border-red-800/50 rounded-xl p-4 mb-6 text-sm text-red-300">
            {error}
          </div>
        )}

        {role === "owner" && !roomId && (
          <button
            onClick={createRoom}
            className="w-full py-3 bg-blue-600 hover:bg-blue-500 rounded-xl font-medium transition-colors cursor-pointer"
          >
            Create Room
          </button>
        )}

        {role === "owner" && roomId && !peerConnected && (
          <div className="bg-gray-800 rounded-xl p-4 border border-gray-700/50 mb-6">
            <p className="text-sm text-gray-400 mb-2">Share this link with the receiver:</p>
            <div className="flex items-center gap-2">
              <input
                readOnly
                value={inviteLink}
                className="flex-1 bg-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 font-mono select-all outline-none"
                onClick={(e) => e.target.select()}
              />
              <button
                onClick={() => navigator.clipboard?.writeText(inviteLink)}
                className="px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm cursor-pointer transition-colors"
              >
                Copy
              </button>
            </div>
          </div>
        )}

        {peerConnected && <FilePicker onFilesSelect={handleFilesSelect} disabled={!canSend} />}

        <div className="mt-6">
          <FileList
            transfers={fileTransfer.transfers}
            onCancel={handleCancel}
            previews={previews}
          />
        </div>

        {role === "guest" && !peerConnected && connectionStatus !== "error" && (
          <div className="bg-gray-800 rounded-xl p-6 border border-gray-700/50 text-center">
            <div className="animate-spin w-8 h-8 border-2 border-blue-400 border-t-transparent rounded-full mx-auto mb-3" />
            <p className="text-gray-300 text-sm">Connecting to sender...</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
