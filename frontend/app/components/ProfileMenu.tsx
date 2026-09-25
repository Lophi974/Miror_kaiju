"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { useAuth } from "../contexte/provider";

export default function ProfileMenu() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const displayName = user?.name || "Profil";

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await logout();
    } finally {
      router.push("/login");
    }
  };

  return (
    <div className="fixed right-6 top-6 z-50">
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        aria-expanded={isOpen}
        aria-haspopup="menu"
        className="flex items-center gap-3 rounded-xl border border-white/15 bg-[#0a1420]/95 px-4 py-3 text-left text-white shadow-xl backdrop-blur transition hover:border-cyan-400/70"
      >
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-cyan-500 font-bold text-slate-950">
          {displayName.charAt(0).toUpperCase()}
        </span>
        <span className="max-w-40 truncate font-semibold">{displayName}</span>
        <span className="text-white/60">{isOpen ? "▴" : "▾"}</span>
      </button>

      {isOpen && (
        <div
          role="menu"
          className="absolute right-0 mt-1 w-40 rounded-xl border border-white/15 bg-[#0a1420] p-1 shadow-2xl"
        >
          <p className="truncate px-3 py-2 text-sm text-white/50">
            {user?.name}
          </p>

          {user?.role === "CD" && (
            <button
              type="button"
              role="menuitem"
              onClick={() => router.push("/register")}
              className="w-full rounded-lg px-3 py-2 text-left font-medium text-cyan-300 transition hover:bg-cyan-500/15"
            >
              Enregistrer une personne
            </button>
          )}

          <button
            type="button"
            role="menuitem"
            onClick={handleLogout}
            disabled={isLoggingOut}
            className="w-full rounded-lg px-3 py-2 text-left font-medium text-red-300 transition hover:bg-red-500/15 disabled:opacity-60"
          >
            {isLoggingOut ? "Déconnexion..." : "Se déconnecter"}
          </button>
        </div>
      )}
    </div>
  );
}