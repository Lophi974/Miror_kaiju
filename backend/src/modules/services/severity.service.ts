import { db } from "../../prisma/db";

export async function getSeverityForOneQuarterService() {
    try {
        const severities = await db.orm.public.DistrictSeverity.first();
        return severities;
    }
    catch (error) {
        console.error("Error fetching severity for one quarter:", error);
        throw new Error("Failed to fetch severity for one quarter");
    }
}