import { useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { Alerte } from "../components/ui";

export default function MotDePasseOublie() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [erreur, setErreur] = useState("");
  const [enCours, setEnCours] = useState(false);

  const soumettre = async (e) => {
    e.preventDefault();
    setErreur("");
    setEnCours(true);
    try {
      const reponse = await api("/auth/mot-de-passe-oublie", {
        method: "POST",
        body: JSON.stringify({ email: email.trim() }),
      });
      setMessage(reponse.message);
    } catch (err) {
      setErreur(err.message);
    } finally {
      setEnCours(false);
    }
  };

  return (
    <div className="ecran-login">
      <form className="carte-login" onSubmit={soumettre}>
        <div className="marque-logo grand">A</div>
        <h1>Mot de passe oublié</h1>
        <p className="sous-titre">
          Saisissez votre adresse email : nous vous enverrons un lien de réinitialisation.
        </p>

        {message && <Alerte type="succes">{message}</Alerte>}
        {erreur && <Alerte type="erreur">{erreur}</Alerte>}

        {!message && (
          <>
            <div className="champ">
              <label htmlFor="email">Adresse email</label>
              <input id="email" type="email" autoComplete="username" value={email}
                     onChange={(e) => setEmail(e.target.value)} required autoFocus />
            </div>
            <button type="submit" disabled={enCours}>
              {enCours ? "Envoi…" : "Envoyer le lien"}
            </button>
          </>
        )}

        <p className="pied-carte">
          <Link to="/" className="lien">Retour à la connexion</Link>
        </p>
      </form>
    </div>
  );
}