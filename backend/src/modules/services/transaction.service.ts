import { db } from "../../prisma/db.ts";

type RouteType = "DIRECT" | "TRANSIT" | "MARITIME";

type QuarterId = Awaited<ReturnType<typeof db.orm.public.Quarter.all>>[number]["id"];

interface QuarterCandidate {
  id: QuarterId;
  code: string;
  name: string;
  treshHoldPercent: number;
  hasSeaAccess: boolean;
}

interface QuarterAvailability {
  quarterId: string;
  quarterCode: string;
  quarterName: string;
  routeType: RouteType;
  transitPath: string[];
  requiresXenoPriorityCheck: boolean;
  currentQuantity: number;
  minRetention: number;
  availableSurplus: number;
  hasEnough: boolean;
}

export async function checkIfAdjacentQuartersHaveResources(
  quarterCode: string,
  resourceTypeId: string,
  requestedQuantity: number,
) {
  const quarter = await db.orm.public.Quarter.where((q) =>
    q.code.eq(quarterCode as Parameters<typeof q.code.eq>[0]),
  ).first();

  if (!quarter) {
    return { success: false, message: "Quarter not found" } as const;
  }

  const allQuarters = await db.orm.public.Quarter.all();
  const allAdjacencies = await db.orm.public.QuarterAdjacency.all();

  const quarterById = new Map<QuarterId, QuarterCandidate>(
    allQuarters.map((q) => [
      q.id,
      {
        id: q.id,
        code: q.code,
        name: q.name,
        treshHoldPercent: q.treshHoldPercent,
        hasSeaAccess: q.hasSeaAccess,
      },
    ]),
  );

  const landAdjacency = new Map<QuarterId, Set<QuarterId>>();
  for (const q of allQuarters) landAdjacency.set(q.id, new Set());
  for (const a of allAdjacencies) {
    landAdjacency.get(a.quarterAId)?.add(a.quarterBId);
    landAdjacency.get(a.quarterBId)?.add(a.quarterAId);
  }

  const directNeighbourIds = landAdjacency.get(quarter.id) ?? new Set<QuarterId>();

  function shortestLandPath(fromId: QuarterId, toId: QuarterId): string[] | null {
    if (fromId === toId) return [];
    const visited = new Set<QuarterId>([fromId]);
    const queue: { id: QuarterId; path: QuarterId[] }[] = [{ id: fromId, path: [] }];
    while (queue.length > 0) {
      const { id, path } = queue.shift()!;
      for (const neighbourId of landAdjacency.get(id) ?? []) {
        if (visited.has(neighbourId)) continue;
        const newPath = [...path, neighbourId];
        if (neighbourId === toId) {
          return newPath.slice(0, -1).map((pid) => quarterById.get(pid)!.code);
        }
        visited.add(neighbourId);
        queue.push({ id: neighbourId, path: newPath });
      }
    }
    return null;
  }

  const requesterHasSea = quarter.hasSeaAccess;

  type Candidate = { quarter: QuarterCandidate; routeType: RouteType; transitPath: string[] };
  const candidates: Candidate[] = [];

  for (const [id, q] of quarterById) {
    if (id === quarter.id) continue;

    if (directNeighbourIds.has(id)) {
      candidates.push({ quarter: q, routeType: "DIRECT", transitPath: [] });
      continue;
    }

    if (requesterHasSea && q.hasSeaAccess) {
      candidates.push({ quarter: q, routeType: "MARITIME", transitPath: [] });
      continue;
    }

    const path = shortestLandPath(quarter.id, id);
    candidates.push({
      quarter: q,
      routeType: "TRANSIT",
      transitPath: path ?? [],
    });
  }

  const resources = await db.orm.public.QuarterResource.where((r) =>
    r.resourceTypeId.eq(resourceTypeId as Parameters<typeof r.resourceTypeId.eq>[0]),
  ).all();
  const resourceByQuarterId = new Map(resources.map((r) => [r.quarterId, r]));

  const results: QuarterAvailability[] = [];
  for (const candidate of candidates) {
    const resource = resourceByQuarterId.get(candidate.quarter.id);
    if (!resource) continue;

    const minRetention = Math.ceil(
      (resource.initialQuantity * candidate.quarter.treshHoldPercent) / 100,
    );
    const availableSurplus = resource.currentQuantity - minRetention;

    results.push({
      quarterId: String(candidate.quarter.id),
      quarterCode: candidate.quarter.code,
      quarterName: candidate.quarter.name,
      routeType: candidate.routeType,
      transitPath: candidate.transitPath,
      requiresXenoPriorityCheck:
        candidate.quarter.code === "X" || candidate.transitPath.includes("X"),
      currentQuantity: resource.currentQuantity,
      minRetention,
      availableSurplus,
      hasEnough: availableSurplus >= requestedQuantity,
    });
  }

  const directWithEnough = results.filter((r) => r.routeType === "DIRECT" && r.hasEnough);
  const fallbackNeeded = directWithEnough.length === 0;

  const eligible = fallbackNeeded
    ? results
    : results.filter((r) => r.routeType === "DIRECT");

  return {
    success: true,
    fallbackToNonAdjacent: fallbackNeeded,
    results: eligible,
    anyHasEnough: eligible.some((r) => r.hasEnough),
  } as const;
}