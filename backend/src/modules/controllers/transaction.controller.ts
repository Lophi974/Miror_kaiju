import { broadcastTransferRequestChange } from "../../wc/broadcast";
import {
  reserveResourcesService,
  isAdjacentQuarter,
  doesTargetQuarterHaveSufficientResources,
  createPendingTransferRequest,
  requisitionResourcesService,
  getAdjacentQuarterIds,
  createPendingTransitRequest,
  getPendingRequestsForQuarterService,
  getQuarterRequestHistoryService,
  approveTransferRequestService,
  rejectTransferRequestService,
  areAllTransitApprovalsApproved,
  getPendingTransitApprovalsForQuarterService,
  approveTransitApprovalService,
  rejectTransitApprovalService,
} from "../services/transaction.service";

export async function reserveResources(
  req: {
    body: { resourceId: string; quantity: number };
    user: { sub: string; role: string; quarterId: string | null };
    severityLevel: number;
  },
  res: any,
) {
  if (req.severityLevel < 2)
    return res.status(403).json({
      success: false,
      message: "Impossible de réserver des ressources à ce niveau de sévérité.",
    });

  try {
    const { resourceId, quantity } = req.body;
    const requestedById = req.user.sub;
    const quarterId = req.user.quarterId;

    if (!quarterId) {
      return res.status(400).json({
        success: false,
        message: "Aucun quartier n'est associé à cet utilisateur.",
      });
    }

    const result = await reserveResourcesService(
      resourceId,
      quantity,
      quarterId,
      requestedById,
    );

    return res.status(200).json({ success: true, data: result.message });
  } catch (error) {
    console.error("Error in reserveResources:", error);
    return res.status(500).json({
      success: false,
      message: "Une erreur est survenue lors de la réservation.",
    });
  }
}

export async function requestRessources(
  req: {
    body: {
      resourceId: string;
      quantity: number;
      targetQuarterId: string;
      sourceQuarterId: string;
    };
    user: { sub: string; role: string; quarterId: string | null };
    severityLevel: number;
  },
  res: any,
) {
  if (req.severityLevel < 3) {
    return res.status(403).json({
      success: false,
      message: "Impossible de demander des ressources à ce niveau de sévérité.",
    });
  }

  try {
    const { resourceId, quantity, targetQuarterId } = req.body;
    // Un QC demande toujours pour son propre quartier : on ignore le body
    const sourceQuarterId =
      req.user.role === "QC" ? req.user.quarterId : req.body.sourceQuarterId;

    if (!sourceQuarterId) {
      return res.status(400).json({
        success: false,
        message: "Aucun quartier n'est associé à cet utilisateur.",
      });
    }
    const requestedById = req.user.sub;

    if (!quantity || quantity <= 0) {
      return res.status(400).json({
        success: false,
        message: "La quantité doit être un nombre positif.",
      });
    }

    const isAdjacent = await isAdjacentQuarter(
      sourceQuarterId,
      targetQuarterId,
    );
    if (!isAdjacent) {
      return res.status(400).json({
        success: false,
        message: "Le quartier sollicité n'est pas adjacent au quartier demandeur.",
      });
    }

    const hasSufficientResources =
      await doesTargetQuarterHaveSufficientResources(
        sourceQuarterId,
        targetQuarterId,
        resourceId,
        quantity,
      );

    if (!hasSufficientResources) {
      return res.status(400).json({
        success: false,
        message: "Le quartier sollicité n'a pas assez de ressources au-dessus de son seuil de rétention.",
      });
    }

    const transferRequest = await createPendingTransferRequest(
      sourceQuarterId,
      targetQuarterId,
      resourceId,
      quantity,
      requestedById,
      req.severityLevel,
    );

    broadcastTransferRequestChange();
    return res.status(201).json({
      success: true,
      message: "Demande de transfert créée, en attente de validation.",
      data: transferRequest,
    });
  } catch (error) {
    console.error("Error in requestRessources:", error);
    return res.status(500).json({
      success: false,
      message: "Une erreur est survenue lors de la demande de ressources.",
    });
  }
}

