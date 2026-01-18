const socket = io("https://your-app.onrender.com");

const localVideo = document.getElementById("localVideo");
const remoteVideo = document.getElementById("remoteVideo");

let localStream;
let peerConnection;
let remoteUserId;

const config = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
};

async function start() {
  localStream = await navigator.mediaDevices.getUserMedia({
    video: true,
    audio: true
  });

  localVideo.srcObject = localStream;

  const roomId = prompt("Enter room ID");
  socket.emit("join-room", roomId);
}

socket.on("user-joined", async (userId) => {
  remoteUserId = userId;
  createPeerConnection();

  const offer = await peerConnection.createOffer();
  await peerConnection.setLocalDescription(offer);

  socket.emit("signal", {
    to: remoteUserId,
    signal: offer
  });
});

socket.on("signal", async (data) => {
  if (!peerConnection) {
    remoteUserId = data.from;
    createPeerConnection();
  }

  if (data.signal.type === "offer") {
    await peerConnection.setRemoteDescription(data.signal);

    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);

    socket.emit("signal", {
      to: remoteUserId,
      signal: answer
    });
  }

  if (data.signal.type === "answer") {
    await peerConnection.setRemoteDescription(data.signal);
  }

  if (data.signal.type === "candidate") {
    await peerConnection.addIceCandidate(data.signal.candidate);
  }
});

function createPeerConnection() {
  peerConnection = new RTCPeerConnection(config);

  localStream.getTracks().forEach(track => {
    peerConnection.addTrack(track, localStream);
  });

  peerConnection.ontrack = (event) => {
    remoteVideo.srcObject = event.streams[0];
  };

  peerConnection.onicecandidate = (event) => {
    if (event.candidate) {
      socket.emit("signal", {
        to: remoteUserId,
        signal: {
          type: "candidate",
          candidate: event.candidate
        }
      });
    }
  };
}

start();
