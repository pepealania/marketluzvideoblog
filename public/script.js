const socket = io("https://your-app.onrender.com");

const localVideo = document.getElementById("localVideo");
const remoteVideo = document.getElementById("remoteVideo");

let localStream;
let peerConnection;
let remoteUserId;
let pendingCandidates = [];

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
  localStream = await navigator.mediaDevices.getUserMedia({
    video: true,
    audio: true
  });

  localVideo.srcObject = localStream;

  const roomId = prompt("Enter room ID");
  socket.emit("join-room", roomId);
}

socket.on("user-joined", async (userId) => {
  if (peerConnection) return;

  remoteUserId = userId;
  createPeerConnection();

  const offer = await peerConnection.createOffer();
  await peerConnection.setLocalDescription(offer);

  socket.emit("signal", {
    to: remoteUserId,
    signal: peerConnection.localDescription
  });
});

socket.on("signal", async ({ from, signal }) => {
  if (!peerConnection) {
    remoteUserId = from;
    createPeerConnection();
  }

  if (signal.type === "offer") {
    await peerConnection.setRemoteDescription(signal);

    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);

    socket.emit("signal", {
      to: from,
      signal: peerConnection.localDescription
    });

    pendingCandidates.forEach(c =>
      peerConnection.addIceCandidate(c)
    );
    pendingCandidates = [];
  }

  if (signal.type === "answer") {
    await peerConnection.setRemoteDescription(signal);

    pendingCandidates.forEach(c =>
      peerConnection.addIceCandidate(c)
    );
    pendingCandidates = [];
  }

  if (signal.type === "candidate") {
    if (peerConnection.remoteDescription) {
      await peerConnection.addIceCandidate(signal.candidate);
    } else {
      pendingCandidates.push(signal.candidate);
    }
  }
});

function createPeerConnection() {
  peerConnection = new RTCPeerConnection(config);

  localStream.getTracks().forEach(track =>
    peerConnection.addTrack(track, localStream)
  );

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

  peerConnection.oniceconnectionstatechange = () => {
    console.log("ICE:", peerConnection.iceConnectionState);
  };
}

start();
