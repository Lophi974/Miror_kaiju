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
  req: { body: { severity: number } },
  res: any,
): Promise<any> {
  const { severity } = req.body;

  if (severity === undefined || severity < 1 || severity > 5) {
    return res
      .status(400)
      .json({
        success: false,
        message: "Severity must be a number between 1 and 5",
      });
  }

  const updatedSeverities = await changeSeverityForAllQuartersService(severity);

  return res.status(200).json({ success: true, data: updatedSeverities });
}
