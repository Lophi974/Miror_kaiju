import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import ressourceRouter from "../src/modules/routes/ressource.route";
import {
  getRessourcesByQuarterIdService,
  getAllQuarterService,
  updateThresholdForAllQuartersService,
} from "../src/modules/services/ressource.service";
import { getAdjacentQuarterIds } from "../src/modules/services/transaction.service";
import { getSeverityForOneQuarterService } from "../src/modules/services/severity.service";
import { broadcastThresholdChange } from "../src/wc/broadcast";
import { createApp, authHeader } from "./helpers";

vi.mock("../src/modules/services/ressource.service", () => ({
  getRessourcesByQuarterIdService: vi.fn(),
  getAllQuarterService: vi.fn(),
  updateThresholdForAllQuartersService: vi.fn(),
}));
vi.mock("../src/modules/services/transaction.service", () => ({
  getAdjacentQuarterIds: vi.fn(),
}));
vi.mock("../src/modules/services/severity.service", () => ({
  getSeverityForOneQuarterService: vi.fn(),
}));
vi.mock("../src/wc/broadcast", () => ({
  broadcastThresholdChange: vi.fn(),
}));

const app = createApp("/api/ressources", ressourceRouter);

// Niveau de sévérité lu par le middleware authorize
function setLevel(level: number) {
  vi.mocked(getSeverityForOneQuarterService).mockResolvedValue({
    level,
  } as never);
}

describe("GET /api/ressources/quarter/:quarterId", () => {
  it("200 avec les ressources du quartier", async () => {
    const ressources = [{ id: "r1", currentQuantity: 10 }];
    vi.mocked(getRessourcesByQuarterIdService).mockResolvedValue(
      ressources as never,
    );

    const res = await request(app).get("/api/ressources/quarter/quarter-a");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, data: ressources });
    expect(getRessourcesByQuarterIdService).toHaveBeenCalledWith("quarter-a");
  });

  it("404 si le service ne renvoie rien", async () => {
    vi.mocked(getRessourcesByQuarterIdService).mockResolvedValue(
      null as never,
    );

    const res = await request(app).get("/api/ressources/quarter/quarter-a");

    expect(res.status).toBe(404);
    expect(res.body.message).toBe("Aucune ressource trouvée pour ce quartier.");
  });
});

describe("GET /api/ressources/quarters", () => {
  it("200 avec la liste des quartiers", async () => {
    const quarters = [{ id: "quarter-a", code: "A" }];
    vi.mocked(getAllQuarterService).mockResolvedValue(quarters as never);

    const res = await request(app).get("/api/ressources/quarters");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, data: quarters });
  });

  it("404 si aucun quartier", async () => {
    vi.mocked(getAllQuarterService).mockResolvedValue(null as never);

    const res = await request(app).get("/api/ressources/quarters");

    expect(res.status).toBe(404);
    expect(res.body.message).toBe("Aucun quartier trouvé.");
  });
});

describe("GET /api/ressources/quarter/:quarterId/adjacent", () => {
  it("200 avec les ids des quartiers adjacents", async () => {
    vi.mocked(getAdjacentQuarterIds).mockResolvedValue(["quarter-e", "quarter-x"]);

    const res = await request(app).get(
      "/api/ressources/quarter/quarter-a/adjacent",
    );

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      success: true,
      data: ["quarter-e", "quarter-x"],
    });
    expect(getAdjacentQuarterIds).toHaveBeenCalledWith("quarter-a");
  });

  it("500 si le quartier est introuvable", async () => {
    vi.mocked(getAdjacentQuarterIds).mockRejectedValue(
      new Error("Quartier introuvable."),
    );

    const res = await request(app).get(
      "/api/ressources/quarter/inconnu/adjacent",
    );

    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
  });
});

describe("PUT /api/ressources/threshold", () => {
  beforeEach(() => setLevel(5));

  it("401 sans jeton", async () => {
    const res = await request(app)
      .put("/api/ressources/threshold")
      .send({ thresholdPercent: 15 });

    expect(res.status).toBe(401);
  });

  it.each(["QC", "LC"] as const)("403 pour un %s", async (role) => {
    const res = await request(app)
      .put("/api/ressources/threshold")
      .set(authHeader(role, role === "QC" ? "quarter-a" : null))
      .send({ thresholdPercent: 15 });

    expect(res.status).toBe(403);
    expect(updateThresholdForAllQuartersService).not.toHaveBeenCalled();
  });

  it("403 pour le CD sous le niveau 5", async () => {
    setLevel(4);

    const res = await request(app)
      .put("/api/ressources/threshold")
      .set(authHeader("CD"))
      .send({ thresholdPercent: 15 });

    expect(res.status).toBe(403);
    expect(updateThresholdForAllQuartersService).not.toHaveBeenCalled();
  });

  it.each([14, 31, 20.5, "15"])(
    "400 si le seuil vaut %s (entier entre 15 et 30 attendu)",
    async (thresholdPercent) => {
      const res = await request(app)
        .put("/api/ressources/threshold")
        .set(authHeader("CD"))
        .send({ thresholdPercent });

      expect(res.status).toBe(400);
      expect(res.body.message).toBe(
        "Le seuil doit être un entier entre 15 et 30 %.",
      );
      expect(updateThresholdForAllQuartersService).not.toHaveBeenCalled();
    },
  );

  it("200 : applique le seuil à tous les quartiers et le diffuse", async () => {
    const quarters = [{ id: "quarter-a", treshHoldPercent: 15 }];
    vi.mocked(updateThresholdForAllQuartersService).mockResolvedValue(
      quarters as never,
    );

    const res = await request(app)
      .put("/api/ressources/threshold")
      .set(authHeader("CD"))
      .send({ thresholdPercent: 15 });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      success: true,
      message: "Seuil de rétention fixé à 15 % pour tous les quartiers.",
      data: quarters,
    });
    expect(updateThresholdForAllQuartersService).toHaveBeenCalledWith(15);
    expect(broadcastThresholdChange).toHaveBeenCalledWith(15);
  });

  it("500 si le service échoue, sans diffusion", async () => {
    vi.mocked(updateThresholdForAllQuartersService).mockRejectedValue(
      new Error("db"),
    );

    const res = await request(app)
      .put("/api/ressources/threshold")
      .set(authHeader("CD"))
      .send({ thresholdPercent: 20 });

    expect(res.status).toBe(500);
    expect(broadcastThresholdChange).not.toHaveBeenCalled();
  });
});
