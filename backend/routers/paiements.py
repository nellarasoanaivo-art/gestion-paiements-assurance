import uuid
from datetime import date, datetime
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

import models
import schemas
from database import get_db
from security import exiger_roles, get_current_user

router = APIRouter(tags=["Paiements"], dependencies=[Depends(get_current_user)])
exiger_annulation = exiger_roles("ADMIN", "GESTIONNAIRE")


def requete_paiements(db: Session):
    return (db.query(models.Paiement, models.Echeance, models.Contrat, models.Client,
                     models.ModePaiement, models.Utilisateur, models.Quittance)
              .join(models.Echeance, models.Paiement.id_echeance == models.Echeance.id_echeance)
              .join(models.Contrat, models.Echeance.id_contrat == models.Contrat.id_contrat)
              .join(models.Client, models.Contrat.id_client == models.Client.id_client)
              .join(models.ModePaiement,
                    models.Paiement.id_mode_paiement == models.ModePaiement.id_mode_paiement)
              .join(models.Utilisateur,
                    models.Paiement.id_utilisateur == models.Utilisateur.id_utilisateur)
              .outerjoin(models.Quittance, models.Quittance.id_paiement == models.Paiement.id_paiement))


def vers_dict(p, e, c, cl, m, u, q) -> dict:
    return {
        "id_paiement": p.id_paiement,
        "reference": p.reference,
        "montant": p.montant,
        "date_paiement": p.date_paiement,
        "statut": p.statut,
        "id_echeance": p.id_echeance,
        "id_mode_paiement": p.id_mode_paiement,
        "id_utilisateur": p.id_utilisateur,
        "mode_paiement": m.libelle,
        "numero_contrat": c.numero_contrat,
        "client": f"{cl.nom} {cl.prenom}",
        "date_echeance": e.date_echeance,
        "montant_echeance": e.montant_du,
        "operateur": f"{u.prenom} {u.nom}",
        "numero_quittance": q.numero if q else None,
    }


def somme_payee(db: Session, id_echeance: int):
    return (db.query(func.coalesce(func.sum(models.Paiement.montant), 0))
              .filter(models.Paiement.id_echeance == id_echeance,
                      models.Paiement.statut == "VALIDE")
              .scalar())


def recalculer_statut_echeance(db: Session, echeance: models.Echeance):
    paye = somme_payee(db, echeance.id_echeance)
    if paye >= echeance.montant_du:
        echeance.statut = "PAYEE"
    elif paye > 0:
        echeance.statut = "PARTIEL"
    elif echeance.date_echeance < date.today():
        echeance.statut = "EN_RETARD"
    else:
        echeance.statut = "A_PAYER"


@router.get("/modes-paiement", response_model=list[schemas.ModePaiementOut])
def lister_modes(db: Session = Depends(get_db)):
    return db.query(models.ModePaiement).order_by(models.ModePaiement.id_mode_paiement).all()


@router.get("/paiements/contrat/{id_contrat}/echeances", response_model=list[schemas.EcheanceDetail])
def echeances_avec_reste(id_contrat: int, db: Session = Depends(get_db)):
    if not db.get(models.Contrat, id_contrat):
        raise HTTPException(404, "Contrat introuvable")
    payes = dict(
        db.query(models.Paiement.id_echeance, func.sum(models.Paiement.montant))
          .filter(models.Paiement.statut == "VALIDE")
          .group_by(models.Paiement.id_echeance).all()
    )
    echeances = (db.query(models.Echeance)
                   .filter(models.Echeance.id_contrat == id_contrat)
                   .order_by(models.Echeance.date_echeance).all())
    resultat = []
    for e in echeances:
        paye = payes.get(e.id_echeance, Decimal("0"))
        reste = e.montant_du - paye
        en_retard = e.statut in ("A_PAYER", "PARTIEL") and e.date_echeance < date.today()
        resultat.append({
            "id_echeance": e.id_echeance,
            "date_echeance": e.date_echeance,
            "montant_du": e.montant_du,
            "statut": "EN_RETARD" if en_retard else e.statut,
            "id_contrat": e.id_contrat,
            "montant_paye": paye,
            "reste": reste,
        })
    return resultat


@router.get("/paiements", response_model=list[schemas.PaiementDetail])
def lister_paiements(db: Session = Depends(get_db)):
    lignes = (requete_paiements(db)
              .order_by(models.Paiement.date_paiement.desc(), models.Paiement.id_paiement.desc())
              .all())
    return [vers_dict(*ligne) for ligne in lignes]


@router.post("/paiements", response_model=schemas.PaiementDetail, status_code=201)
def enregistrer_paiement(data: schemas.PaiementCreate,
                         utilisateur: models.Utilisateur = Depends(get_current_user),
                         db: Session = Depends(get_db)):
    echeance = db.get(models.Echeance, data.id_echeance)
    if not echeance:
        raise HTTPException(404, "Échéance introuvable")
    if not db.get(models.ModePaiement, data.id_mode_paiement):
        raise HTTPException(404, "Mode de paiement introuvable")
    if echeance.contrat.statut == "RESILIE":
        raise HTTPException(400, "Ce contrat est résilié")

    reste = echeance.montant_du - somme_payee(db, echeance.id_echeance)
    if reste <= 0:
        raise HTTPException(400, "Cette échéance est déjà entièrement payée")
    if data.montant > reste:
        raise HTTPException(400, f"Montant supérieur au reste dû ({reste:.0f} Ar)")

    reference = "PAY-" + datetime.now().strftime("%Y%m%d%H%M%S") + "-" + uuid.uuid4().hex[:6].upper()
    paiement = models.Paiement(
        reference=reference,
        montant=data.montant,
        statut="VALIDE",
        id_echeance=data.id_echeance,
        id_mode_paiement=data.id_mode_paiement,
        id_utilisateur=utilisateur.id_utilisateur,
    )
    db.add(paiement)
    db.flush()

    recalculer_statut_echeance(db, echeance)
    db.add(models.Quittance(numero="QT-" + reference[4:], id_paiement=paiement.id_paiement))
    db.commit()

    ligne = requete_paiements(db).filter(models.Paiement.id_paiement == paiement.id_paiement).first()
    return vers_dict(*ligne)


@router.post("/paiements/{id_paiement}/annuler", response_model=schemas.PaiementDetail,
             dependencies=[Depends(exiger_annulation)])
def annuler_paiement(id_paiement: int, db: Session = Depends(get_db)):
    paiement = db.get(models.Paiement, id_paiement)
    if not paiement:
        raise HTTPException(404, "Paiement introuvable")
    if paiement.statut == "ANNULE":
        raise HTTPException(400, "Ce paiement est déjà annulé")

    paiement.statut = "ANNULE"
    db.flush()
    recalculer_statut_echeance(db, paiement.echeance)
    db.commit()

    ligne = requete_paiements(db).filter(models.Paiement.id_paiement == id_paiement).first()
    return vers_dict(*ligne)