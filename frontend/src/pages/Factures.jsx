import { useEffect, useMemo, useState } from "react";
import { api, formaterMontant } from "../api";
import { formaterDate, formaterDateHeure } from "../libelles";
import { Alerte, Logo, Modal } from "../components/ui";

const numeroFacture = (p) => "FAC-" + p.reference.replace(/^PAY-/, "");

export default function Factures() {
  const [paiements, setPaiements] = useState([]);
  const [recherche, setRecherche] = useState("");
  const [du, setDu] = useState("");
  const [au, setAu] = useState("");
  const [facture, setFacture] = useState(null);
  const [erreur, setErreur] = useState("");

  useEffect(() => {
    api("/paiements")
      .then((liste) => setPaiements(liste.filter((p) => p.statut === "VALIDE")))
      .catch((e) => setErreur(e.message));
  }, []);

  const visibles = useMemo(() => {
    const t = recherche.trim().toLowerCase();
    return paiements.filter((p) => {
      const jour = (p.date_paiement || "").slice(0, 10);
      if (du && jour < du) return false;
      if (au && jour > au) return false;
      if (!t) return true;
      return [numeroFacture(p), p.client, p.numero_contrat, p.mode_paiement]
        .join(" ").toLowerCase().includes(t);
    });
  }, [paiements, recherche, du, au]);

  const total = visibles.reduce((somme, p) => somme + Number(p.montant), 0);

  const exporter = () => {
    const lignes = [
      ["Facture", "Date", "Client", "Contrat", "Mode", "Montant (Ar)"],
      ...visibles.map((p) => [numeroFacture(p), formaterDate(p.date_paiement), p.client,
                              p.numero_contrat, p.mode_paiement, Number(p.montant)]),
    ];
    const csv = "\uFEFF" + lignes
      .map((l) => l.map((c) => '"' + String(c).replace(/"/g, '""') + '"').join(";"))
      .join("\r\n");
    const lien = document.createElement("a");
    lien.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    lien.download = "factures.csv";
    lien.click();
    setTimeout(() => URL.revokeObjectURL(lien.href), 1000);
  };

  return (
    <>
      <div className="entete-page">
        <div>
          <h2>Factures</h2>
          <p className="sous-titre">Paiements encaissés : une facture par paiement validé</p>
        </div>
        <button className="secondaire" onClick={exporter} disabled={visibles.length === 0}>
          Exporter en CSV
        </button>
      </div>

      {erreur && <Alerte type="erreur">{erreur}</Alerte>}

      <div className="grille-stats">
        <div className="stat">
          <div className="stat-corps">
            <span className="stat-titre">Factures affichées</span>
            <span className="stat-valeur">{visibles.length}</span>
          </div>
        </div>
        <div className="stat">
          <div className="stat-corps">
            <span className="stat-titre">Total encaissé (sélection)</span>
            <span className="stat-valeur">{formaterMontant(total)}</span>
          </div>
        </div>
      </div>

      <div className="carte">
        <div className="barre-outils filtres">
          <input type="search" placeholder="Rechercher (n° facture, client, contrat…)"
                 value={recherche} onChange={(e) => setRecherche(e.target.value)} />
          <label>Du <input type="date" value={du} onChange={(e) => setDu(e.target.value)} /></label>
          <label>Au <input type="date" value={au} onChange={(e) => setAu(e.target.value)} /></label>
          {(du || au || recherche) && (
            <button className="secondaire petit"
                    onClick={() => { setDu(""); setAu(""); setRecherche(""); }}>
              Réinitialiser
            </button>
          )}
        </div>

        <div className="tableau-conteneur">
          <table>
            <thead>
              <tr>
                <th>N° facture</th><th>Date</th><th>Client</th><th>Contrat</th>
                <th>Mode</th><th>Montant</th><th>Action</th>
              </tr>
            </thead>
            <tbody>
              {visibles.map((p) => (
                <tr key={p.id_paiement}>
                  <td><strong>{numeroFacture(p)}</strong></td>
                  <td>{formaterDateHeure(p.date_paiement)}</td>
                  <td>{p.client}</td>
                  <td>{p.numero_contrat}</td>
                  <td>{p.mode_paiement}</td>
                  <td>{formaterMontant(p.montant)}</td>
                  <td className="actions">
                    <button className="petit" onClick={() => setFacture(p)}>Voir la facture</button>
                  </td>
                </tr>
              ))}
              {visibles.length === 0 && (
                <tr><td colSpan="7" className="vide">Aucune facture.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {facture && (
        <Modal titre={"Facture " + numeroFacture(facture)} large onFermer={() => setFacture(null)}>
          <div className="facture">
            <div className="facture-entete">
              <div className="facture-societe">
                <Logo />
                <div>
                  <strong>G.P.A</strong><br />
                  <small>Gestion des paiements d'assurances</small>
                </div>
              </div>
              <div className="facture-numero">
                <h4>FACTURE</h4>
                <div>N° {numeroFacture(facture)}</div>
                <small>Émise le {formaterDateHeure(facture.date_paiement)}</small>
              </div>
            </div>

            <div className="facture-blocs">
              <div className="facture-bloc">
                <h5>Facturé à</h5>
                <strong>{facture.client}</strong><br />
                Contrat n° {facture.numero_contrat}
              </div>
              <div className="facture-bloc">
                <h5>Règlement</h5>
                Mode : <strong>{facture.mode_paiement}</strong><br />
                Référence : {facture.reference}<br />
                Encaissé par : {facture.operateur}
              </div>
            </div>

            <table>
              <thead>
                <tr>
                  <th>Désignation</th><th>Échéance</th>
                  <th style={{ textAlign: "right" }}>Montant</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Prime d'assurance, contrat {facture.numero_contrat}</td>
                  <td>{formaterDate(facture.date_echeance)}</td>
                  <td style={{ textAlign: "right" }}>{formaterMontant(facture.montant)}</td>
                </tr>
              </tbody>
            </table>

            <div className="facture-total">Total payé : {formaterMontant(facture.montant)}</div>
            <div className="cachet-paye">PAYÉE</div>
            <p className="facture-pied">
              Quittance n° {facture.numero_quittance || "—"}. Merci pour votre confiance.
            </p>
          </div>
          <div className="modal-actions">
            <button className="secondaire" onClick={() => setFacture(null)}>Fermer</button>
            <button onClick={() => window.print()}>Imprimer</button>
          </div>
        </Modal>
      )}
    </>
  );
}