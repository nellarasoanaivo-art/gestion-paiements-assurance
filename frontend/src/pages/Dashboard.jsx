import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, formaterMontant } from "../api";
import { useAuth } from "../AuthContext";
import { formaterDate, formaterDateHeure } from "../libelles";
import { Alerte, Icone } from "../components/ui";
import { BarresHorizontales, GrapheAnneau, GrapheBarres } from "../components/graphiques";

const MOIS = ["janv.", "févr.", "mars", "avr.", "mai", "juin",
              "juil.", "août", "sept.", "oct.", "nov.", "déc."];

function Stat({ titre, valeur, detail, icone, couleur }) {
  return (
    <div className="stat">
      <div className={"stat-icone " + couleur}><Icone nom={icone} taille={26} /></div>
      <div className="stat-corps">
        <span className="stat-titre">{titre}</span>
        <span className="stat-valeur">{valeur}</span>
        {detail && <span className="stat-detail">{detail}</span>}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { utilisateur } = useAuth();
  const [d, setD] = useState(null);
  const [erreur, setErreur] = useState("");

  useEffect(() => {
    api("/dashboard").then(setD).catch((e) => setErreur(e.message));
  }, []);

  if (erreur) return <Alerte type="erreur">{erreur}</Alerte>;
  if (!d) return <p className="sous-titre">Chargement du tableau de bord…</p>;

  const aujourdhui = new Date();
  const dateLongue = aujourdhui.toLocaleDateString("fr-FR", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });
  const moisCourant = aujourdhui.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });

  const mensuel = d.mensuel.map((m) => ({
    label: MOIS[m.mois - 1] + (m.mois === 1 ? " " + String(m.annee).slice(2) : ""),
    encaisse: m.encaisse,
    indemnise: m.indemnise,
  }));

  const segments = [
    { label: "Payées", valeur: d.echeances.payees, couleur: "#16a34a" },
    { label: "Partielles", valeur: d.echeances.partielles, couleur: "#f59e0b" },
    { label: "À venir", valeur: d.echeances.a_venir, couleur: "#3b82f6" },
    { label: "En retard", valeur: d.echeances.en_retard, couleur: "#dc2626" },
  ];
  const totalEcheances = segments.reduce((s, x) => s + x.valeur, 0);

  return (
    <>
      <div className="entete-page">
        <div>
          <h2>Tableau de bord</h2>
          <p className="sous-titre">
            Bonjour {utilisateur.prenom}, voici la situation au {dateLongue}.
          </p>
        </div>
        <Link to="/factures" className="btn-lien">
          <Icone nom="facture" taille={20} /> Voir les factures
        </Link>
      </div>

      <div className="grille-stats">
        <Stat titre="Total encaissé" valeur={formaterMontant(d.encaisse_total)}
              detail={d.nb_paiements + " paiement(s) validé(s)"} icone="paiements" couleur="bleu" />
        <Stat titre="Encaissé ce mois-ci" valeur={formaterMontant(d.encaisse_mois)}
              detail={moisCourant} icone="hausse" couleur="vert" />
        <Stat titre="Échéances en retard" valeur={formaterMontant(d.en_retard.montant)}
              detail={d.en_retard.nombre + " échéance(s) impayée(s)"} icone="alerte" couleur="rouge" />
        <Stat titre="Échéances à venir" valeur={formaterMontant(d.a_venir.montant)}
              detail={d.a_venir.nombre + " échéance(s)"} icone="calendrier" couleur="orange" />
        {d.gestion && (
          <>
            <Stat titre="Clients" valeur={d.clients} detail="enregistrés" icone="clients" couleur="violet" />
            <Stat titre="Contrats actifs" valeur={d.contrats_actifs} detail="en cours de validité"
                  icone="contrats" couleur="bleu" />
            <Stat titre="Sinistres en cours" valeur={d.sinistres_en_cours} detail="à traiter ou à indemniser"
                  icone="sinistres" couleur="orange" />
            <Stat titre="Indemnités versées" valeur={formaterMontant(d.indemnites)}
                  detail="total des sinistres réglés" icone="argent" couleur="vert" />
          </>
        )}
      </div>

      <div className="grille-2">
        <div className="carte">
          <h3 className="titre-carte">Encaissements des 12 derniers mois</h3>
          <div className="legende-graphe">
            <span><i className="pastille-couleur" style={{ background: "#1d4ed8" }} />Primes encaissées</span>
            {d.gestion && (
              <span><i className="pastille-couleur" style={{ background: "#f59e0b" }} />Indemnités versées</span>
            )}
          </div>
          <GrapheBarres donnees={mensuel} avecIndemnites={d.gestion} />
        </div>

        <div className="carte">
          <h3 className="titre-carte">État des échéances</h3>
          {totalEcheances === 0 ? (
            <p className="vide-graphe">Aucune échéance pour le moment.</p>
          ) : (
            <GrapheAnneau segments={segments} centre={totalEcheances} sousCentre="échéances" />
          )}
        </div>
      </div>

      <div className="grille-2 egale">
        <div className="carte">
          <h3 className="titre-carte">Encaissements par mode de paiement</h3>
          {d.modes.length === 0 ? (
            <p className="vide-graphe">Aucun paiement encaissé.</p>
          ) : (
            <BarresHorizontales
              elements={d.modes.map((m) => ({
                label: m.libelle,
                valeur: m.montant,
                texte: formaterMontant(m.montant),
                detail: m.nombre + " paiement(s)",
              }))}
            />
          )}
        </div>

        <div className="carte">
          <h3 className="titre-carte">Échéances en retard</h3>
          <div className="tableau-conteneur">
            <table>
              <thead>
                <tr><th>Client</th><th>Échéance</th><th>Retard</th><th>Reste dû</th></tr>
              </thead>
              <tbody>
                {d.en_retard.liste.map((r) => (
                  <tr key={r.id_echeance}>
                    <td>{r.client}<br /><small>{r.numero_contrat}</small></td>
                    <td>{formaterDate(r.date_echeance)}</td>
                    <td><span className="badge ton-danger">{r.jours} j</span></td>
                    <td>{formaterMontant(r.reste)}</td>
                  </tr>
                ))}
                {d.en_retard.liste.length === 0 && (
                  <tr><td colSpan="4" className="vide">Aucune échéance en retard.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="carte">
        <div className="entete-carte">
          <h3 className="titre-carte">Derniers paiements encaissés</h3>
          <Link to="/factures" className="lien">Toutes les factures →</Link>
        </div>
        <div className="tableau-conteneur">
          <table>
            <thead>
              <tr><th>Facture</th><th>Date</th><th>Client</th><th>Mode</th><th>Montant</th></tr>
            </thead>
            <tbody>
              {d.derniers.map((p) => (
                <tr key={p.reference}>
                  <td><strong>{"FAC-" + p.reference.replace(/^PAY-/, "")}</strong></td>
                  <td>{formaterDateHeure(p.date_paiement)}</td>
                  <td>{p.client}<br /><small>{p.numero_contrat}</small></td>
                  <td>{p.mode}</td>
                  <td>{formaterMontant(p.montant)}</td>
                </tr>
              ))}
              {d.derniers.length === 0 && (
                <tr><td colSpan="5" className="vide">Aucun paiement encaissé.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}