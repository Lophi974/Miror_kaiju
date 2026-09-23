import { db } from "../../prisma/db.ts";

type QuarterCode = "A" | "E" | "W" | "X" | "Z";
type OfficerRole = "QC" | "LC" | "CD";

// --------------------------------------------------------------------------
// HELPER
// --------------------------------------------------------------------------

// Les champs uuidString() du contract sont typés en Char<36>, un type nominal
// qui n'existe qu'au niveau TS (à l'exécution c'est une string classique).
// Ce helper documente l'intention et centralise le cast en un seul endroit
// plutôt que de le répéter partout avec des `as any`.
// Si l'import `Char` échoue (nom différent selon la version installée),
// remplacer par: function uuid(id: string) { return id as any; }
function uuid(id: string): any {
  return id as unknown as any;
}

function uuidList(ids: string[]): any[] {
  return ids.map(uuid);
}

// --------------------------------------------------------------------------
// QUARTIERS & ADJACENCE
// --------------------------------------------------------------------------

export async function getQuarterByCode(code: QuarterCode) {
  return db.orm.public.Quarter.where((q) => q.code.eq(code)).first();
}

export async function checkIfQuartersAreAdjacent(
  quarter1Code: QuarterCode,
  quarter2Code: QuarterCode,
): Promise<boolean> {
  if (quarter1Code === quarter2Code) return false;

  const quarter1 = await getQuarterByCode(quarter1Code);
  const quarter2 = await getQuarterByCode(quarter2Code);

  if (!quarter1 || !quarter2) {
    throw new Error("One or both quarters not found");
  }

  // L'adjacence est seedée dans les deux sens (cf. contract.ts), donc un seul
  // sens suffit en théorie ; on garde les deux par sécurité contre un seed
  // incomplet.
  const rowsFromA = await db.orm.public.QuarterAdjacency.where((a) =>
    a.quarterAId.eq(uuid(quarter1.id)),
  ).all();
  const rowsFromB = await db.orm.public.QuarterAdjacency.where((a) =>
    a.quarterAId.eq(uuid(quarter2.id)),
  ).all();

  const forwardMatch = rowsFromA.some((r) => r.quarterBId === quarter2.id);
  const backwardMatch = rowsFromB.some((r) => r.quarterBId === quarter1.id);

  return forwardMatch || backwardMatch;
}

// Retourne les Quarter complets (pas les lignes d'adjacence brutes), pour
// pouvoir utiliser .code et .id directement côté controller.
export async function getAdjacentQuarters(quarterCode: QuarterCode) {
  const quarter = await getQuarterByCode(quarterCode);
  if (!quarter) throw new Error("Quarter not found");

  const rows = await db.orm.public.QuarterAdjacency.where((a) =>
    a.quarterAId.eq(uuid(quarter.id)),
  ).all();

  const adjacentIds = rows.map((r) => r.quarterBId);
  if (adjacentIds.length === 0) return [];

  return db.orm.public.Quarter.where((q) =>
    q.id.in(uuidList(adjacentIds)),
  ).all();
}

// Cherche un quartier commun adjacent aux deux (pour un transit à un saut).
// Vu la topologie (X borde tout le monde), c'est presque toujours X, mais on
// ne le hardcode pas : on privilégie X si trouvé, sinon un autre commun.
export async function findCommonAdjacentQuarter(
  quarter1Code: QuarterCode,
  quarter2Code: QuarterCode,
) {
  const [adjacentTo1, adjacentTo2] = await Promise.all([
    getAdjacentQuarters(quarter1Code),
    getAdjacentQuarters(quarter2Code),
  ]);

  const idsAdjacentTo2 = new Set(adjacentTo2.map((q) => q.id));
  const common = adjacentTo1.filter((q) => idsAdjacentTo2.has(q.id));

  return common.find((q) => q.code === "X") ?? common[0] ?? null;
}

export async function bothHaveSeaAccess(
  quarter1Code: QuarterCode,
  quarter2Code: QuarterCode,
): Promise<boolean> {
  const [q1, q2] = await Promise.all([
    getQuarterByCode(quarter1Code),
    getQuarterByCode(quarter2Code),
  ]);
  return Boolean(q1?.hasSeaAccess && q2?.hasSeaAccess);
}

// --------------------------------------------------------------------------
// RESSOURCES & SEUIL DE RÉTENTION
// --------------------------------------------------------------------------

