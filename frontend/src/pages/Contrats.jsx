import { useEffect, useMemo, useState } from "react";
import { api, formaterMontant } from "../api";
import { PERIODICITES, formaterDate, libelle } from "../libelles";
import { Alerte, Badge, Modal } from "../components/ui";

const PAR_AN = { MENSUELLE: 12, TRIMESTRIELLE: 4, SEMESTRIELLE: 2, ANNUELLE: 1 };
const MOIS = { MENSUELLE: 1, TRIMESTRIELLE: 3, SEMESTRIELLE: 6, ANNUELLE: 12 };

const VIDE = {
  numero_contrat: "", id_client: "", id_produit: "", periodicite: "",
  date_debut: "", date_fin: "", prime_annuelle: "", statut: "ACTIF",
};

const versIso = (d) => d.toISOString().slice(0, 10);

const ajouterMois = (iso, n) => {
  const [a, m, j] = iso.split("-").map(Number);
  const cible = new Date(Date.UTC(a, m - 1 + n, 1));
  const dernier = new Date(Date.UTC(cible.getUTCFullYear(), cible.getUTCMonth() + 1, 0)).getUTCDate();
  cible.setUTCDate(Math.min(j, dernier));
  return cible;
};

// Date de fin = date de début + durée de la périodicité − 1 jour
const calculerFin = (debut, periodicite) => {
  const fin = ajouterMois(debut, MOIS[periodicite]);
  fin.setUTCDate(fin.getUTCDate() - 1);
  return versIso(fin);
};

const compterEcheances = (debut, fin, periodicite) => {
  if (!debut || !fin || !periodicite || fin <= debut) return 0;
  let n = 0;
  while (n < 600 && versIso(ajouterMois(debut, n * MOIS[periodicite])) <= fin) n++;
  return n;
};

