import { useMemo, useState } from "react";

// ---------- Géométrie du diagramme ----------
const L = 230;          // largeur d'une table
const H_ENTETE = 34;
const H_LIGNE = 22;
const H_PIED = 8;
const LARGEUR = 1240;
const HAUTEUR = 920;

const GROUPES = {
  securite: { nom: "Sécurité", couleur: "#6d28d9" },
  clients: { nom: "Clients", couleur: "#1d4ed8" },
  catalogue: { nom: "Catalogue", couleur: "#15803d" },
  contrats: { nom: "Contrats", couleur: "#b45309" },
  paiements: { nom: "Paiements", couleur: "#0e7490" },
  sinistres: { nom: "Sinistres", couleur: "#b91c1c" },
  trace: { nom: "Traçabilité", couleur: "#475569" },
};

// colonnes : [nom, type, clés]  (clés : PK, FK, UQ séparées par une virgule)
const TABLES = [
  { nom: "role", groupe: "securite", x: 20, y: 20,
    colonnes: [["id_role", "SERIAL", "PK"], ["libelle", "VARCHAR(50)", "UQ"]] },
  { nom: "utilisateur", groupe: "securite", x: 20, y: 150,
    colonnes: [["id_utilisateur", "SERIAL", "PK"], ["nom", "VARCHAR(100)", ""], ["prenom", "VARCHAR(100)", ""],
      ["email", "VARCHAR(150)", "UQ"], ["mot_de_passe", "VARCHAR(255)", ""], ["actif", "BOOLEAN", ""],
      ["date_creation", "TIMESTAMP", ""], ["id_role", "INT", "FK"]] },
  { nom: "journal_audit", groupe: "trace", x: 20, y: 420,
    colonnes: [["id_audit", "BIGSERIAL", "PK"], ["table_cible", "VARCHAR(60)", ""], ["id_enregistrement", "INT", ""],
      ["action", "VARCHAR(10)", ""], ["details", "JSONB", ""], ["date_action", "TIMESTAMP", ""],
      ["id_utilisateur", "INT", "FK"]] },

  { nom: "paiement", groupe: "paiements", x: 320, y: 20,
    colonnes: [["id_paiement", "SERIAL", "PK"], ["reference", "VARCHAR(40)", "UQ"], ["montant", "NUMERIC(12,2)", ""],
      ["date_paiement", "TIMESTAMP", ""], ["statut", "VARCHAR(15)", ""], ["id_echeance", "INT", "FK"],
      ["id_mode_paiement", "INT", "FK"], ["id_utilisateur", "INT", "FK"]] },
  { nom: "quittance", groupe: "paiements", x: 320, y: 280,
    colonnes: [["id_quittance", "SERIAL", "PK"], ["numero", "VARCHAR(30)", "UQ"], ["date_emission", "TIMESTAMP", ""],
      ["id_paiement", "INT", "FK,UQ"]] },
  { nom: "mode_paiement", groupe: "paiements", x: 320, y: 450,
    colonnes: [["id_mode_paiement", "SERIAL", "PK"], ["libelle", "VARCHAR(50)", "UQ"]] },
  { nom: "indemnisation", groupe: "sinistres", x: 320, y: 590,
    colonnes: [["id_indemnisation", "SERIAL", "PK"], ["montant", "NUMERIC(12,2)", ""], ["date_versement", "TIMESTAMP", ""],
      ["statut", "VARCHAR(15)", ""], ["id_sinistre", "INT", "FK"], ["id_mode_paiement", "INT", "FK"],
      ["id_utilisateur", "INT", "FK"]] },

  { nom: "echeance", groupe: "contrats", x: 620, y: 20,
    colonnes: [["id_echeance", "SERIAL", "PK"], ["date_echeance", "DATE", ""], ["montant_du", "NUMERIC(12,2)", ""],
      ["statut", "VARCHAR(15)", ""], ["id_contrat", "INT", "FK"]] },
  { nom: "contrat", groupe: "contrats", x: 620, y: 230,
    colonnes: [["id_contrat", "SERIAL", "PK"], ["numero_contrat", "VARCHAR(30)", "UQ"], ["date_debut", "DATE", ""],
      ["date_fin", "DATE", ""], ["prime_annuelle", "NUMERIC(12,2)", ""], ["periodicite", "VARCHAR(15)", ""],
      ["statut", "VARCHAR(15)", ""], ["id_client", "INT", "FK"], ["id_produit", "INT", "FK"]] },
  { nom: "sinistre", groupe: "sinistres", x: 620, y: 520,
    colonnes: [["id_sinistre", "SERIAL", "PK"], ["numero_sinistre", "VARCHAR(30)", "UQ"], ["date_survenance", "DATE", ""],
      ["date_declaration", "DATE", ""], ["description", "TEXT", ""], ["montant_estime", "NUMERIC(12,2)", ""],
      ["statut", "VARCHAR(15)", ""], ["id_contrat", "INT", "FK"]] },

  { nom: "client", groupe: "clients", x: 920, y: 20,
    colonnes: [["id_client", "SERIAL", "PK"], ["nom", "VARCHAR(100)", ""], ["prenom", "VARCHAR(100)", ""],
      ["sexe", "CHAR(1)", ""], ["cin", "VARCHAR(12)", "UQ"], ["date_naissance", "DATE", ""],
      ["email", "VARCHAR(150)", "UQ"], ["telephone", "VARCHAR(30)", "UQ"], ["adresse", "VARCHAR(255)", ""],
      ["ville", "VARCHAR(100)", ""], ["code_postal", "VARCHAR(10)", ""], ["pays", "VARCHAR(60)", ""],
      ["date_creation", "TIMESTAMP", ""]] },
  { nom: "produit_assurance", groupe: "catalogue", x: 920, y: 420,
    colonnes: [["id_produit", "SERIAL", "PK"], ["nom", "VARCHAR(120)", ""], ["description", "TEXT", ""],
      ["prime_base", "NUMERIC(12,2)", ""], ["id_type_assurance", "INT", "FK"]] },
  { nom: "produit_type", groupe: "catalogue", x: 920, y: 620,
    colonnes: [["id_produit", "INT", "PK,FK"], ["id_type_assurance", "INT", "PK,FK"]] },
  { nom: "type_assurance", groupe: "catalogue", x: 920, y: 750,
    colonnes: [["id_type_assurance", "SERIAL", "PK"], ["libelle", "VARCHAR(80)", "UQ"],
      ["description", "TEXT", ""], ["prime_reference", "NUMERIC(12,2)", ""]] },
];

