"use client";

import { useState, useEffect, useLayoutEffect, useRef } from "react";
import { saveDemandeLog } from "./demandeLog";
import { useAuth } from "../contexte/provider";
import {
  fetchAllQuarter,
  fetchRessourcesByQuarter,
  fetchAdjacentQuarters,
} from "../../fetch/ressources";
import {
  reserveResources,
  requestResources,
  transferResources,
  requisitionResources,
} from "../../fetch/transactions";

// Durée de l'animation (en ms) : doit correspondre à duration-500 plus bas
const ANIM_MS = 500;

interface Quartier {
  id: string;
  code: string;
  name: string;
  hasSeaAccess: boolean;
  treshHoldPercent: number;
}

interface Ressource {
  id: string;
  initialQuantity: number;
  currentQuantity: number;
  resourceType: {
    id: string;
    code: string;
    name: string;
    unit: string;
  };
  quarterId: string;
  quarter: {
    id: string;
    code: string;
    name: string;
    hasSeaAccess: boolean;
    treshHoldPercent: number;
  };
  resourceTypeId: string;
  updatedAt: string;
}

type Action = "reserve" | "request" | "transfer" | "transit" | "requisition";

// Actions proposées selon le rôle et le niveau de sévérité minimum
// (même matrice que backend/src/modules/middleware/rules.ts, qui revérifie)
const ACTIONS_BY_ROLE: Record<
  string,
  { value: Action; label: string; minLevel: number }[]
> = {
  QC: [
    { value: "request", label: "Demander à un quartier adjacent", minLevel: 3 },
    { value: "reserve", label: "Réserver dans mon quartier", minLevel: 2 },
  ],
  LC: [
    { value: "transit", label: "Demande de transit (non adjacent)", minLevel: 4 },
    { value: "transfer", label: "Transfert adjacent", minLevel: 4 },
  ],
  CD: [
    { value: "requisition", label: "Réquisitionner", minLevel: 4 },
    { value: "transit", label: "Demande de transit (non adjacent)", minLevel: 4 },
    { value: "transfer", label: "Transfert adjacent", minLevel: 5 },
  ],
};

