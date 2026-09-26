import { fetchMe } from "./auth";

export async function fetchActiveLevel() {
  try {
    const response = await fetch("http://localhost:1919/api/severities", {
      credentials: "include",
    });
    const data = await response.json();

    console.log("fetchActiveLevel response data:", data);
    return data;
  } catch (error) {
    console.error("Error fetching active level:", error);
    return { success: false, message: "Impossible de récupérer le niveau de sévérité." };
  }
}

export async function changeSeverityLevel(newLevel: number) {
  try {
    const user = await fetchMe();

    // fetchMe renvoie null si l'utilisateur n'est pas connecté (401)
    if (!user || !user.user) {
      throw new Error("Utilisateur non connecté.");
    }

    const { role } = user.user;

    if (role !== "CD") {
      throw new Error(
        "Vous n'avez pas la permission de modifier le niveau de sévérité.",
      );
    }

    const response = await fetch("http://localhost:1919/api/severities", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ severity: newLevel }),
      credentials: "include", // indispensable pour envoyer le cookie httpOnly au backend
    });

    const data = await response.json();
    console.log("changeSeverityLevel response data:", data);
    return data;
  } catch (error) {
    console.error("Error changing severity level:", error);
    return { success: false, message: "Impossible de modifier le niveau de sévérité." };
  }
}