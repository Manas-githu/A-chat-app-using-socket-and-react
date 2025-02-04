import { X, Trash, Video } from "lucide-react";
import { useAuthStore } from "../store/useAuthStore";
import { useChatStore } from "../store/useChatStore";
import toast from "react-hot-toast";
import VideoInterface from "./VideoInterface";
import { useState } from "react";
import { useVideoStore } from "../store/useVideoStore";

const ChatHeader = () => {
  const { selectedUser, setSelectedUser, deleteChat } = useChatStore();
  const { onlineUsers } = useAuthStore();
  const { makeCall, callStatus } = useVideoStore();
  const [isVideoCallActive, setIsVideoCallActive] = useState(false);

  const handleVideoCall = async () => {
    if (!onlineUsers.includes(selectedUser._id)) {
      toast.error("User is offline");
      return;
    }
    
    try {
      await makeCall(selectedUser._id, selectedUser.fullName);
    } catch (error) {
      console.error("Failed to start call:", error);
    }
  };

  const handleDeleteChat = (messageId) => {
    toast(
      (t) => (
        <div className="flex flex-col gap-2 w-80 justify-center align-middle">
          <span>
            <b>PERMENANTLY REMOVE THIS CHAT?</b>
          </span>
          <div className="flex gap-2 justify-center align-middle">
            <button
              className="bg-gray-200 px-3 py-1 rounded-md text-sm hover:bg-gray-300 text-center"
              onClick={() => toast.dismiss(t.id)}
            >
              Cancel
            </button>
            <button
              className="bg-red-500 px-3 py-1 rounded-md text-sm text-white hover:bg-red-600 text-center"
              onClick={() => {
                toast.promise(deleteChat(messageId), {
                  loading: "Deleting...",
                  success: "Message deleted!",
                  error: "Failed to delete message",
                });
                toast.dismiss(t.id);
              }}
            >
              Delete
            </button>
          </div>
        </div>
      ),
      {
        duration: 5000,
      }
    );
  };

  return (
    <div className="p-2.5 border-b border-base-300">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {/* Avatar */}
          <div className="avatar">
            <div className="size-10 rounded-full relative">
              <img
                src={selectedUser.profile_pic || "/image.png"}
                alt={selectedUser.fullName}
              />
            </div>
          </div>

          {/* User info */}
          <div>
            <h3 className="font-medium">{selectedUser.fullName}</h3>
            <p className="text-sm text-base-content/70">
              {onlineUsers.includes(selectedUser._id) ? "Online" : "Offline"}
            </p>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-4">
          <button
            onClick={handleVideoCall}
            disabled={callStatus !== null}
            className={`hover:bg-base-200 p-2 rounded-full transition-colors
              ${callStatus ? 'opacity-50 cursor-not-allowed' : ''}`}
            title="Start video call"
          >
            <Video size={20} />
          </button>

          <button
            onClick={handleDeleteChat}
            className="hover:bg-base-200 p-2 rounded-full transition-colors text-red-500"
            title="Delete chat"
          >
            <Trash size={20} />
          </button>

          <button
            onClick={() => setSelectedUser(null)}
            className="hover:bg-base-200 p-2 rounded-full transition-colors"
            title="Close chat"
          >
            <X size={20} />
          </button>
        </div>
      </div>
      {isVideoCallActive && (
        <>
          <VideoInterface
            selectedUser={selectedUser}
            callType="incoming" // or "outgoing"
            onClose={() => setIsVideoCallActive(false)}
            onAcceptCall={() => console.log("Call accepted")}
            onRejectCall={() => setIsVideoCallActive(false)}
          />
        </>
      )}
    </div>
  );
};
export default ChatHeader;
