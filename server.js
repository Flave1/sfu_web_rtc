const cors = require('cors');
const express = require('express');
const app = express();
const bodyParser = require('body-parser');
const webrtc = require('wrtc');

let senderStream;

app.use(express.static('public'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended:true}))
app.use(cors());

app.post('/broadcast',async({body},res) =>{
   const peer = new webrtc.RTCPeerConnection({
    iceServers: [
        {
            urls: ["stun:stun.1.google.com:19302", "stun:stun2.1.google.com:19302"],
        }
    ]
   });


    peer.ontrack = (e) => handleTrackEvent(e,peer)
    const desc = new webrtc.RTCSessionDescription(body.sdp);
    await peer.setRemoteDescription(desc);
    const answer = await peer.createAnswer();
    await peer.setLocalDescription(answer);
    const payload = {
        sdp:peer.localDescription
    }
    res.json(payload)
})

function handleTrackEvent(e,peer) {
    senderStream = e.streams[0];
}

app.post('/consumer',async({body},res) =>{
    const peer = new webrtc.RTCPeerConnection({
     iceServers: [
         {
             urls:'stun:stun.protocol.org'
         }
     ]
    });
 
 
     const desc = new webrtc.RTCSessionDescription(body.sdp);
     await peer.setRemoteDescription(desc);
     senderStream.getTracks().forEach(track => peer.addTrack(track,senderStream));
     const answer = await peer.createAnswer();
     await peer.setLocalDescription(answer);
     const payload = {
         sdp:peer.localDescription
     }
     res.json(payload)
 })
 app.listen(5000,()=>console.log('server started'))