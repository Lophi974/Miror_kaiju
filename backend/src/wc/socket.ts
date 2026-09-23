import "dotenv/config";
import { Server } from "socket.io";

let io: Server | null = null;

export function initializeSocketServer(app: any) {
  const io = new Server(app, {
    cors: {
      origin: "http://localhost:9001",
      credentials: true,
    },
  });

  io.on("connection", (socket) => {
    console.log("a user connected");
  });

  io.on("disconnect", (socket) => {
    console.log("a user disconnected");
  });

  return io;
}

export function getSocketServer() {
  if (!io) {
    throw new Error("Socket server not initialized");
  }
  return io;
}





