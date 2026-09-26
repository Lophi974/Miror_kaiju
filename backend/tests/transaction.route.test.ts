import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import transactionRouter from "../src/modules/routes/transaction.route";
import * as service from "../src/modules/services/transaction.service";
import { getSeverityForOneQuarterService } from "../src/modules/services/severity.service";
import { broadcastTransferRequestChange } from "../src/wc/broadcast";
import { createApp, authHeader } from "./helpers";

vi.mock("../src/modules/services/transaction.service", () => ({
  reserveResourcesService: vi.fn(),
  isAdjacentQuarter: vi.fn(),
  doesTargetQuarterHaveSufficientResources: vi.fn(),
  createPendingTransferRequest: vi.fn(),
  requisitionResourcesService: vi.fn(),
  getAdjacentQuarterIds: vi.fn(),
  createPendingTransitRequest: vi.fn(),
  getPendingRequestsForQuarterService: vi.fn(),
  getQuarterRequestHistoryService: vi.fn(),
  approveTransferRequestService: vi.fn(),
  rejectTransferRequestService: vi.fn(),
  areAllTransitApprovalsApproved: vi.fn(),
  getPendingTransitApprovalsForQuarterService: vi.fn(),
  approveTransitApprovalService: vi.fn(),
  rejectTransitApprovalService: vi.fn(),
}));
vi.mock("../src/modules/services/severity.service", () => ({
  getSeverityForOneQuarterService: vi.fn(),
}));
vi.mock("../src/wc/broadcast", () => ({
  broadcastTransferRequestChange: vi.fn(),
}));

const app = createApp("/api/transactions", transactionRouter);
const mocked = vi.mocked(service);

// Niveau de sévérité lu par le middleware authorize
function setLevel(level: number) {
  vi.mocked(getSeverityForOneQuarterService).mockResolvedValue({
    level,
  } as never);
}

const QUARTER_W = "quarter-w";
const QUARTER_A = "quarter-a";
const QUARTER_Z = "quarter-z";
const QUARTER_X = "quarter-x";
const RESOURCE = "resource-type-generateurs";

const pendingRequest = {
  id: "req-1",
  requestingQuarterId: QUARTER_Z,
  supplyingQuarterId: QUARTER_W,
  resourceTypeId: RESOURCE,
  quantity: 2,
  routeType: "DIRECT",
  status: "PENDING",
};

// ---------------------------------------------------------------------------
// POST /reserve — QC, niveau >= 2, dans son propre quartier
// ---------------------------------------------------------------------------
describe("POST /api/transactions/reserve", () => {
  const body = { resourceId: RESOURCE, quantity: 3 };

  it("401 sans jeton", async () => {
    const res = await request(app).post("/api/transactions/reserve").send(body);

    expect(res.status).toBe(401);
  });

  it("403 au niveau 1", async () => {
    setLevel(1);

    const res = await request(app)
      .post("/api/transactions/reserve")
      .set(authHeader("QC", QUARTER_W))
      .send(body);

    expect(res.status).toBe(403);
    expect(mocked.reserveResourcesService).not.toHaveBeenCalled();
  });

  it.each(["LC", "CD"] as const)("403 pour un %s", async (role) => {
    setLevel(5);

    const res = await request(app)
      .post("/api/transactions/reserve")
      .set(authHeader(role))
      .send(body);

    expect(res.status).toBe(403);
    expect(mocked.reserveResourcesService).not.toHaveBeenCalled();
  });

  it("400 si le QC n'a pas de quartier", async () => {
    setLevel(2);

    const res = await request(app)
      .post("/api/transactions/reserve")
      .set(authHeader("QC", null))
      .send(body);

    expect(res.status).toBe(400);
    expect(res.body.message).toBe(
      "Aucun quartier n'est associé à cet utilisateur.",
    );
  });

  it("200 : réserve dans le quartier du jeton", async () => {
    setLevel(2);
    mocked.reserveResourcesService.mockResolvedValue({
      success: true,
      message: "Ressources réservées avec succès.",
    } as never);

    const res = await request(app)
      .post("/api/transactions/reserve")
      .set(authHeader("QC", QUARTER_W))
      .send(body);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      success: true,
      data: "Ressources réservées avec succès.",
    });
    expect(mocked.reserveResourcesService).toHaveBeenCalledWith(
      RESOURCE,
      3,
      QUARTER_W,
      "qc-user-id",
    );
  });

  it("500 si le service refuse (ex : seuil de rétention)", async () => {
    setLevel(2);
    mocked.reserveResourcesService.mockRejectedValue(new Error("seuil"));

    const res = await request(app)
      .post("/api/transactions/reserve")
      .set(authHeader("QC", QUARTER_W))
      .send(body);

    expect(res.status).toBe(500);
    expect(res.body.message).toBe(
      "Une erreur est survenue lors de la réservation.",
    );
  });
});

