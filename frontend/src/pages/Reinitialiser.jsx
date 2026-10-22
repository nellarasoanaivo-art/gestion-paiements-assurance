import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../api";
import { Alerte } from "../components/ui";

export default function Reinitialiser() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get("token");

  const [motDePasse, setMotDePasse] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [erreur, setErreur] = useState("");
  const [enCours, setEnCours] = useState(false);

  const soumettre = async (e) => {
    e.preventDefault();
    setErreur("");
    if (motDePasse !== confirmation) {
      setErreur("Les deux mots de passe ne correspondent pas.");
      return;
    }
    setEnCours(true);
    try {
      await api("/auth/reinitialiser-mot-de-passe", {
        method: "POST",
        body: JSON.stringify({ token, mot_de_passe: motDePasse }),
      });
      navigate("/", {
        replace: true,
        state: { message: "Mot de passe modifié. Vous pouvez maintenant vous connecter." },
      });
    } catch (err) {
      setErreur(err.message);
      setEnCours(false);
    }
  };

  if (!token) {
    return (
      <div className="ecran-login">
        <div className="carte-login">
          <div className="marque-logo grand">A</div>
          <h1>Lien invalide</h1>
          <Alerte type="erreur">Ce lien de réinitialisation est incomplet.</Alerte>
          <Link to="/mot-de-passe-oublie" className="lien" style={{ textAlign: "center" }}>
            Refaire une demande
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="ecran-login">
      <form className="carte-login" onSubmit={soumettre}>
        <div className="marque-logo grand">A</div>
        <h1>Nouveau mot de passe</h1>
        <p className="sous-titre">Choisissez un nouveau mot de passe (8 caractères minimum).</p>

        {erreur && <Alerte type="erreur">{erreur}</Alerte>}

        <div className="champ">
          <label htmlFor="mdp">Nouveau mot de passe</label>
          <input id="mdp" type="password" minLength={8} autoComplete="new-password"
                 value={motDePasse} onChange={(e) => setMotDePasse(e.target.value)}
                 required autoFocus />
        </div>
        <div className="champ">
          <label htmlFor="confirmation">Confirmer le mot de passe</label>
          <input id="confirmation" type="password" minLength={8} autoComplete="new-password"
                 value={confirmation} onChange={(e) => setConfirmation(e.target.value)} required />
        </div>

        <button type="submit" disabled={enCours}>
          {enCours ? "Enregistrement…" : "Enregistrer le mot de passe"}
        </button>

        <p className="pied-carte">
          <Link to="/" className="lien">Retour à la connexion</Link>
        </p>
      </form>
    </div>
  );
}