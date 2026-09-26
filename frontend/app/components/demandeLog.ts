export const DEMANDE_LOG_EVENT = "demande-log-added";
const STORAGE_KEY = "kaiju-demande-logs";
const MAX_LOGS = 20;

export type DemandeLog = {
  id: string;
  fromZone: string;
  toZone: string;
  resource: string;
  quantity: number;
  createdAt: string;
};

function isDemandeLog(value: unknown): value is DemandeLog {
  if (!value || typeof value !== "object") return false;

  const log = value as Partial<DemandeLog>;
  return (
    typeof log.id === "string" &&
    typeof log.fromZone === "string" &&
    typeof log.toZone === "string" &&
    typeof log.resource === "string" &&
    typeof log.quantity === "number" &&
    typeof log.createdAt === "string"
  );
}

export function readDemandeLogs(): DemandeLog[] {
  if (typeof window === "undefined") return [];

  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
    return Array.isArray(stored) ? stored.filter(isDemandeLog) : [];
  } catch {
    return [];
  }
}

export function saveDemandeLog(log: Omit<DemandeLog, "id" | "createdAt">) {
  if (typeof window === "undefined") return;

  const newLog: DemandeLog = {
    ...log,
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    createdAt: new Date().toISOString(),
  };
  const logs = [newLog, ...readDemandeLogs()].slice(0, MAX_LOGS);

  localStorage.setItem(STORAGE_KEY, JSON.stringify(logs));
  window.dispatchEvent(
    new CustomEvent<DemandeLog>(DEMANDE_LOG_EVENT, { detail: newLog }),
  );
}
