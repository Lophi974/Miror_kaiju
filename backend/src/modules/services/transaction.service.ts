import { db } from "../../prisma/db";
import { and, or } from "@prisma/orm-postgres/orm-client";

export async function reserveResourcesService(
  resourceTypeId: string,
  quantity: number,
  quarterId: string,
  requestedById: string,
) {
  if (quantity <= 0) {
    throw new Error("La quantité à réserver doit être positive.");
  }

  return db.transaction(async (tx) => {
    const [quarter, quarterResource] = await Promise.all([
      tx.orm.public.Quarter.where((q) =>
        q.id.eq(quarterId as Parameters<typeof q.id.eq>[0]),
      ).first(),
      tx.orm.public.QuarterResource.where((r) =>
        and(
          r.quarterId.eq(quarterId as Parameters<typeof r.quarterId.eq>[0]),
          r.resourceTypeId.eq(
            resourceTypeId as Parameters<typeof r.resourceTypeId.eq>[0],
          ),
        ),
      ).first(),
    ]);

    if (!quarter || !quarterResource) {
      throw new Error("Aucune ressource de ce type pour ce quartier.");
    }

    // Seuil de rétention : 30% (arrondi au supérieur) de initialQuantity,
    // qui ne bouge jamais.
    const minRetention = Math.ceil(
      (quarterResource.initialQuantity * quarter.treshHoldPercent) / 100,
    );

    if (quarterResource.currentQuantity - quantity < minRetention) {
      throw new Error(
        `Cette réservation ferait passer le stock sous le seuil de rétention (${minRetention}). ` +
          `Disponible au-dessus du seuil : ${Math.max(0, quarterResource.currentQuantity - minRetention)}.`,
      );
    }

    const remaining = quarterResource.currentQuantity - quantity;

    // Décrémente le vrai stock disponible.
    await tx.orm.public.QuarterResource.where((r) =>
      and(
        r.quarterId.eq(quarterId as Parameters<typeof r.quarterId.eq>[0]),
        r.resourceTypeId.eq(
          resourceTypeId as Parameters<typeof r.resourceTypeId.eq>[0],
        ),
      ),
    ).updateAll({ currentQuantity: remaining });

    // Trace la quantité réservée au lieu de la laisser disparaître :
    // incrémente si une ligne existe déjà pour ce couple, sinon la crée.
    const existingAmount = await tx.orm.public.QuarterResourceAmount.where(
      (r) =>
        and(
          r.quarterId.eq(quarterId as Parameters<typeof r.quarterId.eq>[0]),
          r.resourceTypeId.eq(
            resourceTypeId as Parameters<typeof r.resourceTypeId.eq>[0],
          ),
        ),
    ).first();

    if (existingAmount) {
      await tx.orm.public.QuarterResourceAmount.where((r) =>
        and(
          r.quarterId.eq(quarterId as Parameters<typeof r.quarterId.eq>[0]),
          r.resourceTypeId.eq(
            resourceTypeId as Parameters<typeof r.resourceTypeId.eq>[0],
          ),
        ),
      ).updateAll({ amount: existingAmount.amount + quantity });
    } else {
      await tx.orm.public.QuarterResourceAmount.create({
        quarterId: quarterId as Parameters<
          typeof tx.orm.public.QuarterResourceAmount.create
        >[0]["quarterId"],
        resourceTypeId: resourceTypeId as Parameters<
          typeof tx.orm.public.QuarterResourceAmount.create
        >[0]["resourceTypeId"],
        amount: quantity,
      });
    }

    const reservation = await tx.orm.public.ReservationRequest.create({
      quarterId: quarterId as Parameters<
        typeof tx.orm.public.ReservationRequest.create
      >[0]["quarterId"],
      resourceTypeId: resourceTypeId as Parameters<
        typeof tx.orm.public.ReservationRequest.create
      >[0]["resourceTypeId"],
      quantity,
      requestedById: requestedById as Parameters<
        typeof tx.orm.public.ReservationRequest.create
      >[0]["requestedById"],
    });

    return {
      success: true,
      message: `Ressources réservées avec succès. Quantité restante disponible : ${remaining}`,
      reservationId: reservation.id,
    };
  });
}