export async function transferRessources(
  req: {
    body: {
      resourceId: string;
      quantity: number;
      sourceQuarterId: string;
      targetQuarterId: string;
    };
    user: { sub: string; role: string };
    severityLevel: number;
  },
  res: any,
) {
  const { resourceId, quantity, sourceQuarterId, targetQuarterId } = req.body;

  if (req.severityLevel < 4) {
    return res.status(403).json({
      success: false,
      message: "Impossible de transférer des ressources à ce niveau de sévérité.",
    });
  }

  const isAdjacent = await isAdjacentQuarter(sourceQuarterId, targetQuarterId);

  const hasSufficientResources = await doesTargetQuarterHaveSufficientResources(
    sourceQuarterId,
    targetQuarterId,
    resourceId,
    quantity,
  );

  if (!hasSufficientResources) {
    return res.status(400).json({
      success: false,
      message: "Le quartier sollicité n'a pas assez de ressources au-dessus de son seuil de rétention.",
    });
  }

  if (isAdjacent) {
    // Transfert adjacent : LC dès le niveau 4, CD seulement au niveau 5
    if (req.user.role === "CD" && req.severityLevel < 5) {
      return res.status(403).json({
        success: false,
        message: "Le CD ne peut organiser un transfert adjacent qu'au niveau de sévérité 5.",
      });
    }

    try {
      const transferRequest = await createPendingTransferRequest(
        sourceQuarterId,
        targetQuarterId,
        resourceId,
        quantity,
        req.user.sub,
        req.severityLevel,
      );

      broadcastTransferRequestChange();
      return res.status(201).json({
        success: true,
        message: "Demande de transfert créée, en attente de validation.",
        data: transferRequest,
      });
    } catch (error) {
      console.error("Error in transferRessources:", error);
      return res.status(500).json({
        success: false,
        message: "Une erreur est survenue lors du transfert.",
      });
    }
  }

  try {
    const adjacentToSource = await getAdjacentQuarterIds(sourceQuarterId);

    if (!adjacentToSource || adjacentToSource.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Aucun quartier adjacent trouvé pour le quartier demandeur.",
      });
    }

    for (const adjQuarterId of adjacentToSource) {
      const hasSufficientResourcesInAdjacent =
        await doesTargetQuarterHaveSufficientResources(
          sourceQuarterId,
          adjQuarterId,
          resourceId,
          quantity,
        );

      if (hasSufficientResourcesInAdjacent) {
        return res.status(400).json({
          success: false,
          message: `Le quartier sollicité n'est pas adjacent au demandeur, mais un quartier adjacent a assez de ressources : faites-lui la demande en priorité.`,
        });
      }
    }

    // Aucun adjacent à la source ne peut fournir : on cherche un vrai
    // quartier de transit — adjacent à la fois à la source ET à la cible,
    // sinon le chemin n'existe pas géographiquement.
    const adjacentToTarget = await getAdjacentQuarterIds(targetQuarterId);
    const transitQuarterId = adjacentToSource.find((id) =>
      adjacentToTarget.includes(id),
    );

    if (!transitQuarterId) {
      return res.status(400).json({
        success: false,
        message:
          "Aucun quartier de passage ne relie directement ces deux quartiers.",
      });
    }

    const transiteRequest = await createPendingTransitRequest(
      sourceQuarterId,
      targetQuarterId,
      resourceId,
      quantity,
      req.user.sub,
      req.severityLevel,
      [transitQuarterId],
    );

    broadcastTransferRequestChange();
    return res.status(201).json({
      success: true,
      message: "Demande de transit créée, en attente de l'accord du quartier de passage.",
      data: transiteRequest,
    });
  } catch (error) {
    console.error("Error in transferRessources:", error);
    return res.status(500).json({
      success: false,
      message: "Une erreur est survenue lors de la création de la demande de transit.",
    });
  }
}

export async function requisitionRessources(
  req: {
    body: {
      resourceId: string;
      quantity: number;
      sourceQuarterId: string;
      targetQuarterId: string;
    };
    user: { sub: string; role: string };
    severityLevel: number;
  },
  res: any,
) {
  if (req.severityLevel < 4) {
    return res.status(403).json({
      success: false,
      message: "Impossible de réquisitionner des ressources à ce niveau de sévérité.",
    });
  }

  try {
    const { resourceId, quantity, sourceQuarterId, targetQuarterId } = req.body;
    const requisitionedById = req.user.sub;

    if (!quantity || quantity <= 0) {
      return res.status(400).json({
        success: false,
        message: "La quantité doit être un nombre positif.",
      });
    }

    const doesHaveSufficientResources =
      await doesTargetQuarterHaveSufficientResources(
        sourceQuarterId,
        targetQuarterId,
        resourceId,
        quantity,
      );

    if (!doesHaveSufficientResources) {
      return res.status(400).json({
        success: false,
        message: "Le quartier réquisitionné n'a pas assez de ressources au-dessus de son seuil de rétention.",
      });
    }

    await requisitionResourcesService(
      resourceId,
      quantity,
      sourceQuarterId,
      targetQuarterId,
      requisitionedById,
      req.severityLevel,
    );

    broadcastTransferRequestChange();
    return res.status(200).json({
      success: true,
      message: "Réquisition effectuée avec succès.",
    });
  } catch (error) {
    console.error("Error in requisitionRessources:", error);
    return res.status(500).json({
      success: false,
      message: "Une erreur est survenue lors de la réquisition.",
    });
  }
}

