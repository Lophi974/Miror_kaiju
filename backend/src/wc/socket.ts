import "dotenv/config";
import { Server } from "socket.io";
import type { Server as HttpServer } from "node:http";
import { CORS_ORIGINS } from "../util/corsOrigins";

let io: Server | null = null;

export function initializeSocketServer(httpServer: HttpServer) {
  io = new Server(httpServer, {
    cors: {
      origin: CORS_ORIGINS,
      credentials: true,
    },
  });

  io.on("connection", (socket) => {
    console.log("a user connected");

    socket.on("disconnect", () => {
      console.log("a user disconnected");
    });
  });

  return io;
}

export function getSocketServer() {
  if (!io) {
    throw new Error("Socket server not initialized");
  }
  return io;
}