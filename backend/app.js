import express from "express";
import { Server } from "socket.io";
import { createServer } from "http";

import cors from "cors";

import roomIdRoutes from "./src/routes/roomId.routes.js";

const app = express();
app.use(cors());
app.use(express.json());

const httpServer = createServer(app);

const room = new Map();

//this is a function to generate random room id
function generateRoomId() {
  return Math.random().toString(36).substring(2, 10);
}

//route to generate a new room id
app.post("/api/createroom", (req, res) => {
  let roomId = generateRoomId();
  room.set(roomId, {
    owner: null,
    guest: null,
    createedAt: Date.now(),
    used: false,
  });
  return res.status(200).json({ RoomId: roomId });
});

const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

app.use("/api", roomIdRoutes);

io.on("connection", (socket) => {
  console.log("a user connected", socket.id);
  socket.data.roomId = null;
  socket.data.owner = null;
  socket.data.guest = null;
  socket.data.createedAt = null;

  socket.on("claim-room", ({ roomId }) => {
    if (room.has(roomId)) {
      socket.data.roomId = roomId;
      socket.data.owner = socket.id;
      socket.data.createedAt = Date.now();
      socket.data.used = false;
      let roomInfo = room.get(roomId);
      roomInfo.owner = socket.id;
      room.set(roomId, roomInfo);

      socket.join(roomId);
      socket.emit("room-claimed", { status: "success", role: "owner" });
      console.log("user joined ", roomId, roomInfo);
    } else {
      socket.emit("room-claimed", {
        status: "failed",
        message: "Room does not exist",
      });
    }
  });

  socket.on("room-join", ({ roomId }) => {
    let roomInfo = room.get(roomId);
    console.log("this is room", roomInfo)
    if (!roomInfo) {
      console.log("no rooooom");
      socket.emit("room-joined", {
        status: "failed",
        message: "Room does not exist",
      });
      return;
    }
    if (roomInfo?.guest) {
      console.log("room is full");
      socket.emit("room-joined", { status: "failed", message: "Room is full" });
      return;
    }
    // if (roomInfo.used === false) {
    //   socket.emit("room-joined", {
    //     status: "failed",
    //     message: "Room is not claimed yet",
    //   });
    //   return;
    // }

    socket.data.roomId = roomId;
    socket.data.guest = socket.id;
    socket.data.createedAt = Date.now();
    socket.data.used = true;

    roomInfo.guest = socket.id;
    room.set(roomId, roomInfo);

    socket.join(roomId);
    console.log("guest joined ", roomInfo);
    socket.emit("room-joined", { status: "success", role: "guest" , roomId });
    io.to(roomInfo.owner).emit("room-joined", { roomId });
  });

  socket.on("signal", ({ roomId, type, data }) => {
    const rooms = room.get(roomId);
    console.log(rooms)
    if (!rooms) return;

    let targeiD = null;

    if (socket.id === rooms.owner) targeiD = rooms.guest;
   else if (socket.id === rooms.guest) targeiD = rooms.owner;

    if(!targeiD) return

    console.log("this is target id", targeiD);
    // console.log(`emitting signal ${type} to ${targeiD} and data is ${JSON.stringify(data)}`);

    io.to(targeiD).emit("signal", { type, data, roomId });
  });
});

httpServer.listen(3000, () => {
  console.log("listening on *:3000");
});
