import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../AuthContext";
import { Alerte } from "../components/ui";

export default function Login() {
  const { connexion } = useAuth();
  const location = useLocation();
  const message = location.state?.message;
  const [email, setEmail] = useState("");
  const [motDePasse, setMotDePasse] = useState("");
  const [erreur, setErreur] = useState("");
  const [enCours, setEnCours] = useState(false);

  const soumettre = async (e) => {
    e.preventDefault();
    setErreur("");
    setEnCours(true);
    try {
      await connexion(email.trim(), motDePasse);
    } catch (err) {
      setErreur(err.message);
      setEnCours(false);
    }
  };

  return (
    <div className="ecran-login">
      <form className="carte-login" onSubmit={soumettre}>
        <div className="marque-logo grand">A</div>
        <h1>Gestion des paiements d'assurances</h1>
        <p className="sous-titre">Connectez-vous pour accéder à votre espace.</p>

        {message && <Alerte type="succes">{message}</Alerte>}
        {erreur && <Alerte type="erreur">{erreur}</Alerte>}

        <div className="champ">
          <label htmlFor="email">Adresse email</label>
          <input id="email" type="email" autoComplete="username" value={email}
                 onChange={(e) => setEmail(e.target.value)} required autoFocus />
        </div>
        <div className="champ">
          <label htmlFor="mdp">Mot de passe</label>
          <input id="mdp" type="password" autoComplete="current-password" value={motDePasse}
                 onChange={(e) => setMotDePasse(e.target.value)} required />
        </div>

        <div className="ligne-liens">
          <Link to="/mot-de-passe-oublie" className="lien">Mot de passe oublié ?</Link>
        </div>

        <button type="submit" disabled={enCours}>
          {enCours ? "Connexion…" : "Se connecter"}
        </button>

        <p className="pied-carte">
          Pas encore de compte ? <Link to="/inscription" className="lien">Créer un compte</Link>
        </p>
      </form>
    </div>
  );
}