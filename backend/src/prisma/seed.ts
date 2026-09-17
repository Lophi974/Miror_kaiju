import { randomBytes } from "node:crypto";
import { writeFile } from "node:fs/promises";
import path from "node:path";

import { db } from "./db.ts";
import { hashPassword } from "../util/hashPassword.ts";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

// Adapte ce chemin si besoin : c'est ici que le fichier des identifiants
// en clair sera écrit. Pense à l'ajouter à ton .gitignore.
const CREDENTIALS_OUTPUT_PATH = path.resolve(
  import.meta.dirname ?? ".",
  "seed-credentials.txt",
);

const EMAIL_DOMAIN = "ville.local";

// Quartiers de référence, dans l'ordre où on veut les voir apparaître.
// hasSeaAccess reprend les KAIJU rules (E, X, Z ont un accès à la Tokyork
// Bay ; A et W sont enclavés).
const QUARTERS_SEED = [
  { code: "A", name: "Apex", hasSeaAccess: false },
  { code: "E", name: "Echo", hasSeaAccess: true },
  { code: "W", name: "Warden", hasSeaAccess: false },
  { code: "X", name: "Xeno", hasSeaAccess: true },
  { code: "Z", name: "Zion", hasSeaAccess: true },
] as const;

// Paires de quartiers adjacents, d'après la matrice d'adjacence des KAIJU
// rules (section "Adjacency matrix"). Chaque paire est non-orientée : on la
// seed dans les deux sens ci-dessous, conformément au commentaire du contrat
// sur QuarterAdjacency ("Seedée dans les DEUX sens (A→E et E→A)").
// Rappel des liens (hors accès mer, déjà porté par Quarter.hasSeaAccess) :
//   A-E, A-W, A-X, E-X, W-X, W-Z, X-Z
const ADJACENT_PAIRS: ReadonlyArray<readonly [string, string]> = [
  ["A", "E"],
  ["A", "W"],
  ["A", "X"],
  ["E", "X"],
  ["W", "X"],
  ["W", "Z"],
  ["X", "Z"],
] as const;

// Les 10 types de ressources critiques, avec la distribution initiale par
// quartier reprise telle quelle de la section "Initial distribution" des
// KAIJU rules. currentQuantity part égal à initialQuantity au moment du
// seed -- aucun transfert n'a encore eu lieu.
const RESOURCES_SEED = [
  {
    code: "MEDICAL_PERSONNEL",
    name: "Personnel médical",
    unit: "personnes",
    byQuarter: { A: 12, E: 5, W: 8, X: 3, Z: 7 },
  },
  {
    code: "RESCUE_TEAMS",
    name: "Équipes de secours",
    unit: "équipes",
    byQuarter: { A: 4, E: 9, W: 3, X: 6, Z: 5 },
  },
  {
    code: "TRANSPORT_VEHICLES",
    name: "Véhicules de transport",
    unit: "véhicules",
    byQuarter: { A: 6, E: 3, W: 10, X: 4, Z: 7 },
  },
  {
    code: "EMERGENCY_SHELTERS",
    name: "Abris d'urgence",
    unit: "abris",
    byQuarter: { A: 8, E: 6, W: 4, X: 10, Z: 2 },
  },
  {
    code: "FOOD_WATER_SUPPLIES",
    name: "Vivres et eau",
    unit: "unités",
    byQuarter: { A: 5, E: 8, W: 6, X: 7, Z: 9 },
  },
  {
    code: "COMMUNICATION_EQUIPMENT",
    name: "Équipement de communication",
    unit: "unités",
    byQuarter: { A: 3, E: 7, W: 5, X: 8, Z: 4 },
  },
  {
    code: "POWER_GENERATORS",
    name: "Générateurs électriques",
    unit: "générateurs",
    byQuarter: { A: 7, E: 2, W: 9, X: 5, Z: 6 },
  },
  {
    code: "ENGINEERING_CREWS",
    name: "Équipes d'ingénierie",
    unit: "équipes",
    byQuarter: { A: 2, E: 6, W: 7, X: 4, Z: 8 },
  },
  {
    code: "SECURITY_UNITS",
    name: "Unités de sécurité",
    unit: "unités",
    byQuarter: { A: 9, E: 4, W: 2, X: 6, Z: 3 },
  },
  {
    code: "HAZMAT_EQUIPMENT",
    name: "Équipement matières dangereuses",
    unit: "unités",
    byQuarter: { A: 3, E: 5, W: 4, X: 2, Z: 10 },
  },
] as const;

