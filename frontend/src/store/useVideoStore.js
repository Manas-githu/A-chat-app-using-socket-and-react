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

  initializeMedia: async () => {
    if (get().localStream) return get().localStream;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
      set({ localStream: stream });
      console.log("Local stream initialized successfully");
      return stream;
    } catch (error) {
      toast.error("Cannot access camera/microphone. Please check permissions.");
      console.error("Media access error:", error);
      throw error;
    }
  },

  makeCall: async (userId) => {
    try {
      const stream = await get().initializeMedia();
      const socket = useAuthStore.getState().socket;
      const currentUser = useAuthStore.getState().authUser;

      const peer = new RTCPeerConnection(iceServers);
      const remoteStream = new MediaStream();
      
      set({ 
        remoteStream, 
        peer,
        isRemoteDescriptionSet: false,
        iceCandidatesQueue: [] 
      });

      stream.getTracks().forEach((track) => {
        peer.addTrack(track, stream);
      });

      peer.ontrack = (event) => {
        try {
          set((state) => {
            const newStream = state.remoteStream || new MediaStream();
            event.streams[0].getTracks().forEach((track) => {
              if (!newStream.getTracks().some(t => t.id === track.id)) {
                newStream.addTrack(track);
              }
            });
            return { remoteStream: newStream };
          });
        } catch (error) {
          console.error("Track handling error:", error);
          toast.error("Video connection error");
        }
      };

      peer.onicecandidate = (event) => {
        if (event.candidate) {
          socket.emit("ice-candidate", {
            candidate: event.candidate,
            to: userId,
            from: currentUser._id,
            isCaller: true
          });
        }
      };

      peer.onconnectionstatechange = () => {
        const state = peer.connectionState;
        console.log("Connection state:", state);
        
        switch (state) {
          case "connected":
            set({ callStatus: "connected" });
            break;
          case "disconnected":
          case "failed":
            toast.error("Call disconnected");
            get().endCall();
            break;
          case "closed":
            get().endCall();
            break;
        }
      };

      const offer = await peer.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true
      });
      
      await peer.setLocalDescription(offer);
      
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
        localStream: stream,
        iceCandidatesQueue: []
      });
    } catch (error) {
      console.error("Incoming call error:", error);
      get().endCall();
    }
  },

  answerCall: async () => {
    const { incomingCall } = get();
    if (!incomingCall) return;

    try {
      const localStream = await get().initializeMedia();
      const peer = new RTCPeerConnection(iceServers);
      const remoteStream = new MediaStream();
      
      set({ 
        remoteStream, 
        peer,
        isRemoteDescriptionSet: false 
      });

      localStream.getTracks().forEach((track) => {
        peer.addTrack(track, localStream);
      });

      peer.ontrack = (event) => {
        try {
          set((state) => {
            const newStream = state.remoteStream || new MediaStream();
            event.streams[0].getTracks().forEach((track) => {
              if (!newStream.getTracks().some(t => t.id === track.id)) {
                newStream.addTrack(track);
              }
            });
            return { remoteStream: newStream };
          });
        } catch (error) {
          console.error("Track handling error:", error);
          toast.error("Video connection error");
        }
      };

      peer.onicecandidate = (event) => {
        if (event.candidate) {
          const socket = useAuthStore.getState().socket;
          socket.emit("ice-candidate", {
            candidate: event.candidate,
            to: incomingCall.from,
            isCaller: false
          });
        }
      };

      peer.onconnectionstatechange = () => {
        const state = peer.connectionState;
        console.log("Connection state:", state);
        
        switch (state) {
          case "connected":
            set({ callStatus: "connected" });
            break;
          case "disconnected":
          case "failed":
            toast.error("Call disconnected");
            get().endCall();
            break;
          case "closed":
            get().endCall();
            break;
        }
      };

      await peer.setRemoteDescription(new RTCSessionDescription(incomingCall.signal));
      set({ isRemoteDescriptionSet: true });

      // Process queued candidates
      const { iceCandidatesQueue } = get();
      for (const candidate of iceCandidatesQueue) {
        try {
          await peer.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (error) {
          console.error("Error adding queued candidate:", error);
        }
      }
      set({ iceCandidatesQueue: [] });

      const answer = await peer.createAnswer();
      await peer.setLocalDescription(answer);

      const socket = useAuthStore.getState().socket;
      socket.emit("answer-call", {
        to: incomingCall.from,
        signal: answer,
      });

      set({ callStatus: "connected" });

    } catch (error) {
      console.error("Error answering call:", error);
      toast.error("Failed to answer call");
      get().endCall();
    }
  },

  handleIceCandidate: async ({ candidate, from }) => {
    const { peer, isRemoteDescriptionSet } = get();
    
    try {
      if (!peer || !candidate) return;

      if (!isRemoteDescriptionSet) {
        set((state) => ({
          iceCandidatesQueue: [...state.iceCandidatesQueue, candidate]
        }));
        console.log("Queued ICE candidate");
        return;
      }

      await peer.addIceCandidate(new RTCIceCandidate(candidate));
      console.log("Added ICE candidate");

    } catch (error) {
      console.error("ICE candidate error:", error);
      toast.error("Connection error");
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
      localStream.getTracks().forEach((track) => track.stop());
    }
    
    if (remoteStream) {
      remoteStream.getTracks().forEach((track) => track.stop());
    }

    set({
      peer: null,
      localStream: null,
      remoteStream: null,
      callStatus: null,
      incomingCall: null,
      iceCandidatesQueue: [],
      isRemoteDescriptionSet: false
    });

    if (selectedUser?._id) {
      socket.emit("end-call", { to: selectedUser._id });
    }
  }
}));