export async function isAdjacentQuarter(
  quarterId1: string,
  quarterId2: string,
): Promise<boolean> {
  const quarter1 = await db.orm.public.Quarter.where((q) =>
    q.id.eq(quarterId1 as Parameters<typeof q.id.eq>[0]),
  ).first();

  const quarter2 = await db.orm.public.Quarter.where((q) =>
    q.id.eq(quarterId2 as Parameters<typeof q.id.eq>[0]),
  ).first();

  if (!quarter1 || !quarter2) {
    throw new Error("One or both quarters not found.");
  }

  if (quarterId1 === quarterId2) {
    return false;
  }

  const adjacency = await db.orm.public.QuarterAdjacency.where((a) =>
    or(
      and(
        a.quarterAId.eq(quarterId1 as Parameters<typeof a.quarterAId.eq>[0]),
        a.quarterBId.eq(quarterId2 as Parameters<typeof a.quarterBId.eq>[0]),
      ),
      and(
        a.quarterAId.eq(quarterId2 as Parameters<typeof a.quarterAId.eq>[0]),
        a.quarterBId.eq(quarterId1 as Parameters<typeof a.quarterBId.eq>[0]),
      ),
    ),
  ).first();

  return adjacency != null;
}

/**
 * Retourne la liste des quarterId adjacents au quartier donné.
 * QuarterAdjacency étant seedée dans les deux sens, une seule requête
 * suffit : on récupère toutes les lignes où le quartier apparaît en A
 * OU en B, et on renvoie "l'autre côté" de chaque ligne.
 */
export async function getAdjacentQuarterIds(
  quarterId: string,
): Promise<string[]> {
  const quarter = await db.orm.public.Quarter.where((q) =>
    q.id.eq(quarterId as Parameters<typeof q.id.eq>[0]),
  ).first();

  if (!quarter) {
    throw new Error("Quarter not found.");
  }

  const adjacencies = await db.orm.public.QuarterAdjacency.where((a) =>
    or(
      a.quarterAId.eq(quarterId as Parameters<typeof a.quarterAId.eq>[0]),
      a.quarterBId.eq(quarterId as Parameters<typeof a.quarterBId.eq>[0]),
    ),
  ).all();

  return adjacencies.map((a) =>
    a.quarterAId === quarterId ? a.quarterBId : a.quarterAId,
  );
}

export async function doesTargetQuarterHaveSufficientResources(
  sourceQuarterId: string,
  targetQuarterId: string,
  resourceTypeId: string,
  quantity: number,
): Promise<boolean> {
  const [targetQuarter, targetResource] = await Promise.all([
    db.orm.public.Quarter.where((q) =>
      q.id.eq(targetQuarterId as Parameters<typeof q.id.eq>[0]),
    ).first(),
    db.orm.public.QuarterResource.where((r) =>
      and(
        r.quarterId.eq(targetQuarterId as Parameters<typeof r.quarterId.eq>[0]),
        r.resourceTypeId.eq(
          resourceTypeId as Parameters<typeof r.resourceTypeId.eq>[0],
        ),
      ),
    ).first(),
  ]);

  if (!targetQuarter || !targetResource) {
    return false;
  }

  const minRetention = Math.ceil(
    (targetResource.initialQuantity * targetQuarter.treshHoldPercent) / 100,
  );

  const availableSurplus = targetResource.currentQuantity - minRetention;

  return availableSurplus >= quantity;
}

export async function createPendingTransferRequest(
  requestingQuarterId: string,
  supplyingQuarterId: string,
  resourceTypeId: string,
  quantity: number,
  createdById: string,
  currentLevel: number,
) {
  return db.orm.public.TransferRequest.create({
    requestingQuarterId: requestingQuarterId as Parameters<
      typeof db.orm.public.TransferRequest.create
    >[0]["requestingQuarterId"],
    supplyingQuarterId: supplyingQuarterId as Parameters<
      typeof db.orm.public.TransferRequest.create
    >[0]["supplyingQuarterId"],
    resourceTypeId: resourceTypeId as Parameters<
      typeof db.orm.public.TransferRequest.create
    >[0]["resourceTypeId"],
    quantity,
    routeType: "DIRECT",
    status: "PENDING",
    disasterLevelAtRequest: currentLevel,
    createdById: createdById as Parameters<
      typeof db.orm.public.TransferRequest.create
    >[0]["createdById"],
  });
}