const QC_PER_QUARTER = 2;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Génère un mot de passe en clair, suffisamment fort pour un compte de démo/seed. */
function generatePlainPassword(): string {
  return randomBytes(9).toString("base64url"); // ~12 caractères, alphanumérique + -_
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

type CredentialRow = {
  email: string;
  plainPassword: string;
  role: "CD" | "LC" | "QC";
  quarterCode: string | null;
  name: string;
};

// Types inférés directement depuis le retour réel des requêtes, pour que
// les id/quarterId/resourceTypeId conservent leur type branded (Char<36>)
// au lieu d'être aplatis en `string` par une interface écrite à la main.
type QuarterRow = Awaited<ReturnType<typeof db.orm.public.Quarter.all>>[number];
type ResourceTypeRow = Awaited<ReturnType<typeof db.orm.public.ResourceType.all>>[number];

// ---------------------------------------------------------------------------
// Étape 1 : s'assurer que les 5 quartiers existent (idempotent)
// ---------------------------------------------------------------------------

async function ensureQuarters(): Promise<Map<string, QuarterRow>> {
  const existing = await db.orm.public.Quarter.all();
  const byCode = new Map(existing.map((q) => [q.code, q] as const));

  const missing = QUARTERS_SEED.filter((q) => !byCode.has(q.code));

  if (missing.length > 0) {
    console.log(
      `Création des quartiers manquants : ${missing.map((q) => q.code).join(", ")}`,
    );
    const created = await db.orm.public.Quarter.createAll(
      missing.map((q) => ({
        code: q.code,
        name: q.name,
        hasSeaAccess: q.hasSeaAccess,
      })),
    );
    for (const q of await created) {
      byCode.set(q.code, q);
    }
  }

  return byCode;
}

// ---------------------------------------------------------------------------
// Étape 1bis : s'assurer que les liens d'adjacence existent (idempotent,
// dans les deux sens pour chaque paire de ADJACENT_PAIRS).
// ---------------------------------------------------------------------------

async function ensureQuarterAdjacencies(
  quarters: Map<string, QuarterRow>,
): Promise<void> {
  const existing = await db.orm.public.QuarterAdjacency.all();
  const existingPairs = new Set(
    existing.map((a) => `${a.quarterAId}:${a.quarterBId}`),
  );

  // Développe chaque paire non-orientée en deux lignes orientées (A→B, B→A).
  const directedPairs: Array<[string, string]> = [];
  for (const [codeA, codeB] of ADJACENT_PAIRS) {
    directedPairs.push([codeA, codeB], [codeB, codeA]);
  }

  const missing = directedPairs.filter(([codeA, codeB]) => {
    const a = quarters.get(codeA);
    const b = quarters.get(codeB);
    if (!a || !b) {
      throw new Error(
        `Adjacence ${codeA}-${codeB} impossible : quartier introuvable après ensureQuarters()`,
      );
    }
    return !existingPairs.has(`${a.id}:${b.id}`);
  });

  if (missing.length === 0) {
    console.log("Adjacences déjà en place, rien à créer.");
    return;
  }

  console.log(
    `Création de ${missing.length} lien(s) d'adjacence (${missing.length / 2} paire(s) × 2 sens)...`,
  );

  // Construit les objets directement dans l'appel à createAll() : comme
  // pour les users, ça garde le typage branded de quarterAId/quarterBId
  // sans jamais transiter par une variable typée "string" à la main.
  await db.orm.public.QuarterAdjacency.createAll(
    missing.map(([codeA, codeB]) => ({
      quarterAId: quarters.get(codeA)!.id,
      quarterBId: quarters.get(codeB)!.id,
    })),
  );
}

// ---------------------------------------------------------------------------
// Étape 1ter : s'assurer que les 10 types de ressources existent (idempotent)
// ---------------------------------------------------------------------------

async function ensureResourceTypes(): Promise<Map<string, ResourceTypeRow>> {
  const existing = await db.orm.public.ResourceType.all();
  const byCode = new Map(existing.map((r) => [r.code, r] as const));

  const missing = RESOURCES_SEED.filter((r) => !byCode.has(r.code));

  if (missing.length > 0) {
    console.log(
      `Création des types de ressources manquants : ${missing.map((r) => r.code).join(", ")}`,
    );
    const created = await db.orm.public.ResourceType.createAll(
      missing.map((r) => ({
        code: r.code,
        name: r.name,
        unit: r.unit,
      })),
    );
    for (const r of await created) {
      byCode.set(r.code, r);
    }
  }

  return byCode;
}

// ---------------------------------------------------------------------------
// Étape 1quater : s'assurer que la distribution initiale de ressources par
// quartier existe (idempotent). initialQuantity et currentQuantity partent
// à la même valeur : aucun transfert n'a encore eu lieu au moment du seed.
// ---------------------------------------------------------------------------

async function ensureQuarterResources(
  quarters: Map<string, QuarterRow>,
  resourceTypes: Map<string, ResourceTypeRow>,
): Promise<void> {
  const existing = await db.orm.public.QuarterResource.all();
  const existingPairs = new Set(
    existing.map((qr) => `${qr.quarterId}:${qr.resourceTypeId}`),
  );

  type PlannedQuarterResource = {
    quarterCode: string;
    resourceCode: string;
    quantity: number;
  };

  const planned: PlannedQuarterResource[] = [];
  for (const resource of RESOURCES_SEED) {
    for (const { code: quarterCode } of QUARTERS_SEED) {
      planned.push({
        quarterCode,
        resourceCode: resource.code,
        quantity: resource.byQuarter[quarterCode as keyof typeof resource.byQuarter],
      });
    }
  }

  const missing = planned.filter(({ quarterCode, resourceCode }) => {
    const quarter = quarters.get(quarterCode);
    const resourceType = resourceTypes.get(resourceCode);
    if (!quarter || !resourceType) {
      throw new Error(
        `Distribution ${resourceCode}/${quarterCode} impossible : quartier ou type de ressource introuvable`,
      );
    }
    return !existingPairs.has(`${quarter.id}:${resourceType.id}`);
  });

  if (missing.length === 0) {
    console.log("Distribution des ressources déjà en place, rien à créer.");
    return;
  }

  console.log(
    `Création de ${missing.length} ligne(s) de distribution de ressources...`,
  );

  // Comme pour les adjacences : construction directe dans createAll() pour
  // conserver le typage branded de quarterId / resourceTypeId.
  await db.orm.public.QuarterResource.createAll(
    missing.map(({ quarterCode, resourceCode, quantity }) => ({
      quarterId: quarters.get(quarterCode)!.id,
      resourceTypeId: resourceTypes.get(resourceCode)!.id,
      initialQuantity: quantity,
      currentQuantity: quantity,
    })),
  );
}

// ---------------------------------------------------------------------------
// Étape 2 : construire la liste des utilisateurs à créer (données "plates",
// sans lien direct vers le type branded de l'id -- on ne le récupère qu'au
// moment de l'insertion, voir insertUsers()).
// ---------------------------------------------------------------------------

type PlannedUser = {
  email: string;
  passwordHash: string;
  name: string;
  role: "CD" | "LC" | "QC";
  quarterCode: string | null; // null = pas de quartier (CD, LC)
};

async function buildUsers(quarterCodes: readonly string[]) {
  const credentials: CredentialRow[] = [];
  const planned: PlannedUser[] = [];

  async function addUser(params: {
    email: string;
    name: string;
    role: "CD" | "LC" | "QC";
    quarterCode: string | null;
  }) {
    const plainPassword = generatePlainPassword();
    const passwordHash = await hashPassword(plainPassword);

    planned.push({
      email: params.email,
      passwordHash,
      name: params.name,
      role: params.role,
      quarterCode: params.quarterCode,
    });

    credentials.push({
      email: params.email,
      plainPassword,
      role: params.role,
      quarterCode: params.quarterCode,
      name: params.name,
    });
  }

  // --- City Director : un seul, portée ville entière, pas de quartier ---
  await addUser({
    email: `cd@${EMAIL_DOMAIN}`,
    name: "Directeur de Ville",
    role: "CD",
    quarterCode: null,
  });

  // --- Logistics Coordinator + Quarter Coordinators, par quartier ---
  for (const { code, name } of QUARTERS_SEED) {
    if (!quarterCodes.includes(code)) {
      throw new Error(`Quartier ${code} introuvable après ensureQuarters()`);
    }

    // LC : portée multi-quartiers -> pas de quarterId, conformément à la
    // règle du contrat ("doit rester null pour LC/CD").
    await addUser({
      email: `lc.${slugify(code)}@${EMAIL_DOMAIN}`,
      name: `Coordinateur Logistique (${name})`,
      role: "LC",
      quarterCode: null,
    });

    // QC : deux par quartier, scope = ce quartier uniquement.
    for (let i = 1; i <= QC_PER_QUARTER; i++) {
      await addUser({
        email: `qc${i}.${slugify(code)}@${EMAIL_DOMAIN}`,
        name: `Coordinateur de Quartier ${name} #${i}`,
        role: "QC",
        quarterCode: code,
      });
    }
  }

  return { planned, credentials };
}

// ---------------------------------------------------------------------------
// Étape 2bis : insertion, séparée en deux lots homogènes (avec / sans
// quarterId) pour que TypeScript infère le bon type branded en contexte
// direct de l'appel à createAll(), sans jamais passer par une variable
// typée "string" à la main.
// ---------------------------------------------------------------------------

async function insertUsers(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  planned: PlannedUser[],
  quarters: Map<string, QuarterRow>,
) {
  const withoutQuarter = planned.filter((u) => u.quarterCode === null);
  const withQuarter = planned.filter((u) => u.quarterCode !== null);

  if (withoutQuarter.length > 0) {
    await tx.orm.public.User.createAll(
      withoutQuarter.map((u) => ({
        email: u.email,
        passwordHash: u.passwordHash,
        name: u.name,
        role: u.role,
      })),
    );
  }

  if (withQuarter.length > 0) {
    await tx.orm.public.User.createAll(
      withQuarter.map((u) => ({
        email: u.email,
        passwordHash: u.passwordHash,
        name: u.name,
        role: u.role,
        // quarters.get(...)!.id conserve son type Char<36> car on ne le
        // fait transiter par aucune variable/interface qui l'aplatirait.
        quarterId: quarters.get(u.quarterCode!)!.id,
      })),
    );
  }
}

// ---------------------------------------------------------------------------
// Étape 3 : écriture du fichier de credentials en clair
// ---------------------------------------------------------------------------

async function writeCredentialsFile(credentials: CredentialRow[]) {
  const lines = [
    "# Identifiants de seed — À NE JAMAIS COMMITER NI UTILISER EN PRODUCTION",
    `# Généré le ${new Date().toISOString()}`,
    "",
    ...credentials.map((c) => {
      const scope = c.quarterCode
        ? `quartier ${c.quarterCode}`
        : "ville entière";
      return `${c.role.padEnd(3)} | ${c.email.padEnd(28)} | ${c.plainPassword.padEnd(16)} | ${scope} | ${c.name}`;
    }),
    "",
  ];

  await writeFile(CREDENTIALS_OUTPUT_PATH, lines.join("\n"), "utf8");
  console.log(`Identifiants en clair écrits dans : ${CREDENTIALS_OUTPUT_PATH}`);
}

async function main() {
  const quarters = await ensureQuarters();
  await ensureQuarterAdjacencies(quarters);

  const resourceTypes = await ensureResourceTypes();
  await ensureQuarterResources(quarters, resourceTypes);

  const { planned, credentials } = await buildUsers(
    Array.from(quarters.keys()),
  );

  await db.transaction(async (tx) => {
    await insertUsers(tx, planned, quarters);
  });

  console.log(`${planned.length} utilisateurs créés :`);
  console.log(`  - 1 CD`);
  console.log(`  - ${QUARTERS_SEED.length} LC (1 par quartier)`);
  console.log(
    `  - ${QUARTERS_SEED.length * QC_PER_QUARTER} QC (${QC_PER_QUARTER} par quartier)`,
  );
  console.log(
    `  - ${ADJACENT_PAIRS.length} paire(s) d'adjacence (${ADJACENT_PAIRS.length * 2} lignes)`,
  );
  console.log(
    `  - ${RESOURCES_SEED.length} types de ressources × ${QUARTERS_SEED.length} quartiers = ${RESOURCES_SEED.length * QUARTERS_SEED.length} lignes de distribution`,
  );

  await writeCredentialsFile(credentials);
}

main()
  .catch((error) => {
    console.error("Échec du seed :", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.close();
  });