export async function getSystemConfig() {
  const config = await db.orm.public.SystemConfig.where((c) =>
    c.id.eq(1),
  ).first();
  if (!config) throw new Error("System config not found");
  return config;
}

export async function getQuarterResource(
  quarterId: string,
  resourceTypeId: string,
) {
  return db.orm.public.QuarterResource.where((qr) =>
    qr.quarterId.eq(uuid(quarterId)),
  )
    .where((qr) => qr.resourceTypeId.eq(uuid(resourceTypeId)))
    .first();
}

// Le seuil se base sur initialQuantity (règle: "30% des ressources
// initiales"), avec le retentionPercent global (SystemConfig), abaissable à
// 15% par le CD au niveau 5.
export async function checkIfQuarterHasEnoughResources(
  quarterId: string,
  resourceTypeId: string,
  requestedQuantity: number,
): Promise<boolean> {
  const quarterResource = await getQuarterResource(quarterId, resourceTypeId);
  if (!quarterResource) {
    throw new Error("Resource type not found in quarter");
  }

  const config = await getSystemConfig();
  const minRetention = Math.ceil(
    (quarterResource.initialQuantity * config.retentionPercent) / 100,
  );

  const available = quarterResource.currentQuantity - minRetention;

  return requestedQuantity > 0 && requestedQuantity <= available;
}

// --------------------------------------------------------------------------
// SÉVÉRITÉ / NIVEAU
// --------------------------------------------------------------------------

// Tous les quartiers partagent le même niveau en pratique : on lit celui du
// quartier demandeur (le "premier" quartier de la requête).
export async function getQuarterSeverityLevel(
  quarterId: string,
): Promise<number> {
  const severity = await db.orm.public.DistrictSeverity.where((s) =>
    s.quarterId.eq(uuid(quarterId)),
  ).first();
  if (!severity) throw new Error("Severity not found for quarter");
  return severity.level;
}

// --------------------------------------------------------------------------
// PERMISSIONS (matrice rôles × niveaux)
// --------------------------------------------------------------------------

type TransferAction =
  | "RESERVE_OWN"
  | "REQUEST_ADJACENT_TRANSFER"
  | "ORGANIZE_TRANSIT";

export function canPerformAction(
  role: OfficerRole,
  action: TransferAction,
  level: number,
): boolean {
  switch (action) {
    case "RESERVE_OWN":
      // Lv2-5 : QC uniquement.
      return level >= 2 && role === "QC";
    case "REQUEST_ADJACENT_TRANSFER":
      // Lv3 : QC · Lv4 : QC, LC · Lv5 : tous.
      if (level === 3) return role === "QC";
      if (level === 4) return role === "QC" || role === "LC";
      if (level === 5) return true;
      return false;
    case "ORGANIZE_TRANSIT":
      // Lv4 : LC · Lv5 : LC, CD.
      if (level === 4) return role === "LC";
      if (level === 5) return role === "LC" || role === "CD";
      return false;
    default:
      return false;
  }
}

// --------------------------------------------------------------------------
// ÉCRITURES
// --------------------------------------------------------------------------

export async function createReservationRequest(params: {
  quarterId: string;
  resourceTypeId: string;
  quantity: number;
  requestedById: string;
}) {
  return db.orm.public.ReservationRequest.create({
    quarterId: uuid(params.quarterId),
    resourceTypeId: uuid(params.resourceTypeId),
    quantity: params.quantity,
    requestedById: uuid(params.requestedById),
  });
}

export async function createTransferRequest(params: {
  requestingQuarterId: string;
  supplyingQuarterId: string;
  resourceTypeId: string;
  quantity: number;
  routeType: "DIRECT" | "TRANSIT" | "MARITIME";
  disasterLevelAtRequest: number;
  createdById: string;
}) {
  return db.orm.public.TransferRequest.create({
    requestingQuarterId: uuid(params.requestingQuarterId),
    supplyingQuarterId: uuid(params.supplyingQuarterId),
    resourceTypeId: uuid(params.resourceTypeId),
    quantity: params.quantity,
    routeType: params.routeType,
    disasterLevelAtRequest: params.disasterLevelAtRequest,
    createdById: uuid(params.createdById),
  });
}

export async function createTransitApproval(params: {
  transferRequestId: string;
  transitQuarterId: string;
  order: number;
}) {
  return db.orm.public.TransitApproval.create({
    transferRequestId: uuid(params.transferRequestId),
    transitQuarterId: uuid(params.transitQuarterId),
    order: params.order,
  });
}