export default function DemandeButton({ level }: { level: number | null }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);

  const actions = (ACTIONS_BY_ROLE[user?.role ?? ""] ?? []).filter(
    (a) => level !== null && level >= a.minLevel,
  );
  const [chosenAction, setChosenAction] = useState<Action | null>(null);
  // Par défaut : la première action autorisée pour le rôle
  const action =
    actions.find((a) => a.value === chosenAction)?.value ??
    actions[0]?.value ??
    null;
  const [quantity, setQuantity] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // QC : le quartier demandeur est toujours le sien, non modifiable
  const ownQuarterId = user?.role === "QC" ? user.quarterId : null;
  // QC : il ne peut demander qu'aux quartiers adjacents au sien
  const [adjacentIds, setAdjacentIds] = useState<string[]>([]);
  // LC / CD : quartiers adjacents au quartier demandeur ("Vers"), pour
  // proposer des adjacents (transfert) ou des non-adjacents (transit)
  const [toAdjacentIds, setToAdjacentIds] = useState<string[]>([]);

  // Animation bouton -> popup
  const btnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [animate, setAnimate] = useState(false);
  const [fromTransform, setFromTransform] = useState("none");

  const [zones, setZones] = useState<Quartier[]>([]);
  const [zonesLoading, setZonesLoading] = useState(false);
  const [zonesError, setZonesError] = useState<string | null>(null);

  // from = quartier qui fournit les ressources, to = quartier qui les reçoit
  const [from, setFrom] = useState<Quartier | null>(null);
  const [to, setTo] = useState<Quartier | null>(null);

  const [ressources, setRessources] = useState<Ressource[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [ressourcesLoading, setRessourcesLoading] = useState(false);
  const [ressourcesError, setRessourcesError] = useState<string | null>(null);

  // Calcule la transformation qui fait "ressembler" la popup au bouton
  // (même position, même taille)
  const getFromTransform = () => {
    const b = btnRef.current?.getBoundingClientRect();
    const p = panelRef.current?.getBoundingClientRect();
    if (!b || !p) return "none";
    const sx = b.width / p.width;
    const sy = b.height / p.height;
    const dx = b.left - p.left;
    const dy = b.bottom - p.bottom;
    return `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`;
  };

  // A l'ouverture : on place la popup sur le bouton, puis on l'agrandit
  useLayoutEffect(() => {
    if (!open) return;

    setFromTransform(getFromTransform());

    let r2 = 0;
    const r1 = requestAnimationFrame(() => {
      setAnimate(true);
      r2 = requestAnimationFrame(() => setExpanded(true));
    });

    return () => {
      cancelAnimationFrame(r1);
      cancelAnimationFrame(r2);
    };
  }, [open]);

  // Quartiers par défaut selon l'action : un QC reçoit / réserve toujours
  // dans son propre quartier
  const applyDefaultQuarters = (
    list: Quartier[],
    nextAction: Action | null,
    adjacent: string[],
  ) => {
    const own = list.find((z) => z.id === ownQuarterId) ?? null;

    if (nextAction === "reserve") {
      setFrom(own);
      setTo(own);
      return;
    }

    if (nextAction === "request" && own) {
      setTo(own);
      setFrom(list.find((z) => adjacent.includes(z.id)) ?? null);
      return;
    }

    setFrom(list[0] ?? null);
    setTo(list[list.length - 1] ?? null);
  };

  // Fetch des quartiers a l'ouverture de la popup
  useEffect(() => {
    if (!open) return;

    const loadZones = async () => {
      setZonesLoading(true);
      setZonesError(null);

      const body = await fetchAllQuarter();

      if (!body?.success) {
        setZonesError(body?.message || "Erreur lors du chargement des quartiers");
        setZonesLoading(false);
        return;
      }

      let adjacent: string[] = [];
      if (ownQuarterId) {
        const adjacentBody = await fetchAdjacentQuarters(ownQuarterId);
        adjacent = adjacentBody?.success ? adjacentBody.data : [];
      }

      setAdjacentIds(adjacent);
      setZones(body.data as Quartier[]);
      applyDefaultQuarters(body.data as Quartier[], action, adjacent);
      setZonesLoading(false);
    };

    loadZones();
    // Uniquement à l'ouverture : un changement d'action ne doit pas
    // refetch les quartiers (applyDefaultQuarters est rappelé au onChange)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const isAllowedSupplier = (zone: Quartier, adjacent: string[]) => {
    if (!to || zone.id === to.id) return false;
    if (action === "transfer") return adjacent.includes(zone.id);
    if (action === "transit") return !adjacent.includes(zone.id);
    return true;
  };

  // LC / CD : adjacents du quartier demandeur, puis fournisseur par défaut
  // valide pour l'action (adjacent ou non)
  useEffect(() => {
    if (!open || ownQuarterId || !to) return;
    if (action !== "transfer" && action !== "transit") return;

    const loadToAdjacent = async () => {
      const body = await fetchAdjacentQuarters(to.id);
      const adjacent: string[] = body?.success ? body.data : [];

      setToAdjacentIds(adjacent);
      setFrom((current) =>
        current && isAllowedSupplier(current, adjacent)
          ? current
          : (zones.find((z) => isAllowedSupplier(z, adjacent)) ?? null),
      );
    };

    loadToAdjacent();
    // isAllowedSupplier dépend déjà de to / action
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, ownQuarterId, to, action, zones]);

  // Fetch des ressources des que "from" change (stock du fournisseur)
  useEffect(() => {
    if (!open || !from) return;

    const loadRessources = async () => {
      setRessourcesLoading(true);
      setRessourcesError(null);
      setRessources([]);
      setSelected(null);

      const body = await fetchRessourcesByQuarter(from.id);

      if (!body?.success) {
        setRessourcesError(
          body?.message || "Erreur lors du chargement des ressources",
        );
        setRessourcesLoading(false);
        return;
      }

      setRessources(body.data as Ressource[]);
      setRessourcesLoading(false);
    };

    loadRessources();
  }, [open, from]);

  const handleClose = () => {
    // La popup rétrécit jusqu'au bouton, puis on la démonte
    setFromTransform(getFromTransform());
    setExpanded(false);
    setSelected(null);
    setRessourcesError(null);
    setZonesError(null);
    setSubmitError(null);
    setQuantity(1);

    setTimeout(() => {
      setOpen(false);
      setAnimate(false);
      setFromTransform("none");
    }, ANIM_MS);
  };

  const handleSubmit = async () => {
    if (!from || !to || !selected || !action) return;

    // selected = id de la ligne QuarterResource, le backend attend l'id du type
    const ressource = ressources.find((r) => r.id === selected);
    if (!ressource) return;

    setSubmitting(true);
    setSubmitError(null);

    let body;
    if (action === "reserve") {
      body = await reserveResources(ressource.resourceTypeId, quantity);
    } else if (action === "request") {
      body = await requestResources(
        to.id,
        from.id,
        ressource.resourceTypeId,
        quantity,
      );
    } else if (action === "transfer" || action === "transit") {
      body = await transferResources(
        to.id,
        from.id,
        ressource.resourceTypeId,
        quantity,
      );
    } else {
      body = await requisitionResources(
        from.id,
        to.id,
        ressource.resourceTypeId,
        quantity,
      );
    }

    setSubmitting(false);

    if (!body?.success) {
      setSubmitError(body?.message || "Echec de l'envoi de la demande");
      return;
    }

    // Une réservation reste dans le quartier : pas une demande entre zones
    if (action !== "reserve") {
      saveDemandeLog({
        fromZone: to.name,
        toZone: from.name,
        resource: ressource.resourceType.name,
        quantity,
      });
    }

    handleClose();
  };

  // Aucune action possible pour ce rôle à ce niveau : pas de bouton
  if (actions.length === 0 && !open) return null;

  return (
    <>
      <div className="fixed bottom-6 left-6 z-50">
        <button
          ref={btnRef}
          type="button"
          onClick={() => setOpen(true)}
          className={`inline-flex items-center justify-center rounded-xl bg-cyan-500 px-5 py-3 text-sm font-semibold text-slate-950 shadow-lg transition hover:bg-cyan-400 ${
            open ? "opacity-0 pointer-events-none" : ""
          }`}
        >
          + Faire une demande
        </button>
      </div>

      {open && (
        <div
          className="pointer-events-none fixed inset-0 z-50"
        >
          <div
            ref={panelRef}
            style={{
              transform: expanded ? "none" : fromTransform,
              transformOrigin: "bottom left",
            }}
            className={`pointer-events-auto absolute bottom-6 left-6 w-[calc(100%-3rem)] max-w-130 max-h-[calc(100%-3rem)] overflow-y-auto rounded-xl border p-6 text-white ${
              animate
                ? "transition-[transform,background-color,border-color] duration-500 ease-in-out"
                : "transition-none"
            } ${
              expanded
                ? "border-slate-700 bg-[#0b1b2d] shadow-2xl"
                : "border-cyan-500 bg-cyan-500"
            }`}
          >
            {/* Le contenu apparait apres l'agrandissement */}
            <div
              className={`transition-opacity ${
                expanded
                  ? "opacity-100 duration-300 delay-200"
                  : "opacity-0 duration-150"
              }`}
            >
              <div className="mb-7 flex items-center justify-between">
                <h2 className="text-2xl font-bold">Nouvelle demande</h2>
                <button
                  type="button"
                  onClick={handleClose}
                  className="text-3xl leading-none text-slate-300 transition hover:text-white"
                >
                  ×
                </button>
              </div>

              {zonesLoading && (
                <div className="rounded-xl border border-slate-700 bg-[#101a2d] px-3 py-2 text-sm text-slate-300">
                  Chargement des quartiers...
                </div>
              )}

              {!zonesLoading && zonesError && (
                <div className="rounded-xl border border-red-600 bg-red-500/10 px-3 py-2 text-sm text-red-400">
                  {zonesError}
                </div>
              )}

              {actions.length === 0 && (
                <div className="rounded-xl border border-yellow-600 bg-yellow-500/10 px-3 py-2 text-sm text-yellow-400">
                  Aucune demande possible à ce niveau de sévérité.
                </div>
              )}

              {actions.length > 0 && (
                <div className="mb-6">
                  <label className="mb-2 block text-sm text-slate-200">
                    Action
                  </label>
                  <select
                    value={action ?? ""}
                    onChange={(event) => {
                      const nextAction = event.target.value as Action;
                      setChosenAction(nextAction);
                      applyDefaultQuarters(zones, nextAction, adjacentIds);
                    }}
                    className="w-full rounded-lg border border-slate-700 bg-[#101a2d] px-3 py-2 text-sm text-white outline-none focus:border-emerald-500"
                  >
                    {actions.map((a) => (
                      <option key={a.value} value={a.value}>
                        {a.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {!zonesLoading && !zonesError && (!to || (!from && ownQuarterId)) && (
                <div className="rounded-xl border border-yellow-600 bg-yellow-500/10 px-3 py-2 text-sm text-yellow-400">
                  Aucun quartier disponible.
                </div>
              )}

              {!zonesLoading && !zonesError && to && (from || !ownQuarterId) && (
                <>
                  {ownQuarterId ? (
                    // QC : quartier demandeur = le sien, non modifiable
                    <div className="flex gap-4">
                      <div className="flex-1">
                        <label className="mb-2 block text-sm text-slate-200">
                          Mon quartier
                        </label>
                        <div className="w-full rounded-lg border border-slate-700 bg-[#101a2d] px-3 py-2 text-sm text-white opacity-60">
                          {to.name}
                        </div>
                      </div>

                      {action === "request" && (
                        <div className="flex-1">
                          <label className="mb-2 block text-sm text-slate-200">
                            Demander à
                          </label>
                          <select
                            value={from?.id ?? ""}
                            onChange={(event) => {
                              const found = zones.find(
                                (z) => z.id === event.target.value,
                              );
                              setFrom(found ?? null);
                            }}
                            className="w-full rounded-lg border border-slate-700 bg-[#101a2d] px-3 py-2 text-sm text-white outline-none focus:border-emerald-500"
                          >
                            {zones
                              .filter((zone) => adjacentIds.includes(zone.id))
                              .map((zone) => (
                                <option key={zone.id} value={zone.id}>
                                  {zone.name}
                                </option>
                              ))}
                          </select>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="flex gap-4">
                      <div className="flex-1">
                        <label className="mb-2 block text-sm text-slate-200">
                          Depuis
                        </label>
                        <select
                          value={from?.id ?? ""}
                          onChange={(event) => {
                            const found = zones.find(
                              (z) => z.id === event.target.value,
                            );
                            setFrom(found ?? null);
                          }}
                          className="w-full rounded-lg border border-slate-700 bg-[#101a2d] px-3 py-2 text-sm text-white outline-none focus:border-emerald-500"
                        >
                          {!from && (
                            <option value="" disabled>
                              {action === "transit"
                                ? "Aucun quartier non adjacent"
                                : "Aucun quartier possible"}
                            </option>
                          )}
                          {zones
                            .filter((zone) =>
                              isAllowedSupplier(zone, toAdjacentIds),
                            )
                            .map((zone) => (
                              <option key={zone.id} value={zone.id}>
                                {zone.name}
                              </option>
                            ))}
                        </select>
                      </div>

                      <div className="flex-1">
                        <label className="mb-2 block text-sm text-slate-200">
                          Vers
                        </label>
                        <select
                          value={to.id}
                          onChange={(event) => {
                            const found = zones.find(
                              (z) => z.id === event.target.value,
                            );
                            setTo(found ?? null);
                          }}
                          className="w-full rounded-lg border border-slate-700 bg-[#101a2d] px-3 py-2 text-sm text-white outline-none focus:border-emerald-500"
                        >
                          {zones
                            .filter((zone) => zone.id !== from?.id)
                            .map((zone) => (
                              <option key={zone.id} value={zone.id}>
                                {zone.name}
                              </option>
                            ))}
                        </select>
                      </div>
                    </div>
                  )}

                  {from && (
                  <div className="mt-6">
                    <label className="mb-2 block text-sm text-slate-200">
                      Ressource
                    </label>

                    {ressourcesLoading && (
                      <div className="rounded-xl border border-slate-700 bg-[#101a2d] px-3 py-2 text-sm text-slate-300">
                        Chargement...
                      </div>
                    )}

                    {!ressourcesLoading && ressourcesError && (
                      <div className="rounded-xl border border-red-600 bg-red-500/10 px-3 py-2 text-sm text-red-400">
                        {ressourcesError}
                      </div>
                    )}

                    {!ressourcesLoading &&
                      !ressourcesError &&
                      ressources.length === 0 && (
                        <div className="rounded-xl border border-yellow-600 bg-yellow-500/10 px-3 py-2 text-sm text-yellow-400">
                          Aucune ressource disponible pour la {from.name}.
                        </div>
                      )}

                    {!ressourcesLoading &&
                      !ressourcesError &&
                      ressources.length > 0 && (
                        <select
                          value={selected ?? ""}
                          onChange={(event) =>
                            setSelected(event.target.value || null)
                          }
                          className="w-full rounded-xl border border-slate-700 bg-[#101a2d] px-3 py-2 text-sm text-white outline-none focus:border-emerald-500"
                        >
                          <option value="" disabled>
                            Sélectionner une ressource
                          </option>
                          {ressources.map((r) => (
                            <option key={r.id} value={r.id}>
                              {r.resourceType.name} ({r.currentQuantity}{" "}
                              {r.resourceType.unit})
                            </option>
                          ))}
                        </select>
                      )}
                  </div>
                  )}

                  <div className="mt-5 rounded-xl border border-slate-700 bg-[#101a2d] p-4 text-sm text-slate-200">
                    <label className="mb-2 block text-sm text-slate-200">
                      Quantité
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={quantity}
                      onChange={(event) =>
                        setQuantity(Math.max(1, Number(event.target.value)))
                      }
                      className="w-full rounded-lg border border-slate-700 bg-[#101a2d] px-3 py-2 text-sm text-white outline-none focus:border-emerald-500"
                    />
                  </div>
                </>
              )}

              {submitError && (
                <div className="mt-5 rounded-xl border border-red-600 bg-red-500/10 px-3 py-2 text-sm text-red-400">
                  {submitError}
                </div>
              )}

              <div className="mt-7 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={handleClose}
                  className="rounded-xl border border-slate-700 bg-[#101a2d] px-4 py-2 text-sm text-slate-200 transition hover:bg-slate-800"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={!selected || !from || !to || !action || submitting}
                  className="rounded-xl bg-emerald-500 px-5 py-2 font-medium text-slate-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {submitting ? "Envoi..." : "Envoyer"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}