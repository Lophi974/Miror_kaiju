"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../contexte/provider";
import { getSocket } from "../contexte/socket";
import {
  fetchAllQuarter,
  fetchRessourcesByQuarter,
} from "../../fetch/ressources";
import {
  fetchPendingRequests,
  fetchPendingTransits,
  fetchRequestHistory,
  approveTransferRequest,
  rejectTransferRequest,
  approveTransit,
  rejectTransit,
} from "../../fetch/transactions";

// Forme renvoyée par /api/transactions/pending et /history
interface TransferRequest {
  id: string;
  requestingQuarterId: string;
  supplyingQuarterId: string;
  resourceTypeId: string;
  quantity: number;
  routeType: "DIRECT" | "TRANSIT" | "MARITIME";
  status: string;
  rejectionReason: string | null;
  createdAt: string;
}

// Forme renvoyée par /api/transactions/transits/pending
interface TransitApproval {
  id: string;
  transferRequestId: string;
  transferRequest: TransferRequest;
}

type Tab = "pending" | "transits" | "history";

const STATUS_LABELS: Record<string, { label: string; className: string }> = {
  PENDING: { label: "En attente", className: "text-yellow-400" },
  APPROVED: { label: "Approuvée", className: "text-cyan-300" },
  IN_TRANSIT: { label: "En route", className: "text-cyan-300" },
  COMPLETED: { label: "Livrée", className: "text-emerald-400" },
  REJECTED: { label: "Refusée", className: "text-red-400" },
  CANCELLED: { label: "Annulée", className: "text-white/50" },
};

const ROUTE_LABELS: Record<string, string> = {
  DIRECT: "Directe",
  TRANSIT: "Transit",
  MARITIME: "Maritime",
};

// Niveaux minimum (même matrice que le backend, qui revérifie)
const MIN_LEVEL_DECIDE = 3;
const MIN_LEVEL_TRANSIT = 4;