/**
 * Crée une demande de transfert non-adjacent (routeType TRANSIT), en
 * PENDING, accompagnée d'une ligne TransitApproval par quartier
 * intermédiaire (également PENDING — chacun doit approuver séparément
 * avant que le transfert puisse être complété).
 *
 * transitQuarterIds : quartiers intermédiaires, dans l'ordre du chemin
 * (order 1, 2, ...). Le quartier source (fournisseur) et le quartier
 * cible (demandeur) ne doivent PAS être inclus dans ce tableau.
 */
export async function createPendingTransitRequest(
  requestingQuarterId: string,
  supplyingQuarterId: string,
  resourceTypeId: string,
  quantity: number,
  createdById: string,
  currentLevel: number,
  transitQuarterIds: string[],
) {
  if (transitQuarterIds.length === 0) {
    throw new Error("Au moins un quartier de transit est requis.");
  }

  return db.transaction(async (tx) => {
    const transferRequest = await tx.orm.public.TransferRequest.create({
      requestingQuarterId: requestingQuarterId as Parameters<
        typeof tx.orm.public.TransferRequest.create
      >[0]["requestingQuarterId"],
      supplyingQuarterId: supplyingQuarterId as Parameters<
        typeof tx.orm.public.TransferRequest.create
      >[0]["supplyingQuarterId"],
      resourceTypeId: resourceTypeId as Parameters<
        typeof tx.orm.public.TransferRequest.create
      >[0]["resourceTypeId"],
      quantity,
      routeType: "TRANSIT",
      status: "PENDING",
      disasterLevelAtRequest: currentLevel,
      createdById: createdById as Parameters<
        typeof tx.orm.public.TransferRequest.create
      >[0]["createdById"],
    });

    for (let i = 0; i < transitQuarterIds.length; i++) {
      await tx.orm.public.TransitApproval.create({
        transferRequestId: transferRequest.id as Parameters<
          typeof tx.orm.public.TransitApproval.create
        >[0]["transferRequestId"],
        transitQuarterId: transitQuarterIds[i] as Parameters<
          typeof tx.orm.public.TransitApproval.create
        >[0]["transitQuarterId"],
        order: i + 1,
        status: "PENDING",
      });
    }

    return transferRequest;
  });
}

/**
 * Demandes directes (adjacentes) en attente où ce quartier est le
 * fournisseur sollicité (status PENDING, supplyingQuarterId = quarterId)
 * — celles que le QC doit approuver ou refuser.
 */
export async function getPendingRequestsForQuarterService(quarterId: string) {
  const quarter = await db.orm.public.Quarter.where((q) =>
    q.id.eq(quarterId as Parameters<typeof q.id.eq>[0]),
  ).first();

  if (!quarter) {
    throw new Error("Quarter not found.");
  }

  return db.orm.public.TransferRequest.where((r) =>
    and(
      r.supplyingQuarterId.eq(
        quarterId as Parameters<typeof r.supplyingQuarterId.eq>[0],
      ),
      r.status.eq("PENDING" as Parameters<typeof r.status.eq>[0]),
    ),
  ).all();
}

/**
 * Historique : toutes les TransferRequest où ce quartier apparaît, en
 * tant que demandeur OU fournisseur, quel que soit le statut. Triées du
 * plus récent au plus ancien.
 */