export default function Contrats() {
  const [contrats, setContrats] = useState([]);
  const [clients, setClients] = useState([]);
  const [produits, setProduits] = useState([]);
  const [recherche, setRecherche] = useState("");
  const [form, setForm] = useState(VIDE);
  const [formulaireOuvert, setFormulaireOuvert] = useState(false);
  const [idEdition, setIdEdition] = useState(null);
  const [erreurFormulaire, setErreurFormulaire] = useState("");
  const [aSupprimer, setASupprimer] = useState(null);
  const [erreur, setErreur] = useState("");
  const [succes, setSucces] = useState("");

  const charger = () =>
    Promise.all([api("/contrats"), api("/clients"), api("/produits")])
      .then(([ct, cl, pr]) => {
        setContrats(ct);
        setClients(cl);
        setProduits(pr);
      })
      .catch((e) => setErreur(e.message));

  useEffect(() => {
    charger();
  }, []);

  const nomClient = (id) => {
    const c = clients.find((x) => x.id_client === id);
    return c ? c.nom + " " + c.prenom : id;
  };
  const produitDe = (id) => produits.find((x) => x.id_produit === id);

  const visibles = useMemo(() => {
    const t = recherche.trim().toLowerCase();
    if (!t) return contrats;
    return contrats.filter((c) =>
      (c.numero_contrat + " " + nomClient(c.id_client)).toLowerCase().includes(t)
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contrats, clients, recherche]);

  const changer = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  // Choix du produit : la prime annuelle se remplit automatiquement
  const changerProduit = (e) => {
    const id = e.target.value;
    const p = produits.find((x) => String(x.id_produit) === id);
    setForm((f) => ({ ...f, id_produit: id, prime_annuelle: p ? String(Number(p.prime_base)) : "" }));
  };

  // Choix de la périodicité : la date de fin se recalcule si la date de début existe
  const changerPeriodicite = (e) => {
    const periodicite = e.target.value;
    setForm((f) => ({
      ...f, periodicite,
      date_fin: f.date_debut && periodicite ? calculerFin(f.date_debut, periodicite) : f.date_fin,
    }));
  };

  // Choix de la date de début : la date de fin se remplit automatiquement
  const changerDebut = (e) => {
    const date_debut = e.target.value;
    setForm((f) => ({
      ...f, date_debut,
      date_fin: date_debut && f.periodicite ? calculerFin(date_debut, f.periodicite) : f.date_fin,
    }));
  };

  const ouvrirCreation = () => {
    const annee = new Date().getFullYear();
    setForm({ ...VIDE, numero_contrat: "CTR-" + annee + "-" + String(contrats.length + 1).padStart(3, "0") });
    setIdEdition(null);
    setErreurFormulaire("");
    setFormulaireOuvert(true);
  };

  const ouvrirModification = (c) => {
    setForm({
      numero_contrat: c.numero_contrat,
      id_client: String(c.id_client),
      id_produit: String(c.id_produit),
      periodicite: c.periodicite,
      date_debut: c.date_debut,
      date_fin: c.date_fin,
      prime_annuelle: String(Number(c.prime_annuelle)),
      statut: c.statut || "ACTIF",
    });
    setIdEdition(c.id_contrat);
    setErreurFormulaire("");
    setFormulaireOuvert(true);
  };

  // Récapitulatif calculé en direct
  const prime = Number(form.prime_annuelle) || 0;
  const parAn = form.periodicite ? PAR_AN[form.periodicite] : 0;
  const montantEcheance = parAn && prime ? prime / parAn : 0;
  const nbEcheances = compterEcheances(form.date_debut, form.date_fin, form.periodicite);
  const totalDu = nbEcheances === parAn ? prime : montantEcheance * nbEcheances;

  const enregistrer = async (e) => {
    e.preventDefault();
    setErreurFormulaire("");
    setSucces("");
    const donnees = {
      numero_contrat: form.numero_contrat.trim(),
      id_client: Number(form.id_client),
      id_produit: Number(form.id_produit),
      date_debut: form.date_debut,
      date_fin: form.date_fin,
      prime_annuelle: Number(form.prime_annuelle),
      periodicite: form.periodicite,
    };
    try {
      if (idEdition) {
        await api("/contrats/" + idEdition, {
          method: "PUT",
          body: JSON.stringify({ ...donnees, statut: form.statut }),
        });
        setSucces("Contrat modifié.");
      } else {
        await api("/contrats", { method: "POST", body: JSON.stringify(donnees) });
        setSucces("Contrat créé, échéances générées.");
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
      await api("/contrats/" + aSupprimer.id_contrat, { method: "DELETE" });
      setSucces("Contrat supprimé.");
      charger();
    } catch (err) {
      setErreur(err.message);
    } finally {
      setASupprimer(null);
    }
  };

  return (
    <>
      <div className="entete-page">
        <div>
          <h2>Contrats</h2>
          <p className="sous-titre">{contrats.length} contrat(s)</p>
        </div>
        <button onClick={ouvrirCreation}>+ Nouveau contrat</button>
      </div>

      {erreur && <Alerte type="erreur">{erreur}</Alerte>}
      {succes && <Alerte type="succes">{succes}</Alerte>}
      {produits.length === 0 && (
        <Alerte type="info">Aucun produit au catalogue : créez d'abord un produit dans la page « Produits ».</Alerte>
      )}

      <div className="carte">
        <div className="barre-outils">
          <input type="search" placeholder="Rechercher par n° de contrat ou client…" value={recherche}
                 onChange={(e) => setRecherche(e.target.value)} />
        </div>
        <div className="tableau-conteneur">
          <table>
            <thead>
              <tr>
                <th>N° contrat</th><th>Client</th><th>Produit</th><th>Période</th>
                <th>Prime annuelle</th><th>Périodicité</th><th>Statut</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {visibles.map((c) => {
                const p = produitDe(c.id_produit);
                return (
                  <tr key={c.id_contrat}>
                    <td><strong>{c.numero_contrat}</strong></td>
                    <td>{nomClient(c.id_client)}</td>
                    <td>{p ? p.nom : c.id_produit}{p && <><br /><small>{p.types.join(", ")}</small></>}</td>
                    <td>{formaterDate(c.date_debut)} → {formaterDate(c.date_fin)}</td>
                    <td>{formaterMontant(c.prime_annuelle)}</td>
                    <td>{libelle(c.periodicite)}</td>
                    <td><Badge valeur={c.statut} /></td>
                    <td className="actions">
                      <button className="secondaire petit" onClick={() => ouvrirModification(c)}>Modifier</button>
                      <button className="danger petit" onClick={() => setASupprimer(c)}>Supprimer</button>
                    </td>
                  </tr>
                );
              })}
              {visibles.length === 0 && (
                <tr><td colSpan="8" className="vide">Aucun contrat.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {formulaireOuvert && (
        <Modal titre={idEdition ? "Modifier le contrat" : "Nouveau contrat"} large
               onFermer={() => setFormulaireOuvert(false)}>
          {idEdition && (
            <Alerte type="info">
              La date de début, la prime et la périodicité ne peuvent plus changer
              une fois qu'un paiement a été enregistré.
            </Alerte>
          )}
          {erreurFormulaire && <Alerte type="erreur">{erreurFormulaire}</Alerte>}
          <form onSubmit={enregistrer}>
            <div className="grille-formulaire">
              <div className="champ">
                <label htmlFor="numero">N° de contrat *</label>
                <input id="numero" name="numero_contrat" value={form.numero_contrat}
                       onChange={changer} required />
              </div>
              <div className="champ">
                <label htmlFor="client">Client *</label>
                <select id="client" name="id_client" value={form.id_client} onChange={changer} required>
                  <option value="">Choisir un client</option>
                  {clients.map((c) => (
                    <option key={c.id_client} value={c.id_client}>{c.nom} {c.prenom}</option>
                  ))}
                </select>
              </div>

              <div className="champ pleine">
                <label htmlFor="produit">Produit d'assurance *</label>
                <select id="produit" name="id_produit" value={form.id_produit}
                        onChange={changerProduit} required>
                  <option value="">Choisir un produit</option>
                  {produits.map((p) => (
                    <option key={p.id_produit} value={p.id_produit}>
                      {p.nom} — {p.types.join(", ")} ({formaterMontant(p.prime_base)})
                    </option>
                  ))}
                </select>
              </div>

              <div className="champ">
                <label htmlFor="periodicite">Périodicité de paiement *</label>
                <select id="periodicite" value={form.periodicite} onChange={changerPeriodicite} required>
                  <option value="">Choisir la périodicité</option>
                  {PERIODICITES.map((p) => (
                    <option key={p} value={p}>{libelle(p)}</option>
                  ))}
                </select>
              </div>
              <div className="champ">
                <label htmlFor="debut">Date de début *</label>
                <input id="debut" type="date" value={form.date_debut} onChange={changerDebut} required />
              </div>

              <div className="champ">
                <label htmlFor="fin">Date de fin *</label>
                <input id="fin" name="date_fin" type="date" value={form.date_fin}
                       onChange={changer} required />
                <span className="aide">Calculée automatiquement selon la périodicité (modifiable).</span>
              </div>
              <div className="champ">
                <label htmlFor="prime">Prime annuelle (Ar) *</label>
                <input id="prime" name="prime_annuelle" type="number" min="1"
                       value={form.prime_annuelle} onChange={changer} required />
                <span className="aide">Remplie automatiquement selon le produit.</span>
              </div>

              {idEdition && (
                <div className="champ">
                  <label htmlFor="statut">Statut</label>
                  <select id="statut" name="statut" value={form.statut} onChange={changer}>
                    {["ACTIF", "SUSPENDU", "RESILIE", "EXPIRE"].map((s) => (
                      <option key={s} value={s}>{libelle(s)}</option>
                    ))}
                  </select>
                </div>
              )}

              {prime > 0 && form.periodicite && (
                <div className="champ pleine">
                  <div className="resume-calcul">
                    <div><span>Prime annuelle</span><strong>{formaterMontant(prime)}</strong></div>
                    <div>
                      <span>Montant à payer à chaque échéance ({libelle(form.periodicite).toLowerCase()})</span>
                      <strong>{formaterMontant(Math.round(montantEcheance * 100) / 100)}</strong>
                    </div>
                    <div><span>Nombre d'échéances sur la durée du contrat</span><strong>{nbEcheances}</strong></div>
                    <div>
                      <span>Total dû sur la durée du contrat</span>
                      <strong>{formaterMontant(Math.round(totalDu * 100) / 100)}</strong>
                    </div>
                  </div>
                </div>
              )}
            </div>
            <div className="modal-actions">
              <button type="button" className="secondaire" onClick={() => setFormulaireOuvert(false)}>Annuler</button>
              <button type="submit">{idEdition ? "Enregistrer" : "Créer le contrat"}</button>
            </div>
          </form>
        </Modal>
      )}

      {aSupprimer && (
        <Modal titre="Supprimer le contrat" onFermer={() => setASupprimer(null)}>
          <p>
            Supprimer le contrat <strong>{aSupprimer.numero_contrat}</strong> et ses échéances ?
            Cette action est impossible si le contrat a des paiements ou des sinistres.
          </p>
          <div className="modal-actions">
            <button className="secondaire" onClick={() => setASupprimer(null)}>Annuler</button>
            <button className="danger" onClick={confirmerSuppression}>Supprimer</button>
          </div>
        </Modal>
      )}
    </>
  );
}