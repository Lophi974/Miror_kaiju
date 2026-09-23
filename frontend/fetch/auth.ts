type LoginPayload = {
  email: string;
  password: string;
};

type LoginResponse = {
  success: boolean;
  message: string;
  token?: string; // renvoyé dans le body par ton backend, mais inutile côté front
};

export async function loginUser(payload: LoginPayload): Promise<LoginResponse> {
  const response = await fetch("http://localhost:1919/api/auth/login", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
    credentials: "include", // indispensable : autorise le navigateur à accepter/stocker le cookie httpOnly renvoyé par Set-Cookie
  });

  const data = (await response.json()) as LoginResponse;

  if (!response.ok) {
    throw new Error(data.message ?? "Identifiants invalides.");
  }

  // Le cookie httpOnly "token" est déjà posé par le navigateur via l'en-tête Set-Cookie.
  // On ne le stocke plus nous-mêmes : il sera renvoyé automatiquement
  // à chaque requête faite avec credentials: "include".
  return data;
}

export type MeResponse = {
  user?: { userId: string; role: string; name: string; quarterId: string | null };
  message?: string;
};

/**
 * Retourne les infos de l'utilisateur connecté, ou `null` si non connecté
 * (401 = pas de cookie ou cookie expiré, ce n'est pas une "vraie" erreur).
 * Lève une erreur uniquement pour les cas anormaux (500, réseau, etc.).
 */
export async function fetchMe(): Promise<MeResponse | null> {
  const response = await fetch("http://localhost:1919/api/auth/me", {
    method: "GET",
    credentials: "include", // envoie automatiquement le cookie httpOnly
  });

  if (response.status === 401) {
    return null;
  }

  const data = (await response.json()) as MeResponse;

  if (!response.ok) {
    throw new Error(
      data.message ??
        "Erreur lors de la récupération des informations de l'utilisateur.",
    );
  }

  return data;
}

/**
 * Nécessite une route backend /api/auth/logout qui fait
 * res.clearCookie("token") pour invalider le cookie côté navigateur.
 */
export async function logoutUser(): Promise<void> {
  await fetch("http://localhost:1919/api/auth/logout", {
    method: "POST",
    credentials: "include",
  });
}