export async function getQuarterRequestHistoryService(quarterId: string) {
  const quarter = await db.orm.public.Quarter.where((q) =>
    q.id.eq(quarterId as Parameters<typeof q.id.eq>[0]),
  ).first();

  if (!quarter) {
    throw new Error("Quarter not found.");
  }

  const requests = await db.orm.public.TransferRequest.where((r) =>
    or(
      r.requestingQuarterId.eq(
        quarterId as Parameters<typeof r.requestingQuarterId.eq>[0],
      ),
      r.supplyingQuarterId.eq(
        quarterId as Parameters<typeof r.supplyingQuarterId.eq>[0],
      ),
    ),
  ).all();

  return requests.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

/**
 * Approbation d'une demande directe (adjacente) par le QC fournisseur :
 * le stock est déplacé et la demande passe à COMPLETED. Le seuil de
 * rétention est revérifié (le stock a pu bouger depuis la création).
 */
export async function approveTransferRequestService(
  transferRequestId: string,
  decidedById: string,
) {
  return db.transaction(async (tx) => {
    const request = await tx.orm.public.TransferRequest.where((r) =>
      r.id.eq(transferRequestId as Parameters<typeof r.id.eq>[0]),
    ).first();

    if (!request || request.status !== "PENDING") {
      throw new Error("Cette demande n'est plus en attente.");
    }

    const [supplyingQuarter, supplyingResource, requestingResource] =
      await Promise.all([
        tx.orm.public.Quarter.where((q) =>
          q.id.eq(request.supplyingQuarterId as Parameters<typeof q.id.eq>[0]),
        ).first(),
        tx.orm.public.QuarterResource.where((r) =>
          and(
            r.quarterId.eq(
              request.supplyingQuarterId as Parameters<typeof r.quarterId.eq>[0],
            ),
            r.resourceTypeId.eq(
              request.resourceTypeId as Parameters<
                typeof r.resourceTypeId.eq
              >[0],
            ),
          ),
        ).first(),
        tx.orm.public.QuarterResource.where((r) =>
          and(
            r.quarterId.eq(
              request.requestingQuarterId as Parameters<
                typeof r.quarterId.eq
              >[0],
            ),
            r.resourceTypeId.eq(
              request.resourceTypeId as Parameters<
                typeof r.resourceTypeId.eq
              >[0],
            ),
          ),
        ).first(),
      ]);

    if (!supplyingQuarter || !supplyingResource) {
      throw new Error("Aucune ressource de ce type pour le quartier fournisseur.");
    }
    if (!requestingResource) {
      throw new Error("Aucune ressource de ce type pour le quartier demandeur.");
    }

    const minRetention = Math.ceil(
      (supplyingResource.initialQuantity * supplyingQuarter.treshHoldPercent) /
        100,
    );

    if (supplyingResource.currentQuantity - request.quantity < minRetention) {
      throw new Error(
        `Ce transfert ferait passer le stock du fournisseur sous son seuil de rétention (${minRetention}). ` +
          `Disponible au-dessus du seuil : ${Math.max(0, supplyingResource.currentQuantity - minRetention)}.`,
      );
    }

    // Filtre sur status PENDING : si une autre décision est passée
    // entre-temps (double clic, 2 QC), update() renvoie null.
    const now = new Date();
    const updatedRequest = await tx.orm.public.TransferRequest.where((r) =>
      and(
        r.id.eq(transferRequestId as Parameters<typeof r.id.eq>[0]),
        r.status.eq("PENDING" as Parameters<typeof r.status.eq>[0]),
      ),
    ).update({
      status: "COMPLETED",
      decidedById: decidedById as Parameters<
        typeof tx.orm.public.TransferRequest.create
      >[0]["decidedById"],
      decidedAt: now,
      completedAt: now,
    });

    if (!updatedRequest) {
      throw new Error("Cette demande a déjà été traitée.");
    }

    const newSupplyingQuantity =
      supplyingResource.currentQuantity - request.quantity;
    const newRequestingQuantity =
      requestingResource.currentQuantity + request.quantity;

    await tx.orm.public.QuarterResource.where((r) =>
      r.id.eq(supplyingResource.id as Parameters<typeof r.id.eq>[0]),
    ).updateAll({ currentQuantity: newSupplyingQuantity });

    await tx.orm.public.QuarterResource.where((r) =>
      r.id.eq(requestingResource.id as Parameters<typeof r.id.eq>[0]),
    ).updateAll({ currentQuantity: newRequestingQuantity });

    return {
      success: true,
      message: `Transfert approuvé : ${request.quantity} unité(s) envoyée(s). Stock restant du fournisseur : ${newSupplyingQuantity}.`,
      transferRequest: updatedRequest,
    };
  });
}

/**
 * Refus d'une demande directe (adjacente) par le QC fournisseur : aucun
 * stock ne bouge, la demande passe à REJECTED avec un motif.
 */
export async function rejectTransferRequestService(
  transferRequestId: string,
  decidedById: string,
  rejectionReason: string,
) {
  const updatedRequest = await db.orm.public.TransferRequest.where((r) =>
    and(
      r.id.eq(transferRequestId as Parameters<typeof r.id.eq>[0]),
      r.status.eq("PENDING" as Parameters<typeof r.status.eq>[0]),
    ),
  ).update({
    status: "REJECTED",
    decidedById: decidedById as Parameters<
      typeof db.orm.public.TransferRequest.create
    >[0]["decidedById"],
    decidedAt: new Date(),
    rejectionReason,
  });

  if (!updatedRequest) {
    throw new Error("Cette demande a déjà été traitée.");
  }

  return updatedRequest;
}

export async function requisitionResourcesService(
  resourceTypeId: string,
  quantity: number,
  sourceQuarterId: string,
  targetQuarterId: string,
  requisitionedById: string,
  currentLevel: number,
) {
  if (quantity <= 0) {
    throw new Error("La quantité réquisitionnée doit être positive.");
  }

  if (sourceQuarterId === targetQuarterId) {
    throw new Error("Impossible de réquisitionner un quartier vers lui-même.");
  }

  return db.transaction(async (tx) => {
    const [sourceQuarter, sourceResource, targetQuarter, targetResource] =
      await Promise.all([
        tx.orm.public.Quarter.where((q) =>
          q.id.eq(sourceQuarterId as Parameters<typeof q.id.eq>[0]),
        ).first(),
        tx.orm.public.QuarterResource.where((r) =>
          and(
            r.quarterId.eq(
              sourceQuarterId as Parameters<typeof r.quarterId.eq>[0],
            ),
            r.resourceTypeId.eq(
              resourceTypeId as Parameters<typeof r.resourceTypeId.eq>[0],
            ),
          ),
        ).first(),
        tx.orm.public.Quarter.where((q) =>
          q.id.eq(targetQuarterId as Parameters<typeof q.id.eq>[0]),
        ).first(),
        tx.orm.public.QuarterResource.where((r) =>
          and(
            r.quarterId.eq(
              targetQuarterId as Parameters<typeof r.quarterId.eq>[0],
            ),
            r.resourceTypeId.eq(
              resourceTypeId as Parameters<typeof r.resourceTypeId.eq>[0],
            ),
          ),
        ).first(),
      ]);

    if (!sourceQuarter || !sourceResource) {
      throw new Error("Aucune ressource de ce type pour le quartier source.");
    }
    if (!targetQuarter || !targetResource) {
      throw new Error("Aucune ressource de ce type pour le quartier cible.");
    }

    const minRetention = Math.ceil(
      (sourceResource.initialQuantity * sourceQuarter.treshHoldPercent) / 100,
    );

    if (sourceResource.currentQuantity - quantity < minRetention) {
      throw new Error(
        `Cette réquisition ferait passer le stock du quartier source sous son seuil de rétention (${minRetention}). ` +
          `Disponible au-dessus du seuil : ${Math.max(0, sourceResource.currentQuantity - minRetention)}.`,
      );
    }

    const newSourceQuantity = sourceResource.currentQuantity - quantity;
    const newTargetQuantity = targetResource.currentQuantity + quantity;

    await tx.orm.public.QuarterResource.where((r) =>
      and(
        r.quarterId.eq(sourceQuarterId as Parameters<typeof r.quarterId.eq>[0]),
        r.resourceTypeId.eq(
          resourceTypeId as Parameters<typeof r.resourceTypeId.eq>[0],
        ),
      ),
    ).updateAll({ currentQuantity: newSourceQuantity });

    await tx.orm.public.QuarterResource.where((r) =>
      and(
        r.quarterId.eq(targetQuarterId as Parameters<typeof r.quarterId.eq>[0]),
        r.resourceTypeId.eq(
          resourceTypeId as Parameters<typeof r.resourceTypeId.eq>[0],
        ),
      ),
    ).updateAll({ currentQuantity: newTargetQuantity });

    const transferRequest = await tx.orm.public.TransferRequest.create({
      requestingQuarterId: targetQuarterId as Parameters<
        typeof tx.orm.public.TransferRequest.create
      >[0]["requestingQuarterId"],
      supplyingQuarterId: sourceQuarterId as Parameters<
        typeof tx.orm.public.TransferRequest.create
      >[0]["supplyingQuarterId"],
      resourceTypeId: resourceTypeId as Parameters<
        typeof tx.orm.public.TransferRequest.create
      >[0]["resourceTypeId"],
      quantity,
      routeType: "DIRECT",
      status: "COMPLETED",
      disasterLevelAtRequest: currentLevel,
      createdById: requisitionedById as Parameters<
        typeof tx.orm.public.TransferRequest.create
      >[0]["createdById"],
      decidedById: requisitionedById as Parameters<
        typeof tx.orm.public.TransferRequest.create
      >[0]["decidedById"],
    });

    return {
      success: true,
      message: `Réquisition effectuée : ${quantity} unité(s) déplacée(s) de ${sourceQuarter.code} vers ${targetQuarter.code}.`,
      transferRequestId: transferRequest.id,
      sourceRemaining: newSourceQuantity,
      targetTotal: newTargetQuantity,
    };
  });
}
