import { API_URL } from "./config";

export async function fetchRessourcesByQuarter(quarterId: string) {

    try{
        const response = await fetch(`${API_URL}/api/ressources/quarter/${quarterId}`);
        const data = await response.json();
        return data;
    } catch (error) {
        console.error("Error fetching resources by quarter:", error);
        return { success: false, message: "Impossible de récupérer les ressources du quartier." };
    }

}

export async function fetchAllQuarter() {
    try{
        const response = await fetch(`${API_URL}/api/ressources/quarters`);
        const data = await response.json();
        return data;
    } catch (error) {
        console.error("Error fetching all quarters:", error);
        return { success: false, message: "Impossible de récupérer les quartiers." };
    }
}

// Seuil de rétention global (CD, niveau 5) : entre 15 et 30 %, appliqué à
// tous les quartiers.
export async function updateThreshold(thresholdPercent: number) {
    try{
        const response = await fetch(`${API_URL}/api/ressources/threshold`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ thresholdPercent }),
            credentials: "include",
        });
        const data = await response.json();
        return data;
    } catch (error) {
        console.error("Error updating threshold:", error);
        return { success: false, message: "Impossible de modifier le seuil de rétention." };
    }
}

// Ids des quartiers adjacents (un QC ne peut demander qu'à ceux-là).
export async function fetchAdjacentQuarters(quarterId: string) {
    try{
        const response = await fetch(`${API_URL}/api/ressources/quarter/${quarterId}/adjacent`, {
            credentials: "include",
        });
        const data = await response.json();
        return data;
    } catch (error) {
        console.error("Error fetching adjacent quarters:", error);
        return { success: false, message: "Impossible de récupérer les quartiers adjacents." };
    }
}
