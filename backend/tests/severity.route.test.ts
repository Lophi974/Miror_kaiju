import { describe, it, expect, vi } from "vitest";
import request from "supertest";
import severityRouter from "../src/modules/routes/severity.route";
import {
  getSeverityForOneQuarterService,
  changeSeverityForAllQuartersService,
} from "../src/modules/services/severity.service";
import { updateThresholdForAllQuartersService } from "../src/modules/services/ressource.service";
import {
  broadcastSeverityLevel,
  broadcastThresholdChange,
} from "../src/wc/broadcast";
import { createApp, authHeader } from "./helpers";

vi.mock("../src/modules/services/severity.service", () => ({
  getSeverityForOneQuarterService: vi.fn(),
  changeSeverityForAllQuartersService: vi.fn(),
}));
vi.mock("../src/modules/services/ressource.service", () => ({
  getRessourcesByQuarterIdService: vi.fn(),
  getAllQuarterService: vi.fn(),
  updateThresholdForAllQuartersService: vi.fn(),
}));
// Importé indirectement via ressource.controller
vi.mock("../src/modules/services/transaction.service", () => ({
  getAdjacentQuarterIds: vi.fn(),
}));
vi.mock("../src/wc/broadcast", () => ({
  broadcastSeverityLevel: vi.fn(),
  broadcastThresholdChange: vi.fn(),
}));

const app = createApp("/api/severities", severityRouter);

describe("GET /api/severities", () => {
  it("401 sans jeton", async () => {
    const res = await request(app).get("/api/severities");

    expect(res.status).toBe(401);
  });

  it("200 avec le niveau courant", async () => {
    const severity = { id: "s1", level: 3 };
    vi.mocked(getSeverityForOneQuarterService).mockResolvedValue(
      severity as never,
    );

    const res = await request(app)
      .get("/api/severities")
      .set(authHeader("QC", "quarter-a"));

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, data: severity });
  });

  it("404 si aucun niveau n'existe", async () => {
    vi.mocked(getSeverityForOneQuarterService).mockResolvedValue(
      undefined as never,
    );

    const res = await request(app)
      .get("/api/severities")
      .set(authHeader("QC", "quarter-a"));

    expect(res.status).toBe(404);
    expect(res.body.message).toBe("Aucun niveau de sévérité trouvé.");
  });
});

describe("PUT /api/severities", () => {
  it("401 sans jeton", async () => {
    const res = await request(app).put("/api/severities").send({ severity: 3 });

    expect(res.status).toBe(401);
  });

  it.each(["QC", "LC"] as const)("403 pour un %s", async (role) => {
    const res = await request(app)
      .put("/api/severities")
      .set(authHeader(role))
      .send({ severity: 3 });

    expect(res.status).toBe(403);
    expect(changeSeverityForAllQuartersService).not.toHaveBeenCalled();
  });

  it.each([0, 6, undefined])("400 si le niveau vaut %s", async (severity) => {
    const res = await request(app)
      .put("/api/severities")
      .set(authHeader("CD"))
      .send({ severity });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe(
      "Le niveau de sévérité doit être un nombre entre 1 et 5.",
    );
    expect(changeSeverityForAllQuartersService).not.toHaveBeenCalled();
  });

  it("200 au niveau 5 : diffuse le niveau sans toucher au seuil", async () => {
    vi.mocked(changeSeverityForAllQuartersService).mockResolvedValue(
      [] as never,
    );

    const res = await request(app)
      .put("/api/severities")
      .set(authHeader("CD"))
      .send({ severity: 5 });

    expect(res.status).toBe(200);
    expect(changeSeverityForAllQuartersService).toHaveBeenCalledWith(5);
    expect(broadcastSeverityLevel).toHaveBeenCalledWith(5);
    expect(updateThresholdForAllQuartersService).not.toHaveBeenCalled();
    expect(broadcastThresholdChange).not.toHaveBeenCalled();
  });

  it.each([1, 2, 3, 4])(
    "200 au niveau %s : remet le seuil à 30 % et le diffuse",
    async (severity) => {
      vi.mocked(changeSeverityForAllQuartersService).mockResolvedValue(
        [] as never,
      );

      const res = await request(app)
        .put("/api/severities")
        .set(authHeader("CD"))
        .send({ severity });

      expect(res.status).toBe(200);
      expect(broadcastSeverityLevel).toHaveBeenCalledWith(severity);
      expect(updateThresholdForAllQuartersService).toHaveBeenCalledWith(30);
      expect(broadcastThresholdChange).toHaveBeenCalledWith(30);
    },
  );
});
