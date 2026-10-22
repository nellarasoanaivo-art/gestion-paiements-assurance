const API_URL = "http://127.0.0.1:8000";
const CLE_TOKEN = "assurance_token";

export const getToken = () => localStorage.getItem(CLE_TOKEN);
export const setToken = (token) =>
  token ? localStorage.setItem(CLE_TOKEN, token) : localStorage.removeItem(CLE_TOKEN);

export async function api(chemin, options = {}) {
  const token = getToken();
  let reponse;
  try {
    reponse = await fetch(API_URL + chemin, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: "Bearer " + token } : {}),
        ...options.headers,
      },
    });
  } catch {
    throw new Error("Impossible de joindre le serveur. Vérifiez que l'API est démarrée.");
  }

  if (reponse.status === 204) return null;
  const donnees = await reponse.json().catch(() => null);

  if (!reponse.ok) {
    if (reponse.status === 401 && token) {
      setToken(null);
      window.dispatchEvent(new Event("session-expiree"));
    }
    let message = "Erreur " + reponse.status;
    if (donnees && typeof donnees.detail === "string") {
      message = donnees.detail;
    } else if (donnees && Array.isArray(donnees.detail)) {
      message = donnees.detail
        .map((d) => {
          const champ = d.loc.slice(1).join(".");
          return (champ ? champ + " : " : "") + d.msg.replace(/^Value error, /, "");
        })
        .join(" | ");
    }
    throw new Error(message);
  }
  return donnees;
}

export const formaterMontant = (valeur) =>
  Number(valeur).toLocaleString("fr-FR") + " Ar";