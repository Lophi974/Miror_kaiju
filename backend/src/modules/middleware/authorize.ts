import { getSeverityForOneQuarterService } from "../services/severity.service";
import { firstStepChecking } from "./rules";

export function authorize(action: string) {
  return async (req: any, res: any, next: any) => {
    try{
      const userRole = req.user.role;

      const severity = await getSeverityForOneQuarterService();

      if (!severity) {
        return res
          .status(404)
          .json({ success: false, message: "Aucun niveau de sévérité trouvé." });
      }

      const severityLevel = severity.level;

      const isAuthorized = firstStepChecking(userRole, severityLevel, action);

        if (!isAuthorized) {
            return res
            .status(403)
            .json({ success: false, message: `Le rôle ${userRole} ne peut pas effectuer l'action « ${action} » à ce niveau de sévérité.`});
        }

        req.severityLevel = severityLevel;

        next();
    }
    catch (error) {
      console.error("Error in authorization middleware:", error);
      return res
        .status(500)
        .json({ success: false, message: "Erreur interne du serveur." });
    }

  };
}
