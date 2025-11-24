export default function roomIdController(req, res) {
  let room = new Map();

  function generateRoomId() {
    return  Math.random().toString(36).substring(2, 10);
  }


    let roomId = generateRoomId();

    room.set(roomId , {owner:null , guest : null , createdAt: Date.now() , used : false});
    console.log(room)

    return res.status(200).json({roomId: roomId});


}

