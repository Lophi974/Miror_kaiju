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
    const updatedSeverities = await db.orm.public.DistrictSeverity.where(() =>
      all(),
    ).updateAll({
      level: newSeverity,
    });

    return updatedSeverities;
  } catch (error) {
    console.error("Error updating severity for all quarters:", error);
    throw new Error("Failed to update severity for all quarters");
  }
}
