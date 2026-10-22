import { createContext, useContext, useEffect, useState } from "react";
import { api, getToken, setToken } from "./api";

const AuthContext = createContext(null);

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  const [utilisateur, setUtilisateur] = useState(null);
  const [chargement, setChargement] = useState(Boolean(getToken()));

  useEffect(() => {
    if (!getToken()) return;
    api("/auth/me")
      .then(setUtilisateur)
      .catch(() => setToken(null))
      .finally(() => setChargement(false));
  }, []);

  useEffect(() => {
    const expirer = () => setUtilisateur(null);
    window.addEventListener("session-expiree", expirer);
    return () => window.removeEventListener("session-expiree", expirer);
  }, []);

  const connexion = async (email, mot_de_passe) => {
    const reponse = await api("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, mot_de_passe }),
    });
    setToken(reponse.access_token);
    setUtilisateur(reponse.utilisateur);
  };

  const deconnexion = () => {
    setToken(null);
    setUtilisateur(null);
  };

  const aRole = (...roles) => Boolean(utilisateur) && roles.includes(utilisateur.role);

  return (
    <AuthContext.Provider value={{ utilisateur, chargement, connexion, deconnexion, aRole }}>
      {children}
    </AuthContext.Provider>
  );
}