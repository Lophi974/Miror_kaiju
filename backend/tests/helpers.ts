import express, { type Router } from "express";
import cookieParser from "cookie-parser";
import jwt from "jsonwebtoken";

// Même montage que src/index.ts, pour un seul routeur (sans lancer le serveur)
export function createApp(path: string, router: Router) {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use(path, router);
  return app;
}

type Role = "QC" | "LC" | "CD";

// Même contenu que le JWT de src/util/createToken.ts
export function tokenFor(
  role: Role,
  quarterId: string | null = null,
  sub = `${role.toLowerCase()}-user-id`,
) {
  return jwt.sign(
    { sub, role, name: `Test ${role}`, quarterId },
    process.env.JWT_SECRET!,
    { expiresIn: "1h" },
  );
}

export function authHeader(role: Role, quarterId: string | null = null) {
  return { Authorization: `Bearer ${tokenFor(role, quarterId)}` };
}