// de.col référence vers.cible  (de = table fille « N », vers = table parente « 1 »)
const RELATIONS = [
  { de: "utilisateur", col: "id_role", vers: "role", cible: "id_role" },
  { de: "paiement", col: "id_echeance", vers: "echeance", cible: "id_echeance" },
  { de: "paiement", col: "id_mode_paiement", vers: "mode_paiement", cible: "id_mode_paiement" },
  { de: "paiement", col: "id_utilisateur", vers: "utilisateur", cible: "id_utilisateur" },
  { de: "quittance", col: "id_paiement", vers: "paiement", cible: "id_paiement", un: true },
  { de: "echeance", col: "id_contrat", vers: "contrat", cible: "id_contrat" },
  { de: "contrat", col: "id_client", vers: "client", cible: "id_client" },
  { de: "contrat", col: "id_produit", vers: "produit_assurance", cible: "id_produit" },
  { de: "produit_assurance", col: "id_type_assurance", vers: "type_assurance", cible: "id_type_assurance" },
  { de: "produit_type", col: "id_produit", vers: "produit_assurance", cible: "id_produit" },
  { de: "produit_type", col: "id_type_assurance", vers: "type_assurance", cible: "id_type_assurance" },
  { de: "sinistre", col: "id_contrat", vers: "contrat", cible: "id_contrat" },
  { de: "indemnisation", col: "id_sinistre", vers: "sinistre", cible: "id_sinistre" },
  { de: "indemnisation", col: "id_mode_paiement", vers: "mode_paiement", cible: "id_mode_paiement" },
  { de: "indemnisation", col: "id_utilisateur", vers: "utilisateur", cible: "id_utilisateur" },
  { de: "journal_audit", col: "id_utilisateur", vers: "utilisateur", cible: "id_utilisateur" },
];

