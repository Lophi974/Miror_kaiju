// URL du backend, définie dans .env (local) et dans les variables
// d'environnement Vercel (production). NEXT_PUBLIC_ : lue côté navigateur.
export const API_URL = process.env.NEXT_PUBLIC_API_URL;

if (!API_URL) {
  console.error("NEXT_PUBLIC_API_URL n'est pas définie : les appels au backend vont échouer.");
}
