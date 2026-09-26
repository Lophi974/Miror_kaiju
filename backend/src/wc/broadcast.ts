import { getSocketServer } from "./socket";

export function broadcastSeverityLevel(level: number) {
  getSocketServer().emit("alertLevelChange", { level });
}

export function broadcastResourceChange(
  quarterId: string,
  resourceTypeId: string,
  currentQuantity: number,
) {
  getSocketServer().emit("resourceChange", {
    quarterId,
    resourceTypeId,
    currentQuantity,
  });
}

// Seuil de rétention global : s'applique à tous les quartiers
export function broadcastThresholdChange(treshHoldPercent: number) {
  getSocketServer().emit("thresholdChange", { treshHoldPercent });
}

// Une demande de transfert a été créée ou a changé de statut : les clients
// rechargent leurs listes (demandes en attente, transits, historique).
export function broadcastTransferRequestChange() {
  getSocketServer().emit("transferRequestChange");
}
