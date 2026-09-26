import { io as socketIO, Socket } from "socket.io-client";

// Une seule connexion Socket.IO partagée par tous les composants : chacun
// s'abonne avec socket.on(...) et se désabonne avec socket.off(...).
let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = socketIO(
      process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:1919",
      { withCredentials: true },
    );
  }
  return socket;
}
