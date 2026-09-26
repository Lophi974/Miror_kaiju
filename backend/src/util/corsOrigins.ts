import dotenv from "dotenv";

dotenv.config();

// Origines autorisées à appeler l'API et le socket, séparées par des virgules :
// CORS_ORIGINS="http://localhost:9001,https://miror-kaiju.vercel.app"
export const CORS_ORIGINS = (process.env.CORS_ORIGINS ?? "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

if (CORS_ORIGINS.length === 0) {
  console.error("CORS_ORIGINS n'est pas définie : aucun front ne pourra appeler l'API.");
}
