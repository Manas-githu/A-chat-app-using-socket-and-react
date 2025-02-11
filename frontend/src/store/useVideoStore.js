// useVideoStore.js
import { create } from "zustand";
import { useAuthStore } from "./useAuthStore";
import toast from "react-hot-toast";
import { useChatStore } from "./useChatStore";

const ICE_SERVERS = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:global.stun.twilio.com:3478" },
    {
      urls: "turn:global.turn.twilio.com:3478?transport=udp",
      username: "c07f4be304dfcd01378cc1f2ab08dfd11455f70c8ce378cb95c15ecda212d2f0",
      credential: "lt7pTosEWrqsdo/smLbDfBtsmb8D3azQyKokREg4cdk=",
    },
    {
      urls: "turn:global.turn.twilio.com:3478?transport=tcp",
      username: "c07f4be304dfcd01378cc1f2ab08dfd11455f70c8ce378cb95c15ecda212d2f0",
      credential: "lt7pTosEWrqsdo/smLbDfBtsmb8D3azQyKokREg4cdk=",
    },
    {
      urls: "turn:global.turn.twilio.com:443?transport=tcp",
      username: "c07f4be304dfcd01378cc1f2ab08dfd11455f70c8ce378cb95c15ecda212d2f0",
      credential: "lt7pTosEWrqsdo/smLbDfBtsmb8D3azQyKokREg4cdk=",
    },
  ],
  iceCandidatePoolSize: 10,
  iceTransportPolicy: "relay", // ✅ Corrected
};


export const useVideoStore = create((set, get) => ({
  localStream: null,
  remoteStream: null,
  callStatus: null,
  peer: null,
  incomingCall: null,
  iceCandidatesQueue: [],

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

      const peer = new RTCPeerConnection(ICE_SERVERS);
      
      // Create remote stream immediately
      const remoteStream = new MediaStream();
      set({ remoteStream, peer });

      // Add tracks to peer connection
      stream.getTracks().forEach((track) => {
        peer.addTrack(track, stream);
      });

      // Handle incoming tracks
      peer.ontrack = (event) => {
  set((state) => {
    const newStream = state.remoteStream || new MediaStream();
    event.streams[0].getTracks().forEach((track) => newStream.addTrack(track));
    return { remoteStream: newStream };
  });
};


      peer.onicecandidate = (event) => {
        if (event.candidate) {
          socket.emit("ice-candidate", {
            candidate: event.candidate,
            to: userId,
          });
        }
      };

      peer.onconnectionstatechange = () => {
        console.log("Connection state changed:", peer.connectionState);
        if (peer.connectionState === "connected") {
          set({ callStatus: "connected" });
        } else if (peer.connectionState === "disconnected") {
          get().endCall();
        }
      };

      peer.oniceconnectionstatechange = () => {
        console.log("ICE Connection State:", peer.iceConnectionState);
        if (peer.iceConnectionState === "failed") {
          toast.error("Connection failed. Please retry.");
          get().endCall();
        }
      };


      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);
      
      socket.emit("call-user", {
        to: userId,
        from: currentUser._id,
        signal: offer,
      });

      set({ callStatus: "outgoing" });
      console.log("Call made and local description set:", offer);
    } catch (error) {
      toast.error("Failed to start call");
      console.error("Call initiation error:", error);
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
    const peer = new RTCPeerConnection(ICE_SERVERS);

    // Create remote stream immediately
    const remoteStream = new MediaStream();
    set({ remoteStream, peer });

    // Add local tracks to peer connection
    localStream.getTracks().forEach((track) => {
      peer.addTrack(track, localStream);
    });

    // Handle incoming tracks
    peer.ontrack = (event) => {
      set((state) => {
        const newStream = state.remoteStream || new MediaStream();
        event.streams[0].getTracks().forEach((track) => newStream.addTrack(track));
        return { remoteStream: newStream };
      });
    };

    // Queue ICE candidates if remote description is not set yet
    peer.onicecandidate = (event) => {
      if (event.candidate) {
        const socket = useAuthStore.getState().socket;
        socket.emit("ice-candidate", {
          candidate: event.candidate,
          to: incomingCall.from,
        });
      }
    };

    peer.onconnectionstatechange = () => {
      console.log("Connection state changed:", peer.connectionState);
      if (peer.connectionState === "connected") {
        set({ callStatus: "connected" });
      } else if (peer.connectionState === "disconnected") {
        get().endCall();
      }
    };

    peer.oniceconnectionstatechange = () => {
      console.log("ICE Connection State:", peer.iceConnectionState);
      if (peer.iceConnectionState === "failed") {
        toast.error("Connection failed. Please retry.");
        get().endCall();
      }
    };

    // Set remote description first
    await peer.setRemoteDescription(new RTCSessionDescription(incomingCall.signal));

    // Process queued ICE candidates **after** setting remote description
    get().iceCandidatesQueue.forEach(async (candidate) => {
      await peer.addIceCandidate(new RTCIceCandidate(candidate));
    });
    set({ iceCandidatesQueue: [] });

    // Create and send answer
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
    get().endCall();
  }
},


  handleIceCandidate: async ({ candidate }) => {
    const { peer } = get();
    try {
      if (!peer.remoteDescription) {
  set((state) => ({
    iceCandidatesQueue: [...state.iceCandidatesQueue, candidate],
  }));
} else {
  await peer.addIceCandidate(new RTCIceCandidate(candidate));
}


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
    });

    if (selectedUser?._id) {
      socket.emit("end-call", { to: selectedUser._id });
    }
  },
}));
