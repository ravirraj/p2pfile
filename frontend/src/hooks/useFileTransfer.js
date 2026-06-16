import { useState, useCallback, useRef } from "react";
import { chunkFile, getFileMetadata, computeFileHash } from "../utils/chunker.js";
import { Reassembler } from "../utils/reassembler.js";
import { saveTransferState, clearTransferState, getSenderState, getReceiverState } from "../utils/transferState.js";
import { TRANSFER_EVENTS, CHUNK_SIZE } from "../constants.js";

function notifyComplete(fileName) {
  if ("Notification" in window && Notification.permission === "granted") {
    new Notification("PeerFlow — Transfer Complete", {
      body: `${fileName} has been transferred successfully.`,
    });
  }
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.setValueAtTime(1100, ctx.currentTime + 0.08);
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.2);
  } catch {}
}

export function useFileTransfer(dcRef) {
  const [transfers, setTransfers] = useState([]);
  const [incomingMeta, setIncomingMeta] = useState(null);
  const [completedBlobs, setCompletedBlobs] = useState([]);
  const reassemblerRef = useRef(null);
  const sendingRef = useRef(false);
  const abortedRef = useRef(false);
  const queueRef = useRef([]);
  const [queueLength, setQueueLength] = useState(0);
  const onCompleteRef = useRef(null);

  const setOnComplete = useCallback((fn) => {
    onCompleteRef.current = fn;
  }, []);

  const sendFile = useCallback(async (file) => {
    if (!dcRef.current || dcRef.current.readyState !== "open") {
      console.error("DataChannel not open");
      return;
    }
    if (sendingRef.current) return;

    sendingRef.current = true;
    abortedRef.current = false;

    const metadata = getFileMetadata(file);
    const fileHash = await computeFileHash(file);
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE);

    const transfer = {
      id: `${metadata.name}-${Date.now()}`,
      fileName: metadata.name,
      fileSize: metadata.size,
      type: "send",
      status: "sending",
      progress: 0,
      bytesSent: 0,
      speed: 0,
      eta: null,
      totalChunks,
    };

    setTransfers((prev) => [...prev, transfer]);

    const existingState = getSenderState(metadata.name);
    const startChunk = existingState?.sentChunks?.length || 0;

    dcRef.current.bufferedAmountLowThreshold = CHUNK_SIZE * 4;

    dcRef.current.send(JSON.stringify({
      type: TRANSFER_EVENTS.FILE_META,
      metadata,
      fileHash,
      startChunk,
    }));

    const startTime = Date.now();
    let lastUpdate = startTime;
    let lastBytes = 0;

    let chunkIndex = 0;
    for await (const chunk of chunkFile(file)) {
      if (abortedRef.current) break;
      if (chunk.index < startChunk) {
        chunkIndex++;
        continue;
      }

      while (dcRef.current.bufferedAmount > dcRef.current.bufferedAmountLowThreshold) {
        await new Promise((resolve) => {
          dcRef.current.addEventListener("bufferedamountlow", resolve, { once: true });
        });
        if (abortedRef.current) break;
      }
      if (abortedRef.current) break;

      const headerStr = JSON.stringify({
        type: TRANSFER_EVENTS.CHUNK,
        index: chunk.index,
        hash: chunk.hash,
        totalChunks: chunk.totalChunks,
      });

      const header = new TextEncoder().encode(headerStr);
      const headerLen = new Uint8Array(4);
      new DataView(headerLen.buffer).setUint32(0, header.byteLength, true);

      const data = new Uint8Array(chunk.data);
      const msg = new Uint8Array(4 + header.byteLength + data.byteLength);
      msg.set(headerLen, 0);
      msg.set(header, 4);
      msg.set(data, 4 + header.byteLength);

      dcRef.current.send(msg);

      const now = Date.now();
      const bytesSent = (chunkIndex + 1) * CHUNK_SIZE;

      if (now - lastUpdate > 200) {
        const deltaBytes = bytesSent - lastBytes;
        const deltaTime = (now - lastUpdate) / 1000;
        const speed = deltaBytes / deltaTime;
        const remaining = metadata.size - Math.min(bytesSent, metadata.size);
        const eta = speed > 0 ? remaining / speed : null;

        setTransfers((prev) =>
          prev.map((t) =>
            t.id === transfer.id
              ? { ...t, progress: Math.min(Math.round((bytesSent / metadata.size) * 100), 100), bytesSent, speed, eta }
              : t
          )
        );

        saveTransferState(metadata.name, {
          role: "sender",
          fileName: metadata.name,
          fileHash,
          totalChunks,
          sentChunks: Array.from({ length: chunkIndex + 1 }, (_, i) => i),
        });

        lastUpdate = now;
        lastBytes = bytesSent;
      }

      chunkIndex++;
    }

    if (!abortedRef.current) {
      dcRef.current.send(JSON.stringify({
        type: TRANSFER_EVENTS.TRANSFER_COMPLETE,
        fileName: metadata.name,
        fileHash,
      }));

      setTransfers((prev) =>
        prev.map((t) =>
          t.id === transfer.id
            ? { ...t, status: "completed", progress: 100 }
            : t
        )
      );

      clearTransferState(metadata.name);
      notifyComplete(metadata.name);
      onCompleteRef.current?.(metadata.name);
    }

    sendingRef.current = false;

    const next = queueRef.current.shift();
    setQueueLength(queueRef.current.length);
    if (next) {
      sendFile(next);
    }
  }, [dcRef]);

  const enqueueFiles = useCallback((files) => {
    queueRef.current.push(...files);
    setQueueLength(queueRef.current.length);
    if (!sendingRef.current && queueRef.current.length > 0) {
      const next = queueRef.current.shift();
      setQueueLength(queueRef.current.length);
      sendFile(next);
    }
  }, [sendFile]);

  const setupReceiver = useCallback((dc) => {
    dc.binaryType = "arraybuffer";

    dc.onmessage = async (ev) => {
      if (typeof ev.data === "string") {
        try {
          const msg = JSON.parse(ev.data);
          if (msg.type === TRANSFER_EVENTS.FILE_META) {
            const existingState = getReceiverState(msg.metadata.name);
            const reassembler = new Reassembler(msg.metadata);
            reassemblerRef.current = reassembler;
            setIncomingMeta(msg.metadata);

            if (existingState) {
              reassembler.restoreState(existingState);
              const missing = reassembler.getMissingChunks();
              dc.send(JSON.stringify({
                type: TRANSFER_EVENTS.REQUEST_RESUME,
                fileName: msg.metadata.name,
                missingChunks: missing,
              }));
              setTransfers((prev) => [
                ...prev,
                {
                  id: `${msg.metadata.name}-${Date.now()}`,
                  fileName: msg.metadata.name,
                  fileSize: msg.metadata.size,
                  type: "receive",
                  status: "resuming",
                  progress: reassembler.getProgress().percent,
                  bytesReceived: existingState.receivedChunks.length * CHUNK_SIZE,
                  totalChunks: reassembler.totalChunks,
                },
              ]);
            } else {
              setTransfers((prev) => [
                ...prev,
                {
                  id: `${msg.metadata.name}-${Date.now()}`,
                  fileName: msg.metadata.name,
                  fileSize: msg.metadata.size,
                  type: "receive",
                  status: "receiving",
                  progress: 0,
                  bytesReceived: 0,
                  totalChunks: reassembler.totalChunks,
                },
              ]);
            }
          } else if (msg.type === TRANSFER_EVENTS.TRANSFER_COMPLETE) {
            const reassembler = reassemblerRef.current;
            if (!reassembler) return;

            const missing = reassembler.getMissingChunks();
            if (missing.length > 0) {
              dc.send(JSON.stringify({
                type: TRANSFER_EVENTS.REQUEST_RESUME,
                fileName: msg.fileName,
                missingChunks: missing,
              }));
              return;
            }

            const blob = reassembler.assemble();
            if (blob) {
              clearTransferState(msg.fileName);
              setCompletedBlobs((prev) => [...prev, { fileName: msg.fileName, blob, url: URL.createObjectURL(blob) }]);
              setTransfers((prev) =>
                prev.map((t) =>
                  t.fileName === msg.fileName
                    ? { ...t, status: "completed", progress: 100 }
                    : t
                )
              );
              notifyComplete(msg.fileName);
            }
          } else if (msg.type === TRANSFER_EVENTS.REQUEST_RESUME) {
            setTransfers((prev) =>
              prev.map((t) =>
                t.fileName === msg.fileName
                  ? { ...t, status: "resuming" }
                  : t
              )
            );
          } else if (msg.type === TRANSFER_EVENTS.TRANSFER_ERROR) {
            setTransfers((prev) =>
              prev.map((t) =>
                t.fileName === msg.fileName
                  ? { ...t, status: "error", error: msg.error }
                  : t
              )
            );
          }
        } catch {
          // not JSON, ignore
        }
        return;
      }

      if (ev.data instanceof ArrayBuffer || ev.data instanceof Uint8Array) {
        const bytes = new Uint8Array(ev.data);
        if (bytes.length < 4) return;

        const headerLen = new DataView(bytes.buffer, bytes.byteOffset, 4).getUint32(0, true);
        if (bytes.length < 4 + headerLen) return;

        const headerStr = new TextDecoder().decode(bytes.slice(4, 4 + headerLen));
        const meta = JSON.parse(headerStr);

        const chunkData = bytes.slice(4 + headerLen);
        processChunk(meta, chunkData.buffer);
      }
    };

    async function processChunk(meta, data) {
      const reassembler = reassemblerRef.current;
      if (!reassembler) return;

      try {
        await reassembler.addChunk(meta.index, data, meta.hash);
        const progress = reassembler.getProgress();
        const bytesReceived = progress.received * CHUNK_SIZE;

        setTransfers((prev) =>
          prev.map((t) =>
            t.fileName === reassembler.metadata.name
              ? { ...t, progress: progress.percent, bytesReceived }
              : t
          )
        );

        saveTransferState(reassembler.metadata.name, reassembler.getState());

        dc.send(JSON.stringify({
          type: TRANSFER_EVENTS.CHUNK_ACK,
          index: meta.index,
        }));
      } catch (err) {
        console.error("Chunk integrity error:", err);
      }
    }
  }, []);

  const abortTransfer = useCallback((fileName) => {
    abortedRef.current = true;
    sendingRef.current = false;
    setTransfers((prev) =>
      prev.map((t) =>
        t.fileName === fileName
          ? { ...t, status: "aborted" }
          : t
      )
    );
  }, []);

  const clearTransfers = useCallback(() => {
    abortedRef.current = true;
    sendingRef.current = false;
    queueRef.current = [];
    setQueueLength(0);
    setTransfers([]);
    setIncomingMeta(null);
  }, []);

  return {
    transfers,
    incomingMeta,
    queueLength,
    completedBlobs,
    sendFile,
    enqueueFiles,
    setupReceiver,
    abortTransfer,
    clearTransfers,
    setOnComplete,
  };
}
