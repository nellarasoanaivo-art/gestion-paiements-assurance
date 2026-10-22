from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

import models
import schemas
from database import get_db

router = APIRouter(prefix="/clients", tags=["Clients"])


def verifier_doublons(db: Session, donnees: dict, id_exclu=None) -> None:
    base = db.query(models.Client)
    if id_exclu is not None:
        base = base.filter(models.Client.id_client != id_exclu)

    if base.filter(func.lower(models.Client.nom) == donnees["nom"].lower(),
                   func.lower(models.Client.prenom) == donnees["prenom"].lower()).first():
        raise HTTPException(409, "Un client avec ce nom et ce prénom existe déjà")
    if base.filter(models.Client.cin == donnees["cin"]).first():
        raise HTTPException(409, "Ce numéro CIN est déjà enregistré")
    if base.filter(func.lower(models.Client.email) == donnees["email"].lower()).first():
        raise HTTPException(409, "Cet email est déjà utilisé")
    if base.filter(models.Client.telephone == donnees["telephone"]).first():
        raise HTTPException(409, "Ce numéro de téléphone est déjà utilisé")


def traduire_erreur(e: IntegrityError) -> HTTPException:
    detail = str(e.orig)
    print("ERREUR BASE :", detail)
    if "ux_client_cin" in detail or "client_cin_key" in detail:
        return HTTPException(409, "Ce numéro CIN est déjà enregistré")
    if "client_email_key" in detail:
        return HTTPException(409, "Cet email est déjà utilisé")
    if "ux_client_telephone" in detail:
        return HTTPException(409, "Ce numéro de téléphone est déjà utilisé")
    if "ux_client_nom_prenom" in detail:
        return HTTPException(409, "Un client avec ce nom et ce prénom existe déjà")
    return HTTPException(400, "Erreur d'intégrité : " + detail.splitlines()[0])


@router.get("", response_model=list[schemas.ClientOut])
def lister_clients(db: Session = Depends(get_db)):
    return db.query(models.Client).order_by(models.Client.id_client).all()


@router.get("/{id_client}", response_model=schemas.ClientOut)
def detail_client(id_client: int, db: Session = Depends(get_db)):
    client = db.get(models.Client, id_client)
    if not client:
        raise HTTPException(404, "Client introuvable")
    return client


@router.post("", response_model=schemas.ClientOut, status_code=201)
def creer_client(data: schemas.ClientCreate, db: Session = Depends(get_db)):
    donnees = data.model_dump()
    verifier_doublons(db, donnees)
    client = models.Client(**donnees)
    db.add(client)
    try:
        db.commit()
    except IntegrityError as e:
        db.rollback()
        raise traduire_erreur(e)
    db.refresh(client)
    return client


@router.put("/{id_client}", response_model=schemas.ClientOut)
def modifier_client(id_client: int, data: schemas.ClientCreate, db: Session = Depends(get_db)):
    client = db.get(models.Client, id_client)
    if not client:
        raise HTTPException(404, "Client introuvable")
    donnees = data.model_dump()
    verifier_doublons(db, donnees, id_exclu=id_client)
    for champ, valeur in donnees.items():
        setattr(client, champ, valeur)
    try:
        db.commit()
    except IntegrityError as e:
        db.rollback()
        raise traduire_erreur(e)
    db.refresh(client)
    return client


@router.delete("/{id_client}", status_code=204)
def supprimer_client(id_client: int, db: Session = Depends(get_db)):
    client = db.get(models.Client, id_client)
    if not client:
        raise HTTPException(404, "Client introuvable")
    try:
        db.delete(client)
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "Suppression impossible : ce client a des contrats")