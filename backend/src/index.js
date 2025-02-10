import express from "express";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
import cors from "cors";

import path from "path";

import authRoutes from "./routes/auth.route.js";
import messageRoute from "./routes/message.route.js";
import { connectDB } from "./lib/db.js";
import { server,app, io } from "./lib/socket.js";

dotenv.config();
const __dirname = path.resolve();

// Middleware configuration
app.use(express.json({ limit: "50mb" })); // JSON body parser with size limit
app.use(express.urlencoded({ extended: true, limit: "50mb" })); // URL-encoded parser
app.use(cookieParser()); // Parse cookies

// Correctly configure CORS
app.use(
  cors({
    origin: process.env.NODE_ENV === "development" ? "http://localhost:5173" : "https://real-time-chat-app-with-video-call-using.onrender.com",
    credentials: true, // Allow credentials (cookies, headers, etc.)
    methods: ["GET", "POST", "PUT", "DELETE"], // Allow these HTTP methods
    allowedHeaders: ["Content-Type", "Authorization"], // Allow specific headers
  })
);


// Routes
app.use("/api/auth", authRoutes);
app.use("/api/message", messageRoute);

if (process.env.NODE_ENV === "production") {
  app.use(express.static(path.join(__dirname, "../frontend/dist")));

  app.get("*", (req, res) => {
    res.sendFile(path.join(__dirname, "../frontend", "dist", "index.html"));
  });
}

// Start the server
server.listen(3000, () => {
  console.log("Server running on port 3000:");
  connectDB();
});
