"use client";

import { useState, useEffect } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

interface Quartier {
  id: string;
  code: string;
  name: string;
  hasSeaAccess: boolean;
  treshHoldPercent: number;
}

interface Ressource {
  id: string;
  name: string;
  quarterId: string;
}

export default function DemandeButton() {
  const [open, setOpen] = useState(false);

  const [zones, setZones] = useState<Quartier[]>([]);
  const [zonesLoading, setZonesLoading] = useState(false);
  const [zonesError, setZonesError] = useState<string | null>(null);

  const [from, setFrom] = useState<Quartier | null>(null);
  const [to, setTo] = useState<Quartier | null>(null);
  const [horaire, setHoraire] = useState("08:00");

  const [ressources, setRessources] = useState<Ressource[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [ressourcesLoading, setRessourcesLoading] = useState(false);
  const [ressourcesError, setRessourcesError] = useState<string | null>(null);

  // Fetch des quartiers a l'ouverture de la popup
  useEffect(() => {
    if (!open) return;

    setZonesLoading(true);
    setZonesError(null);

    fetch(API_URL + "/api/ressources/quarters", { credentials: "include" })
      .then(async (res) => {
        const body = await res.json();
        if (!res.ok) throw new Error("Erreur lors du chargement des quartiers");
        return body;
      })
      .then((body) => {
        const data: Quartier[] = body.data ?? body;
        setZones(data);
        setFrom(data[0] ?? null);
        setTo(data[data.length - 1] ?? null);
      })
      .catch((err: unknown) => {
        console.error("[QUARTERS] Error:", err);
        setZonesError(err instanceof Error ? err.message : "Erreur inconnue");
      })
      .finally(() => setZonesLoading(false));
  }, [open]);

  // Fetch des ressources des que "from" change
  useEffect(() => {
    if (!open || !from) return;

    setRessourcesLoading(true);
    setRessourcesError(null);
    setRessources([]);
    setSelected([]);

    fetch(API_URL + "/api/ressources/quarter/" + from.id, {
      credentials: "include",
    })
      .then(async (res) => {
        if (res.status === 404) {
          return [];
        }

        const body = await res.json();

        if (!res.ok || !body.success) {
          throw new Error(body.message || "Erreur lors du chargement des ressources");
        }

        return body.data as Ressource[];
      })
      .then((data) => setRessources(data))
      .catch((err: unknown) => {
        console.error("[RESSOURCES] Error:", err);
        setRessourcesError(err instanceof Error ? err.message : "Erreur inconnue");
      })
      .finally(() => setRessourcesLoading(false));
  }, [open, from]);

  const toggleRessource = (id: string) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((r) => r !== id) : [...prev, id]
    );
  };

  const handleClose = () => {
    setOpen(false);
    setSelected([]);
    setRessourcesError(null);
    setZonesError(null);
  };

  const handleSubmit = async () => {
    if (!from || !to) return;

    try {
      const res = await fetch(API_URL + "/api/ressources/demande", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          fromQuarterId: from.id,
          toQuarterId: to.id,
          ressources: selected,
          horaire,
        }),
      });

      if (!res.ok) throw new Error("Echec de l'envoi de la demande");

      handleClose();
    } catch (err: unknown) {
      console.error(err);
      setRessourcesError(err instanceof Error ? err.message : "Erreur inconnue");
    }
  };

  return (
    <>
      <div className="fixed bottom-6 left-6 z-50">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex items-center justify-center rounded-xl bg-cyan-500 px-5 py-3 text-sm font-semibold text-slate-950 shadow-lg transition hover:bg-cyan-400"
        >
          + Faire une demande
        </button>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-xl rounded-xl border border-slate-700 bg-[#0b1b2d] p-6 text-white shadow-2xl">
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

            {!zonesLoading && !zonesError && (!from || !to) && (
              <div className="rounded-xl border border-yellow-600 bg-yellow-500/10 px-3 py-2 text-sm text-yellow-400">
                Aucun quartier disponible.
              </div>
            )}

            {!zonesLoading && !zonesError && from && to && (
              <>
                <div className="flex gap-4">
                  <div className="flex-1">
                    <label className="mb-2 block text-sm text-slate-200">Depuis</label>
                    <select
                      value={from.id}
                      onChange={(event) => {
                        const found = zones.find((z) => z.id === event.target.value);
                        setFrom(found ?? null);
                      }}
                      className="w-full rounded-lg border border-slate-700 bg-[#101a2d] px-3 py-2 text-sm text-white outline-none focus:border-emerald-500"
                    >
                      {zones.map((zone) => (
                        <option key={zone.id} value={zone.id}>
                          {zone.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex-1">
                    <label className="mb-2 block text-sm text-slate-200">Vers</label>
                    <select
                      value={to.id}
                      onChange={(event) => {
                        const found = zones.find((z) => z.id === event.target.value);
                        setTo(found ?? null);
                      }}
                      className="w-full rounded-lg border border-slate-700 bg-[#101a2d] px-3 py-2 text-sm text-white outline-none focus:border-emerald-500"
                    >
                      {zones.map((zone) => (
                        <option key={zone.id} value={zone.id}>
                          {zone.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="mt-6">
                  <label className="mb-2 block text-sm text-slate-200">Ressources</label>

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

                  {!ressourcesLoading && !ressourcesError && ressources.length === 0 && (
                    <div className="rounded-xl border border-yellow-600 bg-yellow-500/10 px-3 py-2 text-sm text-yellow-400">
                      Aucune ressource disponible pour la {from.name}.
                    </div>
                  )}

                  {!ressourcesLoading && !ressourcesError && ressources.length > 0 && (
                    <div className="flex flex-col gap-2 max-h-48 overflow-y-auto rounded-xl border border-slate-700 bg-[#101a2d] p-3">
                      {ressources.map((r) => (
                        <label
                          key={r.id}
                          className="flex items-center gap-2 text-sm text-slate-200"
                        >
                          <input
                            type="checkbox"
                            checked={selected.includes(r.id)}
                            onChange={() => toggleRessource(r.id)}
                            className="accent-emerald-500"
                          />
                          {r.name}
                        </label>
                      ))}
                    </div>
                  )}
                </div>

                <div className="mt-5 rounded-xl border border-slate-700 bg-[#101a2d] p-4 text-sm text-slate-200">
                  <label className="mb-2 block text-sm text-slate-200">Horaire</label>
                  <select
                    value={horaire}
                    onChange={(event) => setHoraire(event.target.value)}
                    className="w-full rounded-lg border border-slate-700 bg-[#101a2d] px-3 py-2 text-sm text-white outline-none focus:border-emerald-500"
                  >
                    <option value="08:00">08:00</option>
                    <option value="10:00">10:00</option>
                    <option value="12:00">12:00</option>
                    <option value="14:00">14:00</option>
                    <option value="16:00">16:00</option>
                    <option value="18:00">18:00</option>
                  </select>
                </div>
              </>
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
                disabled={selected.length === 0 || !from || !to}
                className="rounded-xl bg-emerald-500 px-5 py-2 font-medium text-slate-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Envoyer
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}