export async function getPendingRequests(
  req: { user: { quarterId: string | null } },
  res: any,) {

    const { quarterId } = req.user;

    if (!quarterId) {
      return res.status(400).json({
        success: false,
        message: "Aucun quartier n'est associé à cet utilisateur.",
      });
    }

    try {
      const pendingRequests = await getPendingRequestsForQuarterService(
        quarterId,
      );
      return res.status(200).json({ success: true, data: pendingRequests });
    } catch (error) {
      console.error("Error in getPendingRequests:", error);
      return res.status(500).json({
        success: false,
        message: "Une erreur est survenue lors de la récupération des demandes en attente.",
      });
    }
  }

  export async function getQuarterRequestHistory(
    req: { user: { quarterId: string | null } },
    res: any,
  ) {
    const { quarterId } = req.user;

    if (!quarterId) {
      return res.status(400).json({
        success: false,
        message: "Aucun quartier n'est associé à cet utilisateur.",
      });
    }

    try {
      const requestHistory = await getQuarterRequestHistoryService(quarterId);
      return res.status(200).json({ success: true, data: requestHistory });
    } catch (error) {
      console.error("Error in getQuarterRequestHistory:", error);
      return res.status(500).json({
        success: false,
        message: "Une erreur est survenue lors de la récupération de l'historique.",
      });
    }
  }
export async function approveTransferRequest(
  req: {
    params: { id: string };
    user: { sub: string; role: string; quarterId: string | null };
    severityLevel: number;
  },
  res: any,
) {
  if (req.severityLevel < 3) {
    return res.status(403).json({
      success: false,
      message: "Impossible d'approuver une demande à ce niveau de sévérité.",
    });
  }

  const { quarterId } = req.user;

  if (!quarterId) {
    return res.status(400).json({
      success: false,
      message: "Aucun quartier n'est associé à cet utilisateur.",
    });
  }

  try {
    const pendingRequests =
      await getPendingRequestsForQuarterService(quarterId);
    const transferRequest = pendingRequests.find(
      (r) => r.id === req.params.id,
    );

    if (!transferRequest) {
      return res.status(404).json({
        success: false,
        message: "Aucune demande en attente avec cet identifiant pour votre quartier.",
      });
    }

    if (
      transferRequest.routeType === "TRANSIT" &&
      !(await areAllTransitApprovalsApproved(transferRequest.id))
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Le quartier de passage n'a pas encore approuvé cette demande.",
      });
    }

    const hasSufficientResources =
      await doesTargetQuarterHaveSufficientResources(
        transferRequest.requestingQuarterId,
        transferRequest.supplyingQuarterId,
        transferRequest.resourceTypeId,
        transferRequest.quantity,
      );

    if (!hasSufficientResources) {
      return res.status(400).json({
        success: false,
        message:
          "Votre quartier n'a plus assez de ressources au-dessus de son seuil de rétention. Refusez plutôt la demande.",
      });
    }

    const result = await approveTransferRequestService(
      transferRequest.id,
      req.user.sub,
    );

    broadcastTransferRequestChange();
    return res.status(200).json({
      success: true,
      message: result.message,
      data: result.transferRequest,
    });
  } catch (error) {
    console.error("Error in approveTransferRequest:", error);
    return res.status(500).json({
      success: false,
      message: "Une erreur est survenue lors de l'approbation de la demande.",
    });
  }
}

export async function rejectTransferRequest(
  req: {
    params: { id: string };
    body: { rejectionReason: string };
    user: { sub: string; role: string; quarterId: string | null };
    severityLevel: number;
  },
  res: any,
) {
  if (req.severityLevel < 3) {
    return res.status(403).json({
      success: false,
      message: "Impossible de refuser une demande à ce niveau de sévérité.",
    });
  }

  const { quarterId } = req.user;
  const { rejectionReason } = req.body;

  if (!quarterId) {
    return res.status(400).json({
      success: false,
      message: "Aucun quartier n'est associé à cet utilisateur.",
    });
  }

  if (!rejectionReason || !rejectionReason.trim()) {
    return res.status(400).json({
      success: false,
      message: "Un motif de refus est requis.",
    });
  }

  try {
    const pendingRequests =
      await getPendingRequestsForQuarterService(quarterId);
    const transferRequest = pendingRequests.find(
      (r) => r.id === req.params.id,
    );

    if (!transferRequest) {
      return res.status(404).json({
        success: false,
        message: "Aucune demande en attente avec cet identifiant pour votre quartier.",
      });
    }

    const rejectedRequest = await rejectTransferRequestService(
      transferRequest.id,
      req.user.sub,
      rejectionReason.trim(),
    );

    broadcastTransferRequestChange();
    return res.status(200).json({
      success: true,
      message: "Demande de transfert refusée.",
      data: rejectedRequest,
    });
  } catch (error) {
    console.error("Error in rejectTransferRequest:", error);
    return res.status(500).json({
      success: false,
      message: "Une erreur est survenue lors du refus de la demande.",
    });
  }
}

