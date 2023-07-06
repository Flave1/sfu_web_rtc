//index.js
const io = require('socket.io-client')
const mediasoupClient = require('mediasoup-client')

const roomName = window.location.pathname.split('/')[2]

const socket = io("/mediasoup")

socket.on('connection-success', ({ socketId }) => {
  console.log(socketId)
  getLocalStream()
})

let device
let rtpCapabilities
let producerTransport
let consumerTransports = []
let audioProducer
let videoProducer
let consumer
let isProducer = false
let streams;

let params = {
  // mediasoup params
  encodings: [
    {
      rid: 'r0',
      maxBitrate: 100000,
      scalabilityMode: 'S1T3',
    },
    {
      rid: 'r1',
      maxBitrate: 300000,
      scalabilityMode: 'S1T3',
    },
    {
      rid: 'r2',
      maxBitrate: 900000,
      scalabilityMode: 'S1T3',
    },
  ],
  codecOptions: {
    videoGoogleStartBitrate: 1000
  }
}

let audioParams;
let videoParams = { params };
let consumingTransports = [];
let startedRecording = false;
let sharingScreen = false;
let userIdInDisplayFrame = null;

const streamSuccess = (stream) => {
  localVideo.srcObject = stream

  audioParams = { track: stream.getAudioTracks()[0], ...audioParams };
  videoParams = { track: stream.getVideoTracks()[0], ...videoParams };

  joinRoom()
}

const joinRoom = () => {
  socket.emit('joinRoom', { roomName }, (data) => {
    console.log(`Router RTP Capabilities... ${data.rtpCapabilities}`)
    // we assign to local variable and will be used when
    // loading the client Device (see createDevice above)
    rtpCapabilities = data.rtpCapabilities

    // once we have rtpCapabilities from the Router, create Device
    createDevice()
    document.getElementById(`user-container`).addEventListener("click", expandVideoFrame);
    document.getElementById("camera-btn").onclick = () => {
      toggleCamera(streams);
    };
document.getElementById("mic-btn").onclick = () => { 
  toggleMic(streams);
};
document.getElementById("record-btn").onclick = () => {
toggleRecording()
}
document.getElementById("screen-btn").onclick = () => {
  toggleScreen() 
  }
  })
}
let constraints = {
  video: {
    width: { min: 640, max: 1920 },
    height: { min: 480,  max: 1080 },
  },
  audio: true,
};
const getLocalStream = () => {
  navigator.mediaDevices.getUserMedia(constraints)
  .then((stream)=> {streamSuccess(stream);
    streams = stream
  })
  .catch(error => {
    console.log(error.message)
  })
}

// A device is an endpoint connecting to a Router on the
// server side to send/recive media
const createDevice = async () => {
  try {
    device = new mediasoupClient.Device()

    // Loads the device with RTP capabilities of the Router (server side)
    await device.load({
      // see getRtpCapabilities() below
      routerRtpCapabilities: rtpCapabilities
    })

    console.log('Device RTP Capabilities', device.rtpCapabilities)

    // once the device loads, create transport
    createSendTransport()

  } catch (error) {
    console.log(error)
    if (error.name === 'UnsupportedError')
      console.warn('browser not supported')
  }
}

