import { useEffect, useState } from "react";
import { api } from "../api";
import { useAuth } from "../AuthContext";
import { libelle } from "../libelles";
import { Alerte, Badge, Modal } from "../components/ui";

const VIDE = { nom: "", prenom: "", email: "", id_role: "", mot_de_passe: "" };

export default function Utilisateurs() {
  const { utilisateur: moi } = useAuth();
  const [utilisateurs, setUtilisateurs] = useState([]);
  const [roles, setRoles] = useState([]);
  const [form, setForm] = useState(VIDE);
  const [formulaireOuvert, setFormulaireOuvert] = useState(false);
  const [erreurFormulaire, setErreurFormulaire] = useState("");
  const [cible, setCible] = useState(null);
  const [nouveauMdp, setNouveauMdp] = useState("");
  const [erreurMdp, setErreurMdp] = useState("");
  const [erreur, setErreur] = useState("");
  const [succes, setSucces] = useState("");

  const charger = () =>
    Promise.all([api("/utilisateurs"), api("/roles")])
      .then(([u, r]) => {
        setUtilisateurs(u);
        setRoles(r);
      })
      .catch((e) => setErreur(e.message));

  useEffect(() => {
    charger();
  }, []);

  const changer = (e) => setForm({ ...form, [e.target.name]: e.target.value });
  const inactifs = utilisateurs.filter((u) => !u.actif).length;

  const creer = async (e) => {
    e.preventDefault();
    setErreurFormulaire("");
    setSucces("");
    try {
      await api("/utilisateurs", {
        method: "POST",
        body: JSON.stringify({ ...form, id_role: Number(form.id_role) }),
      });
      setFormulaireOuvert(false);
      setForm(VIDE);
      setSucces("Utilisateur créé.");
      charger();
    } catch (err) {
      setErreurFormulaire(err.message);
    }
  };

  const basculer = async (u) => {
    setErreur("");
    setSucces("");
    try {
      await api("/utilisateurs/" + u.id_utilisateur + "/actif", { method: "PATCH" });
      setSucces(u.actif ? "Compte désactivé." : "Compte activé.");
      charger();
    } catch (err) {
      setErreur(err.message);
    }
  };

  const changerRole = async (u, idRole) => {
    setErreur("");
    setSucces("");
    try {
      await api("/utilisateurs/" + u.id_utilisateur + "/role", {
        method: "PATCH",
        body: JSON.stringify({ id_role: idRole }),
      });
      setSucces("Rôle de " + u.prenom + " " + u.nom + " modifié.");
      charger();
    } catch (err) {
      setErreur(err.message);
    }
  };

  const reinitialiser = async (e) => {
    e.preventDefault();
    setErreurMdp("");
    try {
      await api("/utilisateurs/" + cible.id_utilisateur + "/mot-de-passe", {
        method: "PUT",
        body: JSON.stringify({ mot_de_passe: nouveauMdp }),
      });
      setSucces("Mot de passe de " + cible.prenom + " " + cible.nom + " réinitialisé.");
      setCible(null);
      setNouveauMdp("");
    } catch (err) {
      setErreurMdp(err.message);
    }
  };

  return (
    <>
      <div className="entete-page">
        <div>
          <h2>Utilisateurs</h2>
          <p className="sous-titre">Comptes et rôles d'accès</p>
        </div>
        <button onClick={() => { setForm(VIDE); setErreurFormulaire(""); setFormulaireOuvert(true); }}>
          + Nouvel utilisateur
        </button>
      </div>

      {erreur && <Alerte type="erreur">{erreur}</Alerte>}
      {succes && <Alerte type="succes">{succes}</Alerte>}
      {inactifs > 0 && (
        <Alerte type="info">
          {inactifs} compte(s) inactif(s) (en attente de validation ou désactivés) :
          vérifiez le rôle, puis cliquez sur « Activer ».
        </Alerte>
      )}

      <div className="carte">
        <div className="tableau-conteneur">
          <table>
            <thead>
              <tr><th>Nom</th><th>Email</th><th>Rôle</th><th>Compte</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {utilisateurs.map((u) => (
                <tr key={u.id_utilisateur}>
                  <td>{u.prenom} {u.nom}</td>
                  <td>{u.email}</td>
                  <td>
                    {u.id_utilisateur === moi.id_utilisateur ? (
                      <Badge valeur={u.role} />
                    ) : (
                      <select
                        className="petit"
                        value={roles.find((r) => r.libelle === u.role)?.id_role ?? ""}
                        onChange={(e) => changerRole(u, Number(e.target.value))}
                      >
                        {roles.map((r) => (
                          <option key={r.id_role} value={r.id_role}>{libelle(r.libelle)}</option>
                        ))}
                      </select>
                    )}
                  </td>
                  <td>
                    <span className={"badge " + (u.actif ? "ton-succes" : "ton-attention")}>
                      {u.actif ? "Actif" : "Inactif"}
                    </span>
                  </td>
                  <td className="actions">
                    <button className="secondaire petit"
                            onClick={() => { setCible(u); setNouveauMdp(""); setErreurMdp(""); }}>
                      Mot de passe
                    </button>
                    {u.id_utilisateur !== moi.id_utilisateur && (
                      <button className={(u.actif ? "danger" : "") + " petit"} onClick={() => basculer(u)}>
                        {u.actif ? "Désactiver" : "Activer"}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {formulaireOuvert && (
        <Modal titre="Nouvel utilisateur" onFermer={() => setFormulaireOuvert(false)}>
          {erreurFormulaire && <Alerte type="erreur">{erreurFormulaire}</Alerte>}
          <form onSubmit={creer}>
            <div className="grille-formulaire">
              <div className="champ">
                <label htmlFor="nom">Nom *</label>
                <input id="nom" name="nom" value={form.nom} onChange={changer} required />
              </div>
              <div className="champ">
                <label htmlFor="prenom">Prénom *</label>
                <input id="prenom" name="prenom" value={form.prenom} onChange={changer} required />
              </div>
              <div className="champ pleine">
                <label htmlFor="email">Email *</label>
                <input id="email" name="email" type="email" value={form.email} onChange={changer} required />
              </div>
              <div className="champ">
                <label htmlFor="role">Rôle *</label>
                <select id="role" name="id_role" value={form.id_role} onChange={changer} required>
                  <option value="">Choisir un rôle</option>
                  {roles.map((r) => (
                    <option key={r.id_role} value={r.id_role}>{libelle(r.libelle)}</option>
                  ))}
                </select>
              </div>
              <div className="champ">
                <label htmlFor="mdp">Mot de passe * (8 caractères min.)</label>
                <input id="mdp" name="mot_de_passe" type="password" minLength={8}
                       value={form.mot_de_passe} onChange={changer} required autoComplete="new-password" />
              </div>
            </div>
            <div className="modal-actions">
              <button type="button" className="secondaire" onClick={() => setFormulaireOuvert(false)}>Annuler</button>
              <button type="submit">Créer</button>
            </div>
          </form>
        </Modal>
      )}

      {cible && (
        <Modal titre={"Nouveau mot de passe : " + cible.prenom + " " + cible.nom}
               onFermer={() => setCible(null)}>
          {erreurMdp && <Alerte type="erreur">{erreurMdp}</Alerte>}
          <form onSubmit={reinitialiser}>
            <div className="champ">
              <label htmlFor="nmdp">Nouveau mot de passe (8 caractères min.)</label>
              <input id="nmdp" type="password" minLength={8} value={nouveauMdp}
                     onChange={(e) => setNouveauMdp(e.target.value)} required autoComplete="new-password" />
            </div>
            <div className="modal-actions">
              <button type="button" className="secondaire" onClick={() => setCible(null)}>Annuler</button>
              <button type="submit">Enregistrer</button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}