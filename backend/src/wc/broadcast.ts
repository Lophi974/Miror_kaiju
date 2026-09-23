import { getSocketServer } from "./socket";

export function broadcastSeverityLevel(level: number) {
  getSocketServer().emit("alertLevelChange", { level });
}