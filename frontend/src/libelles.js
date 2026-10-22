const LIBELLES = {
  A_PAYER: "À payer", PARTIEL: "Partiel", PAYEE: "Payée", EN_RETARD: "En retard",
  EN_ATTENTE: "En attente", VALIDE: "Validé", REJETE: "Rejeté", ANNULE: "Annulé", VERSE: "Versé",
  ACTIF: "Actif", SUSPENDU: "Suspendu", RESILIE: "Résilié", EXPIRE: "Expiré",
  DECLARE: "Déclaré", EN_EXPERTISE: "En expertise", ACCEPTE: "Accepté",
  REFUSE: "Refusé", CLOTURE: "Clôturé",
  MENSUELLE: "Mensuelle", TRIMESTRIELLE: "Trimestrielle",
  SEMESTRIELLE: "Semestrielle", ANNUELLE: "Annuelle",
  ADMIN: "Administrateur", GESTIONNAIRE: "Gestionnaire", CAISSIER: "Caissier",
};

const TONS = {
  PAYEE: "succes", VALIDE: "succes", VERSE: "succes", ACTIF: "succes", ACCEPTE: "succes",
  PARTIEL: "attention", EN_EXPERTISE: "attention", SUSPENDU: "attention", EN_ATTENTE: "attention",
  EN_RETARD: "danger", REJETE: "danger", ANNULE: "danger", RESILIE: "danger", REFUSE: "danger",
  A_PAYER: "info", DECLARE: "info", ADMIN: "info", GESTIONNAIRE: "info",
};

export const libelle = (valeur) => LIBELLES[valeur] ?? valeur;
export const tonDe = (valeur) => TONS[valeur] ?? "neutre";

export const PERIODICITES = ["MENSUELLE", "TRIMESTRIELLE", "SEMESTRIELLE", "ANNUELLE"];

export const formaterDate = (iso) => (iso ? iso.slice(0, 10).split("-").reverse().join("/") : "");
export const formaterDateHeure = (iso) => (iso ? new Date(iso).toLocaleString("fr-FR") : "");