// ---------------------------------------------------------------------------
// POST /request — demande adjacente : QC >= 3, LC >= 4, tous au niveau 5
// ---------------------------------------------------------------------------
describe("POST /api/transactions/request", () => {
  const body = {
    resourceId: RESOURCE,
    quantity: 2,
    targetQuarterId: QUARTER_Z,
    sourceQuarterId: QUARTER_A, // ignoré pour un QC
  };

  function mockValidRequest() {
    mocked.isAdjacentQuarter.mockResolvedValue(true);
    mocked.doesTargetQuarterHaveSufficientResources.mockResolvedValue(true);
    mocked.createPendingTransferRequest.mockResolvedValue({
      id: "req-new",
    } as never);
  }

  it("403 pour un QC au niveau 2", async () => {
    setLevel(2);

    const res = await request(app)
      .post("/api/transactions/request")
      .set(authHeader("QC", QUARTER_W))
      .send(body);

    expect(res.status).toBe(403);
  });

  it("403 pour un LC au niveau 3", async () => {
    setLevel(3);

    const res = await request(app)
      .post("/api/transactions/request")
      .set(authHeader("LC"))
      .send(body);

    expect(res.status).toBe(403);
  });

  it("201 : un QC demande toujours pour son quartier (source du body ignorée)", async () => {
    setLevel(3);
    mockValidRequest();

    const res = await request(app)
      .post("/api/transactions/request")
      .set(authHeader("QC", QUARTER_W))
      .send(body);

    expect(res.status).toBe(201);
    expect(res.body.message).toBe(
      "Demande de transfert créée, en attente de validation.",
    );
    expect(mocked.isAdjacentQuarter).toHaveBeenCalledWith(QUARTER_W, QUARTER_Z);
    expect(mocked.createPendingTransferRequest).toHaveBeenCalledWith(
      QUARTER_W,
      QUARTER_Z,
      RESOURCE,
      2,
      "qc-user-id",
      3,
    );
    expect(broadcastTransferRequestChange).toHaveBeenCalled();
  });

  it("201 : un LC (niveau 4) utilise la source du body", async () => {
    setLevel(4);
    mockValidRequest();

    const res = await request(app)
      .post("/api/transactions/request")
      .set(authHeader("LC"))
      .send(body);

    expect(res.status).toBe(201);
    expect(mocked.createPendingTransferRequest).toHaveBeenCalledWith(
      QUARTER_A,
      QUARTER_Z,
      RESOURCE,
      2,
      "lc-user-id",
      4,
    );
  });

  it("400 si le QC n'a pas de quartier", async () => {
    setLevel(3);

    const res = await request(app)
      .post("/api/transactions/request")
      .set(authHeader("QC", null))
      .send(body);

    expect(res.status).toBe(400);
    expect(res.body.message).toBe(
      "Aucun quartier n'est associé à cet utilisateur.",
    );
  });

  it.each([0, -1, undefined])("400 si la quantité vaut %s", async (quantity) => {
    setLevel(3);

    const res = await request(app)
      .post("/api/transactions/request")
      .set(authHeader("QC", QUARTER_W))
      .send({ ...body, quantity });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe("La quantité doit être un nombre positif.");
    expect(mocked.isAdjacentQuarter).not.toHaveBeenCalled();
  });

  it("400 si les quartiers ne sont pas adjacents", async () => {
    setLevel(3);
    mocked.isAdjacentQuarter.mockResolvedValue(false);

    const res = await request(app)
      .post("/api/transactions/request")
      .set(authHeader("QC", QUARTER_W))
      .send(body);

    expect(res.status).toBe(400);
    expect(res.body.message).toBe(
      "Le quartier sollicité n'est pas adjacent au quartier demandeur.",
    );
    expect(mocked.createPendingTransferRequest).not.toHaveBeenCalled();
  });

  it("400 si le fournisseur n'a pas assez de ressources", async () => {
    setLevel(3);
    mocked.isAdjacentQuarter.mockResolvedValue(true);
    mocked.doesTargetQuarterHaveSufficientResources.mockResolvedValue(false);

    const res = await request(app)
      .post("/api/transactions/request")
      .set(authHeader("QC", QUARTER_W))
      .send(body);

    expect(res.status).toBe(400);
    expect(mocked.createPendingTransferRequest).not.toHaveBeenCalled();
    expect(broadcastTransferRequestChange).not.toHaveBeenCalled();
  });

  it("500 si la création échoue", async () => {
    setLevel(3);
    mocked.isAdjacentQuarter.mockResolvedValue(true);
    mocked.doesTargetQuarterHaveSufficientResources.mockResolvedValue(true);
    mocked.createPendingTransferRequest.mockRejectedValue(new Error("db"));

    const res = await request(app)
      .post("/api/transactions/request")
      .set(authHeader("QC", QUARTER_W))
      .send(body);

    expect(res.status).toBe(500);
  });
});

