import { defineContract, enumType, member } from "@prisma/orm-postgres/contract-builder";

const pgText = { codecId: "pg/text@1", nativeType: "text" } as const;

// --------------------------------------------------------------------------
// ENUMS
// --------------------------------------------------------------------------

const QuarterCode = enumType(
  "QuarterCode",
  pgText,
  member("A", "A"), // Apex   — enclavé
  member("E", "E"), // Echo   — accès mer
  member("W", "W"), // Warden — enclavé
  member("X", "X"), // Xeno   — hub central, accès mer
  member("Z", "Z"), // Zion   — accès mer
);

const OfficerRole = enumType(
  "OfficerRole",
  pgText,
  member("QC", "QC"), // Quarter Coordinator — scope: un seul quartier
  member("LC", "LC"), // Logistics Coordinator — scope: multi-quartiers
  member("CD", "CD"), // City Director — scope: ville entière
);

const ReservationStatus = enumType(
  "ReservationStatus",
  pgText,
  member("ACTIVE", "ACTIVE"),
  member("RELEASED", "RELEASED"),
  member("EXPIRED", "EXPIRED"),
  member("CANCELLED", "CANCELLED"),
);

const TransferRouteType = enumType(
  "TransferRouteType",
  pgText,
  member("DIRECT", "DIRECT"), // quartiers adjacents
  member("TRANSIT", "TRANSIT"), // via un ou plusieurs quartiers intermédiaires
  member("MARITIME", "MARITIME"), // Echo / Xeno / Zion uniquement, délai doublé
);

const TransferStatus = enumType(
  "TransferStatus",
  pgText,
  member("PENDING", "PENDING"),
  member("APPROVED", "APPROVED"),
  member("REJECTED", "REJECTED"),
  member("IN_TRANSIT", "IN_TRANSIT"),
  member("COMPLETED", "COMPLETED"),
  member("CANCELLED", "CANCELLED"),
);

const TransitApprovalStatus = enumType(
  "TransitApprovalStatus",
  pgText,
  member("PENDING", "PENDING"),
  member("APPROVED", "APPROVED"),
  member("REJECTED", "REJECTED"),
);

// Un code distinct par règle violée (contrainte technique : jamais une
// erreur générique en cas de refus).
const RejectionCode = enumType(
  "RejectionCode",
  pgText,
  member("NOT_ADJACENT", "NOT_ADJACENT"),
  member("INSUFFICIENT_SURPLUS", "INSUFFICIENT_SURPLUS"),
  member("BELOW_RETENTION_THRESHOLD", "BELOW_RETENTION_THRESHOLD"),
  member("PERMISSION_DENIED", "PERMISSION_DENIED"),
  member("LEVEL_TOO_LOW", "LEVEL_TOO_LOW"),
  member("TRANSIT_NOT_APPROVED", "TRANSIT_NOT_APPROVED"),
  member("MARITIME_NOT_ALLOWED", "MARITIME_NOT_ALLOWED"),
  member("SELF_TRANSFER", "SELF_TRANSFER"),
  member("INVALID_QUANTITY", "INVALID_QUANTITY"),
  // Requêtes transitant par Xeno traitées après ses propres besoins.
  member("XENO_PRIORITY_PENDING", "XENO_PRIORITY_PENDING"),
);

