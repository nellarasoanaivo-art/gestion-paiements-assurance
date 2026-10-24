import { useEffect, useState } from "react";
import { api, formaterMontant } from "../api";
import { formaterDate, formaterDateHeure } from "../libelles";
import { Alerte, Badge, Modal } from "../components/ui";

const TRANSITIONS = {
  DECLARE: ["EN_EXPERTISE", "REFUSE"],
  EN_EXPERTISE: ["ACCEPTE", "REFUSE"],
  ACCEPTE: ["CLOTURE"],
  REFUSE: ["CLOTURE"],
  CLOTURE: [],
};

const ACTIONS = {
  EN_EXPERTISE: "Mettre en expertise",
  ACCEPTE: "Accepter",
  REFUSE: "Refuser",
  CLOTURE: "Clôturer",
};

const VIDE = {
  numero_sinistre: "", id_client: "", id_contrat: "",
  date_survenance: "", montant_estime: "", description: "",
};

const aujourdhui = () => {
  const d = new Date();
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" +
    String(d.getDate()).padStart(2, "0");
};

export default function Sinistres() {
  const [sinistres, setSinistres] = useState([]);
  const [contrats, setContrats] = useState([]);
  const [clients, setClients] = useState([]);
  const [modes, setModes] = useState([]);
  const [indemnisations, setIndemnisations] = useState([]);

  const [form, setForm] = useState(VIDE);
  const [declarationOuverte, setDeclarationOuverte] = useState(false);
  const [erreurFormulaire, setErreurFormulaire] = useState("");

  const [aIndemniser, setAIndemniser] = useState(null);
  const [indem, setIndem] = useState({ id_mode_paiement: "", montant: "" });
  const [erreurIndem, setErreurIndem] = useState("");

  const [erreur, setErreur] = useState("");
  const [succes, setSucces] = useState("");

  const charger = () =>
    Promise.all([api("/sinistres"), api("/contrats"), api("/clients"),
                 api("/modes-paiement"), api("/indemnisations")])
      .then(([s, ct, cl, md, ind]) => {
        setSinistres(s);
        setContrats(ct);
        setClients(cl);
        setModes(md);
        setIndemnisations(ind);
      })
      .catch((e) => setErreur(e.message));

  useEffect(() => {
    charger();
  }, []);

  const contratDe = (id) => contrats.find((c) => c.id_contrat === id);
  const nomClient = (id) => {
    const c = clients.find((x) => x.id_client === id);
    return c ? c.nom + " " + c.prenom : "—";
  };
  const clientDuSinistre = (s) => {
    const ct = contratDe(s.id_contrat);
    return ct ? nomClient(ct.id_client) : "—";
  };
  const totalVerse = (idSinistre) =>
    indemnisations
      .filter((i) => i.id_sinistre === idSinistre && i.statut !== "ANNULE")
      .reduce((somme, i) => somme + Number(i.montant), 0);
  const resteAIndemniser = (s) =>
    s.montant_estime != null ? Math.max(0, Number(s.montant_estime) - totalVerse(s.id_sinistre)) : null;


  const contratsDuClient = contrats.filter(
    (c) => String(c.id_client) === form.id_client && c.statut === "ACTIF"
  );
  const contratChoisi = contratDe(Number(form.id_contrat));
  const dateMin = contratChoisi ? contratChoisi.date_debut : undefined;
  const dateMax = contratChoisi && contratChoisi.date_fin < aujourdhui()
    ? contratChoisi.date_fin : aujourdhui();

  const changer = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const changerClient = (e) => {
    const id = e.target.value;
    const actifs = contrats.filter((c) => String(c.id_client) === id && c.statut === "ACTIF");
    setForm({ ...form, id_client: id, id_contrat: actifs.length === 1 ? String(actifs[0].id_contrat) : "" });
  };

  const ouvrirDeclaration = () => {
    const annee = new Date().getFullYear();
    setForm({ ...VIDE, numero_sinistre: "SIN-" + annee + "-" + String(sinistres.length + 1).padStart(3, "0") });
    setErreurFormulaire("");
    setDeclarationOuverte(true);
  };

  const declarer = async (e) => {
    e.preventDefault();
    setErreurFormulaire("");
    setSucces("");
    const donnees = {
      numero_sinistre: form.numero_sinistre.trim(),
      id_contrat: Number(form.id_contrat),
      date_survenance: form.date_survenance,
      description: form.description.trim() || null,
      montant_estime: form.montant_estime === "" ? null : Number(form.montant_estime),
    };
    try {
      await api("/sinistres", { method: "POST", body: JSON.stringify(donnees) });
      setDeclarationOuverte(false);
      setSucces("Sinistre déclaré.");
      charger();
    } catch (err) {
      setErreurFormulaire(err.message);
    }
  };


  const changerStatut = async (id, statut) => {
    setErreur("");
    setSucces("");
    try {
      await api("/sinistres/" + id + "/statut", { method: "PATCH", body: JSON.stringify({ statut }) });
      charger();
    } catch (err) {
      setErreur(err.message);
    }
  };


  const ouvrirIndemnisation = (s) => {
    const reste = resteAIndemniser(s);
    setAIndemniser(s);
    setIndem({
      id_mode_paiement: modes.length ? String(modes[0].id_mode_paiement) : "",
      montant: reste != null ? String(reste) : "",
    });
    setErreurIndem("");
  };

  const indemniser = async (e) => {
    e.preventDefault();
    setErreurIndem("");
    setSucces("");
    try {
      await api("/indemnisations", {
        method: "POST",
        body: JSON.stringify({
          id_sinistre: aIndemniser.id_sinistre,
          id_mode_paiement: Number(indem.id_mode_paiement),
          montant: Number(indem.montant),
        }),
      });
      setAIndemniser(null);
      setSucces("Indemnisation versée.");
      charger();
    } catch (err) {
      setErreurIndem(err.message);
    }
  };

  return (
    <>
      <div className="entete-page">
        <div>
          <h2>Sinistres</h2>
          <p className="sous-titre">{sinistres.length} sinistre(s) déclaré(s)</p>
        </div>
        <button onClick={ouvrirDeclaration}>+ Déclarer un sinistre</button>
      </div>

      {erreur && <Alerte type="erreur">{erreur}</Alerte>}
      {succes && <Alerte type="succes">{succes}</Alerte>}

      <div className="carte">
        <div className="tableau-conteneur">
          <table>
            <thead>
              <tr>
                <th>N°</th><th>Client</th><th>Survenu le</th><th>Estimé</th>
                <th>Indemnisé</th><th>Statut</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {sinistres.map((s) => {
                const reste = resteAIndemniser(s);
                const ct = contratDe(s.id_contrat);
                return (
                  <tr key={s.id_sinistre}>
                    <td><strong>{s.numero_sinistre}</strong></td>
                    <td>{clientDuSinistre(s)}{ct && <><br /><small>{ct.numero_contrat}</small></>}</td>
                    <td>{formaterDate(s.date_survenance)}</td>
                    <td>{s.montant_estime != null ? formaterMontant(s.montant_estime) : "—"}</td>
                    <td>{formaterMontant(totalVerse(s.id_sinistre))}</td>
                    <td><Badge valeur={s.statut} /></td>
                    <td className="actions">
                      {(TRANSITIONS[s.statut] || []).map((st) => (
                        <button key={st} className={"petit" + (st === "REFUSE" ? " danger" : "")}
                                onClick={() => changerStatut(s.id_sinistre, st)}>
                          {ACTIONS[st]}
                        </button>
                      ))}
                      {s.statut === "ACCEPTE" && (reste === null || reste > 0) && (
                        <button className="petit succes-btn" onClick={() => ouvrirIndemnisation(s)}>
                          Indemniser
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {sinistres.length === 0 && (
                <tr><td colSpan="7" className="vide">Aucun sinistre.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="carte">
        <h3 className="titre-carte">Historique des indemnisations</h3>
        <div className="tableau-conteneur">
          <table>
            <thead>
              <tr><th>Sinistre</th><th>Client</th><th>Montant</th><th>Date</th><th>Statut</th></tr>
            </thead>
            <tbody>
              {indemnisations.map((i) => {
                const s = sinistres.find((x) => x.id_sinistre === i.id_sinistre);
                return (
                  <tr key={i.id_indemnisation}>
                    <td>{s ? s.numero_sinistre : i.id_sinistre}</td>
                    <td>{s ? clientDuSinistre(s) : "—"}</td>
                    <td>{formaterMontant(i.montant)}</td>
                    <td>{formaterDateHeure(i.date_versement)}</td>
                    <td><Badge valeur={i.statut} /></td>
                  </tr>
                );
              })}
              {indemnisations.length === 0 && (
                <tr><td colSpan="5" className="vide">Aucune indemnisation.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {declarationOuverte && (
        <Modal titre="Déclarer un sinistre" large onFermer={() => setDeclarationOuverte(false)}>
          {erreurFormulaire && <Alerte type="erreur">{erreurFormulaire}</Alerte>}
          <form onSubmit={declarer}>
            <div className="grille-formulaire">
              <div className="champ">
                <label htmlFor="client">Client *</label>
                <select id="client" value={form.id_client} onChange={changerClient} required>
                  <option value="">Choisir un client</option>
                  {clients.map((c) => (
                    <option key={c.id_client} value={c.id_client}>{c.nom} {c.prenom}</option>
                  ))}
                </select>
              </div>
              <div className="champ">
                <label htmlFor="contrat">Contrat concerné *</label>
                <select id="contrat" name="id_contrat" value={form.id_contrat} onChange={changer}
                        required disabled={!form.id_client}>
                  <option value="">
                    {form.id_client ? "Choisir un contrat" : "Choisissez d'abord un client"}
                  </option>
                  {contratsDuClient.map((c) => (
                    <option key={c.id_contrat} value={c.id_contrat}>
                      {c.numero_contrat} ({formaterDate(c.date_debut)} → {formaterDate(c.date_fin)})
                    </option>
                  ))}
                </select>
                {form.id_client && contratsDuClient.length === 0 && (
                  <span className="msg-erreur">Ce client n'a aucun contrat actif.</span>
                )}
              </div>

              <div className="champ">
                <label htmlFor="numero">N° de sinistre *</label>
                <input id="numero" name="numero_sinistre" value={form.numero_sinistre}
                       onChange={changer} required />
              </div>
              <div className="champ">
                <label htmlFor="date">Date du sinistre *</label>
                <input id="date" name="date_survenance" type="date" value={form.date_survenance}
                       min={dateMin} max={dateMax} onChange={changer} required />
                <span className="aide">Pendant la période de couverture, pas dans le futur.</span>
              </div>

              <div className="champ">
                <label htmlFor="montant">Montant estimé (Ar)</label>
                <input id="montant" name="montant_estime" type="number" min="0"
                       value={form.montant_estime} onChange={changer} />
              </div>
              <div className="champ pleine">
                <label htmlFor="description">Description</label>
                <textarea id="description" name="description" rows="3" value={form.description}
                          onChange={changer} />
              </div>
            </div>
            <div className="modal-actions">
              <button type="button" className="secondaire" onClick={() => setDeclarationOuverte(false)}>Annuler</button>
              <button type="submit">Déclarer</button>
            </div>
          </form>
        </Modal>
      )}

      {aIndemniser && (
        <Modal titre={"Indemniser le sinistre " + aIndemniser.numero_sinistre}
               onFermer={() => setAIndemniser(null)}>
          <p>
            Client : <strong>{clientDuSinistre(aIndemniser)}</strong><br />
            Montant estimé : <strong>
              {aIndemniser.montant_estime != null ? formaterMontant(aIndemniser.montant_estime) : "non renseigné"}
            </strong><br />
            Déjà indemnisé : <strong>{formaterMontant(totalVerse(aIndemniser.id_sinistre))}</strong>
          </p>
          {erreurIndem && <Alerte type="erreur">{erreurIndem}</Alerte>}
          <form onSubmit={indemniser}>
            <div className="grille-formulaire">
              <div className="champ">
                <label htmlFor="mode">Mode de versement</label>
                <select id="mode" value={indem.id_mode_paiement}
                        onChange={(e) => setIndem({ ...indem, id_mode_paiement: e.target.value })} required>
                  {modes.map((m) => (
                    <option key={m.id_mode_paiement} value={m.id_mode_paiement}>{m.libelle}</option>
                  ))}
                </select>
              </div>
              <div className="champ">
                <label htmlFor="montantIndem">Montant à verser (Ar)</label>
                <input id="montantIndem" type="number" min="1" value={indem.montant}
                       onChange={(e) => setIndem({ ...indem, montant: e.target.value })} required />
              </div>
            </div>
            <div className="modal-actions">
              <button type="button" className="secondaire" onClick={() => setAIndemniser(null)}>Annuler</button>
              <button type="submit">Verser l'indemnisation</button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}