// ---------------------------------------------------------------------------
// POST /transfer — LC / CD : direct si adjacent, sinon transit
// ---------------------------------------------------------------------------
describe("POST /api/transactions/transfer", () => {
  const body = {
    resourceId: RESOURCE,
    quantity: 2,
    sourceQuarterId: QUARTER_A, // demandeur
    targetQuarterId: QUARTER_Z, // fournisseur
  };

  it("403 pour un QC", async () => {
    setLevel(5);

    const res = await request(app)
      .post("/api/transactions/transfer")
      .set(authHeader("QC", QUARTER_W))
      .send(body);

    expect(res.status).toBe(403);
  });

  it.each(["LC", "CD"] as const)("403 pour un %s au niveau 3", async (role) => {
    setLevel(3);

    const res = await request(app)
      .post("/api/transactions/transfer")
      .set(authHeader(role))
      .send(body);

    expect(res.status).toBe(403);
  });

  it("400 si le fournisseur n'a pas assez de ressources", async () => {
    setLevel(4);
    mocked.isAdjacentQuarter.mockResolvedValue(true);
    mocked.doesTargetQuarterHaveSufficientResources.mockResolvedValue(false);

    const res = await request(app)
      .post("/api/transactions/transfer")
      .set(authHeader("LC"))
      .send(body);

    expect(res.status).toBe(400);
  });

  describe("quartiers adjacents", () => {
    beforeEach(() => {
      mocked.isAdjacentQuarter.mockResolvedValue(true);
      mocked.doesTargetQuarterHaveSufficientResources.mockResolvedValue(true);
      mocked.createPendingTransferRequest.mockResolvedValue({
        id: "req-direct",
      } as never);
    });

    it("201 : un LC au niveau 4 crée un transfert direct", async () => {
      setLevel(4);

      const res = await request(app)
        .post("/api/transactions/transfer")
        .set(authHeader("LC"))
        .send(body);

      expect(res.status).toBe(201);
      expect(mocked.createPendingTransferRequest).toHaveBeenCalledWith(
        QUARTER_A,
        QUARTER_Z,
        RESOURCE,
        2,
        "lc-user-id",
        4,
      );
      expect(mocked.createPendingTransitRequest).not.toHaveBeenCalled();
      expect(broadcastTransferRequestChange).toHaveBeenCalled();
    });

    it("403 : un CD ne peut pas faire de transfert adjacent au niveau 4", async () => {
      setLevel(4);

      const res = await request(app)
        .post("/api/transactions/transfer")
        .set(authHeader("CD"))
        .send(body);

      expect(res.status).toBe(403);
      expect(res.body.message).toBe(
        "Le CD ne peut organiser un transfert adjacent qu'au niveau de sévérité 5.",
      );
      expect(mocked.createPendingTransferRequest).not.toHaveBeenCalled();
    });

    it("201 : un CD peut faire un transfert adjacent au niveau 5", async () => {
      setLevel(5);

      const res = await request(app)
        .post("/api/transactions/transfer")
        .set(authHeader("CD"))
        .send(body);

      expect(res.status).toBe(201);
    });
  });

  describe("quartiers non adjacents (transit)", () => {
    beforeEach(() => {
      mocked.isAdjacentQuarter.mockResolvedValue(false);
      // A adjacent à W et X ; Z adjacent à W et X
      mocked.getAdjacentQuarterIds.mockImplementation(async (id) =>
        id === QUARTER_A ? [QUARTER_W, QUARTER_X] : [QUARTER_X, QUARTER_W],
      );
      mocked.createPendingTransitRequest.mockResolvedValue({
        id: "req-transit",
      } as never);
    });

    it.each(["LC", "CD"] as const)(
      "201 : un %s au niveau 4 crée un transit via un quartier commun",
      async (role) => {
        setLevel(4);
        // Fournisseur OK, mais aucun adjacent du demandeur n'a le surplus
        mocked.doesTargetQuarterHaveSufficientResources.mockImplementation(
          async (_source, target) => target === QUARTER_Z,
        );

        const res = await request(app)
          .post("/api/transactions/transfer")
          .set(authHeader(role))
          .send(body);

        expect(res.status).toBe(201);
        expect(res.body.message).toBe(
          "Demande de transit créée, en attente de l'accord du quartier de passage.",
        );
        expect(mocked.createPendingTransitRequest).toHaveBeenCalledWith(
          QUARTER_A,
          QUARTER_Z,
          RESOURCE,
          2,
          `${role.toLowerCase()}-user-id`,
          4,
          [QUARTER_W],
        );
        expect(broadcastTransferRequestChange).toHaveBeenCalled();
      },
    );

    it("400 : priorité aux adjacents si l'un d'eux a le surplus", async () => {
      setLevel(4);
      mocked.doesTargetQuarterHaveSufficientResources.mockResolvedValue(true);

      const res = await request(app)
        .post("/api/transactions/transfer")
        .set(authHeader("LC"))
        .send(body);

      expect(res.status).toBe(400);
      expect(res.body.message).toBe(
        "Le quartier sollicité n'est pas adjacent au demandeur, mais un quartier adjacent a assez de ressources : faites-lui la demande en priorité.",
      );
      expect(mocked.createPendingTransitRequest).not.toHaveBeenCalled();
    });

    it("400 si aucun quartier de passage ne relie les deux quartiers", async () => {
      setLevel(4);
      mocked.doesTargetQuarterHaveSufficientResources.mockImplementation(
        async (_source, target) => target === QUARTER_Z,
      );
      mocked.getAdjacentQuarterIds.mockImplementation(async (id) =>
        id === QUARTER_A ? [QUARTER_W] : ["quarter-e"],
      );

      const res = await request(app)
        .post("/api/transactions/transfer")
        .set(authHeader("LC"))
        .send(body);

      expect(res.status).toBe(400);
      expect(res.body.message).toBe(
        "Aucun quartier de passage ne relie directement ces deux quartiers.",
      );
    });

    it("400 si le demandeur n'a aucun quartier adjacent", async () => {
      setLevel(4);
      mocked.doesTargetQuarterHaveSufficientResources.mockResolvedValue(true);
      mocked.getAdjacentQuarterIds.mockResolvedValue([]);

      const res = await request(app)
        .post("/api/transactions/transfer")
        .set(authHeader("LC"))
        .send(body);

      expect(res.status).toBe(400);
      expect(res.body.message).toBe(
        "Aucun quartier adjacent trouvé pour le quartier demandeur.",
      );
    });
  });
});

