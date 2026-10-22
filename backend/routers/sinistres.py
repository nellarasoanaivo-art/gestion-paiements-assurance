from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from database import get_db
from security import get_current_user
import models
import schemas

router = APIRouter(tags=["Sinistres"])

TRANSITIONS = {
    "DECLARE": {"EN_EXPERTISE", "REFUSE"},
    "EN_EXPERTISE": {"ACCEPTE", "REFUSE"},
    "ACCEPTE": {"CLOTURE"},
    "REFUSE": {"CLOTURE"},
    "CLOTURE": set(),
}


@router.get("/sinistres", response_model=list[schemas.SinistreOut])
def lister_sinistres(db: Session = Depends(get_db)):
    return db.query(models.Sinistre).order_by(models.Sinistre.id_sinistre.desc()).all()


@router.post("/sinistres", response_model=schemas.SinistreOut, status_code=201)
def declarer_sinistre(data: schemas.SinistreCreate, db: Session = Depends(get_db)):
    contrat = db.get(models.Contrat, data.id_contrat)
    if not contrat:
        raise HTTPException(404, "Contrat introuvable")
    if contrat.statut != "ACTIF":
        raise HTTPException(400, "Le contrat n'est pas actif")
    if not (contrat.date_debut <= data.date_survenance <= contrat.date_fin):
        raise HTTPException(400, "Le sinistre est survenu en dehors de la période de couverture")

    # exclude_none : la base applique alors ses valeurs par défaut (date de déclaration, statut)
    sinistre = models.Sinistre(**data.model_dump(exclude_none=True))
    db.add(sinistre)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "Ce numéro de sinistre existe déjà")
    db.refresh(sinistre)
    return sinistre


@router.patch("/sinistres/{id_sinistre}/statut", response_model=schemas.SinistreOut)
def changer_statut(id_sinistre: int, data: schemas.SinistreStatutUpdate,
                   db: Session = Depends(get_db)):
    sinistre = db.get(models.Sinistre, id_sinistre)
    if not sinistre:
        raise HTTPException(404, "Sinistre introuvable")
    if data.statut not in TRANSITIONS.get(sinistre.statut, set()):
        raise HTTPException(400, f"Passage impossible de {sinistre.statut} à {data.statut}")
    sinistre.statut = data.statut
    db.commit()
    db.refresh(sinistre)
    return sinistre


@router.get("/indemnisations", response_model=list[schemas.IndemnisationOut])
def lister_indemnisations(db: Session = Depends(get_db)):
    return (db.query(models.Indemnisation)
              .order_by(models.Indemnisation.id_indemnisation.desc()).all())


@router.post("/indemnisations", response_model=schemas.IndemnisationOut, status_code=201)
def verser_indemnisation(data: schemas.IndemnisationCreate,
                         utilisateur: models.Utilisateur = Depends(get_current_user),
                         db: Session = Depends(get_db)):
    sinistre = db.get(models.Sinistre, data.id_sinistre)
    if not sinistre:
        raise HTTPException(404, "Sinistre introuvable")
    if not db.get(models.ModePaiement, data.id_mode_paiement):
        raise HTTPException(404, "Mode de paiement introuvable")
    if sinistre.statut != "ACCEPTE":
        raise HTTPException(400, "Le sinistre doit être accepté pour être indemnisé")

    deja_verse = (db.query(func.coalesce(func.sum(models.Indemnisation.montant), 0))
                    .filter(models.Indemnisation.id_sinistre == sinistre.id_sinistre,
                            models.Indemnisation.statut != "ANNULE")
                    .scalar())
    if sinistre.montant_estime is not None:
        reste = sinistre.montant_estime - deja_verse
        if data.montant > reste:
            raise HTTPException(400, f"Montant supérieur au reste à indemniser ({reste:.0f} Ar)")

    indemnisation = models.Indemnisation(
        montant=data.montant,
        statut="VERSE",
        id_sinistre=data.id_sinistre,
        id_mode_paiement=data.id_mode_paiement,
        id_utilisateur=utilisateur.id_utilisateur,
    )
    db.add(indemnisation)
    db.commit()
    db.refresh(indemnisation)
    return indemnisation