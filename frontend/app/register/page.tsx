"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const ROLES = ["CD", "LC", "QC"] as const;
const QUARTIERS = ["Apex", "Echo", "Warden", "Xeno", "Zion"] as const;

export default function RegisterPage() {
  const router = useRouter();
  const [role, setRole] = useState<string>(ROLES[0]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,#1b3a5a,#07131f_55%)] px-4 py-10 text-white">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/5 p-8 shadow-2xl backdrop-blur-sm">
        <button
          type="button"
          onClick={() => router.back()}
          className="mb-6 rounded-lg border border-white/15 px-3 py-2 text-sm font-medium text-white/70 transition hover:border-cyan-400/70 hover:text-cyan-300"
        >
          Retour
        </button>

        <div className="mb-8 text-center">
          <p className="text-sm uppercase tracking-[0.25em] text-cyan-300">
            Kaiju
          </p>
          <h1 className="mt-3 text-3xl font-bold">Inscription</h1>
        </div>

        <form className="space-y-5">
          <div>
            <label htmlFor="email" className="mb-2 block text-sm font-medium text-slate-200">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              placeholder="exemple@email.com"
              className="w-full rounded-xl border border-slate-600 bg-slate-900/80 px-4 py-3 text-white outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/30"
              required
            />
          </div>

          <div>
            <label htmlFor="password" className="mb-2 block text-sm font-medium text-slate-200">
              Mot de passe
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              placeholder="••••••••"
              className="w-full rounded-xl border border-slate-600 bg-slate-900/80 px-4 py-3 text-white outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/30"
              required
            />
          </div>

          <div>
            <label htmlFor="role" className="mb-2 block text-sm font-medium text-slate-200">
              Rôle
            </label>
            <select
              id="role"
              name="role"
              value={role}
              onChange={(event) => setRole(event.target.value)}
              className="w-full rounded-xl border border-slate-600 bg-slate-900/80 px-4 py-3 text-white outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/30"
              required
            >
              {ROLES.map((roleOption) => (
                <option key={roleOption} value={roleOption} className="bg-slate-900">
                  {roleOption}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="quartier" className="mb-2 block text-sm font-medium text-slate-200">
              Quartier
            </label>
            <select
              id="quartier"
              name="quartier"
              disabled={role !== "LC"}
              className="w-full rounded-xl border border-slate-600 bg-slate-900/80 px-4 py-3 text-white outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/30 disabled:cursor-not-allowed disabled:border-slate-700 disabled:bg-slate-700 disabled:text-slate-400"
              required
            >
              {QUARTIERS.map((quartier) => (
                <option key={quartier} value={quartier} className="bg-slate-900">
                  {quartier}
                </option>
              ))}
            </select>
          </div>

          <button
            type="submit"
            className="w-full rounded-xl bg-cyan-500 px-4 py-3 font-semibold text-slate-950 transition hover:bg-cyan-400"
          >
            S&apos;inscrire
          </button>
        </form>
      </div>
    </main>
  );
}
