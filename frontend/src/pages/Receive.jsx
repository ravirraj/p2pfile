import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../api.js";
import PasswordDialog from "../components/PasswordDialog.jsx";
import { useSocket } from "../hooks/useSocket.jsx";
import { useWebRTC } from "../hooks/useWebRTC.js";
import { useFileTransfer } from "../hooks/useFileTransfer.js";
import FileList from "../components/FileList.jsx";
import { addTransferToHistory } from "../utils/history.js";
import { formatSize } from "../utils/format.js";
import { saveFile } from "../utils/saveFile.js";

export default function Receive() {
  const { roomId: urlRoomId } = useParams();
  const navigate = useNavigate();
  const { socket, connected } = useSocket();
  const webrtc = useWebRTC();
  const fileTransfer = useFileTransfer(webrtc.dcRef);

  const [roomId, setRoomId] = useState(urlRoomId || "");
  const [manualCode, setManualCode] = useState("");
  const [transferMeta, setTransferMeta] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState(null);

  const currentRoomId = useRef(null);
  const currentPassword = useRef(null);
  const joinedRef = useRef(false);
  const pendingJoinRef = useRef(null);

  const doJoinRoom = useCallback((rid, pw) => {
    const s = socket?.current;
    if (s?.connected) {
      currentRoomId.current = rid;
      currentPassword.current = pw || null;
      joinedRef.current = true;
      webrtc.setSocket(s);
      s.emit("room-join", { roomId: rid, password: pw || null });
    } else {
      pendingJoinRef.current = { rid, pw };
      setStatus("connecting");
    }
  }, [socket, webrtc]);

  useEffect(() => {
    if (!socket?.current || !connected) return;
    const s = socket.current;
    webrtc.setSocket(s);

    s.on("room-joined", ({ status: st, message }) => {
      if (st === "success") {
        setStatus("waiting");
      } else {
        setError(message);
        setStatus("error");
      }
    });

    s.on("signal", async ({ type, data }) => {
      const rid = currentRoomId.current;
      if (!rid) return;
      try {
        if (type === "offer") {
          webrtc.createPeerConnection(rid);
          webrtc.onDataChannel((dc) => {
            fileTransfer.setupReceiver(dc);
            if (dc.readyState === "open") {
              setStatus("receiving");
            } else {
              dc.onopen = () => setStatus("receiving");
            }
          });
          const answer = await webrtc.handleOffer(data);
          if (answer) s.emit("signal", { roomId: rid, type: "answer", data: answer });
        } else if (type === "candidate") {
          await webrtc.addIceCandidate(data);
        }
      } catch (err) {
        setError("Connection error: " + err.message);
        setStatus("error");
      }
    });

    s.on("partner-disconnected", () => {
      webrtc.close();
      setStatus("disconnected");
    });

    if (pendingJoinRef.current) {
      const { rid, pw } = pendingJoinRef.current;
      pendingJoinRef.current = null;
      currentRoomId.current = rid;
      currentPassword.current = pw || null;
      joinedRef.current = true;
      s.emit("room-join", { roomId: rid, password: pw || null });
    }

    return () => {
      s.off("room-joined");
      s.off("signal");
      s.off("partner-disconnected");
      webrtc.close();
    };
  }, [socket, connected]);

  async function fetchTransfer(rid) {
    setStatus("loading");
    setError(null);
    try {
      const res = await api.get(`/api/transfers/${rid}`);
      setTransferMeta(res.data);
      if (res.data.hasPassword) {
        setShowPassword(true);
        setStatus("password");
      } else {
        doJoinRoom(rid, null);
      }
    } catch (err) {
      setError(err.response?.data?.error || "Transfer not found");
      setStatus("error");
    }
  }

  useEffect(() => {
    if (!urlRoomId) return;
    setRoomId(urlRoomId);
    fetchTransfer(urlRoomId);
  }, [urlRoomId]);

  async function handlePasswordSubmit(pw) {
    setShowPassword(false);
    setStatus("loading");
    try {
      await api.post(`/api/transfers/${roomId}/verify-password`, { password: pw });
      doJoinRoom(roomId, pw);
    } catch {
      setError("Incorrect password");
      setStatus("error");
    }
  }

  useEffect(() => {
    if (fileTransfer.transfers.some((t) => t.status === "completed")) {
      addTransferToHistory({
        type: "received",
        files: transferMeta?.files || [],
        roomId,
      });
    }
  }, [fileTransfer.transfers, transferMeta, roomId]);

  function handleCodeSubmit(e) {
    e.preventDefault();
    if (!manualCode.trim()) return;
    const rid = manualCode.trim();
    setRoomId(rid);
    fetchTransfer(rid);
  }

  const isComplete = fileTransfer.transfers.some((t) => t.status === "completed");

  return (
    <div className="max-w-lg mx-auto px-4 py-8">
      <h2 className="text-xl font-bold mb-6">Receive Files</h2>

      {error && (
        <div className="bg-red-900/30 border border-red-800/50 rounded-xl p-4 mb-4 text-sm text-red-300">
          {error}
        </div>
      )}

      {!urlRoomId && status === "idle" && (
        <div className="space-y-6">
          <div className="border-2 border-dashed border-gray-600 rounded-xl p-8 text-center cursor-pointer hover:border-gray-400 transition-colors">
            <p className="text-gray-300 font-medium">Scan QR Code from Sender</p>
            <p className="text-gray-500 text-sm mt-1">Use your camera to scan the QR code</p>
          </div>

          <form onSubmit={handleCodeSubmit} className="space-y-3">
            <label className="block text-sm text-gray-400">Or enter transfer code:</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                placeholder="e.g. a1b2c3d4"
                className="flex-1 bg-gray-700 rounded-lg px-3 py-2 text-sm font-mono outline-none focus:ring-2 focus:ring-blue-500 uppercase"
                maxLength={8}
              />
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm transition-colors cursor-pointer"
              >
                Join
              </button>
            </div>
          </form>
        </div>
      )}

      {showPassword && (
        <PasswordDialog
          onSubmit={handlePasswordSubmit}
          onCancel={() => navigate("/")}
        />
      )}

      {transferMeta && status !== "password" && (
        <div className="bg-gray-800/60 rounded-xl p-4 border border-gray-700/50 mb-4">
          <h3 className="font-medium mb-3">Incoming Transfer</h3>
          <div className="space-y-1 text-sm">
            {transferMeta.files?.map((f, i) => (
              <div key={i} className="flex items-center justify-between text-gray-400">
                <span className="truncate">{f.name}</span>
                <span className="shrink-0 ml-2">{formatSize(f.size)}</span>
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-500 mt-3">
            {transferMeta.files?.length || 0} file{(transferMeta.files?.length || 0) !== 1 ? "s" : ""}
          </p>
        </div>
      )}

      {(status === "loading" || status === "connecting") && (
        <div className="flex items-center justify-center gap-2 text-sm text-gray-400 py-12">
          <div className="animate-spin w-5 h-5 border-2 border-blue-400 border-t-transparent rounded-full" />
          {status === "loading" ? "Loading transfer info..." : "Connecting to sender..."}
        </div>
      )}

      {status === "error" && !urlRoomId && (
        <div className="text-center py-12">
          <button
            onClick={() => { setStatus("idle"); setError(null); }}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm transition-colors cursor-pointer"
          >
            Try Again
          </button>
        </div>
      )}

      {status === "disconnected" && (
        <div className="text-center py-12">
          <p className="text-gray-400 text-sm mb-3">Sender disconnected</p>
          <button
            onClick={() => navigate("/")}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm transition-colors cursor-pointer"
          >
            Back to Home
          </button>
        </div>
      )}

      {status === "waiting" && (
        <div className="flex items-center justify-center gap-2 text-sm text-yellow-400">
          <div className="animate-pulse w-2 h-2 bg-yellow-400 rounded-full" />
          Waiting for sender to establish connection...
        </div>
      )}

      {status === "receiving" && (
        <FileList
          transfers={fileTransfer.transfers}
          onCancel={fileTransfer.abortTransfer}
        />
      )}

      {isComplete && (
        <div className="mt-4 text-center space-y-3">
          <p className="text-green-400 font-medium mb-3">Download Complete ✓</p>
          {fileTransfer.completedBlobs.map((f, i) => (
            <button
              key={i}
              onClick={() => saveFile(f.blob, f.fileName)}
              className="block w-full px-4 py-3 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm transition-colors cursor-pointer"
            >
              Save {f.fileName}
            </button>
          ))}
          <button
            onClick={() => navigate("/")}
            className="px-6 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm transition-colors cursor-pointer"
          >
            Done
          </button>
        </div>
      )}
    </div>
  );
}
