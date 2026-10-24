import { formaterMontant } from "../api";

const compact = (v) => {
  if (v >= 1e9) return (v / 1e9).toFixed(1).replace(".0", "") + " Md";
  if (v >= 1e6) return (v / 1e6).toFixed(1).replace(".0", "") + " M";
  if (v >= 1e3) return Math.round(v / 1e3) + " k";
  return String(Math.round(v));
};


export function GrapheBarres({ donnees, avecIndemnites }) {
  const L = 760, H = 320;
  const m = { haut: 16, bas: 44, gauche: 64, droite: 12 };

  const maxBrut = Math.max(
    0, ...donnees.map((d) => Math.max(d.encaisse, avecIndemnites ? d.indemnise || 0 : 0))
  );
  if (maxBrut === 0) {
    return <p className="vide-graphe">Aucun encaissement sur les 12 derniers mois.</p>;
  }

  const ordre = Math.pow(10, Math.floor(Math.log10(maxBrut)));
  const max = Math.ceil(maxBrut / ordre) * ordre;
  const hauteurUtile = H - m.haut - m.bas;
  const largeurGroupe = (L - m.gauche - m.droite) / donnees.length;
  const nbSeries = avecIndemnites ? 2 : 1;
  const largeurBarre = Math.min(26, (largeurGroupe * 0.7) / nbSeries);
  const y = (v) => m.haut + hauteurUtile - (v / max) * hauteurUtile;

  return (
    <svg viewBox={`0 0 ${L} ${H}`} className="graphe" role="img"
         aria-label="Encaissements des 12 derniers mois">
      {[0, 1, 2, 3, 4].map((i) => {
        const valeur = (max * i) / 4;
        return (
          <g key={i}>
            <line className="grille" x1={m.gauche} x2={L - m.droite} y1={y(valeur)} y2={y(valeur)} />
            <text x={m.gauche - 8} y={y(valeur) + 4} textAnchor="end">{compact(valeur)}</text>
          </g>
        );
      })}

      {donnees.map((d, i) => {
        const x0 = m.gauche + i * largeurGroupe + (largeurGroupe - largeurBarre * nbSeries) / 2;
        const centre = m.gauche + i * largeurGroupe + largeurGroupe / 2;
        return (
          <g key={i}>
            <rect className="barre-encaisse" x={x0} y={y(d.encaisse)} width={largeurBarre}
                  height={Math.max(0, H - m.bas - y(d.encaisse))} rx="3">
              <title>{d.label} : {formaterMontant(d.encaisse)} encaissés</title>
            </rect>
            {avecIndemnites && (
              <rect className="barre-indemnise" x={x0 + largeurBarre} y={y(d.indemnise || 0)}
                    width={largeurBarre} height={Math.max(0, H - m.bas - y(d.indemnise || 0))} rx="3">
                <title>{d.label} : {formaterMontant(d.indemnise || 0)} d'indemnités</title>
              </rect>
            )}
            <text x={centre} y={H - 18} textAnchor="middle">{d.label}</text>
          </g>
        );
      })}
    </svg>
  );
}


export function GrapheAnneau({ segments, centre, sousCentre }) {
  const total = segments.reduce((s, x) => s + x.valeur, 0);
  const R = 70;
  const C = 2 * Math.PI * R;

  const arcs = segments.reduce((acc, s) => {
    const longueur = total ? (s.valeur / total) * C : 0;
    const precedent = acc[acc.length - 1];
    const decalage = precedent ? precedent.decalage - precedent.longueur : 0;
    acc.push({ ...s, longueur, decalage });
    return acc;
  }, []);

  return (
    <div className="anneau">
      <svg viewBox="0 0 200 200" className="anneau-svg" role="img" aria-label="Répartition">
        <circle cx="100" cy="100" r={R} fill="none" stroke="#e2e8f0" strokeWidth="26" />
        {arcs.filter((a) => a.valeur > 0).map((a) => (
          <circle key={a.label} cx="100" cy="100" r={R} fill="none" stroke={a.couleur}
                  strokeWidth="26" strokeDasharray={`${a.longueur} ${C - a.longueur}`}
                  strokeDashoffset={a.decalage} transform="rotate(-90 100 100)">
            <title>{a.label} : {a.valeur}</title>
          </circle>
        ))}
        <text x="100" y="102" textAnchor="middle" className="anneau-centre">{centre}</text>
        <text x="100" y="124" textAnchor="middle" className="anneau-sous">{sousCentre}</text>
      </svg>
      <ul className="legende">
        {segments.map((s) => (
          <li key={s.label}>
            <span className="pastille-couleur" style={{ background: s.couleur }} />
            {s.label}
            <strong>{s.valeur}</strong>
          </li>
        ))}
      </ul>
    </div>
  );
}


export function BarresHorizontales({ elements }) {
  const max = Math.max(1, ...elements.map((e) => e.valeur));
  return (
    <ul className="barres-h">
      {elements.map((e) => (
        <li key={e.label}>
          <div className="barres-h-entete">
            <span>{e.label}</span>
            <strong>{e.texte}</strong>
          </div>
          <div className="barres-h-piste">
            <div className="barres-h-barre" style={{ width: (e.valeur / max) * 100 + "%" }} />
          </div>
          {e.detail && <small>{e.detail}</small>}
        </li>
      ))}
    </ul>
  );
}