export async function getPendingTransitApprovals(
  req: { user: { quarterId: string | null } },
  res: any,
) {
  const { quarterId } = req.user;

  if (!quarterId) {
    return res.status(400).json({
      success: false,
      message: "Aucun quartier n'est associé à cet utilisateur.",
    });
  }

  try {
    const pendingApprovals =
      await getPendingTransitApprovalsForQuarterService(quarterId);
    return res.status(200).json({ success: true, data: pendingApprovals });
  } catch (error) {
    console.error("Error in getPendingTransitApprovals:", error);
    return res.status(500).json({
      success: false,
      message: "Une erreur est survenue lors de la récupération des transits en attente.",
    });
  }
}

export async function approveTransit(
  req: {
    params: { id: string };
    user: { sub: string; role: string; quarterId: string | null };
    severityLevel: number;
  },
  res: any,
) {
  if (req.severityLevel < 4) {
    return res.status(403).json({
      success: false,
      message: "Impossible d'approuver un transit à ce niveau de sévérité.",
    });
  }

  const { quarterId } = req.user;

  if (!quarterId) {
    return res.status(400).json({
      success: false,
      message: "Aucun quartier n'est associé à cet utilisateur.",
    });
  }

  try {
    const pendingApprovals =
      await getPendingTransitApprovalsForQuarterService(quarterId);
    const transitApproval = pendingApprovals.find(
      (a) => a.transferRequestId === req.params.id,
    );

    if (!transitApproval) {
      return res.status(404).json({
        success: false,
        message: "Aucun transit en attente pour cette demande dans votre quartier.",
      });
    }

    const approvedTransit = await approveTransitApprovalService(
      transitApproval.id,
      req.user.sub,
    );

    broadcastTransferRequestChange();
    return res.status(200).json({
      success: true,
      message:
        "Transit approuvé. La demande attend maintenant l'accord du quartier fournisseur.",
      data: approvedTransit,
    });
  } catch (error) {
    console.error("Error in approveTransit:", error);
    return res.status(500).json({
      success: false,
      message: "Une erreur est survenue lors de l'approbation du transit.",
    });
  }
}

export async function rejectTransit(
  req: {
    params: { id: string };
    body: { rejectionReason: string };
    user: { sub: string; role: string; quarterId: string | null };
    severityLevel: number;
  },
  res: any,
) {
  if (req.severityLevel < 4) {
    return res.status(403).json({
      success: false,
      message: "Impossible de refuser un transit à ce niveau de sévérité.",
    });
  }

  const { quarterId } = req.user;
  const { rejectionReason } = req.body;

  if (!quarterId) {
    return res.status(400).json({
      success: false,
      message: "Aucun quartier n'est associé à cet utilisateur.",
    });
  }

  if (!rejectionReason || !rejectionReason.trim()) {
    return res.status(400).json({
      success: false,
      message: "Un motif de refus est requis.",
    });
  }

  try {
    const pendingApprovals =
      await getPendingTransitApprovalsForQuarterService(quarterId);
    const transitApproval = pendingApprovals.find(
      (a) => a.transferRequestId === req.params.id,
    );

    if (!transitApproval) {
      return res.status(404).json({
        success: false,
        message: "Aucun transit en attente pour cette demande dans votre quartier.",
      });
    }

    const { rejectedRequest, maritimeRequest } =
      await rejectTransitApprovalService(
        transitApproval.id,
        transitApproval.transferRequestId,
        req.user.sub,
        rejectionReason.trim(),
        req.severityLevel,
      );

    broadcastTransferRequestChange();
    return res.status(200).json({
      success: true,
      message: maritimeRequest
        ? "Transit refusé. Une demande par voie maritime a été créée à la place, en attente de l'accord du quartier fournisseur."
        : "Transit refusé. Aucune route maritime n'est possible entre ces quartiers.",
      data: { rejectedRequest, maritimeRequest },
    });
  } catch (error) {
    console.error("Error in rejectTransit:", error);
    return res.status(500).json({
      success: false,
      message: "Une erreur est survenue lors du refus du transit.",
    });
  }
}