// ---------------------------------------------------------------------------
// POST /requisition — CD, niveau >= 4
// ---------------------------------------------------------------------------
describe("POST /api/transactions/requisition", () => {
  const body = {
    resourceId: RESOURCE,
    quantity: 5,
    sourceQuarterId: QUARTER_W, // à qui on prend
    targetQuarterId: QUARTER_Z, // qui reçoit
  };

  it.each(["QC", "LC"] as const)("403 pour un %s", async (role) => {
    setLevel(5);

    const res = await request(app)
      .post("/api/transactions/requisition")
      .set(authHeader(role, role === "QC" ? QUARTER_W : null))
      .send(body);

    expect(res.status).toBe(403);
  });

  it("403 pour le CD au niveau 3", async () => {
    setLevel(3);

    const res = await request(app)
      .post("/api/transactions/requisition")
      .set(authHeader("CD"))
      .send(body);

    expect(res.status).toBe(403);
  });

  it("400 si la quantité n'est pas positive", async () => {
    setLevel(4);

    const res = await request(app)
      .post("/api/transactions/requisition")
      .set(authHeader("CD"))
      .send({ ...body, quantity: 0 });

    expect(res.status).toBe(400);
  });

  it("400 si le quartier réquisitionné n'a pas assez de ressources", async () => {
    setLevel(4);
    mocked.doesTargetQuarterHaveSufficientResources.mockResolvedValue(false);

    const res = await request(app)
      .post("/api/transactions/requisition")
      .set(authHeader("CD"))
      .send(body);

    expect(res.status).toBe(400);
    expect(mocked.requisitionResourcesService).not.toHaveBeenCalled();
  });

  it("200 : réquisition au niveau 4", async () => {
    setLevel(4);
    mocked.doesTargetQuarterHaveSufficientResources.mockResolvedValue(true);
    mocked.requisitionResourcesService.mockResolvedValue({} as never);

    const res = await request(app)
      .post("/api/transactions/requisition")
      .set(authHeader("CD"))
      .send(body);

    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Réquisition effectuée avec succès.");
    expect(mocked.requisitionResourcesService).toHaveBeenCalledWith(
      RESOURCE,
      5,
      QUARTER_W,
      QUARTER_Z,
      "cd-user-id",
      4,
    );
    expect(broadcastTransferRequestChange).toHaveBeenCalled();
  });

  it("500 si le service échoue", async () => {
    setLevel(4);
    mocked.doesTargetQuarterHaveSufficientResources.mockResolvedValue(true);
    mocked.requisitionResourcesService.mockRejectedValue(new Error("db"));

    const res = await request(app)
      .post("/api/transactions/requisition")
      .set(authHeader("CD"))
      .send(body);

    expect(res.status).toBe(500);
  });
});

