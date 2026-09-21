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

    // On récupère toutes les lignes où quarter1 apparaît côté A, puis on
    // filtre en mémoire — évite de deviner la bonne syntaxe de composition
    // AND tant qu'elle n'est pas confirmée.
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