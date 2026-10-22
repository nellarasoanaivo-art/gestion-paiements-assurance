from collections import defaultdict
from datetime import date, datetime

from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

import models
from database import get_db
from security import get_current_user

router = APIRouter(tags=["Tableau de bord"])


def _f(valeur) -> float:
    return float(valeur or 0)


def _mois_precedents(n: int) -> list[tuple[int, int]]:
    """Les n derniers mois (année, mois), du plus ancien au mois courant."""
    aujourdhui = date.today()
    resultat = []
    for i in range(n - 1, -1, -1):
        m = aujourdhui.month - 1 - i
        resultat.append((aujourdhui.year + m // 12, m % 12 + 1))
    return resultat


@router.get("/dashboard")
def tableau_de_bord(utilisateur: models.Utilisateur = Depends(get_current_user),
                    db: Session = Depends(get_db)):
    aujourdhui = date.today()
    gestion = utilisateur.role.libelle in ("ADMIN", "GESTIONNAIRE")
    valide = models.Paiement.statut == "VALIDE"

    # ---------- Encaissements ----------
    total_encaisse = db.query(func.coalesce(func.sum(models.Paiement.montant), 0)).filter(valide).scalar()
    nb_paiements = db.query(func.count(models.Paiement.id_paiement)).filter(valide).scalar()
    debut_mois = datetime(aujourdhui.year, aujourdhui.month, 1)
    encaisse_mois = (db.query(func.coalesce(func.sum(models.Paiement.montant), 0))
                       .filter(valide, models.Paiement.date_paiement >= debut_mois).scalar())

    # ---------- Série des 12 derniers mois ----------
    mois = _mois_precedents(12)
    debut_serie = datetime(mois[0][0], mois[0][1], 1)

    encaisse_par_mois = defaultdict(float)
    for date_p, montant in (db.query(models.Paiement.date_paiement, models.Paiement.montant)
                              .filter(valide, models.Paiement.date_paiement >= debut_serie).all()):
        encaisse_par_mois[(date_p.year, date_p.month)] += _f(montant)

    indemnise_par_mois = defaultdict(float)
    if gestion:
        for date_i, montant in (db.query(models.Indemnisation.date_versement,
                                         models.Indemnisation.montant)
                                  .filter(models.Indemnisation.statut == "VERSE",
                                          models.Indemnisation.date_versement >= debut_serie).all()):
            indemnise_par_mois[(date_i.year, date_i.month)] += _f(montant)

    mensuel = [{
        "annee": a, "mois": m,
        "encaisse": encaisse_par_mois[(a, m)],
        "indemnise": indemnise_par_mois[(a, m)] if gestion else None,
    } for a, m in mois]

    # ---------- Échéances ----------
    payes = dict(db.query(models.Paiement.id_echeance, func.sum(models.Paiement.montant))
                   .filter(valide).group_by(models.Paiement.id_echeance).all())
    lignes = (db.query(models.Echeance, models.Contrat, models.Client)
                .join(models.Contrat, models.Echeance.id_contrat == models.Contrat.id_contrat)
                .join(models.Client, models.Contrat.id_client == models.Client.id_client)
                .filter(models.Contrat.statut != "RESILIE").all())

    repartition = {"payees": 0, "partielles": 0, "a_venir": 0, "en_retard": 0}
    retards = []
    montant_retard = 0.0
    nb_a_venir, montant_a_venir = 0, 0.0

    for echeance, contrat, client in lignes:
        paye = _f(payes.get(echeance.id_echeance))
        reste = _f(echeance.montant_du) - paye
        if reste <= 0.005:
            repartition["payees"] += 1
        elif echeance.date_echeance < aujourdhui:
            repartition["en_retard"] += 1
            montant_retard += reste
            retards.append({
                "id_echeance": echeance.id_echeance,
                "client": f"{client.nom} {client.prenom}",
                "numero_contrat": contrat.numero_contrat,
                "date_echeance": echeance.date_echeance,
                "jours": (aujourdhui - echeance.date_echeance).days,
                "reste": reste,
            })
        else:
            repartition["partielles" if paye > 0 else "a_venir"] += 1
            nb_a_venir += 1
            montant_a_venir += reste

    retards.sort(key=lambda r: r["date_echeance"])

    # ---------- Modes de paiement ----------
    modes = (db.query(models.ModePaiement.libelle,
                      func.sum(models.Paiement.montant),
                      func.count(models.Paiement.id_paiement))
               .join(models.Paiement,
                     models.Paiement.id_mode_paiement == models.ModePaiement.id_mode_paiement)
               .filter(valide)
               .group_by(models.ModePaiement.libelle)
               .order_by(func.sum(models.Paiement.montant).desc()).all())

    # ---------- Derniers paiements encaissés ----------
    derniers = (db.query(models.Paiement, models.Contrat, models.Client, models.ModePaiement)
                  .join(models.Echeance, models.Paiement.id_echeance == models.Echeance.id_echeance)
                  .join(models.Contrat, models.Echeance.id_contrat == models.Contrat.id_contrat)
                  .join(models.Client, models.Contrat.id_client == models.Client.id_client)
                  .join(models.ModePaiement,
                        models.Paiement.id_mode_paiement == models.ModePaiement.id_mode_paiement)
                  .filter(valide)
                  .order_by(models.Paiement.date_paiement.desc(), models.Paiement.id_paiement.desc())
                  .limit(6).all())

    # ---------- Indicateurs réservés à la gestion ----------
    clients = contrats_actifs = sinistres_en_cours = indemnites = None
    if gestion:
        clients = db.query(func.count(models.Client.id_client)).scalar()
        contrats_actifs = (db.query(func.count(models.Contrat.id_contrat))
                             .filter(models.Contrat.statut == "ACTIF").scalar())
        sinistres_en_cours = (db.query(func.count(models.Sinistre.id_sinistre))
                                .filter(models.Sinistre.statut.in_(["DECLARE", "EN_EXPERTISE", "ACCEPTE"]))
                                .scalar())
        indemnites = _f(db.query(func.coalesce(func.sum(models.Indemnisation.montant), 0))
                          .filter(models.Indemnisation.statut == "VERSE").scalar())

    return {
        "gestion": gestion,
        "encaisse_total": _f(total_encaisse),
        "encaisse_mois": _f(encaisse_mois),
        "nb_paiements": nb_paiements,
        "en_retard": {"nombre": len(retards), "montant": montant_retard, "liste": retards[:6]},
        "a_venir": {"nombre": nb_a_venir, "montant": montant_a_venir},
        "echeances": repartition,
        "mensuel": mensuel,
        "modes": [{"libelle": l, "montant": _f(m), "nombre": n} for l, m, n in modes],
        "derniers": [{
            "reference": p.reference,
            "date_paiement": p.date_paiement,
            "montant": _f(p.montant),
            "client": f"{cl.nom} {cl.prenom}",
            "numero_contrat": c.numero_contrat,
            "mode": m.libelle,
        } for p, c, cl, m in derniers],
        "clients": clients,
        "contrats_actifs": contrats_actifs,
        "sinistres_en_cours": sinistres_en_cours,
        "indemnites": indemnites,
    }