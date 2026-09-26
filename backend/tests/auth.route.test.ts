import { describe, it, expect, vi } from "vitest";
import request from "supertest";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import authRouter from "../src/modules/routes/auth.route";
import { getUserByEmail } from "../src/modules/services/auth.service";
import { createApp, authHeader } from "./helpers";

vi.mock("../src/modules/services/auth.service", () => ({
  getUserByEmail: vi.fn(),
}));

const app = createApp("/api/auth", authRouter);

const PASSWORD = "Test123!";
// Même hash que le seed : mot de passe + PEPPER
const passwordHash = bcrypt.hashSync(PASSWORD + process.env.PEPPER, 4);

const qcUser = {
  id: "qc-id",
  role: "QC",
  hashedPassword: passwordHash,
  name: "Coordinateur Warden",
  quarterId: "quarter-w",
};

describe("POST /api/auth/login", () => {
  it("400 si l'email ou le mot de passe manque", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "qc@ville.local" });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      success: false,
      message: "L'email et le mot de passe sont requis.",
    });
    expect(getUserByEmail).not.toHaveBeenCalled();
  });

  it("401 si l'utilisateur n'existe pas", async () => {
    vi.mocked(getUserByEmail).mockResolvedValue(null);

    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "inconnu@ville.local", password: PASSWORD });

    expect(res.status).toBe(401);
    expect(res.body.message).toBe("Email ou mot de passe incorrect.");
  });

  it("401 si le mot de passe est faux", async () => {
    vi.mocked(getUserByEmail).mockResolvedValue(qcUser as never);

    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "qc@ville.local", password: "mauvais" });

    expect(res.status).toBe(401);
    expect(res.body.message).toBe("Email ou mot de passe incorrect.");
  });

  it("200, pose le cookie httpOnly et renvoie un JWT avec rôle et quartier", async () => {
    vi.mocked(getUserByEmail).mockResolvedValue(qcUser as never);

    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "qc@ville.local", password: PASSWORD });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toBe("Connexion réussie.");

    const cookie = res.headers["set-cookie"]?.[0] ?? "";
    expect(cookie).toMatch(/^token=/);
    expect(cookie).toContain("HttpOnly");

    const payload = jwt.verify(res.body.token, process.env.JWT_SECRET!) as {
      sub: string;
      role: string;
      quarterId: string | null;
    };
    expect(payload).toMatchObject({
      sub: "qc-id",
      role: "QC",
      quarterId: "quarter-w",
    });
  });

  it("met quarterId à null pour un utilisateur sans quartier (CD / LC)", async () => {
    vi.mocked(getUserByEmail).mockResolvedValue({
      ...qcUser,
      role: "LC",
      quarterId: null,
    } as never);

    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "lc@ville.local", password: PASSWORD });

    expect(res.status).toBe(200);
    const payload = jwt.decode(res.body.token) as { quarterId: string | null };
    expect(payload.quarterId).toBeNull();
  });
});

describe("GET /api/auth/me", () => {
  it("401 sans jeton", async () => {
    const res = await request(app).get("/api/auth/me");

    expect(res.status).toBe(401);
    expect(res.body.message).toBe("Jeton manquant ou au mauvais format.");
  });

  it("403 avec un jeton invalide", async () => {
    const res = await request(app)
      .get("/api/auth/me")
      .set("Authorization", "Bearer pas-un-jwt");

    expect(res.status).toBe(403);
    expect(res.body.message).toBe("Jeton invalide ou expiré.");
  });

  it("200 avec le jeton dans le header Authorization", async () => {
    const res = await request(app)
      .get("/api/auth/me")
      .set(authHeader("QC", "quarter-w"));

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      success: true,
      user: {
        userId: "qc-user-id",
        role: "QC",
        name: "Test QC",
        quarterId: "quarter-w",
      },
    });
  });

  it("200 avec le jeton dans le cookie", async () => {
    const token = authHeader("CD").Authorization.replace("Bearer ", "");

    const res = await request(app)
      .get("/api/auth/me")
      .set("Cookie", `token=${token}`);

    expect(res.status).toBe(200);
    expect(res.body.user.role).toBe("CD");
    expect(res.body.user.quarterId).toBeNull();
  });
});

describe("POST /api/auth/logout", () => {
  it("401 sans jeton", async () => {
    const res = await request(app).post("/api/auth/logout");

    expect(res.status).toBe(401);
  });

  it("200 et efface le cookie", async () => {
    const res = await request(app)
      .post("/api/auth/logout")
      .set(authHeader("QC", "quarter-w"));

    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Déconnexion réussie");
    expect(res.headers["set-cookie"]?.[0]).toMatch(/^token=;/);
  });
});
