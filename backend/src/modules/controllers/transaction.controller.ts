import {
  checkIfQuartersAreAdjacent,
  getAdjacentQuarters,
  checkIfQuarterHasEnoughResources,
} from "../services/transaction.service";

export async function transferResources(
  req: {
    body: {
      quarterCode: "A" | "E" | "W" | "X" | "Z";
      resourceTypeId: string;
      requestedQuantity: number;
      targetQuarterCode: "A" | "E" | "W" | "X" | "Z";
    };
  },
  res: any,
) {
  const { quarterCode, resourceTypeId, requestedQuantity, targetQuarterCode } =
    req.body;

  if (!quarterCode || !resourceTypeId || requestedQuantity === undefined) {
    return res.status(400).json({ error: "Missing required parameters" });
  }

  const isAdjacent = await checkIfQuartersAreAdjacent(
    quarterCode,
    targetQuarterCode,
  );

  if (!isAdjacent) {
    try {
      const adjacentQuarters = await getAdjacentQuarters(quarterCode);

      if (adjacentQuarters.length > 0) {
        const adjacentQuarterWithEnoughResources = [];

        for (const adjacent of adjacentQuarters) {
            console.log("Checking adjacent quarter:", adjacent.quarterBId);
            checkIfQuarterHasEnoughResources(adjacent.quarterBId, resourceTypeId, requestedQuantity)
        }
      }
    } catch (error) {
      console.error("Error fetching adjacent quarters:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  }

  return;
}