const createSendTransport = () => {
  // see server's socket.on('createWebRtcTransport', sender?, ...)
  // this is a call from Producer, so sender = true
  socket.emit('createWebRtcTransport', { consumer: false }, ({ params }) => {
    // The server sends back params needed 
    // to create Send Transport on the client side
    if (params.error) {
      console.log(params.error)
      return
    }

    console.log(params)

    // creates a new WebRTC Transport to send media
    // based on the server's producer transport params
    producerTransport = device.createSendTransport(params)

    // this event is raised when a first call to transport.produce() is made
    // see connectSendTransport() below
    producerTransport.on('connect', async ({ dtlsParameters }, callback, errback) => {
      try {
        // Signal local DTLS parameters to the server side transport
        // see server's socket.on('transport-connect', ...)
        await socket.emit('transport-connect', {
          dtlsParameters,
        })

        // Tell the transport that parameters were transmitted.
        callback()

      } catch (error) {
        errback(error)
      }
    })

    producerTransport.on('produce', async (parameters, callback, errback) => {
      console.log(parameters)

      try {
        // tell the server to create a Producer
        // with the following parameters and produce
        // and expect back a server side producer id
        // see server's socket.on('transport-produce', ...)
        await socket.emit('transport-produce', {
          kind: parameters.kind,
          rtpParameters: parameters.rtpParameters,
          appData: parameters.appData,
        }, ({ id, producersExist }) => {
          // Tell the transport that parameters were transmitted and provide it with the
          // server side producer's id.
          callback({ id })

          // if producers exist, then join room
          if (producersExist) getProducers()
        })
      } catch (error) {
        errback(error)
      }
    })

    connectSendTransport()
  })
}

const connectSendTransport = async () => {
  // we now call produce() to instruct the producer transport
  // to send media to the Router
  // https://mediasoup.org/documentation/v3/mediasoup-client/api/#transport-produce
  // this action will trigger the 'connect' and 'produce' events above
  
  audioProducer = await producerTransport.produce(audioParams);
  videoProducer = await producerTransport.produce(videoParams);

  audioProducer.on('trackended', () => {
    console.log('audio track ended')

    // close audio track
  })

  audioProducer.on('transportclose', () => {
    console.log('audio transport ended')

    // close audio track
  })
  
  videoProducer.on('trackended', () => {
    console.log('video track ended')

    // close video track
  })

  videoProducer.on('transportclose', () => {
    console.log('video transport ended')

    // close video track
  })
}

const signalNewConsumerTransport = async (remoteProducerId) => {
  //check if we are already consuming the remoteProducerId
  if (consumingTransports.includes(remoteProducerId)) return;
  consumingTransports.push(remoteProducerId);

  await socket.emit('createWebRtcTransport', { consumer: true }, ({ params }) => {
    // The server sends back params needed 
    // to create Send Transport on the client side
    if (params.error) {
      console.log(params.error)
      return
    }
    console.log(`PARAMS... ${params}`)

    let consumerTransport
    try {
      consumerTransport = device.createRecvTransport(params)
    } catch (error) {
      // exceptions: 
      // {InvalidStateError} if not loaded
      // {TypeError} if wrong arguments.
      console.log(error)
      return
    }

    consumerTransport.on('connect', async ({ dtlsParameters }, callback, errback) => {
      try {
        // Signal local DTLS parameters to the server side transport
        // see server's socket.on('transport-recv-connect', ...)
        await socket.emit('transport-recv-connect', {
          dtlsParameters,
          serverConsumerTransportId: params.id,
        })

        // Tell the transport that parameters were transmitted.
        callback()
      } catch (error) {
        // Tell the transport that something was wrong
        errback(error)
      }
    })

    connectRecvTransport(consumerTransport, remoteProducerId, params.id)
  })
}

// server informs the client of a new producer just joined
socket.on('new-producer', ({ producerId }) => signalNewConsumerTransport(producerId))

const getProducers = () => {
  socket.emit('getProducers', producerIds => {
    console.log(producerIds)
    // for each of the producer create a consumer
    // producerIds.forEach(id => signalNewConsumerTransport(id))
    producerIds.forEach(signalNewConsumerTransport)
  })
}

