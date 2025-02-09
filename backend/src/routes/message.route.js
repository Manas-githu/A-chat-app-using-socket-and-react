import express from "express";
import { protectedRoute } from "../middleware/auth.middleware.js";
import {deleteMessage, getMessages, getUserForSidebar, sendMessage} from "../controllers/message.controller.js"

const router = express.Router();


router.get("/users",protectedRoute,getUserForSidebar)
router.get("/:id",protectedRoute,getMessages);
router.post("/send/:id",protectedRoute,sendMessage);
router.delete("/:id",protectedRoute,deleteMessage);


export default router;