const hauteurTable = (t) => H_ENTETE + t.colonnes.length * H_LIGNE + H_PIED;
const ligneY = (t, col) =>
  t.y + H_ENTETE + t.colonnes.findIndex((c) => c[0] === col) * H_LIGNE + H_LIGNE / 2;
const classeCle = (cle) =>
  cle.includes("PK") ? "PK" : cle.includes("FK") ? "FK" : cle.includes("UQ") ? "UQ" : "";

// ---------- Vue « liste » (idéale sur téléphone) ----------
function ListeTables() {
  return (
    <div className="mpd-grille">
      {TABLES.map((t) => (
        <article className="mpd-table" key={t.nom}>
          <header style={{ background: GROUPES[t.groupe].couleur }}>
            <h4>{t.nom}</h4>
            <span>{GROUPES[t.groupe].nom}</span>
          </header>
          <ul>
            {t.colonnes.map(([nom, type, cle]) => {
              const ref = RELATIONS.find((r) => r.de === t.nom && r.col === nom);
              return (
                <li key={nom}>
                  <span className="col-nom">{nom}</span>
                  <span className="col-type">
                    {type}
                    {cle.split(",").filter(Boolean).map((k) => (
                      <b key={k} className={"cle cle-" + k}>{k}</b>
                    ))}
                  </span>
                  {ref && <span className="col-ref">→ {ref.vers}.{ref.cible}</span>}
                </li>
              );
            })}
          </ul>
        </article>
      ))}
    </div>
  );
}

