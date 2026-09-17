import { db } from "../../prisma/db.ts";

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
    throw new Error("Failed to fetch ressources");
  }
}
