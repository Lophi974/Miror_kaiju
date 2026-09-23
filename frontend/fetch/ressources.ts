

export async function fetchRessourcesByQuarter(quarterId: string) {

    try{
        console.log("Fetching resources for quarter:", quarterId);
        const response = await fetch(`http://localhost:1919/api/ressources/quarter/${quarterId}`);
        const data = await response.json();
        console.log("fetchRessourcesByQuarter response data:", data);
        return data;
    } catch (error) {
        console.error("Error fetching resources by quarter:", error);
        return { success: false, message: "Error fetching resources by quarter" };
    }

}

export async function fetchAllQuarter() {
    try{
        console.log("Fetching all quarters");
        const response = await fetch(`http://localhost:1919/api/ressources/quarters`);
        const data = await response.json();
        console.log("fetchAllQuarter response data:", data);
        return data;
    } catch (error) {
        console.error("Error fetching all quarters:", error);
        return { success: false, message: "Error fetching all quarters" };
    }
}