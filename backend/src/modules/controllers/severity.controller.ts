import {
  broadcastSeverityLevel,
  broadcastThresholdChange,
} from "../../wc/broadcast";
import {
  changeSeverityForAllQuartersService,
  getSeverityForOneQuarterService,
} from "../services/severity.service";
import { updateThresholdForAllQuartersService } from "../services/ressource.service";
import { DEFAULT_THRESHOLD_PERCENT } from "./ressource.controller";

export async function getSeverityForOneQuarter(
  req: any,
  res: any,
): Promise<any> {
  const severity = await getSeverityForOneQuarterService();

  if (!severity) {
    return res
      .status(404)
      .json({ success: false, message: "Aucun niveau de sévérité trouvé." });
  }

  return res.status(200).json({ success: true, data: severity });
}

export async function changeSeverityForAllQuarters(
  req: { body: { severity: number }, user: { sub: string; role: string } },
  res: any,
): Promise<any> {
  const { severity } = req.body;
  const userId = req.user.sub;
  const role = req.user.role;

  if (role !== "CD") {
    return res
      .status(403)
      .json({ success: false, message: "Vous n'avez pas la permission de modifier le niveau de sévérité." });
  }

  if (severity === undefined || severity < 1 || severity > 5) {
    return res
      .status(400)
      .json({
        success: false,
        message: "Le niveau de sévérité doit être un nombre entre 1 et 5.",
      });
  }

  const updatedSeverities = await changeSeverityForAllQuartersService(severity);

  broadcastSeverityLevel(severity);

  // Seuil abaissé uniquement possible au niveau 5 : en dessous, il repasse à
  // sa valeur par défaut pour tous les quartiers
  if (severity < 5) {
    await updateThresholdForAllQuartersService(DEFAULT_THRESHOLD_PERCENT);
    broadcastThresholdChange(DEFAULT_THRESHOLD_PERCENT);
  }

  return res.status(200).json({ success: true, data: updatedSeverities });
}