// ---------------------------------------------------------------------------
// GET /pending et GET /history — quartier du jeton
// ---------------------------------------------------------------------------
describe("GET /api/transactions/pending", () => {
  it("401 sans jeton", async () => {
    const res = await request(app).get("/api/transactions/pending");

    expect(res.status).toBe(401);
  });

  it("400 pour un utilisateur sans quartier", async () => {
    const res = await request(app)
      .get("/api/transactions/pending")
      .set(authHeader("LC"));

    expect(res.status).toBe(400);
  });

  it("200 avec les demandes en attente du quartier", async () => {
    mocked.getPendingRequestsForQuarterService.mockResolvedValue([
      pendingRequest,
    ] as never);

    const res = await request(app)
      .get("/api/transactions/pending")
      .set(authHeader("QC", QUARTER_W));

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, data: [pendingRequest] });
    expect(mocked.getPendingRequestsForQuarterService).toHaveBeenCalledWith(
      QUARTER_W,
    );
  });

  it("500 si le service échoue", async () => {
    mocked.getPendingRequestsForQuarterService.mockRejectedValue(
      new Error("Quartier introuvable."),
    );

    const res = await request(app)
      .get("/api/transactions/pending")
      .set(authHeader("QC", QUARTER_W));

    expect(res.status).toBe(500);
  });
});

