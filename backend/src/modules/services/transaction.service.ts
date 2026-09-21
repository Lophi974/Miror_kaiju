import { db } from "../../prisma/db.ts";

interface QuarterCode {
  quarterCode: "A" | "E" | "W" | "X" | "Z";
}

export async function checkIfQuartersAreAdjacent(
  quarter1Code: QuarterCode["quarterCode"],
  quarter2Code: QuarterCode["quarterCode"],
): Promise<boolean> {
  if (quarter1Code === quarter2Code) return false;

  try {
    const quarter1 = await db.orm.public.Quarter.where((q) =>
      q.code.eq(quarter1Code),
    ).first();
    const quarter2 = await db.orm.public.Quarter.where((q) =>
      q.code.eq(quarter2Code),
    ).first();

    if (!quarter1 || !quarter2) {
      throw new Error("One or both quarters not found");
    }

    const rowsFromA = await db.orm.public.QuarterAdjacency.where((a) =>
      a.quarterAId.eq(quarter1.id),
    ).all();
    const rowsFromB = await db.orm.public.QuarterAdjacency.where((a) =>
      a.quarterAId.eq(quarter2.id),
    ).all();

    const forwardMatch = rowsFromA.some((r) => r.quarterBId === quarter2.id);
    const backwardMatch = rowsFromB.some((r) => r.quarterBId === quarter1.id);

    return forwardMatch || backwardMatch;
  } catch (error) {
    console.error("Error checking quarter adjacency:", error);
    throw error;
  }
}

export async function getAdjacentQuarters(quarterCode: QuarterCode["quarterCode"]) {
  try {
    const quarter = await db.orm.public.Quarter.where((q) =>
      q.code.eq(quarterCode)
    ).first();

    if (!quarter) {
      throw new Error("Quarter not found");
    }

    const quarterId = quarter.id;

    const adjacentRows = await db.orm.public.QuarterAdjacency.where((a) =>
      a.quarterAId.eq(quarterId)
    ).all();

    return adjacentRows

  } catch (error) {
    console.error("Error getting adjacent quarters:", error);
    throw error;
  }
}


export async function checkIfQuarterHasEnoughResources(quarterId : string, resourceTypeId : string, requestedQuantity : number) {

    try {

        const quarterResource = await db.orm.public.QuarterResource.where((qr) =>
            qr.quarterId.eq(quarterId as Parameters<typeof qr.quarterId.eq>[0])
        ).all()

        if (!quarterResource) {
            throw new Error("Quarter resource not found");
        }

        // console.log("Quarter Resource:", quarterResource);

    }
    catch (error) {
        console.error("Error checking if quarter has enough resources:", error);
        throw error;
    }

}