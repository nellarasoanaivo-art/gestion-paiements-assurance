import calendar
from datetime import date
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

import models
import schemas
from database import get_db

router = APIRouter(tags=["Contrats"])

NB_ECHEANCES_PAR_AN = {"MENSUELLE": 12, "TRIMESTRIELLE": 4, "SEMESTRIELLE": 2, "ANNUELLE": 1}


def ajouter_mois(d: date, n: int) -> date:
    mois = d.month - 1 + n
    annee = d.year + mois // 12
    mois = mois % 12 + 1
    jour = min(d.day, calendar.monthrange(annee, mois)[1])
    return date(annee, mois, jour)


def generer_echeances(db: Session, id_contrat: int, date_debut: date, date_fin: date,
                      prime_annuelle: Decimal, periodicite: str):
    """Une échéance par période, de la date de début jusqu'à la date de fin.
    Montant d'une échéance = prime annuelle / nombre de périodes par an."""
    par_an = NB_ECHEANCES_PAR_AN[periodicite]
    pas = 12 // par_an

    dates = []
    i = 0
    while i < 600:
        d = ajouter_mois(date_debut, i * pas)
        if d > date_fin:
            break
        dates.append(d)
        i += 1

    montant = (prime_annuelle / par_an).quantize(Decimal("0.01"))
    montants = [montant] * len(dates)
    if len(dates) == par_an:  
        montants[-1] = prime_annuelle - montant * (par_an - 1)

    for d, m in zip(dates, montants):
        db.add(models.Echeance(id_contrat=id_contrat, date_echeance=d, montant_du=m))


def contrat_a_des_paiements(db: Session, id_contrat: int) -> bool:
    return (db.query(models.Paiement.id_paiement)
              .join(models.Echeance, models.Paiement.id_echeance == models.Echeance.id_echeance)
              .filter(models.Echeance.id_contrat == id_contrat)
              .first()) is not None


def contrat_a_des_sinistres(db: Session, id_contrat: int) -> bool:
    return (db.query(models.Sinistre.id_sinistre)
              .filter(models.Sinistre.id_contrat == id_contrat)
              .first()) is not None



@router.get("/types-assurance", response_model=list[schemas.TypeAssuranceOut])
def lister_types(db: Session = Depends(get_db)):
    return db.query(models.TypeAssurance).order_by(models.TypeAssurance.libelle).all()



def produit_vers_dict(p: models.ProduitAssurance) -> dict:
    types = sorted(p.types, key=lambda t: t.id_type_assurance)
    return {
        "id_produit": p.id_produit,
        "nom": p.nom,
        "description": p.description,
        "prime_base": p.prime_base,
        "id_type_assurance": p.id_type_assurance,
        "ids_types": [t.id_type_assurance for t in types],
        "types": [t.libelle for t in types],
    }


def charger_types(db: Session, ids: list[int]) -> list[models.TypeAssurance]:
    ids = list(dict.fromkeys(ids))  
    trouves = {t.id_type_assurance: t for t in
               db.query(models.TypeAssurance)
                 .filter(models.TypeAssurance.id_type_assurance.in_(ids)).all()}
    if len(trouves) != len(ids):
        raise HTTPException(404, "Type d'assurance introuvable")
    return [trouves[i] for i in ids]


@router.get("/produits", response_model=list[schemas.ProduitOut])
def lister_produits(db: Session = Depends(get_db)):
    produits = db.query(models.ProduitAssurance).order_by(models.ProduitAssurance.id_produit).all()
    return [produit_vers_dict(p) for p in produits]


@router.post("/produits", response_model=schemas.ProduitOut, status_code=201)
def creer_produit(data: schemas.ProduitCreate, db: Session = Depends(get_db)):
    types = charger_types(db, data.ids_types)
    produit = models.ProduitAssurance(
        nom=data.nom.strip(),
        description=data.description,
        prime_base=data.prime_base,
        id_type_assurance=types[0].id_type_assurance,
    )
    produit.types = types
    db.add(produit)
    db.commit()
    db.refresh(produit)
    return produit_vers_dict(produit)


@router.put("/produits/{id_produit}", response_model=schemas.ProduitOut)
def modifier_produit(id_produit: int, data: schemas.ProduitCreate, db: Session = Depends(get_db)):
    produit = db.get(models.ProduitAssurance, id_produit)
    if not produit:
        raise HTTPException(404, "Produit introuvable")
    types = charger_types(db, data.ids_types)
    produit.nom = data.nom.strip()
    produit.description = data.description
    produit.prime_base = data.prime_base
    produit.id_type_assurance = types[0].id_type_assurance
    produit.types = types
    db.commit()
    db.refresh(produit)
    return produit_vers_dict(produit)


