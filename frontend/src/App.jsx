import { useEffect, useRef, useState } from "react";
import axios from "axios";
import { connectWebSocket } from "./helper/ws.js";

function App() {
  const socket = useRef(null);
  const pcRef = useRef(null); 
  const dcRef = useRef(null);
  const roomIdRef = useRef(null); 
  const roleRef = useRef(null); 
  const [roomId, setRoomId] = useState(""); 
  const [role, setRole] = useState("default");
  const [status, setStatus] = useState("idle");

  const ICE_SERVERS = [
    { urls: "stun:stun.l.google.com:19302" },
  ];

  function createPeerConnection(currentRoomId) {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    console.log("this is ice server ", ICE_SERVERS[0].urls);

    pc.onicecandidate = (ev) => {
      if (ev.candidate && socket.current) {
        socket.current.emit("signal", {
          roomId: currentRoomId,
          type: "candidate",
          data: ev.candidate,
        });
      }
    };

    pc.oniceconnectionstatechange = () => {
      console.log("ICE state:", pc.iceConnectionState);
    };

    return pc;
  }

  useEffect(() => {
    const s = connectWebSocket();
    socket.current = s;
    console.log("the role is ig", role);

    const params = new URLSearchParams(window.location.search);
    const idFromUrl = params.get("roomId");

    const initialRole = idFromUrl ? "guest" : "owner";
    setRole(initialRole);
    roleRef.current = initialRole;

    if (idFromUrl) setRoomId(idFromUrl);
    roomIdRef.current = idFromUrl;

    s.on("connect", () => {
      console.log("socket connected:", s.id, "as", initialRole);


      if (initialRole === "guest" && idFromUrl) {
        setStatus("joining");
        s.emit("room-join", { roomId: idFromUrl });
      }

    });

 
    s.on("room-joined", async ({ roomId }) => {
      console.log("thisssss is ", roomId);
      // yeh OWNER ke liye hai
      console.log(
        "room-joined event, starting WebRTC as OWNER for room",
        roomId
      );
      setStatus("starting-webrtc-owner");

      const pc = createPeerConnection(roomId);
      pcRef.current = pc;

      // OWNER creates DataChannel
      const dc = pc.createDataChannel("chat");
      dcRef.current = dc;

      dc.onopen = () => {
        console.log("DataChannel OPEN (owner side)");
        // test message
        dc.send("hello from owner");
      };

      dc.onmessage = (ev) => {
        console.log("OWNER got from DC:", ev.data);
      };

      const offer = await pc.createOffer();
      // console.log("thiiiisss is offerrrr", offer);
      await pc.setLocalDescription(offer);
      // console.log("this is pc " , pc)

      s.emit("signal", {
        roomId,
        type: "offer",
        data: pc.localDescription,
      });
    });


    s.on("signal", async ({ type, data, roomId }) => {
      // console.log(`the type is ${type} data is ${JSON.stringify(data)}`)
      const thisRole = roleRef.current;
      console.log("the type of offer is ", type);
      console.log("this is the role ig", thisRole);
      const currentRoomId = roomIdRef.current || roomId;

      // GUEST handles OFFER
      if (type === "offer" && thisRole === "guest") {
        console.log("GUEST: got offer");
        setStatus("got-offer");

        const pc = createPeerConnection(currentRoomId);
        pcRef.current = pc;

        pc.ondatachannel = (event) => {
          const dc = event.channel;
          dcRef.current = dc;

          dc.onopen = () => {
            console.log("DataChannel OPEN (guest side)");
            dc.send("hello from guest");
          };

          dc.onmessage = (e) => {
            console.log("GUEST got from DC:", e.data);
          };
        };

        await pc.setRemoteDescription(data);
        const answer = await pc.createAnswer();

        await pc.setLocalDescription(answer);

        s.emit("signal", {
          roomId: currentRoomId,
          type: "answer",
          data: pc.localDescription,
        });
      }

      // OWNER handles ANSWER
      if (type === "answer" && thisRole === "owner") {
        console.log("OWNER: got answer");
        if (!pcRef.current) return;
        await pcRef.current.setRemoteDescription(data);
        setStatus("webrtc-connected");
      }

      // BOTH handle CANDIDATE
      if (
        type === "candidate" &&
        (thisRole === "owner" || thisRole === "guest")
      ) {
        if (pcRef.current && data) {
          try {
            await pcRef.current.addIceCandidate(data);
            console.log("Added ICE candidate");
          } catch (err) {
            console.error("addIceCandidate error", err);
          }
        }
      }
    });

    s.on("error-msg", ({ reason }) => {
      console.log("server error-msg:", reason);
      setStatus("error: " + reason);
    });

    return () => {
      s.off("connect");
      s.off("room-joined");
      s.off("signal");
      s.off("error-msg");
      s.disconnect();
    };
  
  }, []); 

  async function createRoom() {
    try {
      const res = await axios.post("http://localhost:3000/api/createroom");
      const newRoomId = res.data.roomId || res.data.RoomId;
      if (!newRoomId) {
        console.error("No roomId in response", res.data);
        return;
      }

      console.log("Created room:", newRoomId);
      setRoomId(newRoomId);
      roomIdRef.current = newRoomId;
      setStatus("room-created");

      if (socket.current) {
        socket.current.emit("claim-room", { roomId: newRoomId });
      }
    } catch (err) {
      console.error(err);
      setStatus("error creating room");
    }
  }

  return (
    <>
      <h1>P2P WebRTC Test</h1>
      <p>Role: {role || "-"}</p>
      <p>Status: {status}</p>
      <button onClick={() => dcRef.current?.send("hww")}>hellow</button>

      {role === "owner" && (
        <>
          <button onClick={createRoom}>Create Room</button>
          <p>Share this link once created:</p>
          <code>http://localhost:5173/?roomId={roomId}</code>
        </>
      )}

      {role === "guest" && (
        <>
          <p>
            Joining as guest, roomId from URL: <strong>{roomId}</strong>
          </p>
          <p>Check console logs for WebRTC / DataChannel events.</p>
        </>
      )}
    </>
  );
}

export default App;
