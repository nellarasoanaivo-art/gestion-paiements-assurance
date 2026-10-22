import { useEffect, useState } from "react";
import { api, formaterMontant } from "../api";
import { useAuth } from "../AuthContext";
import { formaterDate, formaterDateHeure } from "../libelles";
import { Alerte, Badge, Modal } from "../components/ui";

export default function Paiements() {
  const { aRole } = useAuth();
  const peutAnnuler = aRole("ADMIN", "GESTIONNAIRE");

  const [contrats, setContrats] = useState([]);
  const [clients, setClients] = useState([]);
  const [modes, setModes] = useState([]);
  const [idContrat, setIdContrat] = useState("");
  const [echeances, setEcheances] = useState([]);
  const [idMode, setIdMode] = useState("");
  const [montants, setMontants] = useState({});
  const [paiements, setPaiements] = useState([]);
  const [quittance, setQuittance] = useState(null);
  const [aAnnuler, setAAnnuler] = useState(null);
  const [erreur, setErreur] = useState("");
  const [succes, setSucces] = useState("");

  const chargerPaiements = () =>
    api("/paiements").then(setPaiements).catch((e) => setErreur(e.message));

  const chargerEcheances = (id) =>
    api("/paiements/contrat/" + id + "/echeances")
      .then(setEcheances)
      .catch((e) => setErreur(e.message));

  useEffect(() => {
    Promise.all([api("/contrats"), api("/clients"), api("/modes-paiement")])
      .then(([ct, cl, md]) => {
        setContrats(ct.filter((c) => c.statut !== "RESILIE"));
        setClients(cl);
        setModes(md);
        if (md.length > 0) setIdMode(String(md[0].id_mode_paiement));
      })
      .catch((e) => setErreur(e.message));
    chargerPaiements();
  }, []);

  const nomClient = (id) => {
    const c = clients.find((x) => x.id_client === id);
    return c ? c.nom + " " + c.prenom : "";
  };

  const choisirContrat = (e) => {
    const id = e.target.value;
    setIdContrat(id);
    setEcheances([]);
    setMontants({});
    setErreur("");
    setSucces("");
    if (id) chargerEcheances(id);
  };

  const encaisser = async (ech) => {
    setErreur("");
    setSucces("");
    const montant = Number(montants[ech.id_echeance] ?? ech.reste);
    try {
      const p = await api("/paiements", {
        method: "POST",
        body: JSON.stringify({
          id_echeance: ech.id_echeance,
          id_mode_paiement: Number(idMode),
          montant,
        }),
      });
      setSucces("Paiement enregistré : " + p.reference);
      setMontants({});
      setQuittance(p);
      chargerEcheances(idContrat);
      chargerPaiements();
    } catch (err) {
      setErreur(err.message);
    }
  };

  const confirmerAnnulation = async () => {
    setErreur("");
    setSucces("");
    try {
      await api("/paiements/" + aAnnuler.id_paiement + "/annuler", { method: "POST" });
      setSucces("Paiement " + aAnnuler.reference + " annulé.");
      if (idContrat) chargerEcheances(idContrat);
      chargerPaiements();
    } catch (err) {
      setErreur(err.message);
    } finally {
      setAAnnuler(null);
    }
  };

  return (
    <>
      <div className="entete-page">
        <div>
          <h2>Paiements</h2>
          <p className="sous-titre">Encaissement des primes et historique</p>
        </div>
      </div>

      {erreur && <Alerte type="erreur">{erreur}</Alerte>}
      {succes && <Alerte type="succes">{succes}</Alerte>}

      <div className="carte">
        <h3 className="titre-carte">Encaisser une prime</h3>
        <div className="grille-formulaire">
          <div className="champ">
            <label htmlFor="contrat">Contrat</label>
            <select id="contrat" value={idContrat} onChange={choisirContrat}>
              <option value="">Choisir un contrat</option>
              {contrats.map((c) => (
                <option key={c.id_contrat} value={c.id_contrat}>
                  {c.numero_contrat} — {nomClient(c.id_client)}
                </option>
              ))}
            </select>
          </div>
          <div className="champ">
            <label htmlFor="mode">Mode de paiement</label>
            <select id="mode" value={idMode} onChange={(e) => setIdMode(e.target.value)}>
              {modes.map((m) => (
                <option key={m.id_mode_paiement} value={m.id_mode_paiement}>{m.libelle}</option>
              ))}
            </select>
          </div>
        </div>

        {echeances.length > 0 && (
          <div className="tableau-conteneur espace-haut">
            <table>
              <thead>
                <tr>
                  <th>Échéance</th><th>Montant dû</th><th>Déjà payé</th><th>Reste</th>
                  <th>Statut</th><th>Montant à encaisser</th><th></th>
                </tr>
              </thead>
              <tbody>
                {echeances.map((ech) => {
                  const soldee = ech.statut === "PAYEE" || Number(ech.reste) <= 0;
                  return (
                    <tr key={ech.id_echeance}>
                      <td>{formaterDate(ech.date_echeance)}</td>
                      <td>{formaterMontant(ech.montant_du)}</td>
                      <td>{formaterMontant(ech.montant_paye)}</td>
                      <td>{formaterMontant(ech.reste)}</td>
                      <td><Badge valeur={ech.statut} /></td>
                      <td>
                        <input type="number" min="1" className="champ-montant" disabled={soldee}
                               value={montants[ech.id_echeance] ?? Number(ech.reste)}
                               onChange={(e) => setMontants({ ...montants, [ech.id_echeance]: e.target.value })} />
                      </td>
                      <td>
                        <button className="petit" disabled={soldee} onClick={() => encaisser(ech)}>
                          Encaisser
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="carte">
        <h3 className="titre-carte">Historique des paiements</h3>
        <div className="tableau-conteneur">
          <table>
            <thead>
              <tr>
                <th>Référence</th><th>Date</th><th>Client / Contrat</th><th>Mode</th>
                <th>Montant</th><th>Statut</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {paiements.map((p) => (
                <tr key={p.id_paiement}>
                  <td>{p.reference}</td>
                  <td>{formaterDateHeure(p.date_paiement)}</td>
                  <td>{p.client}<br /><small>{p.numero_contrat}</small></td>
                  <td>{p.mode_paiement}</td>
                  <td>{formaterMontant(p.montant)}</td>
                  <td><Badge valeur={p.statut} /></td>
                  <td className="actions">
                    <button className="secondaire petit" onClick={() => setQuittance(p)}>Quittance</button>
                    {peutAnnuler && p.statut === "VALIDE" && (
                      <button className="danger petit" onClick={() => setAAnnuler(p)}>Annuler</button>
                    )}
                  </td>
                </tr>
              ))}
              {paiements.length === 0 && (
                <tr><td colSpan="7" className="vide">Aucun paiement.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {quittance && (
        <Modal titre="Quittance de paiement" onFermer={() => setQuittance(null)}>
          <div className="quittance">
            <div className="quittance-entete">
              <strong>Gestion des paiements d'assurances</strong>
              <span>Quittance n° {quittance.numero_quittance}</span>
            </div>
            <dl className="quittance-details">
              <dt>Référence</dt><dd>{quittance.reference}</dd>
              <dt>Date</dt><dd>{formaterDateHeure(quittance.date_paiement)}</dd>
              <dt>Client</dt><dd>{quittance.client}</dd>
              <dt>Contrat</dt><dd>{quittance.numero_contrat}</dd>
              <dt>Échéance du</dt><dd>{formaterDate(quittance.date_echeance)}</dd>
              <dt>Mode de paiement</dt><dd>{quittance.mode_paiement}</dd>
              <dt>Encaissé par</dt><dd>{quittance.operateur}</dd>
            </dl>
            <div className="quittance-total">Montant reçu : {formaterMontant(quittance.montant)}</div>
            {quittance.statut === "ANNULE" && <p className="quittance-annulee">PAIEMENT ANNULÉ</p>}
          </div>
          <div className="modal-actions">
            <button className="secondaire" onClick={() => setQuittance(null)}>Fermer</button>
            <button onClick={() => window.print()}>Imprimer</button>
          </div>
        </Modal>
      )}

      {aAnnuler && (
        <Modal titre="Annuler le paiement" onFermer={() => setAAnnuler(null)}>
          <p>
            Annuler le paiement <strong>{aAnnuler.reference}</strong> de{" "}
            <strong>{formaterMontant(aAnnuler.montant)}</strong> ? L'échéance sera recalculée.
          </p>
          <div className="modal-actions">
            <button className="secondaire" onClick={() => setAAnnuler(null)}>Retour</button>
            <button className="danger" onClick={confirmerAnnulation}>Confirmer l'annulation</button>
          </div>
        </Modal>
      )}
    </>
  );
}