// ---------- Vue « schéma » ----------
function Diagramme() {
  const [actif, setActif] = useState(null);
  const parNom = useMemo(() => Object.fromEntries(TABLES.map((t) => [t.nom, t])), []);

  const voisines = useMemo(() => {
    if (!actif) return null;
    const ensemble = new Set([actif]);
    RELATIONS.forEach((r) => {
      if (r.de === actif) ensemble.add(r.vers);
      if (r.vers === actif) ensemble.add(r.de);
    });
    return ensemble;
  }, [actif]);

  const liens = RELATIONS.map((r, i) => {
    const a = parNom[r.de];
    const b = parNom[r.vers];
    const y1 = ligneY(a, r.col);
    const y2 = ligneY(b, r.cible);
    let x1, x2, c1, c2, o1, o2;

    if (a.x < b.x) {
      x1 = a.x + L; x2 = b.x;
      const d = Math.max(30, (x2 - x1) / 2);
      c1 = x1 + d; c2 = x2 - d; o1 = x1 + 12; o2 = x2 - 12;
    } else if (a.x > b.x) {
      x1 = a.x; x2 = b.x + L;
      const d = Math.max(30, (x1 - x2) / 2);
      c1 = x1 - d; c2 = x2 + d; o1 = x1 - 12; o2 = x2 + 12;
    } else {
      x1 = a.x + L; x2 = x1;
      c1 = x1 + 55; c2 = x2 + 55; o1 = x1 + 12; o2 = x2 + 12;
    }

    let etat = "";
    if (actif) etat = r.de === actif || r.vers === actif ? " vif" : " pale";

    return (
      <g key={i}>
        <path className={"mpd-lien" + etat} d={`M ${x1} ${y1} C ${c1} ${y1}, ${c2} ${y2}, ${x2} ${y2}`} />
        <text className={"mpd-card" + (etat === " pale" ? " pale" : "")} x={o1} y={y1 - 6}>{r.un ? "1" : "N"}</text>
        <text className={"mpd-card" + (etat === " pale" ? " pale" : "")} x={o2} y={y2 - 6}>1</text>
      </g>
    );
  });

  return (
    <div className="carte">
      <div className="mpd-legende">
        {Object.values(GROUPES).map((g) => (
          <span key={g.nom}><i className="pastille-couleur" style={{ background: g.couleur }} />{g.nom}</span>
        ))}
        <span><b className="cle cle-PK">PK</b> clé primaire</span>
        <span><b className="cle cle-FK">FK</b> clé étrangère</span>
        <span><b className="cle cle-UQ">UQ</b> valeur unique</span>
        <span><b className="cle cle-FK">N</b> / <b className="cle cle-FK">1</b> cardinalités</span>
      </div>
      <p className="aide">
        Survolez ou touchez une table pour mettre ses relations en évidence.
        <span className="mpd-aide-mobile"> Faites glisser horizontalement pour voir tout le schéma.</span>
      </p>

      <div className="mpd-defilement">
        <svg viewBox={`0 0 ${LARGEUR} ${HAUTEUR}`} className="mpd-svg" role="img"
             aria-label="Schéma du modèle physique de données">
          <rect width={LARGEUR} height={HAUTEUR} fill="transparent" onClick={() => setActif(null)} />
          {liens}
          {TABLES.map((t) => {
            const h = hauteurTable(t);
            const couleur = GROUPES[t.groupe].couleur;
            const pale = voisines && !voisines.has(t.nom);
            return (
              <g key={t.nom} transform={`translate(${t.x} ${t.y})`}
                 className={"mpd-t" + (pale ? " pale" : "") + (actif === t.nom ? " choisie" : "")}
                 onPointerEnter={(e) => e.pointerType === "mouse" && setActif(t.nom)}
                 onPointerLeave={(e) => e.pointerType === "mouse" && setActif(null)}
                 onClick={(e) => { e.stopPropagation(); setActif(t.nom); }}>
                <rect className="mpd-boite" width={L} height={h} rx="9" />
                <rect width={L} height={H_ENTETE} rx="9" fill={couleur} />
                <rect y={H_ENTETE - 9} width={L} height="9" fill={couleur} />
                <text className="mpd-nom" x="14" y="22">{t.nom}</text>
                {t.colonnes.map(([nom, type, cle], i) => {
                  const y = H_ENTETE + i * H_LIGNE;
                  const k = classeCle(cle);
                  return (
                    <g key={nom}>
                      {i > 0 && <line className="mpd-sep" x1="8" x2={L - 8} y1={y} y2={y} />}
                      {k && <text className={"mpd-cle s-" + k} x="12" y={y + 15}>{k}</text>}
                      <text className="mpd-col" x="36" y={y + 15}>{nom}</text>
                      <text className="mpd-type" x={L - 12} y={y + 15} textAnchor="end">{type}</text>
                    </g>
                  );
                })}
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

// ---------- Page ----------
export default function Apropos() {
  // Sur téléphone, la liste est plus lisible que le schéma
  const [vue, setVue] = useState(() =>
    window.matchMedia("(max-width: 720px)").matches ? "liste" : "diagramme"
  );

  return (
    <>
      <div className="entete-page">
        <div>
          <h2>À propos</h2>
          <p className="sous-titre">Modèle physique de données (MPD) de G.P.A</p>
        </div>
      </div>

      <div className="onglets" role="tablist">
        <button role="tab" aria-selected={vue === "liste"}
                className={vue === "liste" ? "actif" : ""} onClick={() => setVue("liste")}>
          Liste des tables
        </button>
        <button role="tab" aria-selected={vue === "diagramme"}
                className={vue === "diagramme" ? "actif" : ""} onClick={() => setVue("diagramme")}>
          Schéma
        </button>
      </div>

      {vue === "diagramme" ? <Diagramme /> : <div className="carte"><ListeTables /></div>}
    </>
  );
}