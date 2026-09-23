import { getSocketServer } from "./socket";

export function broadcastSeverityLevel() {

    getSocketServer().emit("alertLevelChange");

}