const connectRecvTransport = async (consumerTransport, remoteProducerId, serverConsumerTransportId) => {
  // for consumer, we need to tell the server first
  // to create a consumer based on the rtpCapabilities and consume
  // if the router can consume, it will send back a set of params as below
  await socket.emit('consume', {
    rtpCapabilities: device.rtpCapabilities,
    remoteProducerId,
    serverConsumerTransportId,
  }, async ({ params }) => {
    if (params.error) {
      console.log('Cannot Consume')
      return
    }

    console.log(`Consumer Params ${params}`)
    // then consume with the local consumer transport
    // which creates a consumer
    const consumer = await consumerTransport.consume({
      id: params.id,
      producerId: params.producerId,
      kind: params.kind,
      rtpParameters: params.rtpParameters
    })

    consumerTransports = [
      ...consumerTransports,
      {
        consumerTransport,
        serverConsumerTransportId: params.id,
        producerId: remoteProducerId,
        consumer,
      },
    ]

    // create a new div element for the new consumer media
    const newElem = document.createElement('div')
    newElem.setAttribute('id', `td-${remoteProducerId}`)
    if (params.kind == 'audio') {
      //append to the audio container
      newElem.innerHTML = '<audio id="' + remoteProducerId + '" autoplay></audio>'
    } else {
      //append to the video container
      newElem.setAttribute('class','video__container')
      // newElem.setAttribute('class', 'remoteVideo')
      newElem.innerHTML = '<video id="' + remoteProducerId + '" autoplay class="video remoteVideo" ></video>'
    }

  streams__container.appendChild(newElem)

    // destructure and retrieve the video track from the producer
    const { track } = consumer

    document.getElementById(remoteProducerId).srcObject = new MediaStream([track])

    // the server consumer started with media paused
    // so we need to inform the server to resume
    socket.emit('consumer-resume', { serverConsumerId: params.serverConsumerId })
  })
}

socket.on('producer-closed', ({ remoteProducerId }) => {
  // server notification is received when a producer is closed
  // we need to close the client-side consumer and associated transport
  const producerToClose = consumerTransports.find(transportData => transportData.producerId === remoteProducerId)
  producerToClose.consumerTransport.close()
  producerToClose.consumer.close()

  // remove the consumer transport from the list
  consumerTransports = consumerTransports.filter(transportData => transportData.producerId !== remoteProducerId)

  // remove the video div element
  streams__container.removeChild(document.getElementById(`td-${remoteProducerId}`))
})

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
      "rgb(42, 98, 202, .9)";
  }
}
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
      "rgb(42, 98, 202, .9)"; 
  }
};
let toggleRecording = async () => {
  if (!startedRecording) {
    startRecording();
    document.getElementById("record-btn").style.backgroundColor =
      "rgb(42, 98, 202,.9)";
  } else {
    stopRecording();
    document.getElementById("record-btn").style.backgroundColor =
      "rgb(38, 38, 37)";
  }
};

// let startRecording = () =>{
//   recordedChunks = [];
// navigator.mediaDevices.getUserMedia(constraints)
//         .then((stream) => {
//             mediaRecorder = new MediaRecorder(stream);
//             mediaRecorder.ondataavailable = (event) => {
//               recordedChunks.push(event.data);
//             }; mediaRecorder.start();
//             mediaRecorder.onstop = () => {
//               console.log('Recording stopped');
//               downloadRecording();
//             };
           
//           })
//           .catch((error) => {
//             console.error('Error accessing media devices:', error);
//           });
//   startedRecording = true;
//   console.log("recording started");
// }

let startRecording = async () =>{
  let stream = await navigator.mediaDevices.getDisplayMedia({
    video: true
  })

  //needed for better browser support
  const mime = MediaRecorder.isTypeSupported("video/webm; codecs=vp9") 
             ? "video/webm; codecs=vp9" 
             : "video/webm"
    let mediaRecorder = new MediaRecorder(stream, {
        mimeType: mime
    })
   
    let chunks = []
    mediaRecorder.addEventListener('dataavailable', function(e) {
        chunks.push(e.data)
    })

    mediaRecorder.addEventListener('stop', function(){
      let blob = new Blob(chunks, {
          type: chunks[0].type
      })
      let url = URL.createObjectURL(blob)

      let video = document.querySelector("video")
      video.src = url

      let a = document.createElement('a')
      a.href = url
      a.download = 'video.webm'
      a.click()
  })

    //we have to start the recorder manually
    mediaRecorder.start()
  console.log("recording started");
}


