import { useRef, useCallback, useState } from "react";
import { ICE_SERVERS } from "../constants.js";

export function useWebRTC() {
  const pcRef = useRef(null);
  const dcRef = useRef(null);
  const socketRef = useRef(null);
  const pendingCandidatesRef = useRef([]);
  const [connectionState, setConnectionState] = useState("idle");

  const setSocket = useCallback((socket) => {
    socketRef.current = socket;
  }, []);

  const createPeerConnection = useCallback((roomId) => {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

    pc.onicecandidate = (ev) => {
      if (ev.candidate && socketRef.current?.connected) {
        socketRef.current.emit("signal", {
          roomId,
          type: "candidate",
          data: ev.candidate,
        });
      }
    };

    pc.oniceconnectionstatechange = () => {
      setConnectionState(pc.iceConnectionState);
    };

    pc.onsignalingstatechange = () => {
      console.log("Signaling state:", pc.signalingState);
    };

    pcRef.current = pc;
    return pc;
  }, []);

  const createDataChannel = useCallback((label = "file-transfer") => {
    if (!pcRef.current) return null;
    const dc = pcRef.current.createDataChannel(label, {
      ordered: true,
    });
    dcRef.current = dc;
    return dc;
  }, []);

  const onDataChannel = useCallback((handler) => {
    if (!pcRef.current) return;
    pcRef.current.ondatachannel = (event) => {
      if (!dcRef.current || dcRef.current.readyState === "closed") {
        dcRef.current = event.channel;
      }
      handler(event.channel);
    };
  }, []);

  const createOffer = useCallback(async () => {
    if (!pcRef.current) return null;
    const offer = await pcRef.current.createOffer();
    await pcRef.current.setLocalDescription(offer);
    return pcRef.current.localDescription;
  }, []);

  const handleOffer = useCallback(async (data) => {
    if (!pcRef.current) return;
    await pcRef.current.setRemoteDescription(data);
    const answer = await pcRef.current.createAnswer();
    await pcRef.current.setLocalDescription(answer);
    const pending = pendingCandidatesRef.current;
    pendingCandidatesRef.current = [];
    for (const c of pending) {
      try {
        await pcRef.current.addIceCandidate(c);
      } catch (err) {
        console.error("addIceCandidate error:", err);
      }
    }
    return pcRef.current.localDescription;
  }, []);

  const handleAnswer = useCallback(async (data) => {
    if (!pcRef.current) return;
    await pcRef.current.setRemoteDescription(data);
    const pending = pendingCandidatesRef.current;
    pendingCandidatesRef.current = [];
    for (const c of pending) {
      try {
        await pcRef.current.addIceCandidate(c);
      } catch (err) {
        console.error("addIceCandidate error:", err);
      }
    }
  }, []);

  const addIceCandidate = useCallback(async (data) => {
    if (!pcRef.current || !data) return;
    const pc = pcRef.current;
    if (pc.currentRemoteDescription || pc.remoteDescription) {
      try {
        await pc.addIceCandidate(data);
      } catch (err) {
        console.error("addIceCandidate error:", err);
      }
    } else {
      pendingCandidatesRef.current.push(data);
    }
  }, []);

  const close = useCallback(() => {
    if (dcRef.current) {
      dcRef.current.close();
      dcRef.current = null;
    }
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    pendingCandidatesRef.current = [];
    setConnectionState("idle");
  }, []);

  return {
    pcRef,
    dcRef,
    connectionState,
    setSocket,
    createPeerConnection,
    createDataChannel,
    onDataChannel,
    createOffer,
    handleOffer,
    handleAnswer,
    addIceCandidate,
    close,
  };
}
