import { useState, useCallback, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import QRDisplay from "../components/QRDisplay.jsx";
import FilePreview from "../components/FilePreview.jsx";
import { useSocket } from "../hooks/useSocket.jsx";
import { useWebRTC } from "../hooks/useWebRTC.js";
import { useFileTransfer } from "../hooks/useFileTransfer.js";
import FileList from "../components/FileList.jsx";
import { addTransferToHistory } from "../utils/history.js";
import { generateEncryptionKey, exportKey } from "../utils/crypto.js";
import { formatSize } from "../utils/format.js";

export default function Send() {
  const navigate = useNavigate();
  const { socket, connected } = useSocket();
  const webrtc = useWebRTC();
  const fileTransfer = useFileTransfer(webrtc.dcRef);

  const [files, setFiles] = useState([]);
  const [password, setPassword] = useState("");
  const [hasPassword, setHasPassword] = useState(false);
  const [transfer, setTransfer] = useState(null);
  const [transferCode, setTransferCode] = useState("");
  const [peerConnected, setPeerConnected] = useState(false);
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState(null);
  const [folderCount, setFolderCount] = useState(0);

  const fileInputRef = useRef(null);
  const pendingClaimRef = useRef(null);

  const resetState = useCallback(() => {
    webrtc.close();
    fileTransfer.clearTransfers();
    setFiles([]);
    setPassword("");
    setHasPassword(false);
    setTransfer(null);
    setTransferCode("");
    setPeerConnected(false);
    setStatus("idle");
    setError(null);
    setFolderCount(0);
  }, [webrtc, fileTransfer]);

  useEffect(() => {
    if (!socket?.current || !connected) return;
    const s = socket.current;
    webrtc.setSocket(s);

    s.on("room-claimed", ({ status: st, message }) => {
      if (st === "success") {
        setStatus("waiting");
      } else {
        setError(message);
        setStatus("error");
      }
    });

    s.on("room-joined", async ({ roomId: rid }) => {
      setStatus("connecting");
      try {
        webrtc.createPeerConnection(rid);
        webrtc.onDataChannel((dc) => {
          fileTransfer.setupReceiver(dc);
          if (dc.readyState === "open") {
            setPeerConnected(true);
            setStatus("transferring");
          } else {
            dc.onopen = () => { setPeerConnected(true); setStatus("transferring"); };
          }
        });
        const dc = webrtc.createDataChannel();
        if (dc) dc.onopen = () => { setPeerConnected(true); setStatus("transferring"); };
        const offer = await webrtc.createOffer();
        if (offer) s.emit("signal", { roomId: rid, type: "offer", data: offer });
      } catch (err) {
        setError("Failed to establish connection: " + err.message);
        setStatus("error");
      }
    });

    s.on("signal", async ({ type, data, roomId: rid }) => {
      try {
        if (type === "answer") {
          await webrtc.handleAnswer(data);
        } else if (type === "candidate") {
          await webrtc.addIceCandidate(data);
        }
      } catch (err) {
        setError("Signal error: " + err.message);
      }
    });

    s.on("peer-disconnected", () => {
      webrtc.close();
      setPeerConnected(false);
      setStatus("disconnected");
    });

    if (pendingClaimRef.current) {
      const { roomId, pw } = pendingClaimRef.current;
      pendingClaimRef.current = null;
      s.emit("claim-room", { roomId, password: pw });
    }

    return () => {
      s.off("room-claimed");
      s.off("room-joined");
      s.off("signal");
      s.off("peer-disconnected");
      webrtc.close();
    };
  }, [socket, connected]);

  const handleFilesSelected = useCallback((newFiles) => {
    setFiles((prev) => [...prev, ...newFiles]);
  }, []);

  async function handleFolderSelect() {
    if (!window.showDirectoryPicker) {
      setError("Folder selection is only supported in Chromium-based browsers. Please select files individually instead.");
      return;
    }
    try {
      const dirHandle = await window.showDirectoryPicker();
      const entries = [];
      async function walk(dir, path) {
        for await (const entry of dir.values()) {
          if (entry.kind === "file") {
            const file = await entry.getFile();
            Object.defineProperty(file, "webkitRelativePath", { value: path + entry.name });
            entries.push(file);
          } else if (entry.kind === "directory") {
            await walk(entry, path + entry.name + "/");
          }
        }
      }
      await walk(dirHandle, dirHandle.name + "/");
      setFiles((prev) => [...prev, ...entries]);
      setFolderCount((prev) => prev + 1);
    } catch (err) {
      if (err.name !== "AbortError") {
        setError("Failed to read folder: " + err.message);
      }
    }
  }

  async function handleCreateTransfer() {
    if (files.length === 0) return;
    setError(null);
    setStatus("creating");

    const fileMeta = files.map((f) => ({
      name: f.name,
      size: f.size,
      type: f.type || "application/octet-stream",
    }));

    try {
      const pw = hasPassword ? password : null;
      const res = await axios.post("/api/transfers", { files: fileMeta, password: pw });
      const { roomId } = res.data;

      const link = `${window.location.origin}/receive/${roomId}`;
      const code = roomId;

      setTransfer({ roomId, link });
      setTransferCode(code);

      const s = socket.current;
      if (s?.connected) {
        s.emit("claim-room", { roomId, password: pw });
      } else {
        pendingClaimRef.current = { roomId, pw };
      }

      setStatus("waiting");
    } catch (err) {
      setError(err.response?.data?.error || "Failed to create transfer");
      setStatus("error");
    }
  }

  useEffect(() => {
    if (!peerConnected) return;
    if (fileTransfer.transfers.length === 0 && files.length > 0) {
      fileTransfer.enqueueFiles(files);
    }
  }, [peerConnected, files]);

  useEffect(() => {
    if (fileTransfer.transfers.some((t) => t.status === "completed")) {
      addTransferToHistory({
        type: "sent",
        files: files.map((f) => ({ name: f.name, size: f.size })),
        roomId: transfer?.roomId,
      });
    }
  }, [fileTransfer.transfers, files, transfer]);

  const totalSize = files.reduce((s, f) => s + f.size, 0);
  const inviteUrl = transfer?.link || "";
  const isComplete = fileTransfer.transfers.some((t) => t.status === "completed");

  return (
    <div className="max-w-lg mx-auto px-4 py-8">
      <h2 className="text-xl font-bold mb-6">Send Files</h2>

      {error && (
        <div className="bg-red-900/30 border border-red-800/50 rounded-xl p-4 mb-4 text-sm text-red-300">
          {error}
        </div>
      )}

      {status === "idle" && (
        <div className="space-y-4">
          <div
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-gray-600 rounded-xl p-8 text-center cursor-pointer hover:border-gray-400 transition-colors"
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={(e) => handleFilesSelected(Array.from(e.target.files))}
            />
            <svg className="w-10 h-10 mx-auto mb-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
              />
            </svg>
            <p className="text-gray-300 font-medium">Click to select files</p>
            <p className="text-gray-500 text-sm mt-1">Or drag and drop files here</p>
          </div>

          <button
            onClick={handleFolderSelect}
            className="w-full py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm transition-colors cursor-pointer"
          >
            Select Folder
          </button>

          {files.length > 0 && (
            <div className="bg-gray-800/60 rounded-xl p-4 border border-gray-700/50">
              <p className="text-sm text-gray-300 mb-2">
                {files.length} file{files.length !== 1 ? "s" : ""} — {formatSize(totalSize)}
              </p>
              <div className="max-h-40 overflow-y-auto space-y-1">
                {files.map((f, i) => (
                  <div key={i} className="flex items-center justify-between text-xs text-gray-400">
                    <span className="truncate">{f.name}</span>
                    <span className="shrink-0 ml-2">{formatSize(f.size)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <label className="flex items-center gap-2 text-sm text-gray-400 cursor-pointer">
            <input
              type="checkbox"
              checked={hasPassword}
              onChange={(e) => setHasPassword(e.target.checked)}
              className="rounded"
            />
            Password protect transfer
          </label>

          {hasPassword && (
            <input
              type="text"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter a password"
              className="w-full bg-gray-700 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
            />
          )}

          <button
            onClick={handleCreateTransfer}
            disabled={files.length === 0}
            className="w-full py-3 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-500 rounded-xl font-medium transition-colors cursor-pointer disabled:cursor-not-allowed"
          >
            Create Transfer
          </button>
        </div>
      )}

      {status === "creating" && (
        <div className="flex items-center justify-center gap-2 text-sm text-gray-400 py-12">
          <div className="animate-spin w-5 h-5 border-2 border-blue-400 border-t-transparent rounded-full" />
          Creating transfer...
        </div>
      )}

      {status === "connecting" && (
        <div className="flex items-center justify-center gap-2 text-sm text-yellow-400 py-12">
          <div className="animate-pulse w-2 h-2 bg-yellow-400 rounded-full" />
          Establishing secure connection...
        </div>
      )}

      {status === "error" && !error && (
        <div className="text-center py-12">
          <p className="text-red-400 text-sm mb-3">Something went wrong</p>
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
          <p className="text-gray-400 text-sm mb-3">Peer disconnected</p>
          <button
            onClick={resetState}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm transition-colors cursor-pointer"
          >
            Start New Transfer
          </button>
        </div>
      )}

      {status === "waiting" && transfer && (
        <div className="text-center space-y-4">
          <h3 className="text-lg font-semibold">Transfer Ready</h3>
          <p className="text-sm text-gray-400">Share with the receiver:</p>

          <QRDisplay value={inviteUrl} />

          <div className="bg-gray-800 rounded-xl p-4 border border-gray-700/50 space-y-3">
            <div>
              <p className="text-xs text-gray-500 mb-1">Transfer Code</p>
              <p className="text-2xl font-mono font-bold tracking-widest">{transferCode}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Shareable Link</p>
              <div className="flex items-center gap-2">
                <input
                  readOnly
                  value={inviteUrl}
                  className="flex-1 bg-gray-700 rounded-lg px-3 py-2 text-xs font-mono select-all outline-none"
                  onClick={(e) => e.target.select()}
                />
                <button
                  onClick={() => navigator.clipboard?.writeText(inviteUrl)}
                  className="px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-xs transition-colors cursor-pointer shrink-0"
                >
                  Copy
                </button>
              </div>
            </div>
          </div>

          <div className="bg-gray-800/60 rounded-xl p-4 border border-gray-700/50">
            <p className="text-sm text-gray-300 mb-2">
              {files.length} file{files.length !== 1 ? "s" : ""} — {formatSize(totalSize)}
            </p>
            <div className="text-xs text-gray-400">
              {files.slice(0, 5).map((f, i) => (
                <p key={i} className="truncate">{f.name}</p>
              ))}
              {files.length > 5 && <p className="text-gray-500 mt-1">...and {files.length - 5} more</p>}
            </div>
          </div>

          <div className="flex items-center justify-center gap-2 text-sm text-yellow-400">
            <div className="animate-pulse w-2 h-2 bg-yellow-400 rounded-full" />
            Waiting for receiver to connect...
          </div>
        </div>
      )}

      {status === "transferring" && (
        <div className="space-y-4">
          <div className="bg-gray-800 rounded-xl p-4 border border-gray-700/50 text-center">
            <p className="text-green-400 font-medium mb-1">Receiver Connected</p>
            <p className="text-xs text-gray-400">Transferring {files.length} file{files.length !== 1 ? "s" : ""}</p>
          </div>

          <FileList
            transfers={fileTransfer.transfers}
            onCancel={fileTransfer.abortTransfer}
          />
        </div>
      )}

      {isComplete && (
        <div className="mt-4 text-center">
          <p className="text-green-400 font-medium mb-3">Transfer Complete ✓</p>
          <button
            onClick={resetState}
            className="px-6 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm transition-colors cursor-pointer"
          >
            Send Another
          </button>
        </div>
      )}
    </div>
  );
}
