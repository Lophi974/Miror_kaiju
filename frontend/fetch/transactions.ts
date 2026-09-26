import { API_URL } from "./config";

// resourceTypeId : id du TYPE de ressource (QuarterResource.resourceTypeId),
// pas l'id de la ligne QuarterResource.

export async function reserveResources(
  resourceTypeId: string,
  quantity: number,
) {
  try {
    const response = await fetch(
      `${API_URL}/api/transactions/reserve`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ resourceId: resourceTypeId, quantity }),
        credentials: "include",
      },
    );
    const data = await response.json();
    console.log("reserveResources response data:", data);
    return data;
  } catch (error) {
    console.error("Error reserving resources:", error);
    return { success: false, message: "Impossible de réserver les ressources." };
  }
}

// Demande directe entre quartiers adjacents (QC).
export async function requestResources(
  requestingQuarterId: string,
  supplyingQuarterId: string,
  resourceTypeId: string,
  quantity: number,
) {
  try {
    const response = await fetch(
      `${API_URL}/api/transactions/request`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        // Côté backend : source = demandeur, target = fournisseur
        body: JSON.stringify({
          resourceId: resourceTypeId,
          quantity,
          sourceQuarterId: requestingQuarterId,
          targetQuarterId: supplyingQuarterId,
        }),
        credentials: "include",
      },
    );
    const data = await response.json();
    console.log("requestResources response data:", data);
    return data;
  } catch (error) {
    console.error("Error requesting resources:", error);
    return { success: false, message: "Impossible d'envoyer la demande de ressources." };
  }
}

// Transfert organisé par LC / CD : direct si adjacent, sinon via un
// quartier de transit (choisi par le backend).
export async function transferResources(
  requestingQuarterId: string,
  supplyingQuarterId: string,
  resourceTypeId: string,
  quantity: number,
) {
  try {
    const response = await fetch(
      `${API_URL}/api/transactions/transfer`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        // Côté backend : source = demandeur, target = fournisseur
        body: JSON.stringify({
          resourceId: resourceTypeId,
          quantity,
          sourceQuarterId: requestingQuarterId,
          targetQuarterId: supplyingQuarterId,
        }),
        credentials: "include",
      },
    );
    const data = await response.json();
    console.log("transferResources response data:", data);
    return data;
  } catch (error) {
    console.error("Error transferring resources:", error);
    return { success: false, message: "Impossible de créer le transfert." };
  }
}

// Réquisition par le CD : immédiate, sans accord du QC.
export async function requisitionResources(
  fromQuarterId: string,
  toQuarterId: string,
  resourceTypeId: string,
  quantity: number,
) {
  try {
    const response = await fetch(
      `${API_URL}/api/transactions/requisition`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        // Attention : ici source = quartier à qui on prend, target = qui reçoit
        body: JSON.stringify({
          resourceId: resourceTypeId,
          quantity,
          sourceQuarterId: fromQuarterId,
          targetQuarterId: toQuarterId,
        }),
        credentials: "include",
      },
    );
    const data = await response.json();
    console.log("requisitionResources response data:", data);
    return data;
  } catch (error) {
    console.error("Error requisitioning resources:", error);
    return { success: false, message: "Impossible d'effectuer la réquisition." };
  }
}

// Demandes en attente où le quartier de l'utilisateur est fournisseur.
export async function fetchPendingRequests() {
  try {
    const response = await fetch(
      `${API_URL}/api/transactions/pending`,
      {
        credentials: "include",
      },
    );
    const data = await response.json();
    console.log("fetchPendingRequests response data:", data);
    return data;
  } catch (error) {
    console.error("Error fetching pending requests:", error);
    return { success: false, message: "Impossible de récupérer les demandes en attente." };
  }
}

export async function fetchRequestHistory() {
  try {
    const response = await fetch(
      `${API_URL}/api/transactions/history`,
      {
        credentials: "include",
      },
    );
    const data = await response.json();
    console.log("fetchRequestHistory response data:", data);
    return data;
  } catch (error) {
    console.error("Error fetching request history:", error);
    return { success: false, message: "Impossible de récupérer l'historique." };
  }
}

export async function approveTransferRequest(transferRequestId: string) {
  try {
    const response = await fetch(
      `${API_URL}/api/transactions/requests/${transferRequestId}/approve`,
      {
        method: "POST",
        credentials: "include",
      },
    );
    const data = await response.json();
    console.log("approveTransferRequest response data:", data);
    return data;
  } catch (error) {
    console.error("Error approving transfer request:", error);
    return { success: false, message: "Impossible d'approuver la demande." };
  }
}

export async function rejectTransferRequest(
  transferRequestId: string,
  rejectionReason: string,
) {
  try {
    const response = await fetch(
      `${API_URL}/api/transactions/requests/${transferRequestId}/reject`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ rejectionReason }),
        credentials: "include",
      },
    );
    const data = await response.json();
    console.log("rejectTransferRequest response data:", data);
    return data;
  } catch (error) {
    console.error("Error rejecting transfer request:", error);
    return { success: false, message: "Impossible de refuser la demande." };
  }
}

// Accords de passage en attente pour le quartier de l'utilisateur.
export async function fetchPendingTransits() {
  try {
    const response = await fetch(
      `${API_URL}/api/transactions/transits/pending`,
      {
        credentials: "include",
      },
    );
    const data = await response.json();
    console.log("fetchPendingTransits response data:", data);
    return data;
  } catch (error) {
    console.error("Error fetching pending transits:", error);
    return { success: false, message: "Impossible de récupérer les transits en attente." };
  }
}

// transferRequestId : id de la demande de transfert (pas de la TransitApproval).
export async function approveTransit(transferRequestId: string) {
  try {
    const response = await fetch(
      `${API_URL}/api/transactions/transits/${transferRequestId}/approve`,
      {
        method: "POST",
        credentials: "include",
      },
    );
    const data = await response.json();
    console.log("approveTransit response data:", data);
    return data;
  } catch (error) {
    console.error("Error approving transit:", error);
    return { success: false, message: "Impossible d'approuver le transit." };
  }
}

// Si les deux quartiers ont un accès mer, le backend crée une demande
// maritime à la place (data.maritimeRequest).
export async function rejectTransit(
  transferRequestId: string,
  rejectionReason: string,
) {
  try {
    const response = await fetch(
      `${API_URL}/api/transactions/transits/${transferRequestId}/reject`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ rejectionReason }),
        credentials: "include",
      },
    );
    const data = await response.json();
    console.log("rejectTransit response data:", data);
    return data;
  } catch (error) {
    console.error("Error rejecting transit:", error);
    return { success: false, message: "Impossible de refuser le transit." };
  }
}
