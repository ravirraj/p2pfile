import { useState } from "react";
import { useEffect } from "react";
import { connectWebSocket } from "./helper/ws.js";
import { useRef } from "react";
import axios from "axios";

function App() {
  const socket = useRef(null);
  const [url, setUrl] = useState("");
  const [role, setRole] = useState("");
  useEffect(() => {
    socket.current = connectWebSocket();
  }, []);

  useEffect(() => {
    const parms = new URLSearchParams(window.location.search);
    const roomId = parms.get("roomId");
    console.log(roomId);
    if (roomId) {
      setUrl(roomId);
      setRole("guest");
      socket.current.emit("room-join", { roomId: roomId });
    }
  }, []);

  function createRoom() {
    axios
      .post("http://localhost:3000/api/createroom")
      .then((res) => {
        console.log(res.data.RoomId);
        setUrl(res.data.RoomId);
        socket.current.emit("claim-room", { roomId: res.data.RoomId });
      })
      .catch((err) => {
        console.log(err);
      });
  }

  return (
    <>
      <h1>this is something</h1>
      <button onClick={() => createRoom()}>Click me </button>
      <p>{"http://localhost:5173/?roomId=" + url}</p>
    </>
  );
}

export default App;
