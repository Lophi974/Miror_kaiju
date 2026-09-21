import { checkIfQuartersAreAdjacent } from "../services/transaction.service";

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
  const { quarterCode, resourceTypeId, requestedQuantity, targetQuarterCode } = req.body;

  if (!quarterCode || !resourceTypeId || requestedQuantity === undefined) {
    return res.status(400).json({ error: "Missing required parameters" });
  }

  const isAdjacent = await checkIfQuartersAreAdjacent(quarterCode, targetQuarterCode);

  return res.status(200).json({ success: true, isAdjacent });

}
