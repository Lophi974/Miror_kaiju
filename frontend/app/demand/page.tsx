"use client";

import { useState } from "react";

export default function DemandeButton() {
  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState("Zone A");
  const [to, setTo] = useState("Zone Z");

  return (
    <>
      {/* Bouton */}
      <button
        onClick={() => setOpen(true)}
        className="rounded-lg bg-emerald-500 px-5 py-3 font-medium text-white transition hover:bg-emerald-600"
      >
        Faire une demande
      </button>

      {/* Popup */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-[570px] rounded-xl border border-slate-700 bg-[#0b1b2d] p-6 text-white shadow-2xl">

            {/* Titre */}
            <div className="mb-7 flex items-center justify-between">
              <h2 className="text-2xl font-bold">
                Nouvelle demande
              </h2>

              <button
                onClick={() => setOpen(false)}
                className="text-3xl leading-none text-slate-300 transition hover:text-white"
              >
                ×
              </button>
            </div>

            {/* Depuis / Vers */}
            <div className="flex gap-4">

              {/* Depuis */}
              <div className="flex-1">
                <label className="mb-2 block text-sm text-slate-200">
                  Depuis
                </label>

                <select
                  value={from}
                  onChange={(event) => setFrom(event.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-[#101a2d] px-3 py-2 text-sm text-white outline-none focus:border-emerald-500"
                >
                  <option>Zone A</option>
                  <option>Zone E</option>
                  <option>Zone W</option>
                  <option>Zone Z</option>
                   <option>Zone x</option>
                </select>
              </div>

              {/* Vers */}
              <div className="flex-1">
                <label className="mb-2 block text-sm text-slate-200">
                  Vers
                </label>

                <select
                  value={to}
                  onChange={(event) => setTo(event.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-[#101a2d] px-3 py-2 text-sm text-white outline-none focus:border-emerald-500"
                >
                  <option>Zone A</option>
                  <option>Zone E</option>
                   <option>Zone x</option>
                  <option>Zone W</option>
                  <option>Zone Z</option>
                 
                </select>
              </div>

            </div>

            {/* Ressources */}
            <div className="mt-6">
              <label className="mb-2 block text-sm text-slate-200">
                Ressources
              </label>

              <div className="rounded-xl border border-yellow-600 bg-yellow-500/10 px-3 py-2 text-sm text-yellow-400">
                Aucune ressource disponible pour la {from}.
              </div>
            </div>

            {/* Résumé */}
            <div className="mt-5 rounded-xl border border-slate-700 bg-[#101a2d] p-4 text-sm text-slate-200">
              <strong>Résumé :</strong>{" "}
              {from} → {to} : Aucune ressource sélectionnée
            </div>

            {/* Boutons */}
            <div className="mt-7 flex justify-end gap-3">

              <button
                onClick={() => setOpen(false)}
                className="rounded-xl border border-slate-700 bg-[#101a2d] px-4 py-2 text-sm text-slate-200 transition hover:bg-slate-800"
              >
                Annuler
              </button>

              <button
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