import {
  checkIfQuartersAreAdjacent,
  getAdjacentQuarters,
  checkIfQuarterHasEnoughResources,
  getQuarterByCode,
  getQuarterSeverityLevel,
  canPerformAction,
  findCommonAdjacentQuarter,
  bothHaveSeaAccess,
  createReservationRequest,
  createTransferRequest,
  createTransitApproval,
} from "../services/transaction.service";

type QuarterCode = "A" | "E" | "W" | "X" | "Z";
type OfficerRole = "QC" | "LC" | "CD";

export async function transferResources(
  req: {
    body: {
      quarterCode: QuarterCode;
      resourceTypeId: string;
      requestedQuantity: number;
      targetQuarterCode: QuarterCode;
      role: OfficerRole;
      userId: string; // officier à l'origine de l'action (auditée sur la requête)
    };
  },
  res: any,
) {
  const { quarterCode, resourceTypeId, requestedQuantity, targetQuarterCode, role, userId } =
    req.body;

  if (
    !quarterCode ||
    !resourceTypeId ||
    requestedQuantity === undefined ||
    !targetQuarterCode ||
    role === undefined ||
    !userId
  ) {
    return res.status(400).json({ error: "Missing required parameters" });
  }

  if (requestedQuantity <= 0) {
    return res.status(400).json({
      success: false,
      code: "INVALID_QUANTITY",
      message: "requestedQuantity doit être positif",
    });
  }

  try {
    const requestingQuarter = await getQuarterByCode(quarterCode);
    if (!requestingQuarter) {
      return res.status(404).json({ error: `Quarter ${quarterCode} not found` });
    }

    // Niveau lu depuis le quartier demandeur (tous les quartiers partagent
    // le même niveau en pratique).
    const level = await getQuarterSeverityLevel(requestingQuarter.id);

    if (level === 1) {
      return res.status(403).json({
        success: false,
        code: "LEVEL_TOO_LOW",
        message: "Niveau 1 (Watch) : aucune réservation ni transfert autorisé.",
      });
    }

    // ------------------------------------------------------------------
    // Cas 1 : demande vers son propre quartier → réservation (Niv.2+, QC).
    // ------------------------------------------------------------------
    if (quarterCode === targetQuarterCode) {
      if (!canPerformAction(role, "RESERVE_OWN", level)) {
        return res.status(403).json({
          success: false,
          code: "PERMISSION_DENIED",
          message: "Seul un Quarter Coordinator peut réserver dans son propre quartier.",
        });
      }

      const hasEnough = await checkIfQuarterHasEnoughResources(
        requestingQuarter.id,
        resourceTypeId,
        requestedQuantity,
      );

      if (!hasEnough) {
        return res.status(409).json({
          success: false,
          code: "BELOW_RETENTION_THRESHOLD",
          message: "Cette réservation ferait passer le quartier sous son seuil de rétention.",
        });
      }

      const reservation = await createReservationRequest({
        quarterId: requestingQuarter.id,
        resourceTypeId,
        quantity: requestedQuantity,
        requestedById: userId,
      });

      return res.status(201).json({ success: true, reservation });
    }

    // ------------------------------------------------------------------
    // Cas 2 : transfert entre deux quartiers différents → Niv.3 minimum.
    // ------------------------------------------------------------------
    if (level < 3) {
      return res.status(403).json({
        success: false,
        code: "LEVEL_TOO_LOW",
        message: "Les transferts inter-quartiers nécessitent au moins le Niveau 3 (Emergency).",
      });
    }

    const targetQuarter = await getQuarterByCode(targetQuarterCode);
    if (!targetQuarter) {
      return res.status(404).json({ error: `Quarter ${targetQuarterCode} not found` });
    }

    const isAdjacent = await checkIfQuartersAreAdjacent(quarterCode, targetQuarterCode);

    // ---- 2a. Quartiers adjacents : transfert direct ----
    if (isAdjacent) {
      if (!canPerformAction(role, "REQUEST_ADJACENT_TRANSFER", level)) {
        return res.status(403).json({
          success: false,
          code: "PERMISSION_DENIED",
          message: "Ce rôle ne peut pas demander de transfert adjacent à ce niveau.",
        });
      }

      const targetHasSurplus = await checkIfQuarterHasEnoughResources(
        targetQuarter.id,
        resourceTypeId,
        requestedQuantity,
      );

      if (!targetHasSurplus) {
        return res.status(409).json({
          success: false,
          code: "INSUFFICIENT_SURPLUS",
          message: `${targetQuarterCode} n'a pas assez de surplus pour cette demande.`,
        });
      }

      const transfer = await createTransferRequest({
        requestingQuarterId: requestingQuarter.id,
        supplyingQuarterId: targetQuarter.id,
        resourceTypeId,
        quantity: requestedQuantity,
        routeType: "DIRECT",
        disasterLevelAtRequest: level,
        createdById: userId,
      });

      // Reste en PENDING : le QC du quartier fournisseur doit encore approuver.
      return res.status(201).json({ success: true, transfer });
    }

    // ---- 2b. Quartiers non-adjacents : transit / maritime, Niv.4 minimum ----
    if (level < 4) {
      return res.status(403).json({
        success: false,
        code: "LEVEL_TOO_LOW",
        message: "Les transferts vers un quartier non-adjacent nécessitent au moins le Niveau 4 (Critical).",
      });
    }

    if (!canPerformAction(role, "ORGANIZE_TRANSIT", level)) {
      return res.status(403).json({
        success: false,
        code: "PERMISSION_DENIED",
        message: "Seul le Logistics Coordinator (ou le City Director au Niveau 5) peut organiser un transit.",
      });
    }

    // Règle de priorité : un quartier non-adjacent ne peut fournir que si
    // aucun quartier adjacent au demandeur n'a le surplus requis.
    const adjacentToRequester = await getAdjacentQuarters(quarterCode);

    for (const adjacent of adjacentToRequester) {
      const adjacentHasSurplus = await checkIfQuarterHasEnoughResources(
        adjacent.id,
        resourceTypeId,
        requestedQuantity,
      );

      if (adjacentHasSurplus) {
        return res.status(409).json({
          success: false,
          code: "INSUFFICIENT_SURPLUS",
          message: `${adjacent.code} (adjacent) dispose déjà du surplus requis ; sollicitez-le en priorité.`,
        });
      }
    }

    const targetHasSurplus = await checkIfQuarterHasEnoughResources(
      targetQuarter.id,
      resourceTypeId,
      requestedQuantity,
    );

    if (!targetHasSurplus) {
      return res.status(409).json({
        success: false,
        code: "INSUFFICIENT_SURPLUS",
        message: `${targetQuarterCode} n'a pas assez de surplus pour cette demande.`,
      });
    }

    // Route maritime possible uniquement si les deux quartiers ont accès à
    // la mer (Echo, Xeno, Zion) — proposée comme alternative, délai doublé.
    const canUseMaritime = await bothHaveSeaAccess(quarterCode, targetQuarterCode);

    if (canUseMaritime) {
      const transfer = await createTransferRequest({
        requestingQuarterId: requestingQuarter.id,
        supplyingQuarterId: targetQuarter.id,
        resourceTypeId,
        quantity: requestedQuantity,
        routeType: "MARITIME",
        disasterLevelAtRequest: level,
        createdById: userId,
      });

      return res
        .status(201)
        .json({ success: true, transfer, note: "Route maritime : délai de livraison doublé." });
    }

    // Sinon, transit via un quartier intermédiaire commun (souvent Xeno).
    const transitQuarter = await findCommonAdjacentQuarter(quarterCode, targetQuarterCode);

    if (!transitQuarter) {
      return res.status(409).json({
        success: false,
        code: "TRANSIT_NOT_APPROVED",
        message: `Aucune route de transit trouvée entre ${quarterCode} et ${targetQuarterCode}.`,
      });
    }

    const transfer = await createTransferRequest({
      requestingQuarterId: requestingQuarter.id,
      supplyingQuarterId: targetQuarter.id,
      resourceTypeId,
      quantity: requestedQuantity,
      routeType: "TRANSIT",
      disasterLevelAtRequest: level,
      createdById: userId,
    });

    await createTransitApproval({
      transferRequestId: transfer.id,
      transitQuarterId: transitQuarter.id,
      order: 1,
    });

    return res.status(201).json({
      success: true,
      transfer,
      note:
        transitQuarter.code === "X"
          ? "Transit via Xeno : traité après les besoins propres de Xeno."
          : `Transit via ${transitQuarter.code}, en attente de son approbation.`,
    });
  } catch (error) {
    console.error("Error processing transfer request:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}