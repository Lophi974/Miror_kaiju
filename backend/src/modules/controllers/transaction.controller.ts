import { checkIfAdjacentQuartersHaveResources } from "../services/transaction.service";

export async function transferResources(
  req: {
    body: {
      quarterCode: string;
      resourceTypeId: string;
      requestedQuantity: number;
    };
  },
  res: any,
) {
  const { quarterCode, resourceTypeId, requestedQuantity } = req.body;

  if (!quarterCode || !resourceTypeId || requestedQuantity === undefined) {
    return res.status(400).json({ error: "Missing required parameters" });
  }

  const hasResources = await checkIfAdjacentQuartersHaveResources(
    quarterCode,
    resourceTypeId,
    requestedQuantity,
  );

  if (!hasResources.success) {
    return res
      .status(400)
      .json({ error: "Not enough resources in adjacent quarters" });
  }

  return res.status(200).json({ sucess: true, data: hasResources.results });
}
