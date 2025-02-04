import { User } from "../models/user.model.js";
import { Message } from "../models/message.model.js";
import cloudinary from "../lib/cloudinary.js";
import { getReceiverSocketId, io } from "../lib/socket.js";

export const getUserForSidebar = async (req, res) => {
  try {
    const loggedInUserId = req.user._id;
    const filteredUsers = await User.find({ _id: { $ne: loggedInUserId } });
    res.status(200).json(filteredUsers);
  } catch (error) {
    console.log(
      "Error on the get User for sidebar in messaeg controlller .js + ",
      error
    );
    res.status(500).send("Interal server error" + error.message);
  }
};

export const getMessages = async (req, res) => {
  // console.log("getting the msgs")                  working fine
  try {
    const { id: diffUserId } = req.params;
    const myId = req.user._id;

    const messages = await Message.find({
      $or: [
        { senderId: myId, recieverId: diffUserId },
        { senderId: diffUserId, recieverId: myId },
      ],
    });
    res.status(200).json(messages);
  } catch (error) {
    console.log(
      "error in the message controller getMessages: " + error.message
    );
    res.status(500).send("internal server error");
  }
};

export const sendMessage = async (req, res) => {
  try {
    const { text, image } = req.body;

    const recieverId = req.params.id; //other user id
    const senderId = req.user._id; //my id

    let imageUrl = "";
    if (image) {
      // Upload base64 image to cloudinary
      const uploadResponse = await cloudinary.uploader.upload(image);
      imageUrl = uploadResponse.secure_url;

    }

    const newMessage = new Message({
      senderId,
      recieverId,
      text,
      image: imageUrl,
    });

    await newMessage.save();

    res.json(newMessage);
    /// this part will below useed for socket.io
    // here i am baby 

    const receiverSocketId = getReceiverSocketId(recieverId);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("newMessage", newMessage);
    };


  } catch (error) {
    console.log("error inside the message controller: " + error.message);
    res.status(500).send("internal server error: " + error.message);
  }
};
