import { vi } from "vitest";

// Sécurité : aucun test ne doit atteindre la vraie base de données
vi.mock("../src/prisma/db", () => ({ db: {} }));

// Les contrôleurs loggent beaucoup : on garde la sortie des tests lisible
vi.spyOn(console, "log").mockImplementation(() => {});
vi.spyOn(console, "error").mockImplementation(() => {});