export const contract = defineContract({}, ({ field, model, rel }) => {
  // ------------------------------------------------------------------------
  // CONFIGURATION GLOBALE (singleton, id fixé à 1 par l'application)
  // ------------------------------------------------------------------------
  const SystemConfig = model("SystemConfig", {
    fields: {
      id: field.int().id(),
      currentLevel: field.int().default(1),
      retentionPercent: field.int().default(30),
      updatedAt: field.temporal.updatedAt(),
      updatedById: field.uuidString().optional(),
    },
  });

  // ------------------------------------------------------------------------
  // QUARTIERS & ADJACENCE
  // ------------------------------------------------------------------------
  const Quarter = model("Quarter", {
    fields: {
      id: field.id.uuidv7String(),
      code: field.namedType(QuarterCode).unique(),
      name: field.text(),
      treshHoldPercent: field.int().default(30),
      hasSeaAccess: field.boolean().default(false),
      createdAt: field.temporal.createdAt(),
    },
  });

  const QuarterAdjacency = model("QuarterAdjacency", {
    fields: {
      id: field.id.uuidv7String(),
      quarterAId: field.uuidString(),
      quarterBId: field.uuidString(),
    },
  });

  const User = model("User", {
    fields: {
      id: field.id.uuidv7String(),
      email: field.text().unique(),
      passwordHash: field.text(),
      name: field.text(),
      role: field.namedType(OfficerRole),
      // Obligatoire pour un QC, doit rester null pour LC/CD : à vérifier
      // côté application (pas de check conditionnel inter-colonnes natif).
      quarterId: field.uuidString().optional(),
      createdAt: field.temporal.createdAt(),
    },
  });

  const ResourceType = model("ResourceType", {
    fields: {
      id: field.id.uuidv7String(),
      code: field.text().unique(), // ex: MEDICAL_PERSONNEL, RESCUE_TEAMS...
      name: field.text(),
      unit: field.text().default("unités"),
    },
  });

  // Stock d'un type de ressource dans un quartier. minRetention n'est PAS
  // stocké : calculé à la volée via ceil(initialQuantity * retentionPercent
  // / 100) pour que l'abaissement à 15% (CD, niveau 5) s'applique aussitôt.
  const QuarterResource = model("QuarterResource", {
    fields: {
      id: field.id.uuidv7String(),
      quarterId: field.uuidString(),
      resourceTypeId: field.uuidString(),
      initialQuantity: field.int(),
      currentQuantity: field.int(),
      updatedAt: field.temporal.updatedAt(),
    },
  });

  // Table de liaison légère quartier <-> type de ressource : juste les deux
  // colonnes de jointure + une quantité. Contrairement à QuarterResource,
  // pas de suivi initial/courant/updatedAt.
  const QuarterResourceAmount = model("QuarterResourceAmount", {
    fields: {
      id: field.id.uuidv7String(),
      quarterId: field.uuidString(),
      resourceTypeId: field.uuidString(),
      amount: field.int(),
    },
  });

  const DistrictSeverity = model("DistrictSeverity", {
    fields: {
      id: field.id.uuidv7String(),
      quarterId: field.uuidString().unique(),
      level: field.int().default(1), // 1..5, affiché sur la carte
      updatedAt: field.temporal.updatedAt(),
    },
  });

  const SeverityHistory = model("SeverityHistory", {
    fields: {
      id: field.id.uuidv7String(),
      districtSeverityId: field.uuidString(),
      previousLevel: field.int(),
      newLevel: field.int(),
      changedById: field.uuidString().optional(),
      createdAt: field.temporal.createdAt(),
    },
  });

  // Réservations niveau 2 : dans son propre quartier uniquement.
  const ReservationRequest = model("ReservationRequest", {
    fields: {
      id: field.id.uuidv7String(),
      quarterId: field.uuidString(),
      resourceTypeId: field.uuidString(),
      quantity: field.int(),
      requestedById: field.uuidString(),
      status: field.namedType(ReservationStatus).default(ReservationStatus.members.ACTIVE),
      createdAt: field.temporal.createdAt(),
      releasedAt: field.dateTime().optional(),
    },
  });

  const TransferRequest = model("TransferRequest", {
    fields: {
      id: field.id.uuidv7String(),
      requestingQuarterId: field.uuidString(),
      supplyingQuarterId: field.uuidString(),
      resourceTypeId: field.uuidString(),
      quantity: field.int(),
      routeType: field.namedType(TransferRouteType),
      status: field.namedType(TransferStatus).default(TransferStatus.members.PENDING),
      // Niveau global au moment de la requête, pour audit/replay des règles.
      disasterLevelAtRequest: field.int(),
      createdById: field.uuidString(),
      decidedById: field.uuidString().optional(),
      rejectionCode: field.namedType(RejectionCode).optional(),
      rejectionReason: field.text().optional(),
      createdAt: field.temporal.createdAt(),
      decidedAt: field.dateTime().optional(),
      completedAt: field.dateTime().optional(),
    },
  });

  // Maillon de la chaîne de transit pour les transferts non-adjacents
  // (règle : "transit via un quartier intermédiaire nécessite son accord").
  // `order` fixe la séquence (ex: A -> X -> Z : deux maillons, order 1 et 2).
  const TransitApproval = model("TransitApproval", {
    fields: {
      id: field.id.uuidv7String(),
      transferRequestId: field.uuidString(),
      transitQuarterId: field.uuidString(),
      order: field.int(),
      status: field.namedType(TransitApprovalStatus).default(TransitApprovalStatus.members.PENDING),
      approvedById: field.uuidString().optional(),
      decidedAt: field.dateTime().optional(),
      createdAt: field.temporal.createdAt(),
    },
  });

  // Deux requêtes simultanées visant la même ressource / le même quartier :
  // alimente l'alerte temps réel "conflit".
  const ConflictNotification = model("ConflictNotification", {
    fields: {
      id: field.id.uuidv7String(),
      requestAId: field.uuidString(),
      requestBId: field.uuidString(),
      resourceTypeId: field.uuidString(),
      quarterId: field.uuidString(),
      createdAt: field.temporal.createdAt(),
      resolved: field.boolean().default(false),
    },
  });

  const AuditLog = model("AuditLog", {
    fields: {
      id: field.id.uuidv7String(),
      actorId: field.uuidString().optional(),
      action: field.text(), // ex: "TRANSFER_REQUEST_REJECTED"
      entityType: field.text(), // ex: "TransferRequest"
      entityId: field.text().optional(),
      statusCode: field.int().optional(),
      detail: field.json().optional(),
      createdAt: field.temporal.createdAt(),
    },
  });

  const Notification = model("Notification", {
    fields: {
      id: field.id.uuidv7String(),
      userId: field.uuidString(),
      type: field.text(),
      payload: field.json(),
      read: field.boolean().default(false),
      createdAt: field.temporal.createdAt(),
    },
  });

  const CalendarEvent = model("CalendarEvent", {
    fields: {
      id: field.id.uuidv7String(),
      title: field.text(),
      description: field.text().optional(),
      quarterId: field.uuidString().optional(),
      startAt: field.dateTime(),
      endAt: field.dateTime().optional(),
      type: field.text(), // ex: "DRILL", "MAINTENANCE", "LEVEL_REVIEW"
      createdById: field.uuidString(),
      createdAt: field.temporal.createdAt(),
    },
  });

  // ------------------------------------------------------------------------
  // RELATIONS
  // ------------------------------------------------------------------------
  return {
    enums: {
      QuarterCode,
      OfficerRole,
      ReservationStatus,
      TransferRouteType,
      TransferStatus,
      TransitApprovalStatus,
      RejectionCode,
    },
    models: {
      SystemConfig: SystemConfig.relations({
        updatedBy: rel.belongsTo(User, { from: "updatedById", to: "id" }),
      }).sql({ table: "system_config" }),

      Quarter: Quarter.relations({
        users: rel.hasMany(User, { by: "quarterId" }),
        resources: rel.hasMany(QuarterResource, { by: "quarterId" }),
        resourceAmounts: rel.hasMany(QuarterResourceAmount, { by: "quarterId" }),
        severity: rel.hasOne(DistrictSeverity, { by: "quarterId" }),
        adjacentAsA: rel.hasMany(QuarterAdjacency, { by: "quarterAId" }),
        adjacentAsB: rel.hasMany(QuarterAdjacency, { by: "quarterBId" }),
        outgoingRequests: rel.hasMany(TransferRequest, { by: "requestingQuarterId" }),
        incomingRequests: rel.hasMany(TransferRequest, { by: "supplyingQuarterId" }),
        transitSteps: rel.hasMany(TransitApproval, { by: "transitQuarterId" }),
        reservations: rel.hasMany(ReservationRequest, { by: "quarterId" }),
        calendarEvents: rel.hasMany(CalendarEvent, { by: "quarterId" }),
        conflictNotifications: rel.hasMany(ConflictNotification, { by: "quarterId" }),
      }).sql({ table: "quarters" }),

      // Seedée dans les DEUX sens (A→E et E→A) pour simplifier les requêtes
      // d'adjacence côté application.
      QuarterAdjacency: QuarterAdjacency.relations({
        quarterA: rel
          .belongsTo(Quarter, { from: "quarterAId", to: "id" })
          .sql({ fk: { name: "quarter_adjacency_a_fkey", onDelete: "cascade" } }),
        quarterB: rel
          .belongsTo(Quarter, { from: "quarterBId", to: "id" })
          .sql({ fk: { name: "quarter_adjacency_b_fkey", onDelete: "cascade" } }),
      })
        .attributes(({ fields, constraints }) => ({
          uniques: [constraints.unique([fields.quarterAId, fields.quarterBId])],
        }))
        .sql({ table: "quarter_adjacencies" }),

      User: User.relations({
        quarter: rel.belongsTo(Quarter, { from: "quarterId", to: "id" }).sql({ fk: { name: "user_quarter_fkey" } }),
        createdRequests: rel.hasMany(TransferRequest, { by: "createdById" }),
        decidedRequests: rel.hasMany(TransferRequest, { by: "decidedById" }),
        transitApprovals: rel.hasMany(TransitApproval, { by: "approvedById" }),
        reservations: rel.hasMany(ReservationRequest, { by: "requestedById" }),
        auditLogs: rel.hasMany(AuditLog, { by: "actorId" }),
        notifications: rel.hasMany(Notification, { by: "userId" }),
        calendarEvents: rel.hasMany(CalendarEvent, { by: "createdById" }),
        severityChanges: rel.hasMany(SeverityHistory, { by: "changedById" }),
        systemConfigEdits: rel.hasMany(SystemConfig, { by: "updatedById" }),
      }).sql(({ cols, constraints }) => ({
        table: "users",
        indexes: [constraints.index([cols.quarterId])],
      })),

      ResourceType: ResourceType.relations({
        quarterResources: rel.hasMany(QuarterResource, { by: "resourceTypeId" }),
        quarterResourceAmounts: rel.hasMany(QuarterResourceAmount, { by: "resourceTypeId" }),
        transferRequests: rel.hasMany(TransferRequest, { by: "resourceTypeId" }),
        reservations: rel.hasMany(ReservationRequest, { by: "resourceTypeId" }),
        conflictNotifications: rel.hasMany(ConflictNotification, { by: "resourceTypeId" }),
      }).sql({ table: "resource_types" }),

      QuarterResource: QuarterResource.relations({
        quarter: rel.belongsTo(Quarter, { from: "quarterId", to: "id" }).sql({ fk: { onDelete: "cascade" } }),
        resourceType: rel
          .belongsTo(ResourceType, { from: "resourceTypeId", to: "id" })
          .sql({ fk: { onDelete: "restrict" } }),
      })
        .attributes(({ fields, constraints }) => ({
          uniques: [constraints.unique([fields.quarterId, fields.resourceTypeId])],
        }))
        .sql({ table: "quarter_resources" }),

      QuarterResourceAmount: QuarterResourceAmount.relations({
        quarter: rel
          .belongsTo(Quarter, { from: "quarterId", to: "id" })
          .sql({ fk: { onDelete: "cascade" } }),
        resourceType: rel
          .belongsTo(ResourceType, { from: "resourceTypeId", to: "id" })
          .sql({ fk: { onDelete: "restrict" } }),
      })
        .attributes(({ fields, constraints }) => ({
          uniques: [constraints.unique([fields.quarterId, fields.resourceTypeId])],
        }))
        .sql({ table: "quarter_resource_amounts" }),

      DistrictSeverity: DistrictSeverity.relations({
        quarter: rel.belongsTo(Quarter, { from: "quarterId", to: "id" }).sql({ fk: { onDelete: "cascade" } }),
        history: rel.hasMany(SeverityHistory, { by: "districtSeverityId" }),
      }).sql({ table: "district_severities" }),

      SeverityHistory: SeverityHistory.relations({
        districtSeverity: rel
          .belongsTo(DistrictSeverity, { from: "districtSeverityId", to: "id" })
          .sql({ fk: { onDelete: "cascade" } }),
        changedBy: rel.belongsTo(User, { from: "changedById", to: "id" }),
      }).sql({ table: "severity_history" }),

      ReservationRequest: ReservationRequest.relations({
        quarter: rel.belongsTo(Quarter, { from: "quarterId", to: "id" }).sql({ fk: { onDelete: "cascade" } }),
        resourceType: rel.belongsTo(ResourceType, { from: "resourceTypeId", to: "id" }),
        requestedBy: rel.belongsTo(User, { from: "requestedById", to: "id" }),
      }).sql({ table: "reservation_requests" }),

      TransferRequest: TransferRequest.relations({
        requestingQuarter: rel.belongsTo(Quarter, { from: "requestingQuarterId", to: "id" }),
        supplyingQuarter: rel.belongsTo(Quarter, { from: "supplyingQuarterId", to: "id" }),
        resourceType: rel.belongsTo(ResourceType, { from: "resourceTypeId", to: "id" }),
        createdBy: rel.belongsTo(User, { from: "createdById", to: "id" }),
        decidedBy: rel.belongsTo(User, { from: "decidedById", to: "id" }),
        transitSteps: rel.hasMany(TransitApproval, { by: "transferRequestId" }),
        conflictsAsA: rel.hasMany(ConflictNotification, { by: "requestAId" }),
        conflictsAsB: rel.hasMany(ConflictNotification, { by: "requestBId" }),
      }).sql({ table: "transfer_requests" }),

      TransitApproval: TransitApproval.relations({
        transferRequest: rel
          .belongsTo(TransferRequest, { from: "transferRequestId", to: "id" })
          .sql({ fk: { onDelete: "cascade" } }),
        transitQuarter: rel.belongsTo(Quarter, { from: "transitQuarterId", to: "id" }),
        approvedBy: rel.belongsTo(User, { from: "approvedById", to: "id" }),
      })
        .attributes(({ fields, constraints }) => ({
          uniques: [constraints.unique([fields.transferRequestId, fields.order])],
        }))
        .sql({ table: "transit_approvals" }),

      ConflictNotification: ConflictNotification.relations({
        requestA: rel.belongsTo(TransferRequest, { from: "requestAId", to: "id" }).sql({ fk: { onDelete: "cascade" } }),
        requestB: rel.belongsTo(TransferRequest, { from: "requestBId", to: "id" }).sql({ fk: { onDelete: "cascade" } }),
        resourceType: rel.belongsTo(ResourceType, { from: "resourceTypeId", to: "id" }),
        quarter: rel.belongsTo(Quarter, { from: "quarterId", to: "id" }),
      }).sql({ table: "conflict_notifications" }),

      AuditLog: AuditLog.relations({
        actor: rel.belongsTo(User, { from: "actorId", to: "id" }),
      }).sql({ table: "audit_logs" }),

      Notification: Notification.relations({
        user: rel.belongsTo(User, { from: "userId", to: "id" }).sql({ fk: { onDelete: "cascade" } }),
      }).sql({ table: "notifications" }),

      CalendarEvent: CalendarEvent.relations({
        quarter: rel.belongsTo(Quarter, { from: "quarterId", to: "id" }),
        createdBy: rel.belongsTo(User, { from: "createdById", to: "id" }),
      }).sql({ table: "calendar_events" }),
    },
  };
});