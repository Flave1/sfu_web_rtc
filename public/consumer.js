
    export async function initForRemote(){
    const peer = createPeer();
    peer.addTransceiver('video',{direction:'recvonly'})
    }
    function createPeer(){
    const peer = new RTCPeerConnection({
    iceServers:[{urls:["stun:stun.1.google.com:19302", "stun:stun2.1.google.com:19302"]}]
    })
    peer.ontrack = handleTrackEvent;
    peer.onnegotiationneeded = () => handleNegotiationNeededEvent(peer)
    return peer
    }
    function handleTrackEvent(e){
        const remoteVideo = document.createElement('video');
        console.log('log',e.streams[0]);
        remoteVideo.autoplay = true;
        remoteVideo.srcObject = e.streams[0];
        remoteVideo.classList.add('smallFrame');
        document.getElementById('videos').appendChild(remoteVideo);;
        
    }
    async function handleNegotiationNeededEvent(peer){
        const offer = await peer.createOffer()
        await peer.setLocalDescription(offer);
        const payload = {
        sdp:peer.localDescription
        }
        try{
        const {data} = await axios.post('http://localhost:5000/consumer',payload);
        const desc = new RTCSessionDescription(data.sdp);
        peer.setRemoteDescription(desc).catch(e=>console.log(e))
        }catch (error) {
        console.log(error);
    
}  
  
            
    }