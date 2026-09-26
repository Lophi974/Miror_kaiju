import {
  getRessourcesByQuarterIdService,
  getAllQuarterService,
  updateThresholdForAllQuartersService,
} from "../services/ressource.service.ts";
import { broadcastThresholdChange } from "../../wc/broadcast";
import { getAdjacentQuarterIds } from "../services/transaction.service";

export async function getResssourcesByQuarterId(
  req: { params: { quarterId: string } },
  res: any,
) {
  const { quarterId } = req.params;

  if (!quarterId) {
    return res
      .status(400)
      .json({ success: false, message: "L'identifiant du quartier est requis." });
  }

  const ressources = await getRessourcesByQuarterIdService(quarterId);

  if (!ressources) {
    return res.status(404).json({
      success: false,
      message: "Aucune ressource trouvée pour ce quartier.",
    });
  }

  return res.status(200).json({ success: true, data: ressources });
}

export async function getAllQuarter(req: any, res: any) {
  const quarters = await getAllQuarterService();

  if (!quarters) {
    return res.status(404).json({
      success: false,
      message: "Aucun quartier trouvé.",
    });
  }

  return res.status(200).json({ success: true, data: quarters });
}

// Seuil par défaut 30 %, abaissable par le CD jusqu'à 15 % au niveau 5.
const MIN_THRESHOLD_PERCENT = 15;
export const DEFAULT_THRESHOLD_PERCENT = 30;

export async function updateThreshold(
  req: {
    body: { thresholdPercent: number };
    user: { sub: string; role: string };
    severityLevel: number;
  },
  res: any,
) {
  if (req.severityLevel < 5) {
    return res.status(403).json({
      success: false,
      message: "Impossible de modifier le seuil de rétention à ce niveau de sévérité.",
    });
  }

  const { thresholdPercent } = req.body;

  if (
    !Number.isInteger(thresholdPercent) ||
    thresholdPercent < MIN_THRESHOLD_PERCENT ||
    thresholdPercent > DEFAULT_THRESHOLD_PERCENT
  ) {
    return res.status(400).json({
      success: false,
      message: `Le seuil doit être un entier entre ${MIN_THRESHOLD_PERCENT} et ${DEFAULT_THRESHOLD_PERCENT} %.`,
    });
  }

  try {
    const updatedQuarters =
      await updateThresholdForAllQuartersService(thresholdPercent);

    broadcastThresholdChange(thresholdPercent);

    return res.status(200).json({
      success: true,
      message: `Seuil de rétention fixé à ${thresholdPercent} % pour tous les quartiers.`,
      data: updatedQuarters,
    });
  } catch (error) {
    console.error("Error in updateThreshold:", error);
    return res.status(500).json({
      success: false,
      message: "Une erreur est survenue lors de la modification du seuil.",
    });
  }
}

export async function getAdjacentQuarters(
  req: { params: { quarterId: string } },
  res: any,
) {
  const { quarterId } = req.params;

  try {
    const adjacentQuarterIds = await getAdjacentQuarterIds(quarterId);
    return res.status(200).json({ success: true, data: adjacentQuarterIds });
  } catch (error) {
    console.error("Error in getAdjacentQuarters:", error);
    return res.status(500).json({
      success: false,
      message: "Une erreur est survenue lors de la récupération des quartiers adjacents.",
    });
  }
}
