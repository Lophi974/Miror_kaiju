import { db } from "../../prisma/db";
import { all } from "@prisma/orm-postgres/orm-client";

export async function getSeverityForOneQuarterService() {
  try {
    const severities = await db.orm.public.DistrictSeverity.first();
    return severities;
  } catch (error) {
    console.error("Error fetching severity for one quarter:", error);
    throw new Error("Failed to fetch severity for one quarter");
  }
}

export async function changeSeverityForAllQuartersService(newSeverity: number) {
  try {
    console.log("[SEVERITY] Valeur demandée :", newSeverity);

    const before = await db.orm.public.DistrictSeverity.all();
    console.log(
      "[SEVERITY] Avant update :",
      before.map((s) => ({ id: s.id, quarterId: s.quarterId, level: s.level })),
    );

    const updatedSeverities = await db.orm.public.DistrictSeverity.where(() =>
      all(),
    ).updateAll({
      level: newSeverity,
    });

    console.log("[SEVERITY] Retour de updateAll :", updatedSeverities);

    const after = await db.orm.public.DistrictSeverity.all();
    console.log(
      "[SEVERITY] Après update (relu en base) :",
      after.map((s) => ({ id: s.id, quarterId: s.quarterId, level: s.level })),
    );

    return updatedSeverities;
  } catch (error) {
    console.error("Error updating severity for all quarters:", error);
    throw new Error("Failed to update severity for all quarters");
  }
}