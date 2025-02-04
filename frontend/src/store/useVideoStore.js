import { create } from "zustand";
import Peer from "simple-peer";
import { useAuthStore } from "./useAuthStore";
import toast from "react-hot-toast";

export const useVideoStore = create((set, get) => ({
  localStream: null,
  remoteStream: null,
  callStatus: null, // 'incoming' | 'outgoing' | 'connected' | null
  peer: null,
  incomingCall: null,

  initializeMedia: async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true
      });
      set({ localStream: stream });
      return stream;
    } catch (error) {
      toast.error("Cannot access camera/microphone. Please check permissions.");
      throw error;
    }
  },

  makeCall: async (userId, userName) => {
    try {
      const stream = await get().initializeMedia();
      const socket = useAuthStore.getState().socket;
      const currentUser = useAuthStore.getState().authUser;

      const peer = new Peer({
        initiator: true,
        trickle: false,
        stream
      });

      peer.on("signal", (signalData) => {
        socket.emit("call-user", {
          userToCall: userId,
          signalData,
          from: currentUser._id,
          name: currentUser.fullName
        });
      });

      peer.on("stream", (remoteStream) => {
        set({ remoteStream });
      });

      set({ peer, callStatus: "outgoing" });
    } catch (error) {
      toast.error("Failed to start call");
      get().endCall();
    }
  },

  handleIncomingCall: (incomingCall) => {
    set({ incomingCall, callStatus: "incoming" });
  },

  answerCall: async () => {
    try {
      const { incomingCall } = get();
      const stream = await get().initializeMedia();
      const socket = useAuthStore.getState().socket;

      const peer = new Peer({
        initiator: false,
        trickle: false,
        stream
      });

      peer.on("signal", (signal) => {
        socket.emit("answer-call", {
          signal,
          to: incomingCall.from
        });
      });

      peer.on("stream", (remoteStream) => {
        set({ remoteStream });
      });

      peer.signal(incomingCall.signal);
      set({ peer, callStatus: "connected", incomingCall: null });
    } catch (error) {
      toast.error("Failed to answer call");
      get().endCall();
    }
  },

  endCall: () => {
    const { peer, localStream, remoteStream } = get();
    const socket = useAuthStore.getState().socket;
    
    if (peer) {
      peer.destroy();
    }
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
    }
    if (remoteStream) {
      remoteStream.getTracks().forEach(track => track.stop());
    }

    socket.emit("end-call", { to: get().incomingCall?.from });

    set({
      peer: null,
      localStream: null,
      remoteStream: null,
      callStatus: null,
      incomingCall: null
    });
  }
})); 