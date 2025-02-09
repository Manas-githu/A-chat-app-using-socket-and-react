import { User } from "../models/user.model.js";
import bcrypt from "bcryptjs";
import { generateToken } from "../lib/utils.js";
import cloudinary from "../lib/cloudinary.js";

export const signup = async (req, res) => {
  const { fullName, email, password } = req.body;
  try {
    if (!fullName || !password || !email) {
      res.status(404).send("provide mandatoory details");
    }
    if (password.length < 6) {
      res.status(404).send("Password length is < 6");
    }

    const user = await User.findOne({ email });

    if (user) {
      res.status(403).send("user already exist");
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    const newUser = new User({
      fullName: fullName,
      email: email,
      password: hashedPassword,
    });

    if (newUser) {
      //here we generate jwt token
      generateToken(newUser._id, res);
      await newUser.save();

      res.status(201).json({
        _id: newUser._id,
        fullName: newUser.fullName,
        email: newUser.email,
        profilePic: newUser.profilePic,
      });
    } else {
      res.status(400).send("Invalid Credentials");
    }
  } catch (error) {
    console.log("error in controlling signup router ", error.message);
    res.status(500).send("Internal server error");
  }
};

export const login = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(404).send("please enter the password and email correctly");
  }
//user id for j@mail.com : 6796ea6e661c44e2db15396f
  try {
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(400).json({ message: "Invalid Credentials" });
    }

    const isPassed = await bcrypt.compare(password, user.password);

    if (!isPassed) {
      return res.status(401).send("Wrong password please enter correct password");
    }

    generateToken(user._id, res);

    res.status(200).json({
      _id: user._id,
      fullName: user.fullName,
      email: user.email,
      profilePic: user.profilePic
    });

  } catch (error) {
    res.status(500).json({message:"internal server error"});
}
};

export const logout = (req, res) => {
    try {
        res.cookie("jwt", "", { maxAge: 0 });
        res.status(201).json({ message: "Session expires Logged out succesfully ;-)" });
    } catch (error) {
        console.log(error);
        res.status(500).json({message:"internal server error"});
        
    }

  
};

export const updateProfile = async (req,res) => {
  // console.log("updating profile");         going inside try block
  
  try {
        const { profilePic } = req.body;
        // console.log(profilePic)      //working absotutely fine
        const userId = req.user._id;

        if(!profilePic) res.status(400).send("enter profile pic");

        const uploadResponce = await cloudinary.uploader.upload(profilePic);
        const updatedUser = await User.findByIdAndUpdate(userId,{profile_pic:uploadResponce.secure_url},{new:true});

        // console.log(updatedUser)       //working absotutely fine

        res.status(200).json(updatedUser);
    } catch (error) {
        console.log("error in profile update "+error);
        res.status(500).send("internal server error");
    }
}


export const checkAuth = (req,res) => {
  try {
    res.status(200).json(req.user)
  } catch (error) {
    console.log("error in checkAuth kindly check " + error);
    res.status(500).send("Internal server error");
  }
}