@router.delete("/produits/{id_produit}", status_code=204)
def supprimer_produit(id_produit: int, db: Session = Depends(get_db)):
    produit = db.get(models.ProduitAssurance, id_produit)
    if not produit:
        raise HTTPException(404, "Produit introuvable")
    if db.query(models.Contrat.id_contrat).filter(models.Contrat.id_produit == id_produit).first():
        raise HTTPException(409, "Suppression impossible : des contrats utilisent ce produit")
    db.delete(produit)
    db.commit()



@router.get("/contrats", response_model=list[schemas.ContratOut])
def lister_contrats(db: Session = Depends(get_db)):
    return db.query(models.Contrat).order_by(models.Contrat.id_contrat).all()


@router.get("/contrats/{id_contrat}", response_model=schemas.ContratOut)
def detail_contrat(id_contrat: int, db: Session = Depends(get_db)):
    contrat = db.get(models.Contrat, id_contrat)
    if not contrat:
        raise HTTPException(404, "Contrat introuvable")
    return contrat


@router.post("/contrats", response_model=schemas.ContratOut, status_code=201)
def creer_contrat(data: schemas.ContratCreate, db: Session = Depends(get_db)):
    if not db.get(models.Client, data.id_client):
        raise HTTPException(404, "Client introuvable")
    if not db.get(models.ProduitAssurance, data.id_produit):
        raise HTTPException(404, "Produit introuvable")

    contrat = models.Contrat(**data.model_dump())
    db.add(contrat)
    try:
        db.flush()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "Ce numéro de contrat existe déjà")

    generer_echeances(db, contrat.id_contrat, data.date_debut, data.date_fin,
                      data.prime_annuelle, data.periodicite)
    db.commit()
    db.refresh(contrat)
    return contrat


@router.put("/contrats/{id_contrat}", response_model=schemas.ContratOut)
def modifier_contrat(id_contrat: int, data: schemas.ContratUpdate,
                     db: Session = Depends(get_db)):
    contrat = db.get(models.Contrat, id_contrat)
    if not contrat:
        raise HTTPException(404, "Contrat introuvable")
    if not db.get(models.Client, data.id_client):
        raise HTTPException(404, "Client introuvable")
    if not db.get(models.ProduitAssurance, data.id_produit):
        raise HTTPException(404, "Produit introuvable")

    structure_modifiee = (
        data.date_debut != contrat.date_debut
        or data.prime_annuelle != contrat.prime_annuelle
        or data.periodicite != contrat.periodicite
    )
    fin_modifiee = data.date_fin != contrat.date_fin
    a_des_paiements = contrat_a_des_paiements(db, id_contrat)

    if structure_modifiee and a_des_paiements:
        raise HTTPException(
            400,
            "Impossible de modifier la date de début, la prime ou la périodicité : "
            "des paiements ont déjà été enregistrés sur ce contrat",
        )
    regenerer = (structure_modifiee or fin_modifiee) and not a_des_paiements

    contrat.numero_contrat = data.numero_contrat
    contrat.date_debut = data.date_debut
    contrat.date_fin = data.date_fin
    contrat.prime_annuelle = data.prime_annuelle
    contrat.periodicite = data.periodicite
    contrat.statut = data.statut
    contrat.id_client = data.id_client
    contrat.id_produit = data.id_produit

    try:
        if regenerer:
            (db.query(models.Echeance)
               .filter(models.Echeance.id_contrat == id_contrat)
               .delete(synchronize_session=False))
            db.flush()
            generer_echeances(db, id_contrat, data.date_debut, data.date_fin,
                              data.prime_annuelle, data.periodicite)
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "Ce numéro de contrat existe déjà")

    db.refresh(contrat)
    return contrat


@router.delete("/contrats/{id_contrat}", status_code=204)
def supprimer_contrat(id_contrat: int, db: Session = Depends(get_db)):
    contrat = db.get(models.Contrat, id_contrat)
    if not contrat:
        raise HTTPException(404, "Contrat introuvable")
    if contrat_a_des_paiements(db, id_contrat):
        raise HTTPException(
            409, "Suppression impossible : ce contrat a des paiements. "
                 "Passez-le plutôt au statut RESILIE."
        )
    if contrat_a_des_sinistres(db, id_contrat):
        raise HTTPException(
            409, "Suppression impossible : ce contrat a des sinistres. "
                 "Passez-le plutôt au statut RESILIE."
        )

    (db.query(models.Echeance)
       .filter(models.Echeance.id_contrat == id_contrat)
       .delete(synchronize_session=False))
    db.delete(contrat)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "Suppression impossible : le contrat est référencé ailleurs")


@router.get("/contrats/{id_contrat}/echeances", response_model=list[schemas.EcheanceOut])
def echeances_du_contrat(id_contrat: int, db: Session = Depends(get_db)):
    if not db.get(models.Contrat, id_contrat):
        raise HTTPException(404, "Contrat introuvable")
    return (db.query(models.Echeance)
              .filter(models.Echeance.id_contrat == id_contrat)
              .order_by(models.Echeance.date_echeance).all())