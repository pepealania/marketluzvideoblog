const socket = io("https://marketluzvideoblog.onrender.com/");

const localVideo = document.getElementById("localVideo");
const remoteVideo = document.getElementById("remoteVideo");

let localStream;
// let peerConnection;
// let remoteUserId;
let peers = {};
let pendingCandidates = [];
let availableSlots = [
  document.getElementById("remoteVideo"),
  document.getElementById("remoteVideo1"),
  document.getElementById("remoteVideo2")
];
const config = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    {
      urls: "turn:openrelay.metered.ca:80",
      username: "openrelayproject",
      credential: "openrelayproject"
    }
  ]
};

async function start() {
  try {
    // 1. Get camera + mic
    localStream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: true
    });

    // 2. Assign LOCAL stream → slot 2
    const localVideo = document.getElementById("localVideo");
    localVideo.srcObject = localStream;

    console.log("Local stream ready");

    // 3. Join room
    const roomId = prompt("Enter room ID");
    socket.emit("join-room", roomId);

    console.log("Joined room:", roomId);

  } catch (err) {
    console.error("Error accessing media devices:", err);
  }
}

socket.on("user-joined", async (userId) => {
  console.log("User joined:", userId);

  const pc = createPeerConnection(userId);
  peers[userId] = pc;

  // 🎯 assign next available box
  const slot = availableSlots.find(v => !Object.values(userSlots).includes(v));
  if (!slot) return;

  userSlots[userId] = slot;

  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);

  socket.emit("signal", {
    to: userId,
    signal: offer
  });
});

// socket.on("user-joined", async (userId) => {
//   if (peerConnection) return;

//   console.log("ok user joined");

//   remoteUserId = userId;
//   createPeerConnection();

//   const offer = await peerConnection.createOffer();
//   await peerConnection.setLocalDescription(offer);

//   socket.emit("signal", {
//     to: remoteUserId,
//     signal: peerConnection.localDescription
//   });
// });

socket.on("signal", async ({ from, signal }) => {
  let pc = peers[from];

  if (!pc) {
    pc = createPeerConnection(from);
    peers[from] = pc;

    const slot = availableSlots.find(v => !Object.values(userSlots).includes(v));
    if (!slot) return;

    userSlots[from] = slot;
  }

  if (signal.type === "offer") {
    await pc.setRemoteDescription(signal);

    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    socket.emit("signal", {
      to: from,
      signal: answer
    });
  }

  if (signal.type === "answer") {
    await pc.setRemoteDescription(signal);
  }

  if (signal.type === "candidate") {
    await pc.addIceCandidate(signal.candidate);
  }
});

// socket.on("signal", async ({ from, signal }) => {
//   if (!peerConnection) {
//     remoteUserId = from;
//     createPeerConnection();
//   }

//   if (signal.type === "offer") {
//     await peerConnection.setRemoteDescription(signal);

//     const answer = await peerConnection.createAnswer();
//     await peerConnection.setLocalDescription(answer);

//     socket.emit("signal", {
//       to: from,
//       signal: peerConnection.localDescription
//     });

//     pendingCandidates.forEach(c =>
//       peerConnection.addIceCandidate(c)
//     );
//     pendingCandidates = [];
//   }

//   if (signal.type === "answer") {
//     await peerConnection.setRemoteDescription(signal);

//     pendingCandidates.forEach(c =>
//       peerConnection.addIceCandidate(c)
//     );
//     pendingCandidates = [];
//   }

//   if (signal.type === "candidate") {
//     if (peerConnection.remoteDescription) {
//       await peerConnection.addIceCandidate(signal.candidate);
//     } else {
//       pendingCandidates.push(signal.candidate);
//     }
//   }
// });

function createPeerConnection(userId) {
  const pc = new RTCPeerConnection(config);

  localStream.getTracks().forEach(track =>
    pc.addTrack(track, localStream)
  );

  pc.ontrack = (event) => {
    const video = userSlots[userId];
    if (video) {
      video.srcObject = event.streams[0];
    }
  };

  pc.onicecandidate = (event) => {
    if (event.candidate) {
      socket.emit("signal", {
        to: userId,
        signal: {
          type: "candidate",
          candidate: event.candidate
        }
      });
    }
  };

  return pc;
}

// function createPeerConnection() {
//   peerConnection = new RTCPeerConnection(config);

//   localStream.getTracks().forEach(track =>
//     peerConnection.addTrack(track, localStream)
//   );

//   peerConnection.ontrack = (event) => {
//     const remoteVideo = document.getElementById("remoteVideo");
//     remoteVideo.srcObject = event.streams[0];
//   };

//   peerConnection.onicecandidate = (event) => {
//     if (event.candidate) {
//       socket.emit("signal", {
//         to: remoteUserId,
//         signal: {
//           type: "candidate",
//           candidate: event.candidate
//         }
//       });
//     }
//   };

//   peerConnection.oniceconnectionstatechange = () => {
//     console.log("ICE:", peerConnection.iceConnectionState);
//   };
// }

function createVideoElement(userId) {
  const container = document.querySelector(".videos");

  const box = document.createElement("div");
  box.className = "video-box";
  box.id = "box-" + userId;

  const video = document.createElement("video");
  video.autoplay = true;
  video.playsInline = true;
  video.id = "video-" + userId;

  box.appendChild(video);
  container.appendChild(box);
}

start();
