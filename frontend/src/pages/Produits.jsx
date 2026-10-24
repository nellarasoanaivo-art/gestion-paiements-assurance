import { useEffect, useState } from "react";
import { api, formaterMontant } from "../api";
import { Alerte, Modal } from "../components/ui";

const VIDE = { nom: "", ids_types: [], prime_base: "", description: "" };

export default function Produits() {
  const [produits, setProduits] = useState([]);
  const [types, setTypes] = useState([]);
  const [form, setForm] = useState(VIDE);
  const [formulaireOuvert, setFormulaireOuvert] = useState(false);
  const [idEdition, setIdEdition] = useState(null);
  const [erreurFormulaire, setErreurFormulaire] = useState("");
  const [aSupprimer, setASupprimer] = useState(null);
  const [erreur, setErreur] = useState("");
  const [succes, setSucces] = useState("");

  const charger = () =>
    Promise.all([api("/produits"), api("/types-assurance")])
      .then(([p, t]) => {
        setProduits(p);
        setTypes(t);
      })
      .catch((e) => setErreur(e.message));

  useEffect(() => {
    charger();
  }, []);

  const changer = (e) => setForm({ ...form, [e.target.name]: e.target.value });

 
  const basculerType = (id) => {
    const ids = form.ids_types.includes(id)
      ? form.ids_types.filter((x) => x !== id)
      : [...form.ids_types, id];
    const total = types
      .filter((t) => ids.includes(t.id_type_assurance))
      .reduce((somme, t) => somme + Number(t.prime_reference), 0);
    setForm({ ...form, ids_types: ids, prime_base: ids.length ? String(total) : "" });
  };

  const ouvrirCreation = () => {
    setForm(VIDE);
    setIdEdition(null);
    setErreurFormulaire("");
    setFormulaireOuvert(true);
  };

  const ouvrirModification = (p) => {
    setForm({
      nom: p.nom,
      ids_types: p.ids_types,
      prime_base: String(Number(p.prime_base)),
      description: p.description || "",
    });
    setIdEdition(p.id_produit);
    setErreurFormulaire("");
    setFormulaireOuvert(true);
  };

  const enregistrer = async (e) => {
    e.preventDefault();
    setErreurFormulaire("");
    setSucces("");
    if (form.ids_types.length === 0) {
      setErreurFormulaire("Choisissez au moins un type d'assurance.");
      return;
    }
    const donnees = {
      nom: form.nom.trim(),
      ids_types: form.ids_types,
      prime_base: Number(form.prime_base),
      description: form.description.trim() || null,
    };
    try {
      if (idEdition) {
        await api("/produits/" + idEdition, { method: "PUT", body: JSON.stringify(donnees) });
        setSucces("Produit modifié.");
      } else {
        await api("/produits", { method: "POST", body: JSON.stringify(donnees) });
        setSucces("Produit ajouté.");
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
      await api("/produits/" + aSupprimer.id_produit, { method: "DELETE" });
      setSucces("Produit supprimé.");
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
          <h2>Produits d'assurance</h2>
          <p className="sous-titre">{produits.length} produit(s) au catalogue</p>
        </div>
        <button onClick={ouvrirCreation}>+ Nouveau produit</button>
      </div>

      {erreur && <Alerte type="erreur">{erreur}</Alerte>}
      {succes && <Alerte type="succes">{succes}</Alerte>}

      <div className="carte">
        <div className="tableau-conteneur">
          <table>
            <thead>
              <tr><th>N°</th><th>Produit</th><th>Types d'assurance</th><th>Prime de base</th><th>Description</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {produits.map((p) => (
                <tr key={p.id_produit}>
                  <td>{p.id_produit}</td>
                  <td><strong>{p.nom}</strong></td>
                  <td>
                    {p.types.map((t) => (
                      <span key={t} className="badge ton-info" style={{ marginRight: ".3rem" }}>{t}</span>
                    ))}
                  </td>
                  <td>{formaterMontant(p.prime_base)}</td>
                  <td>{p.description}</td>
                  <td className="actions">
                    <button className="secondaire petit" onClick={() => ouvrirModification(p)}>Modifier</button>
                    <button className="danger petit" onClick={() => setASupprimer(p)}>Supprimer</button>
                  </td>
                </tr>
              ))}
              {produits.length === 0 && (
                <tr><td colSpan="6" className="vide">Aucun produit.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {formulaireOuvert && (
        <Modal titre={idEdition ? "Modifier le produit" : "Nouveau produit"} large
               onFermer={() => setFormulaireOuvert(false)}>
          {erreurFormulaire && <Alerte type="erreur">{erreurFormulaire}</Alerte>}
          <form onSubmit={enregistrer}>
            <div className="grille-formulaire">
              <div className="champ pleine">
                <label htmlFor="nom">Nom du produit *</label>
                <input id="nom" name="nom" value={form.nom} onChange={changer} required />
              </div>

              <div className="champ pleine">
                <label>Types d'assurance * (un ou plusieurs)</label>
                <div className="cases-types">
                  {types.map((t) => {
                    const coche = form.ids_types.includes(t.id_type_assurance);
                    return (
                      <label key={t.id_type_assurance} className={"case-type" + (coche ? " cochee" : "")}>
                        <input type="checkbox" checked={coche}
                               onChange={() => basculerType(t.id_type_assurance)} />
                        <span>
                          {t.libelle}
                          <small>{formaterMontant(t.prime_reference)}</small>
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="champ">
                <label htmlFor="prime">Prime de base (Ar) *</label>
                <input id="prime" name="prime_base" type="number" min="0" value={form.prime_base}
                       onChange={changer} required />
                <span className="aide">Calculée automatiquement selon les types cochés (modifiable).</span>
              </div>

              <div className="champ pleine">
                <label htmlFor="description">Description</label>
                <textarea id="description" name="description" rows="3" value={form.description}
                          onChange={changer} />
              </div>
            </div>
            <div className="modal-actions">
              <button type="button" className="secondaire" onClick={() => setFormulaireOuvert(false)}>Annuler</button>
              <button type="submit">{idEdition ? "Enregistrer" : "Ajouter"}</button>
            </div>
          </form>
        </Modal>
      )}

      {aSupprimer && (
        <Modal titre="Supprimer le produit" onFermer={() => setASupprimer(null)}>
          <p>Voulez-vous vraiment supprimer <strong>{aSupprimer.nom}</strong> ?</p>
          <div className="modal-actions">
            <button className="secondaire" onClick={() => setASupprimer(null)}>Annuler</button>
            <button className="danger" onClick={confirmerSuppression}>Supprimer</button>
          </div>
        </Modal>
      )}
    </>
  );
}