let stopRecording = () => {
  mediaRecorder.stop();
  startedRecording = false;
}

// let downloadRecording =() => {
//   if (recordedChunks.length === 0) {
//     console.log("No recorded chunks available.");
//     return;
//   }
//   const blob = new Blob(recordedChunks, { type: recordedChunks[0].type });
//   const url = URL.createObjectURL(blob);
//   const a = document.createElement("a");
//   a.href = url;
//   a.download = "recorded-media.webm";
//   document.body.appendChild(a);
//   a.click();
//   document.body.removeChild(a);
//   URL.revokeObjectURL(url);
// }
let toggleScreen = async () => {
  let streamBox =  document.getElementById("stream__box");
  let screenBtn = document.getElementById("screen-btn");
  const newElem = document.createElement('div')
    newElem.setAttribute('class', 'video__container');
    newElem.innerHTML = `<div class="video-player-screen-share" ><video id="sharedVideo" autoplay ></video></div>`
    streamBox.appendChild(newElem); 
  let videoElem = document.getElementById("sharedVideo")
  var displayMediaOptions = {
    video: {
        cursor: "always",
        height: 500,
        width: 2100, 
    },
    audio: false
};

if(userIdInDisplayFrame){
  streamBox.addEventListener("click", hideDisplayFrame);//edit 
}

  if (!sharingScreen) {
    sharingScreen = true;
      try {
          videoElem.srcObject = await navigator.mediaDevices.getDisplayMedia(displayMediaOptions);
          dumpOptionsInfo();
      } catch (err) {
          // Handle error
          console.error("Error: " + err);
      }
    
  
  
  // Dump the available media track capabilities to the console
  function dumpOptionsInfo() {
      const videoTrack = videoElem.srcObject.getVideoTracks()[0];
      console.info("Track settings:");
      console.info(JSON.stringify(videoTrack.getSettings(), null, 2));
      console.info("Track constraints:");
      console.info(JSON.stringify(videoTrack.getConstraints(), null, 2));
}
    streamBox.style.display = 'block';
    screenBtn.style.backgroundColor =
      "rgb(42, 98, 202,.9)";
  } else {
    sharingScreen = false;
    let tracks = videoElem.srcObject.getTracks();
    tracks.forEach(track => track.stop());
    videoElem.srcObject = null;
    streamBox.style.display = 'none';
    screenBtn.style.backgroundColor =
      "rgb(38, 38, 37)";
  }
}


const expandVideoFrame = (e) => {
  const streamsContainer = document.getElementById("stream__container");
  const displayFrame = document.getElementById("stream__box");
  const videoFrames = document.getElementsByClassName("video__container");

  const child = displayFrame?.children[0];

  if (child) {
    streamsContainer.appendChild(child);
  }
  displayFrame.style.display = "block";
  displayFrame?.appendChild(e.currentTarget);
  userIdInDisplayFrame = e.currentTarget.id;
  displayFrame && displayFrame.addEventListener("click", hideDisplayFrame); 
  for (let i = 0; i < videoFrames.length; i++) {
    if (videoFrames[i] !== userIdInDisplayFrame) {
      videoFrames[i].style.height = "100px";
      videoFrames[i].style.width = "100px";
    }
  }
  for (let i = 0; videoFrames.length > i; i++) {
    videoFrames[i].addEventListener("click", expandVideoFrame);
  }
};

let hideDisplayFrame = () => {
  const videoFrames = document.getElementsByClassName("video__container");
  const displayFrame = document.getElementById("stream__box");
  userIdInDisplayFrame = null;
  displayFrame.style.display = "none";
  let child = displayFrame?.children[0];
  document.getElementById("streams__container").appendChild(child);

  for (let i = 0; videoFrames.length > i; i++) {
    videoFrames[i].style.height = "200px";
    videoFrames[i].style.width = "200px";
  }
}; 
