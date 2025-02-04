/*

this code is to check whether user is authenticated or not 
this in route is used to protect the route

/   notice the use of next() to go to next middleware after completioin

*/




import jwt from "jsonwebtoken";
import {User} from "../models/user.model.js"

export const protectedRoute = async (req,res,next) => {

    try {
        const token = req.cookies.jwt;

    if(!token) return res.status(401).send("no token found");

    const decoded = jwt.verify(token,process.env.JWT_SECRET);

    if(!decoded) return res.status(401).send("invalid token cookie");

    const user = await User.findById(decoded.userId).select("-password");

    if(!user) return res.status(401).send("user not found");

    req.user = user;

    next();
    } catch (error) {
        console.log("error in protected route " + error)
        res.status(500).send("Internal server error");
    }
    

}