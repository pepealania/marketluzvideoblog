const socket = io();
const localVideo = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');

let localStream;
let peerConnection;
const config = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };

async function init() {
    localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    localVideo.srcObject = localStream;

    const roomId = prompt("Enter room ID:");
    socket.emit('join-room', roomId);

    socket.on('user-joined', async (userId) => {
        console.log('User joined:', userId);
        createPeerConnection(userId, true);
    });

    socket.on('signal', async (data) => {
        if (!peerConnection) createPeerConnection(data.from, false);
        await peerConnection.setRemoteDescription(new RTCSessionDescription(data.signal));
        if (data.signal.type === 'offer') {
            const answer = await peerConnection.createAnswer();
            await peerConnection.setLocalDescription(answer);
            socket.emit('signal', { to: data.from, signal: peerConnection.localDescription });
        }
    });

    socket.on('user-left', (userId) => {
        console.log('User left:', userId);
        remoteVideo.srcObject = null;
        peerConnection = null;
    });
}

function createPeerConnection(userId, isOfferer) {
    peerConnection = new RTCPeerConnection(config);

    localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));

    peerConnection.ontrack = (event) => {
        remoteVideo.srcObject = event.streams[0];
    };

    peerConnection.onicecandidate = (event) => {
        if (event.candidate) return;
        socket.emit('signal', { to: userId, signal: peerConnection.localDescription });
    };

    if (isOfferer) {
        peerConnection.createOffer()
            .then(offer => peerConnection.setLocalDescription(offer))
            .then(() => {
                socket.emit('signal', { to: userId, signal: peerConnection.localDescription });
            });
    }
}

init();
