import e from "express";
import { db } from "../../prisma/db.ts";
import { all } from "@prisma/orm-postgres/orm-client";

export async function getRessourcesByQuarterIdService(quarterId: string) {
  try {
    const ressources = await db.orm.public.QuarterResource.where((r) =>
      r.quarterId.eq(quarterId as Parameters<typeof r.quarterId.eq>[0]),
    )
      .include("resourceType", (rt) => rt.select("id", "code", "name", "unit"))
      .include("quarter")
      .all();

    return ressources;
  } catch (error) {
    console.error("Error fetching ressources by quarter ID:", error);
    throw new Error("Impossible de récupérer les ressources.");
  }
}

export async function getAllQuarterService() {
  try {
    const quarters = await db.orm.public.Quarter.all();
    return quarters;
  } catch (error) {
    console.error("Error fetching all quarters:", error);
    throw new Error("Impossible de récupérer les quartiers.");
  }
}

// Le seuil de rétention est le même pour toute la ville : il est appliqué
// à tous les quartiers d'un coup.
export async function updateThresholdForAllQuartersService(
  thresholdPercent: number,
) {
  try {
    await db.orm.public.Quarter.where(() => all()).updateAll({
      treshHoldPercent: thresholdPercent,
    });

    return db.orm.public.Quarter.all();
  } catch (error) {
    console.error("Error updating threshold for all quarters:", error);
    throw new Error("Impossible de modifier le seuil des quartiers.");
  }
}
