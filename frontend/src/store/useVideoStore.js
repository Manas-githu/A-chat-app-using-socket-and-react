import { create } from "zustand";
import { useAuthStore } from "./useAuthStore";
import toast from "react-hot-toast";
import { useChatStore } from "./useChatStore";

const iceServers = {
  iceServers: [
    { urls: "stun:stun.relay.metered.ca:80" },
    { 
      urls: "turn:global.relay.metered.ca:80", 
      username: "c6423e269f600466978874b9", 
      credential: "WHntcvF0TEmGcm8h" 
    },
    { 
      urls: "turn:global.relay.metered.ca:80?transport=tcp", 
      username: "c6423e269f600466978874b9", 
      credential: "WHntcvF0TEmGcm8h" 
    },
    { 
      urls: "turn:global.relay.metered.ca:443", 
      username: "c6423e269f600466978874b9", 
      credential: "WHntcvF0TEmGcm8h" 
    },
    { 
      urls: "turns:global.relay.metered.ca:443?transport=tcp", 
      username: "c6423e269f600466978874b9", 
      credential: "WHntcvF0TEmGcm8h" 
    }
  ]
};

export const useVideoStore = create((set, get) => ({
  localStream: null,
  remoteStream: null,
  callStatus: null,
  peer: null,
  incomingCall: null,
  iceCandidatesQueue: [],
  isRemoteDescriptionSet: false,
  isLocalDescriptionSet: false,

  initializeMedia: async () => {
    const currentStream = get().localStream;
    if (currentStream && currentStream.active) {
      console.log("Reusing existing local stream");
      return currentStream;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
      set({ localStream: stream });
      console.log("Local stream initialized successfully");
      return stream;
    } catch (error) {
      console.error("Media access error:", error);
      toast.error("Cannot access camera/microphone. Please check permissions.");
      throw error;
    }
  },

  setupPeerConnection: (stream) => {
    const peer = new RTCPeerConnection(iceServers);
    const remoteStream = new MediaStream();

    // Add tracks to peer connection
    stream.getTracks().forEach((track) => {
      peer.addTrack(track, stream);
    });

    // Handle incoming tracks
    peer.ontrack = (event) => {
      try {
        event.streams[0].getTracks().forEach((track) => {
          remoteStream.addTrack(track);
        });
        set({ remoteStream });
      } catch (error) {
        console.error("Track handling error:", error);
        toast.error("Video connection error");
      }
    };

    peer.onconnectionstatechange = () => {
      console.log("Connection state changed:", peer.connectionState);
      switch (peer.connectionState) {
        case "connected":
          set({ callStatus: "connected" });
          break;
        case "disconnected":
          console.log("Peer connection disconnected");
          setTimeout(() => {
            if (peer.connectionState === "disconnected") {
              get().endCall();
            }
          }, 5000); // Wait 5s before ending call in case of temporary disconnection
          break;
        case "failed":
          toast.error("Connection failed");
          get().endCall();
          break;
      }
    };

    peer.oniceconnectionstatechange = () => {
      console.log("ICE Connection State:", peer.iceConnectionState);
      if (peer.iceConnectionState === "failed") {
        console.log("Attempting ICE restart...");
        peer.restartIce();
      }
    };

    return { peer, remoteStream };
  },

  makeCall: async (userId) => {
    try {
      const stream = await get().initializeMedia();
      const socket = useAuthStore.getState().socket;
      const currentUser = useAuthStore.getState().authUser;

      const { peer, remoteStream } = get().setupPeerConnection(stream);
      
      set({ 
        remoteStream, 
        peer,
        isRemoteDescriptionSet: false,
        isLocalDescriptionSet: false,
        iceCandidatesQueue: [] 
      });

      peer.onicecandidate = (event) => {
        if (event.candidate) {
          socket.emit("ice-candidate", {
            candidate: event.candidate,
            to: userId,
            from: currentUser._id
          });
        }
      };

      const offer = await peer.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true,
        iceRestart: true
      });
      
      await peer.setLocalDescription(offer);
      set({ isLocalDescriptionSet: true });
      
      socket.emit("call-user", {
        to: userId,
        from: currentUser._id,
        signal: offer,
      });

      set({ callStatus: "outgoing" });

    } catch (error) {
      console.error("Call initiation error:", error);
      toast.error("Failed to start call");
      get().endCall();
    }
  },

  handleIncomingCall: async ({ from, signal }) => {
    try {
      const stream = await get().initializeMedia();
      set({
        incomingCall: { from, signal },
        callStatus: "incoming",
        localStream: stream
      });
    } catch (error) {
      console.error("Error handling incoming call:", error);
      get().endCall();
    }
  },

  answerCall: async () => {
    const { incomingCall } = get();
    if (!incomingCall) return;

    try {
      const localStream = await get().initializeMedia();
      const { peer, remoteStream } = get().setupPeerConnection(localStream);
      
      set({ 
        remoteStream, 
        peer,
        isRemoteDescriptionSet: false,
        isLocalDescriptionSet: false
      });

      peer.onicecandidate = (event) => {
        if (event.candidate) {
          const socket = useAuthStore.getState().socket;
          socket.emit("ice-candidate", {
            candidate: event.candidate,
            to: incomingCall.from
          });
        }
      };

      console.log("Setting remote description for answer:", incomingCall.signal);
      await peer.setRemoteDescription(new RTCSessionDescription(incomingCall.signal));
      set({ isRemoteDescriptionSet: true });

      // Process any queued candidates
      await get().processIceCandidateQueue();

      const answer = await peer.createAnswer();
      await peer.setLocalDescription(answer);
      set({ isLocalDescriptionSet: true });

      const socket = useAuthStore.getState().socket;
      socket.emit("answer-call", {
        to: incomingCall.from,
        signal: answer,
      });

    } catch (error) {
      console.error("Error answering call:", error);
      toast.error("Failed to answer call");
      get().endCall();
    }
  },

  processIceCandidateQueue: async () => {
    const { peer, iceCandidatesQueue } = get();
    if (!peer || !peer.remoteDescription) return;

    try {
      console.log(`Processing ${iceCandidatesQueue.length} queued candidates`);
      for (const candidate of iceCandidatesQueue) {
        await peer.addIceCandidate(new RTCIceCandidate(candidate));
      }
      set({ iceCandidatesQueue: [] });
    } catch (error) {
      console.error("Error processing ICE candidates:", error);
    }
  },

  handleIceCandidate: async ({ candidate }) => {
    const { peer, isRemoteDescriptionSet } = get();
    
    if (!peer) return;

    try {
      if (!isRemoteDescriptionSet) {
        console.log("Queued ICE candidate");
        set((state) => ({
          iceCandidatesQueue: [...state.iceCandidatesQueue, candidate]
        }));
        return;
      }

      await peer.addIceCandidate(new RTCIceCandidate(candidate));
      console.log("Added ICE candidate directly");

    } catch (error) {
      console.error("Error handling ICE candidate:", error);
    }
  },

  endCall: () => {
    const { peer, localStream, remoteStream } = get();
    const socket = useAuthStore.getState().socket;
    const { selectedUser } = useChatStore.getState();
  
    if (peer) {
      peer.close();
    }
    
    if (localStream) {
      localStream.getTracks().forEach((track) => {
        track.stop();
        localStream.removeTrack(track);
      });
    }
    
    if (remoteStream) {
      remoteStream.getTracks().forEach((track) => {
        track.stop();
        remoteStream.removeTrack(track);
      });
    }

    set({
      peer: null,
      localStream: null,
      remoteStream: null,
      callStatus: null,
      incomingCall: null,
      iceCandidatesQueue: [],
      isRemoteDescriptionSet: false,
      isLocalDescriptionSet: false
    });

    if (selectedUser?._id) {
      socket.emit("end-call", { to: selectedUser._id });
    }
  }
}));