describe("GET /api/transactions/history", () => {
  it("400 pour un utilisateur sans quartier", async () => {
    const res = await request(app)
      .get("/api/transactions/history")
      .set(authHeader("CD"));

    expect(res.status).toBe(400);
  });

  it("200 avec l'historique du quartier", async () => {
    mocked.getQuarterRequestHistoryService.mockResolvedValue([
      pendingRequest,
    ] as never);

    const res = await request(app)
      .get("/api/transactions/history")
      .set(authHeader("QC", QUARTER_W));

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([pendingRequest]);
    expect(mocked.getQuarterRequestHistoryService).toHaveBeenCalledWith(
      QUARTER_W,
    );
  });

  it("500 si le service échoue", async () => {
    mocked.getQuarterRequestHistoryService.mockRejectedValue(new Error("db"));

    const res = await request(app)
      .get("/api/transactions/history")
      .set(authHeader("QC", QUARTER_W));

    expect(res.status).toBe(500);
  });
});

// ---------------------------------------------------------------------------
// POST /requests/:id/approve et /reject — QC fournisseur, niveau >= 3
// ---------------------------------------------------------------------------
describe("POST /api/transactions/requests/:id/approve", () => {
  const url = `/api/transactions/requests/${pendingRequest.id}/approve`;

  it("403 au niveau 2", async () => {
    setLevel(2);

    const res = await request(app).post(url).set(authHeader("QC", QUARTER_W));

    expect(res.status).toBe(403);
  });

  it.each(["LC", "CD"] as const)("403 pour un %s", async (role) => {
    setLevel(5);

    const res = await request(app).post(url).set(authHeader(role));

    expect(res.status).toBe(403);
  });

  it("404 si la demande n'est pas en attente pour ce quartier", async () => {
    setLevel(3);
    mocked.getPendingRequestsForQuarterService.mockResolvedValue([]);

    const res = await request(app).post(url).set(authHeader("QC", QUARTER_W));

    expect(res.status).toBe(404);
    expect(mocked.approveTransferRequestService).not.toHaveBeenCalled();
  });

  it("400 si le transit n'a pas encore été approuvé", async () => {
    setLevel(4);
    mocked.getPendingRequestsForQuarterService.mockResolvedValue([
      { ...pendingRequest, routeType: "TRANSIT" },
    ] as never);
    mocked.areAllTransitApprovalsApproved.mockResolvedValue(false);

    const res = await request(app).post(url).set(authHeader("QC", QUARTER_W));

    expect(res.status).toBe(400);
    expect(res.body.message).toBe(
      "Le quartier de passage n'a pas encore approuvé cette demande.",
    );
    expect(mocked.approveTransferRequestService).not.toHaveBeenCalled();
  });

  it("400 si le stock est passé sous le seuil depuis la demande", async () => {
    setLevel(3);
    mocked.getPendingRequestsForQuarterService.mockResolvedValue([
      pendingRequest,
    ] as never);
    mocked.doesTargetQuarterHaveSufficientResources.mockResolvedValue(false);

    const res = await request(app).post(url).set(authHeader("QC", QUARTER_W));

    expect(res.status).toBe(400);
    expect(mocked.approveTransferRequestService).not.toHaveBeenCalled();
  });

  it("200 : approuve la demande et diffuse le changement", async () => {
    setLevel(3);
    mocked.getPendingRequestsForQuarterService.mockResolvedValue([
      pendingRequest,
    ] as never);
    mocked.doesTargetQuarterHaveSufficientResources.mockResolvedValue(true);
    mocked.approveTransferRequestService.mockResolvedValue({
      success: true,
      message: "Transfert approuvé : 2 unité(s) en route (60s).",
      transferRequest: { ...pendingRequest, status: "IN_TRANSIT" },
    } as never);

    const res = await request(app).post(url).set(authHeader("QC", QUARTER_W));

    expect(res.status).toBe(200);
    expect(res.body.message).toBe(
      "Transfert approuvé : 2 unité(s) en route (60s).",
    );
    expect(res.body.data.status).toBe("IN_TRANSIT");
    expect(mocked.approveTransferRequestService).toHaveBeenCalledWith(
      pendingRequest.id,
      "qc-user-id",
    );
    expect(broadcastTransferRequestChange).toHaveBeenCalled();
  });

  it("200 : une demande TRANSIT dont le passage est approuvé", async () => {
    setLevel(4);
    mocked.getPendingRequestsForQuarterService.mockResolvedValue([
      { ...pendingRequest, routeType: "TRANSIT" },
    ] as never);
    mocked.areAllTransitApprovalsApproved.mockResolvedValue(true);
    mocked.doesTargetQuarterHaveSufficientResources.mockResolvedValue(true);
    mocked.approveTransferRequestService.mockResolvedValue({
      message: "ok",
      transferRequest: {},
    } as never);

    const res = await request(app).post(url).set(authHeader("QC", QUARTER_W));

    expect(res.status).toBe(200);
  });

  it("500 si l'approbation échoue", async () => {
    setLevel(3);
    mocked.getPendingRequestsForQuarterService.mockResolvedValue([
      pendingRequest,
    ] as never);
    mocked.doesTargetQuarterHaveSufficientResources.mockResolvedValue(true);
    mocked.approveTransferRequestService.mockRejectedValue(
      new Error("Cette demande a déjà été traitée."),
    );

    const res = await request(app).post(url).set(authHeader("QC", QUARTER_W));

    expect(res.status).toBe(500);
    expect(broadcastTransferRequestChange).not.toHaveBeenCalled();
  });
});

