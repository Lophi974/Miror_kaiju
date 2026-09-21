import { getSeverityForOneQuarterService } from "../services/severity.service";

export async function getSeverityForOneQuarter(req: any, res: any): Promise<any> {

        const severity = await getSeverityForOneQuarterService();

        if (!severity) {
            return res.status(404).json({ success: false, message: "No severity data found" });
        }

        return res.status(200).json({ success: true, data: severity });

}

