"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import { fetchMe, logoutUser } from "@/fetch/auth";

type AuthUser = {
  userId: string;
  role: string;
};

type AuthContextValue = {
  user: AuthUser | null;
  loading: boolean;
  error: string | null;
  isAuthenticated: boolean;
  refetch: () => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadUser = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // fetchMe renvoie null si pas de cookie / cookie expiré (401) :
      // c'est un état normal "non connecté", pas une erreur à afficher.
      const data = await fetchMe();
      if (data?.user) {
        setUser({ userId: data.user.userId, role: data.user.role });
      } else {
        setUser(null);
      }
    } catch (err) {
      // Ici uniquement pour les vraies erreurs (500, réseau, etc.)
      console.error("Erreur lors du chargement de l'utilisateur:", err);
      setUser(null);
      setError(
        err instanceof Error ? err.message : "Erreur d'authentification",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  const logout = useCallback(async () => {
    try {
      await logoutUser();
    } catch (err) {
      console.error("Erreur lors de la déconnexion:", err);
    }
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        error,
        isAuthenticated: !!user,
        refetch: loadUser,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth doit être utilisé à l'intérieur d'un AuthProvider");
  }
  return context;
}