describe("POST /api/transactions/requests/:id/reject", () => {
  const url = `/api/transactions/requests/${pendingRequest.id}/reject`;

  beforeEach(() => setLevel(3));

  it.each([undefined, "", "   "])(
    "400 si le motif vaut %j",
    async (rejectionReason) => {
      const res = await request(app)
        .post(url)
        .set(authHeader("QC", QUARTER_W))
        .send({ rejectionReason });

      expect(res.status).toBe(400);
      expect(res.body.message).toBe("Un motif de refus est requis.");
    },
  );

  it("404 si la demande n'est pas en attente pour ce quartier", async () => {
    mocked.getPendingRequestsForQuarterService.mockResolvedValue([]);

    const res = await request(app)
      .post(url)
      .set(authHeader("QC", QUARTER_W))
      .send({ rejectionReason: "Stock réservé" });

    expect(res.status).toBe(404);
  });

  it("200 : refuse avec le motif nettoyé", async () => {
    mocked.getPendingRequestsForQuarterService.mockResolvedValue([
      pendingRequest,
    ] as never);
    mocked.rejectTransferRequestService.mockResolvedValue({
      ...pendingRequest,
      status: "REJECTED",
    } as never);

    const res = await request(app)
      .post(url)
      .set(authHeader("QC", QUARTER_W))
      .send({ rejectionReason: "  Stock réservé  " });

    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Demande de transfert refusée.");
    expect(mocked.rejectTransferRequestService).toHaveBeenCalledWith(
      pendingRequest.id,
      "qc-user-id",
      "Stock réservé",
    );
    expect(broadcastTransferRequestChange).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Transits — QC du quartier de passage, niveau >= 4
// ---------------------------------------------------------------------------
const transitApproval = {
  id: "approval-1",
  transferRequestId: "req-transit",
  transitQuarterId: QUARTER_W,
  status: "PENDING",
  transferRequest: { ...pendingRequest, id: "req-transit", routeType: "TRANSIT" },
};

describe("GET /api/transactions/transits/pending", () => {
  it("400 pour un utilisateur sans quartier", async () => {
    const res = await request(app)
      .get("/api/transactions/transits/pending")
      .set(authHeader("LC"));

    expect(res.status).toBe(400);
  });

  it("200 avec les passages en attente du quartier", async () => {
    mocked.getPendingTransitApprovalsForQuarterService.mockResolvedValue([
      transitApproval,
    ] as never);

    const res = await request(app)
      .get("/api/transactions/transits/pending")
      .set(authHeader("QC", QUARTER_W));

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([transitApproval]);
    expect(
      mocked.getPendingTransitApprovalsForQuarterService,
    ).toHaveBeenCalledWith(QUARTER_W);
  });
});

describe("POST /api/transactions/transits/:id/approve", () => {
  const url = "/api/transactions/transits/req-transit/approve";

  it("403 au niveau 3", async () => {
    setLevel(3);

    const res = await request(app).post(url).set(authHeader("QC", QUARTER_W));

    expect(res.status).toBe(403);
    expect(res.body.message).toBe(
      "Impossible d'approuver un transit à ce niveau de sévérité.",
    );
  });

  it("404 si aucun passage en attente pour cette demande", async () => {
    setLevel(4);
    mocked.getPendingTransitApprovalsForQuarterService.mockResolvedValue([]);

    const res = await request(app).post(url).set(authHeader("QC", QUARTER_W));

    expect(res.status).toBe(404);
  });

  it("200 : approuve le passage", async () => {
    setLevel(4);
    mocked.getPendingTransitApprovalsForQuarterService.mockResolvedValue([
      transitApproval,
    ] as never);
    mocked.approveTransitApprovalService.mockResolvedValue({
      ...transitApproval,
      status: "APPROVED",
    } as never);

    const res = await request(app).post(url).set(authHeader("QC", QUARTER_W));

    expect(res.status).toBe(200);
    expect(res.body.message).toBe(
      "Transit approuvé. La demande attend maintenant l'accord du quartier fournisseur.",
    );
    expect(mocked.approveTransitApprovalService).toHaveBeenCalledWith(
      "approval-1",
      "qc-user-id",
    );
    expect(broadcastTransferRequestChange).toHaveBeenCalled();
  });
});

describe("POST /api/transactions/transits/:id/reject", () => {
  const url = "/api/transactions/transits/req-transit/reject";

  beforeEach(() => {
    setLevel(4);
    mocked.getPendingTransitApprovalsForQuarterService.mockResolvedValue([
      transitApproval,
    ] as never);
  });

  it("403 au niveau 3", async () => {
    setLevel(3);

    const res = await request(app)
      .post(url)
      .set(authHeader("QC", QUARTER_W))
      .send({ rejectionReason: "Route coupée" });

    expect(res.status).toBe(403);
  });

  it("400 sans motif", async () => {
    const res = await request(app)
      .post(url)
      .set(authHeader("QC", QUARTER_W))
      .send({});

    expect(res.status).toBe(400);
    expect(mocked.rejectTransitApprovalService).not.toHaveBeenCalled();
  });

  it("404 si aucun passage en attente pour cette demande", async () => {
    mocked.getPendingTransitApprovalsForQuarterService.mockResolvedValue([]);

    const res = await request(app)
      .post(url)
      .set(authHeader("QC", QUARTER_W))
      .send({ rejectionReason: "Route coupée" });

    expect(res.status).toBe(404);
  });

  it("200 : refus avec repli maritime", async () => {
    mocked.rejectTransitApprovalService.mockResolvedValue({
      rejectedRequest: { id: "req-transit", status: "REJECTED" },
      maritimeRequest: { id: "req-maritime", routeType: "MARITIME" },
    } as never);

    const res = await request(app)
      .post(url)
      .set(authHeader("QC", QUARTER_W))
      .send({ rejectionReason: "  Route coupée " });

    expect(res.status).toBe(200);
    expect(res.body.message).toBe(
      "Transit refusé. Une demande par voie maritime a été créée à la place, en attente de l'accord du quartier fournisseur.",
    );
    expect(res.body.data.maritimeRequest.routeType).toBe("MARITIME");
    expect(mocked.rejectTransitApprovalService).toHaveBeenCalledWith(
      "approval-1",
      "req-transit",
      "qc-user-id",
      "Route coupée",
      4,
    );
    expect(broadcastTransferRequestChange).toHaveBeenCalled();
  });

  it("200 : refus sans route maritime possible", async () => {
    mocked.rejectTransitApprovalService.mockResolvedValue({
      rejectedRequest: { id: "req-transit", status: "REJECTED" },
      maritimeRequest: null,
    } as never);

    const res = await request(app)
      .post(url)
      .set(authHeader("QC", QUARTER_W))
      .send({ rejectionReason: "Route coupée" });

    expect(res.status).toBe(200);
    expect(res.body.message).toBe(
      "Transit refusé. Aucune route maritime n'est possible entre ces quartiers.",
    );
    expect(res.body.data.maritimeRequest).toBeNull();
  });

  it("500 si le service échoue", async () => {
    mocked.rejectTransitApprovalService.mockRejectedValue(new Error("db"));

    const res = await request(app)
      .post(url)
      .set(authHeader("QC", QUARTER_W))
      .send({ rejectionReason: "Route coupée" });

    expect(res.status).toBe(500);
  });
});
