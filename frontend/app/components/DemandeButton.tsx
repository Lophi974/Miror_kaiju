"use client";

import { useState } from "react";

export default function DemandeButton() {
  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState("Zone A");
  const [to, setTo] = useState("Zone Z");
  const [horaire, setHoraire] = useState("08:00");
  const zones = ["Zone A", "Zone E", "Zone X", "Zone W", "Zone Z"];

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
                onClick={() => setOpen(false)}
                className="text-3xl leading-none text-slate-300 transition hover:text-white"
              >
                ×
              </button>
            </div>

            <div className="flex gap-4">
              <div className="flex-1">
                <label className="mb-2 block text-sm text-slate-200">Depuis</label>
                <select
                  value={from}
                  onChange={(event) => setFrom(event.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-[#101a2d] px-3 py-2 text-sm text-white outline-none focus:border-emerald-500"
                >
                  {zones.map((zone) => (
                    <option key={zone} value={zone}>
                      {zone}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex-1">
                <label className="mb-2 block text-sm text-slate-200">Vers</label>
                <select
                  value={to}
                  onChange={(event) => setTo(event.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-[#101a2d] px-3 py-2 text-sm text-white outline-none focus:border-emerald-500"
                >
                  {zones.map((zone) => (
                    <option key={zone} value={zone}>
                      {zone}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-6">
              <label className="mb-2 block text-sm text-slate-200">Ressources</label>
              <div className="rounded-xl border border-yellow-600 bg-yellow-500/10 px-3 py-2 text-sm text-yellow-400">
                Aucune ressource disponible pour la {from}.
              </div>
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

            <div className="mt-7 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-xl border border-slate-700 bg-[#101a2d] px-4 py-2 text-sm text-slate-200 transition hover:bg-slate-800"
              >
                Annuler
              </button>
              <button
                type="button"
                className="rounded-xl bg-emerald-500 px-5 py-2 font-medium text-slate-950 transition hover:bg-emerald-400"
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
