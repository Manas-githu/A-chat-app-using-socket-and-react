/* eslint-disable react/prop-types */
import  { useState, useEffect } from "react";
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  PhoneOff,
  Maximize,
  Minimize,
  PhoneIncoming,
} from "lucide-react";
import { useVideoStore } from "../store/useVideoStore";

const VideoInterface = ({ selectedUser, callType, onClose }) => {
  const { 
    localStream,
    remoteStream,
    callStatus,
    makeCall,
    answerCall,
    endCall 
  } = useVideoStore();
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOn, setIsVideoOn] = useState(true);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [isConnecting, setIsConnecting] = useState(callType === "outgoing");
  const [isAccepted, setIsAccepted] = useState(callType === "outgoing");
  
  console.info("VideoInterface", {selectedUser, callType, onClose});

  useEffect(() => {
    if (callType === "outgoing") {
      const timer = setTimeout(() => setIsConnecting(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [callType]);

  const handleAcceptCall = async () => {
    await answerCall(callSignal, callerId);
  };

  const handleEndCall = () => {
    endCall();
    onClose();
  };

  // Incoming Call UI
  if (callType === "incoming" && !isAccepted) {
    return (
      <div className="fixed inset-0 bg-base-300/90 z-50 flex items-center justify-center">
        <div className="bg-base-100 p-6 rounded-lg shadow-lg flex flex-col items-center text-center">
          <PhoneIncoming size={48} className="text-primary" />
          <p className="text-lg font-semibold mt-4">
            Incoming call from {selectedUser?.fullName || "User"}
          </p>
          <div className="flex gap-4 mt-6">
            <button onClick={handleAcceptCall} className="btn btn-success">
              Accept
            </button>
            <button onClick={onClose} className="btn btn-error">
              Reject
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-base-300/90 z-50">
      <div className="relative h-full">
        {remoteStream && (
          <video
            ref={remoteVideo}
            autoPlay
            playsInline
            className="w-full h-full object-cover"
          />
        )}
        {localStream && (
          <video
            ref={localVideo}
            autoPlay
            playsInline
            muted
            className="absolute bottom-4 right-4 w-48 h-36 object-cover rounded-lg"
          />
        )}
        <div className="fixed inset-0 bg-base-300/90 z-50 flex items-center justify-center">
          <div
            className={`relative rounded-lg overflow-hidden flex flex-col shadow-lg border border-base-200 
            ${isFullScreen ? "w-screen h-screen" : "w-[800px] h-[600px]"}`}
          >
            <div className="flex-1 grid grid-cols-2 gap-4 p-4 bg-base-200">
              <div className="col-span-2 bg-base-100 rounded-lg flex items-center justify-center relative">
                {isConnecting ? (
                  <div className="flex flex-col items-center gap-4">
                    <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                    <p className="text-primary text-lg font-semibold">
                      {callType === "outgoing" ? "Calling" : "Connecting"} {selectedUser?.fullName || "User"}...
                    </p>
                  </div>
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center text-base-content">
                    <p className="text-lg">{selectedUser?.fullName || "User"}&#39;s Video</p>
                  </div>
                )}
              </div>
              <div className="absolute bottom-24 right-4 w-48 h-36 bg-base-100 rounded-lg border border-base-300 flex items-center justify-center m-5">
                <p className="text-base-content">Your Video</p>
              </div>
            </div>

            {/* Controls */}
            <div className="h-20 bg-base-100 flex items-center justify-center gap-4 px-4 border-t border-base-300">
              <button
                onClick={() => setIsMuted(!isMuted)}
                className={`btn btn-circle transition-all ${isMuted ? "btn-error" : "btn-primary"}`}
              >
                {isMuted ? <MicOff /> : <Mic />}
              </button>

              <button
                onClick={() => setIsVideoOn(!isVideoOn)}
                className={`btn btn-circle transition-all ${!isVideoOn ? "btn-error" : "btn-primary"}`}
              >
                {isVideoOn ? <Video /> : <VideoOff />}
              </button>

              <button onClick={handleEndCall} className="btn btn-circle btn-error">
                <PhoneOff />
              </button>

              <button
                onClick={() => setIsFullScreen(!isFullScreen)}
                className="btn btn-circle btn-primary"
              >
                {isFullScreen ? <Minimize /> : <Maximize />}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VideoInterface;
