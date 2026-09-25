import {
  reserveResourcesService,
  isAdjacentQuarter,
  doesTargetQuarterHaveSufficientResources,
  createPendingTransferRequest,
  requisitionResourcesService,
  getAdjacentQuarterIds,
  createPendingTransitRequest,
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
      message: "Cannot reserve resources at this severity level.",
    });

  try {
    const { resourceId, quantity } = req.body;
    const requestedById = req.user.sub;
    const quarterId = req.user.quarterId;

    if (!quarterId) {
      return res.status(400).json({
        success: false,
        message: "User does not have a quarter assigned.",
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
      message: "An error occurred while reserving resources.",
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
    user: { sub: string; role: string };
    severityLevel: number;
  },
  res: any,
) {
  if (req.severityLevel < 3) {
    return res.status(403).json({
      success: false,
      message: "Cannot request resources at this severity level.",
    });
  }

  try {
    const { resourceId, quantity, targetQuarterId, sourceQuarterId } = req.body;
    const requestedById = req.user.sub;

    if (!quantity || quantity <= 0) {
      return res.status(400).json({
        success: false,
        message: "Quantity must be a positive number.",
      });
    }

    const isAdjacent = await isAdjacentQuarter(
      sourceQuarterId,
      targetQuarterId,
    );
    if (!isAdjacent) {
      return res.status(400).json({
        success: false,
        message: "The target quarter is not adjacent to the source quarter.",
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
        message: "The target quarter does not have sufficient resources.",
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

    return res.status(201).json({
      success: true,
      message: "Transfer request created and pending approval.",
      data: transferRequest,
    });
  } catch (error) {
    console.error("Error in requestRessources:", error);
    return res.status(500).json({
      success: false,
      message: "An error occurred while requesting resources.",
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
      message: "Cannot transfer resources at this severity level.",
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
      message: "The target quarter does not have sufficient resources.",
    });
  }

  if (isAdjacent) {
    try {
      const transferRequest = await createPendingTransferRequest(
        sourceQuarterId,
        targetQuarterId,
        resourceId,
        quantity,
        req.user.sub,
        req.severityLevel,
      );

      return res.status(201).json({
        success: true,
        message: "Transfer request created and pending approval.",
        data: transferRequest,
      });
    } catch (error) {
      console.error("Error in transferRessources:", error);
      return res.status(500).json({
        success: false,
        message: "An error occurred while transferring resources.",
      });
    }
  }

  try {
    const adjacentToSource = await getAdjacentQuarterIds(sourceQuarterId);

    if (!adjacentToSource || adjacentToSource.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No adjacent quarter found for the source quarter.",
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
          message: `The target quarter is not adjacent to the source quarter. However, an adjacent quarter (${adjQuarterId}) has sufficient resources.`,
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
          "No single-hop transit quarter connects the source and target quarters.",
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

    return res.status(201).json({
      success: true,
      message: `Transit request created via quarter ${transitQuarterId}, pending its approval.`,
      data: transiteRequest,
    });
  } catch (error) {
    console.error("Error in transferRessources:", error);
    return res.status(500).json({
      success: false,
      message: "An error occurred while creating transit request.",
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
      message: "Cannot requisition resources at this severity level.",
    });
  }

  console.log("Requisition request received:", req.body);

  try {
    const { resourceId, quantity, sourceQuarterId, targetQuarterId } = req.body;
    const requisitionedById = req.user.sub;

    if (!quantity || quantity <= 0) {
      return res.status(400).json({
        success: false,
        message: "Quantity must be a positive number.",
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
        message: "The source quarter does not have sufficient resources.",
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

    return res.status(200).json({
      success: true,
      message: "Resources requisitioned successfully.",
    });
  } catch (error) {
    console.error("Error in requisitionRessources:", error);
    return res.status(500).json({
      success: false,
      message: "An error occurred while requisitioning resources.",
    });
  }
}
