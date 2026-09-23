import { broadcastSeverityLevel } from "../../wc/broadcast";
import {
  changeSeverityForAllQuartersService,
  getSeverityForOneQuarterService,
} from "../services/severity.service";

export async function getSeverityForOneQuarter(
  req: any,
  res: any,
): Promise<any> {
  const severity = await getSeverityForOneQuarterService();

  if (!severity) {
    return res
      .status(404)
      .json({ success: false, message: "No severity data found" });
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
      .json({ success: false, message: "User does not have permission to change severity level." });
  }

  if (severity === undefined || severity < 1 || severity > 5) {
    return res
      .status(400)
      .json({
        success: false,
        message: "Severity must be a number between 1 and 5",
      });
  }

  const updatedSeverities = await changeSeverityForAllQuartersService(severity);

  broadcastSeverityLevel(severity);

  return res.status(200).json({ success: true, data: updatedSeverities });
}