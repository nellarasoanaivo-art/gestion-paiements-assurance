import { useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { Alerte } from "../components/ui";

const VIDE = { nom: "", prenom: "", email: "", mot_de_passe: "", confirmation: "" };

export default function Inscription() {
  const [form, setForm] = useState(VIDE);
  const [erreur, setErreur] = useState("");
  const [message, setMessage] = useState("");
  const [enCours, setEnCours] = useState(false);

  const changer = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const soumettre = async (e) => {
    e.preventDefault();
    setErreur("");
    if (form.mot_de_passe !== form.confirmation) {
      setErreur("Les deux mots de passe ne correspondent pas.");
      return;
    }
    setEnCours(true);
    try {
      const reponse = await api("/auth/inscription", {
        method: "POST",
        body: JSON.stringify({
          nom: form.nom.trim(),
          prenom: form.prenom.trim(),
          email: form.email.trim(),
          mot_de_passe: form.mot_de_passe,
        }),
      });
      setMessage(reponse.message);
    } catch (err) {
      setErreur(err.message);
    } finally {
      setEnCours(false);
    }
  };

  if (message) {
    return (
      <div className="ecran-login">
        <div className="carte-login">
          <div className="marque-logo grand">A</div>
          <h1>Demande envoyée</h1>
          <Alerte type="succes">{message}</Alerte>
          <Link to="/" className="lien" style={{ textAlign: "center" }}>
            Retour à la connexion
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="ecran-login">
      <form className="carte-login" onSubmit={soumettre}>
        <div className="marque-logo grand">A</div>
        <h1>Créer un compte</h1>
        <p className="sous-titre">
          Votre compte sera activé après validation par un administrateur.
        </p>

        {erreur && <Alerte type="erreur">{erreur}</Alerte>}

        <div className="champ">
          <label htmlFor="nom">Nom</label>
          <input id="nom" name="nom" value={form.nom} onChange={changer} required autoFocus />
        </div>
        <div className="champ">
          <label htmlFor="prenom">Prénom</label>
          <input id="prenom" name="prenom" value={form.prenom} onChange={changer} required />
        </div>
        <div className="champ">
          <label htmlFor="email">Adresse email</label>
          <input id="email" name="email" type="email" autoComplete="username"
                 value={form.email} onChange={changer} required />
        </div>
        <div className="champ">
          <label htmlFor="mdp">Mot de passe</label>
          <input id="mdp" name="mot_de_passe" type="password" minLength={8}
                 autoComplete="new-password" value={form.mot_de_passe}
                 onChange={changer} required />
          <span className="aide">8 caractères minimum.</span>
        </div>
        <div className="champ">
          <label htmlFor="confirmation">Confirmer le mot de passe</label>
          <input id="confirmation" name="confirmation" type="password" minLength={8}
                 autoComplete="new-password" value={form.confirmation}
                 onChange={changer} required />
        </div>

        <button type="submit" disabled={enCours}>
          {enCours ? "Envoi…" : "Créer mon compte"}
        </button>

        <p className="pied-carte">
          Vous avez déjà un compte ? <Link to="/" className="lien">Se connecter</Link>
        </p>
      </form>
    </div>
  );
}