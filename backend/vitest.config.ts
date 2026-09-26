import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    setupFiles: ["tests/setup.ts"],
    // Lu par authenticateToken / createToken / auth.controller au chargement
    env: {
      JWT_SECRET: "test-secret",
      PEPPER: "test-pepper",
    },
    // Chaque test définit lui-même ce que renvoient les services mockés
    mockReset: true,
  },
});
