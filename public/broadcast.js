import { initForRemote } from "./consumer.js";

//initialise sending to server on click of start stream button
window.onload = () => {
  init();
};

//variables
let mediaRecorder;
let recordedChunks = [];
let startedRecording = false;
let constraints = {
  video: {
    width: { min: 640, ideal: 1920, max: 1920 },
    height: { min: 480, ideal: 1080, max: 1080 },
  },
  audio: true,
};

async function init() {
  //adding the audio and video to code from system
  let stream = await navigator.mediaDevices.getUserMedia(constraints);
  document.getElementById("user-1").srcObject = stream;
  //adding create peer option
  const peer = createPeer();
  stream.getTracks().forEach((track) => peer.addTrack(track, stream));
  //setting onclick event for camera and mic and record
  document.getElementById("camera-btn").onclick = () => {
    toggleCamera(stream);
  };
  document.getElementById("mic-btn").onclick = () => {
    toggleMic(stream);
  };
  document.getElementById("record-btn").onclick = () => {
    if (!startedRecording) {
      startRecording();
      document.getElementById("record-btn").style.backgroundColor =
        "rgb(255, 80, 80)";
    } else {
      stopRecording();
      document.getElementById("record-btn").style.backgroundColor =
        "rgb(179, 102, 249, .9)";
    }
  };
}

function createPeer() {
  //creating peerconnection and adding ice servers
  const peer = new RTCPeerConnection({
    iceServers: [
      {
        urls: ["stun:stun.1.google.com:19302", "stun:stun2.1.google.com:19302"],
      },
    ],
  });
  peer.onnegotiationneeded = () => handleNegotiationNeededEvent(peer);
  return peer;
}

async function handleNegotiationNeededEvent(peer) {
  //creating offer
  const offer = await peer.createOffer();
  await peer.setLocalDescription(offer);
  //adding session description protocol
  const payload = {
    sdp: peer.localDescription,
  };
  try {
    //sending offer and tracks to server
    const { data } = await axios.post(
      "http://localhost:5000/broadcast",
      payload
    ); // Make a POST request to '/broadcast' with the payload
    const desc = new RTCSessionDescription(data.sdp);
    //getting offer and tracks from server
    peer.setRemoteDescription(desc).catch((e) => console.log(e));
    //initiate remote peers request
    initForRemote();
  } catch (error) {
    console.log(error);
  }
}
//toggle camera
let toggleCamera = async (stream) => {
  let videoTrack = stream.getTracks().find((track) => track.kind === "video");

  if (videoTrack.enabled) {
    videoTrack.enabled = false;
    document.getElementById("camera-btn").style.backgroundColor =
      "rgb(255, 80, 80)";
  } else {
    videoTrack.enabled = true;
    document.getElementById("camera-btn").style.backgroundColor =
      "rgb(179, 102, 249, .9)";
  }
};
//toggle mic
let toggleMic = async (stream) => {
  let audioTrack = stream.getTracks().find((track) => track.kind === "audio");

  if (audioTrack.enabled) {
    audioTrack.enabled = false;
    document.getElementById("mic-btn").style.backgroundColor =
      "rgb(255, 80, 80)";
  } else {
    audioTrack.enabled = true;
    document.getElementById("mic-btn").style.backgroundColor =
      "rgb(179, 102, 249, .9)";
  }
};

function startRecording() {
  recordedChunks = [];
navigator.mediaDevices.getUserMedia(constraints)
        .then((stream) => {
            mediaRecorder = new MediaRecorder(stream);
            mediaRecorder.ondataavailable = (event) => {
              recordedChunks.push(event.data);
            }; mediaRecorder.start();
            mediaRecorder.onstop = () => {
              console.log('Recording stopped');
              downloadRecording();
            };
           
          })
          .catch((error) => {
            console.error('Error accessing media devices:', error);
          });
  startedRecording = true;
  console.log("recording started");
}



function stopRecording() {
  mediaRecorder.stop();
  startedRecording = false;
}

function downloadRecording() {
  if (recordedChunks.length === 0) {
    console.log("No recorded chunks available.");
    return;
  }
  const blob = new Blob(recordedChunks, { type: recordedChunks[0].type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "recorded-media.webm";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
