import { all } from "@prisma/orm-postgres/orm-client";

import { db } from "./db.ts";

// ---------------------------------------------------------------------------
// Vide toutes les tables du contrat, dans l'ordre inverse des dépendances
// (FK) pour ne jamais violer une contrainte de clé étrangère.
//
// ⚠️ Destructif et irréversible. Réservé au développement / aux tests.
// Prisma 8 ne fournit plus de commande CLI équivalente (migrate reset,
// db push --force-reset) par choix de design -- voir le blog Prisma sur
// les garde-fous anti-suppression accidentelle.
// ---------------------------------------------------------------------------

// Tables "feuilles" en premier (rien ne les référence), tables racines
// (Quarter, ResourceType) en dernier.
const DELETE_ORDER = [
  "AuditLog",
  "Notification",
  "CalendarEvent",
  "ConflictNotification",
  "TransitApproval",
  "TransferRequest",
  "ReservationRequest",
  "SeverityHistory",
  "DistrictSeverity",
  "QuarterResource",
  "SystemConfig",
  "User",
  "QuarterAdjacency",
  "Quarter",
  "ResourceType",
] as const;

async function main() {
  console.log("Vidage de la base en cours...");

  // where(() => all()) est la façon documentée de matcher "toutes les
  // lignes" avant un deleteAll() -- Postgres refuse un deleteAll() sans
  // where() préalable.
  await db.orm.public.AuditLog.where(() => all()).deleteAll();
  await db.orm.public.Notification.where(() => all()).deleteAll();
  await db.orm.public.CalendarEvent.where(() => all()).deleteAll();
  await db.orm.public.ConflictNotification.where(() => all()).deleteAll();
  await db.orm.public.TransitApproval.where(() => all()).deleteAll();
  await db.orm.public.TransferRequest.where(() => all()).deleteAll();
  await db.orm.public.ReservationRequest.where(() => all()).deleteAll();
  await db.orm.public.SeverityHistory.where(() => all()).deleteAll();
  await db.orm.public.DistrictSeverity.where(() => all()).deleteAll();
  await db.orm.public.QuarterResource.where(() => all()).deleteAll();
  await db.orm.public.SystemConfig.where(() => all()).deleteAll();
  await db.orm.public.User.where(() => all()).deleteAll();
  await db.orm.public.QuarterAdjacency.where(() => all()).deleteAll();
  await db.orm.public.Quarter.where(() => all()).deleteAll();
  await db.orm.public.ResourceType.where(() => all()).deleteAll();

  console.log(`Base vidée (${DELETE_ORDER.length} tables).`);
}

main()
  .catch((error) => {
    console.error("Échec du reset :", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.close();
  });