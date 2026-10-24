import { useEffect, useMemo, useState } from "react";
import { api } from "../api";
import { formaterDate } from "../libelles";
import { Alerte, Modal } from "../components/ui";

const LIMITE_NAISSANCE = "2006-12-31";
const REGEX_EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const SEXES = { F: "Femme", M: "Homme" };

const VIDE = {
  nom: "", prenom: "", sexe: "", cin: "", date_naissance: "",
  email: "", telephone: "", adresse: "", ville: "", code_postal: "",
};


const capitaliser = (v) =>
  v.replace(/[^\s\-']+/g, (m) => m[0].toUpperCase() + m.slice(1).toLowerCase());

const normaliserTelephone = (v) => {
  let t = v.replace(/[\s.\-()]/g, "");
  if (t.startsWith("+261")) t = "0" + t.slice(4);
  else if (t.startsWith("00261")) t = "0" + t.slice(5);
  return t;
};

function valider(f, clients, idEdition) {
  const e = {};
  const autres = clients.filter((c) => c.id_client !== idEdition);
  const nom = f.nom.trim();
  const prenom = f.prenom.trim();

  if (!nom) e.nom = "Le nom est obligatoire.";
  if (!prenom) e.prenom = "Le prénom est obligatoire.";
  else if (nom && autres.some((c) =>
    c.nom.toLowerCase() === nom.toLowerCase() && c.prenom.toLowerCase() === prenom.toLowerCase()))
    e.prenom = "Un client avec ce nom et ce prénom existe déjà.";

  if (!f.sexe) e.sexe = "Choisissez le sexe.";

  if (!f.date_naissance) e.date_naissance = "La date de naissance est obligatoire.";
  else if (f.date_naissance > LIMITE_NAISSANCE)
    e.date_naissance = "Date de naissance : 31/12/2006 au plus tard.";
  else if (f.date_naissance < "1900-01-01") e.date_naissance = "Date de naissance invalide.";

  if (!f.cin) e.cin = "Le numéro CIN est obligatoire.";
  else if (f.cin.length < 12) e.cin = `Le CIN doit comporter 12 chiffres (${f.cin.length}/12).`;
  else if (!f.sexe) e.cin = "Choisissez le sexe pour vérifier le CIN.";
  else {
    const attendu = f.sexe === "F" ? "2" : "1";
    if (f.cin[5] !== attendu)
      e.cin = `Le 6ᵉ chiffre du CIN doit être ${attendu} pour ${f.sexe === "F" ? "une femme" : "un homme"}.`;
    else {
      const doublon = autres.find((c) => c.cin === f.cin);
      if (doublon) e.cin = `Ce CIN est déjà enregistré (${doublon.nom} ${doublon.prenom}).`;
    }
  }
  if (f.cin && f.cin.length >= 6 && !f.sexe && !e.cin) e.cin = "Choisissez le sexe pour vérifier le CIN.";

  const email = f.email.trim().toLowerCase();
  if (!email) e.email = "L'email est obligatoire.";
  else if (!REGEX_EMAIL.test(email)) e.email = "Format invalide : exemple@gmail.com";
  else if (autres.some((c) => (c.email || "").toLowerCase() === email))
    e.email = "Cet email est déjà utilisé par un autre client.";

  const tel = normaliserTelephone(f.telephone);
  if (!f.telephone.trim()) e.telephone = "Le téléphone est obligatoire.";
  else if (!/^0\d{9}$/.test(tel)) e.telephone = "Numéro invalide (exemple : 034 12 345 67).";
  else if (autres.some((c) => c.telephone === tel))
    e.telephone = "Ce numéro est déjà utilisé par un autre client.";

  return e;
}

export default function Clients() {
  const [clients, setClients] = useState([]);
  const [recherche, setRecherche] = useState("");
  const [form, setForm] = useState(VIDE);
  const [formulaireOuvert, setFormulaireOuvert] = useState(false);
  const [idEdition, setIdEdition] = useState(null);
  const [soumis, setSoumis] = useState(false);
  const [erreurFormulaire, setErreurFormulaire] = useState("");
  const [aSupprimer, setASupprimer] = useState(null);
  const [erreur, setErreur] = useState("");
  const [succes, setSucces] = useState("");

  const charger = () =>
    api("/clients").then(setClients).catch((e) => setErreur(e.message));

  useEffect(() => {
    charger();
  }, []);

  const erreurs = valider(form, clients, idEdition);
  const voir = (nom) => (soumis || form[nom] !== "") && erreurs[nom];

  const visibles = useMemo(() => {
    const t = recherche.trim().toLowerCase();
    if (!t) return clients;
    return clients.filter((c) =>
      [c.nom, c.prenom, c.email, c.telephone, c.cin, c.ville]
        .filter(Boolean).join(" ").toLowerCase().includes(t)
    );
  }, [clients, recherche]);

  const changer = (e) => {
    const { name, value } = e.target;
    let v = value;
    if (name === "nom") v = value.toUpperCase();
    if (name === "prenom") v = capitaliser(value);
    if (name === "cin") v = value.replace(/\D/g, "").slice(0, 12);
    if (name === "telephone") v = value.replace(/[^\d+\s.\-]/g, "").slice(0, 20);
    if (name === "email") v = value.replace(/\s/g, "");
    setForm({ ...form, [name]: v });
  };

  const ouvrirCreation = () => {
    setForm(VIDE);
    setIdEdition(null);
    setSoumis(false);
    setErreurFormulaire("");
    setFormulaireOuvert(true);
  };

  const ouvrirModification = (c) => {
    setForm({
      nom: c.nom, prenom: c.prenom, sexe: c.sexe || "", cin: c.cin || "",
      date_naissance: c.date_naissance || "", email: c.email || "",
      telephone: c.telephone || "", adresse: c.adresse || "",
      ville: c.ville || "", code_postal: c.code_postal || "",
    });
    setIdEdition(c.id_client);
    setSoumis(false);
    setErreurFormulaire("");
    setFormulaireOuvert(true);
  };

  const enregistrer = async (e) => {
    e.preventDefault();
    setSoumis(true);
    setErreurFormulaire("");
    setSucces("");
    if (Object.keys(erreurs).length > 0) return;

    const donnees = {
      nom: form.nom.trim(),
      prenom: form.prenom.trim(),
      sexe: form.sexe,
      cin: form.cin,
      date_naissance: form.date_naissance,
      email: form.email.trim().toLowerCase(),
      telephone: normaliserTelephone(form.telephone),
      adresse: form.adresse.trim() || null,
      ville: form.ville.trim() || null,
      code_postal: form.code_postal.trim() || null,
    };
    try {
      if (idEdition) {
        await api("/clients/" + idEdition, { method: "PUT", body: JSON.stringify(donnees) });
        setSucces("Client modifié.");
      } else {
        await api("/clients", { method: "POST", body: JSON.stringify(donnees) });
        setSucces("Client ajouté.");
      }
      setFormulaireOuvert(false);
      charger();
    } catch (err) {
      setErreurFormulaire(err.message);
    }
  };

  const confirmerSuppression = async () => {
    setErreur("");
    setSucces("");
    try {
      await api("/clients/" + aSupprimer.id_client, { method: "DELETE" });
      setSucces("Client supprimé.");
      charger();
    } catch (err) {
      setErreur(err.message);
    } finally {
      setASupprimer(null);
    }
  };

  const champ = (name, label, { pleine, aide, ...props } = {}) => (
    <div className={"champ" + (pleine ? " pleine" : "") + (voir(name) ? " invalide" : "")}>
      <label htmlFor={name}>{label}</label>
      <input id={name} name={name} value={form[name]} onChange={changer} {...props} />
      {voir(name) ? <span className="msg-erreur">{erreurs[name]}</span>
        : aide && <span className="aide">{aide}</span>}
    </div>
  );

  return (
    <>
      <div className="entete-page">
        <div>
          <h2>Clients</h2>
          <p className="sous-titre">{clients.length} client(s) enregistré(s)</p>
        </div>
        <button onClick={ouvrirCreation}>+ Nouveau client</button>
      </div>

      {erreur && <Alerte type="erreur">{erreur}</Alerte>}
      {succes && <Alerte type="succes">{succes}</Alerte>}

      <div className="carte">
        <div className="barre-outils">
          <input type="search" placeholder="Rechercher (nom, CIN, téléphone, email…)"
                 value={recherche} onChange={(e) => setRecherche(e.target.value)} />
        </div>
        <div className="tableau-conteneur">
          <table>
            <thead>
              <tr>
                <th>N°</th><th>Nom</th><th>Prénom(s)</th><th>Sexe</th><th>CIN</th>
                <th>Né(e) le</th><th>Téléphone</th><th>Email</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {visibles.map((c) => (
                <tr key={c.id_client}>
                  <td>{c.id_client}</td>
                  <td><strong>{c.nom}</strong></td>
                  <td>{c.prenom}</td>
                  <td>{SEXES[c.sexe] || "—"}</td>
                  <td>{c.cin || "—"}</td>
                  <td>{formaterDate(c.date_naissance)}</td>
                  <td>{c.telephone}</td>
                  <td>{c.email}</td>
                  <td className="actions">
                    <button className="secondaire petit" onClick={() => ouvrirModification(c)}>Modifier</button>
                    <button className="danger petit" onClick={() => setASupprimer(c)}>Supprimer</button>
                  </td>
                </tr>
              ))}
              {visibles.length === 0 && (
                <tr><td colSpan="9" className="vide">Aucun client.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {formulaireOuvert && (
        <Modal titre={idEdition ? "Modifier le client" : "Nouveau client"} large
               onFermer={() => setFormulaireOuvert(false)}>
          {erreurFormulaire && <Alerte type="erreur">{erreurFormulaire}</Alerte>}
          <form onSubmit={enregistrer} noValidate>
            <div className="grille-formulaire">
              {champ("nom", "Nom *", { aide: "Mis en majuscules automatiquement." })}
              {champ("prenom", "Prénom(s) *", { aide: "Première lettre de chaque prénom en majuscule." })}

              <div className={"champ" + (soumis && erreurs.sexe ? " invalide" : "")}>
                <label>Sexe *</label>
                <div className="groupe-radio">
                  <label>
                    <input type="radio" name="sexe" value="F" checked={form.sexe === "F"} onChange={changer} />
                    Femme
                  </label>
                  <label>
                    <input type="radio" name="sexe" value="M" checked={form.sexe === "M"} onChange={changer} />
                    Homme
                  </label>
                </div>
                {soumis && erreurs.sexe && <span className="msg-erreur">{erreurs.sexe}</span>}
              </div>

              {champ("date_naissance", "Date de naissance *", {
                type: "date", min: "1900-01-01", max: LIMITE_NAISSANCE,
                aide: "Naissance en 2006 au plus tard.",
              })}

              {champ("cin", "N° CIN *", {
                inputMode: "numeric", placeholder: "12 chiffres",
                aide: "6ᵉ chiffre : 1 = homme, 2 = femme.",
              })}
              {champ("telephone", "Téléphone *", { placeholder: "034 12 345 67", inputMode: "tel" })}
              {champ("email", "Email *", { type: "email", placeholder: "exemple@gmail.com", pleine: true })}
              {champ("adresse", "Adresse", { pleine: true })}
              {champ("ville", "Ville")}
              {champ("code_postal", "Code postal")}
            </div>
            <div className="modal-actions">
              <button type="button" className="secondaire" onClick={() => setFormulaireOuvert(false)}>Annuler</button>
              <button type="submit">{idEdition ? "Enregistrer" : "Ajouter"}</button>
            </div>
          </form>
        </Modal>
      )}

      {aSupprimer && (
        <Modal titre="Supprimer le client" onFermer={() => setASupprimer(null)}>
          <p>Voulez-vous vraiment supprimer <strong>{aSupprimer.nom} {aSupprimer.prenom}</strong> ?</p>
          <div className="modal-actions">
            <button className="secondaire" onClick={() => setASupprimer(null)}>Annuler</button>
            <button className="danger" onClick={confirmerSuppression}>Supprimer</button>
          </div>
        </Modal>
      )}
    </>
  );
}