export default function DemandesPanel({ level }: { level: number | null }) {
  const { user } = useAuth();
  const quarterId = user?.role === "QC" ? user.quarterId : null;

  const [isOpen, setIsOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("pending");

  const [pending, setPending] = useState<TransferRequest[]>([]);
  const [transits, setTransits] = useState<TransitApproval[]>([]);
  const [history, setHistory] = useState<TransferRequest[]>([]);

  // id -> nom, pour afficher autre chose que des uuid
  const [quarterNames, setQuarterNames] = useState<Record<string, string>>({});
  const [resourceNames, setResourceNames] = useState<
    Record<string, { name: string; unit: string }>
  >({});

  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  // Demande en cours de refus + motif saisi
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [reason, setReason] = useState("");

  const loadRequests = useCallback(async () => {
    const [pendingBody, transitsBody, historyBody] = await Promise.all([
      fetchPendingRequests(),
      fetchPendingTransits(),
      fetchRequestHistory(),
    ]);

    setPending(pendingBody?.success ? pendingBody.data : []);
    setTransits(transitsBody?.success ? transitsBody.data : []);
    setHistory(historyBody?.success ? historyBody.data : []);
  }, []);

  // Noms des quartiers et des ressources (chargés une fois)
  useEffect(() => {
    if (!quarterId) return;

    const loadNames = async () => {
      const [quartersBody, ressourcesBody] = await Promise.all([
        fetchAllQuarter(),
        fetchRessourcesByQuarter(quarterId),
      ]);

      if (quartersBody?.success) {
        setQuarterNames(
          quartersBody.data.reduce(
            (acc: Record<string, string>, q: { id: string; name: string }) => {
              acc[q.id] = q.name;
              return acc;
            },
            {},
          ),
        );
      }

      if (ressourcesBody?.success) {
        setResourceNames(
          ressourcesBody.data.reduce(
            (
              acc: Record<string, { name: string; unit: string }>,
              r: {
                resourceTypeId: string;
                resourceType: { name: string; unit: string };
              },
            ) => {
              acc[r.resourceTypeId] = {
                name: r.resourceType.name,
                unit: r.resourceType.unit,
              };
              return acc;
            },
            {},
          ),
        );
      }
    };

    loadNames();
  }, [quarterId]);

  // Chargement initial + rechargement à chaque changement de demande
  useEffect(() => {
    if (!quarterId) return;

    const load = async () => {
      await loadRequests();
    };
    load();

    const socket = getSocket();
    const handleTransferRequestChange = () => {
      console.log("[SOCKET] transferRequestChange reçu");
      loadRequests();
    };

    socket.on("transferRequestChange", handleTransferRequestChange);
    return () => {
      socket.off("transferRequestChange", handleTransferRequestChange);
    };
  }, [quarterId, loadRequests]);

  // Panneau réservé aux QC (rattachés à un quartier)
  if (!quarterId) return null;

  const quarterName = (id: string) => quarterNames[id] ?? "Quartier inconnu";

  const describe = (r: TransferRequest) => {
    const resource = resourceNames[r.resourceTypeId];
    return `${r.quantity} ${resource?.unit ?? ""} × ${resource?.name ?? "Ressource"}`;
  };

  const formatDate = (date: string) =>
    new Intl.DateTimeFormat("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(date));

  const canDecide = level !== null && level >= MIN_LEVEL_DECIDE;
  const canDecideTransit = level !== null && level >= MIN_LEVEL_TRANSIT;

  // Approuver / refuser : même déroulé pour les demandes et les transits
  async function handleDecision(
    id: string,
    decide: () => Promise<{ success: boolean; message?: string }>,
  ) {
    setBusyId(id);
    setError(null);

    const response = await decide();

    setBusyId(null);

    if (!response?.success) {
      setError(response?.message || "Erreur lors de la décision");
      return;
    }

    setRejectingId(null);
    setReason("");
    await loadRequests();
  }

  function renderDecisionButtons(
    id: string,
    enabled: boolean,
    onApprove: () => Promise<{ success: boolean; message?: string }>,
    onReject: (reason: string) => Promise<{ success: boolean; message?: string }>,
  ) {
    if (rejectingId === id) {
      return (
        <div className="mt-2 flex flex-col gap-2">
          <input
            type="text"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Motif du refus"
            className="w-full rounded-lg border border-white/20 bg-[#0a1420] px-3 py-1.5 text-sm text-white outline-none focus:border-red-400"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                setRejectingId(null);
                setReason("");
              }}
              className="flex-1 rounded-lg border border-white/15 px-3 py-1.5 text-sm text-white/70 transition hover:bg-white/5"
            >
              Annuler
            </button>
            <button
              type="button"
              disabled={!reason.trim() || busyId === id}
              onClick={() => handleDecision(id, () => onReject(reason.trim()))}
              className="flex-1 rounded-lg bg-red-600 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Confirmer le refus
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="mt-2 flex gap-2">
        <button
          type="button"
          disabled={!enabled || busyId === id}
          onClick={() => handleDecision(id, onApprove)}
          className="flex-1 rounded-lg bg-emerald-500 px-3 py-1.5 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Approuver
        </button>
        <button
          type="button"
          disabled={!enabled || busyId === id}
          onClick={() => {
            setRejectingId(id);
            setReason("");
          }}
          className="flex-1 rounded-lg border border-red-500/50 px-3 py-1.5 text-sm font-semibold text-red-300 transition hover:bg-red-500/15 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Refuser
        </button>
      </div>
    );
  }

  const toDecideCount = pending.length + transits.length;

  return (
    <div className="fixed left-6 top-6 z-50">
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        aria-expanded={isOpen}
        className="flex items-center gap-3 rounded-xl border border-white/15 bg-[#0a1420]/95 px-4 py-3 text-left text-white shadow-xl backdrop-blur transition hover:border-cyan-400/70"
      >
        <span className="font-semibold">Demandes</span>
        {toDecideCount > 0 && (
          <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-cyan-500 px-2 text-xs font-bold text-slate-950">
            {toDecideCount}
          </span>
        )}
        <span className="text-white/60">{isOpen ? "▴" : "▾"}</span>
      </button>

      {isOpen && (
        <div className="mt-1 w-96 max-w-[calc(100vw-3rem)] rounded-xl border border-white/15 bg-[#0a1420] p-4 text-white shadow-2xl">
          <div className="mb-4 flex gap-1 rounded-lg bg-white/5 p-1">
            {(
              [
                { value: "pending", label: `À valider (${pending.length})` },
                { value: "transits", label: `Transits (${transits.length})` },
                { value: "history", label: "Historique" },
              ] as { value: Tab; label: string }[]
            ).map(({ value, label }) => (
              <button
                key={value}
                type="button"
                onClick={() => {
                  setTab(value);
                  setError(null);
                  setRejectingId(null);
                }}
                className={`flex-1 rounded-md px-2 py-1.5 text-xs font-semibold transition ${
                  tab === value
                    ? "bg-cyan-500 text-slate-950"
                    : "text-white/60 hover:text-white"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {error && (
            <div className="mb-3 rounded-xl border border-red-600 bg-red-500/10 px-3 py-2 text-sm text-red-400">
              {error}
            </div>
          )}

          <div className="max-h-96 space-y-3 overflow-y-auto">
            {tab === "pending" && (
              <>
                {!canDecide && (
                  <p className="text-xs text-yellow-400">
                    Décisions possibles à partir du niveau {MIN_LEVEL_DECIDE}.
                  </p>
                )}
                {pending.length === 0 && (
                  <p className="text-sm text-white/50">
                    Aucune demande en attente.
                  </p>
                )}
                {pending.map((r) => (
                  <div
                    key={r.id}
                    className="rounded-xl border border-white/10 bg-white/5 p-3"
                  >
                    <p className="text-sm leading-5">
                      <strong>{quarterName(r.requestingQuarterId)}</strong>{" "}
                      demande {describe(r)}
                    </p>
                    <p className="text-xs text-white/50">
                      {ROUTE_LABELS[r.routeType] ?? r.routeType} ·{" "}
                      {formatDate(r.createdAt)}
                    </p>
                    {renderDecisionButtons(
                      r.id,
                      canDecide,
                      () => approveTransferRequest(r.id),
                      (motif) => rejectTransferRequest(r.id, motif),
                    )}
                  </div>
                ))}
              </>
            )}

            {tab === "transits" && (
              <>
                {!canDecideTransit && (
                  <p className="text-xs text-yellow-400">
                    Décisions possibles à partir du niveau {MIN_LEVEL_TRANSIT}.
                  </p>
                )}
                {transits.length === 0 && (
                  <p className="text-sm text-white/50">
                    Aucun passage en attente.
                  </p>
                )}
                {transits.map((t) => (
                  <div
                    key={t.id}
                    className="rounded-xl border border-white/10 bg-white/5 p-3"
                  >
                    <p className="text-sm leading-5">
                      Passage de {describe(t.transferRequest)} de{" "}
                      <strong>
                        {quarterName(t.transferRequest.supplyingQuarterId)}
                      </strong>{" "}
                      vers{" "}
                      <strong>
                        {quarterName(t.transferRequest.requestingQuarterId)}
                      </strong>
                    </p>
                    <p className="text-xs text-white/50">
                      {formatDate(t.transferRequest.createdAt)}
                    </p>
                    {renderDecisionButtons(
                      t.transferRequestId,
                      canDecideTransit,
                      () => approveTransit(t.transferRequestId),
                      (motif) => rejectTransit(t.transferRequestId, motif),
                    )}
                  </div>
                ))}
              </>
            )}

            {tab === "history" && (
              <>
                {history.length === 0 && (
                  <p className="text-sm text-white/50">Aucune demande.</p>
                )}
                {history.map((r) => {
                  const status = STATUS_LABELS[r.status] ?? {
                    label: r.status,
                    className: "text-white/50",
                  };
                  return (
                    <div key={r.id} className="flex items-start gap-3">
                      <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-cyan-400" />
                      <p className="text-sm leading-5 text-white">
                        <strong>{quarterName(r.requestingQuarterId)}</strong> ←{" "}
                        <strong>{quarterName(r.supplyingQuarterId)}</strong> ·{" "}
                        {describe(r)}
                        <span className="block text-xs text-white/50">
                          <span className={status.className}>
                            {status.label}
                          </span>{" "}
                          · {ROUTE_LABELS[r.routeType] ?? r.routeType} ·{" "}
                          {formatDate(r.createdAt)}
                          {r.status === "REJECTED" && r.rejectionReason && (
                            <> · {r.rejectionReason}</>
                          )}
                        </span>
                      </p>
                    </div>
                  );
                })}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
