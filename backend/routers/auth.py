import os

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

import models
import schemas
from database import get_db
from emailing import envoyer_email
from security import (creer_token, creer_token_reinitialisation, exiger_roles,
                      get_current_user, hacher_mot_de_passe,
                      utilisateur_depuis_token_reinitialisation, verifier_mot_de_passe)

router = APIRouter(tags=["Authentification"])
exiger_admin = exiger_roles("ADMIN")


def sortie(u: models.Utilisateur) -> dict:
    return {
        "id_utilisateur": u.id_utilisateur,
        "nom": u.nom,
        "prenom": u.prenom,
        "email": u.email,
        "actif": u.actif,
        "role": u.role.libelle,
    }


# ---------- Connexion ----------
@router.post("/auth/login")
def connexion(data: schemas.LoginIn, db: Session = Depends(get_db)):
    utilisateur = (db.query(models.Utilisateur)
                     .filter(func.lower(models.Utilisateur.email) == data.email.strip().lower())
                     .first())
    if not utilisateur or not verifier_mot_de_passe(data.mot_de_passe, utilisateur.mot_de_passe):
        raise HTTPException(401, "Email ou mot de passe incorrect")
    if not utilisateur.actif:
        raise HTTPException(
            403, "Votre compte est en attente de validation ou désactivé. "
                 "Contactez l'administrateur."
        )
    return {
        "access_token": creer_token(utilisateur),
        "token_type": "bearer",
        "utilisateur": sortie(utilisateur),
    }


@router.get("/auth/me", response_model=schemas.UtilisateurOut)
def moi(utilisateur: models.Utilisateur = Depends(get_current_user)):
    return sortie(utilisateur)


# ---------- Création de compte (public) ----------
@router.post("/auth/inscription", status_code=201)
def inscription(data: schemas.InscriptionIn, db: Session = Depends(get_db)):
    email = data.email.strip().lower()
    if db.query(models.Utilisateur).filter(func.lower(models.Utilisateur.email) == email).first():
        raise HTTPException(409, "Cet email est déjà utilisé")

    # Rôle le plus restreint ; l'administrateur l'ajustera à la validation
    role = db.query(models.Role).filter(models.Role.libelle == "CAISSIER").first()
    if not role:
        raise HTTPException(500, "Rôle par défaut introuvable")

    db.add(models.Utilisateur(
        nom=data.nom.strip(),
        prenom=data.prenom.strip(),
        email=email,
        mot_de_passe=hacher_mot_de_passe(data.mot_de_passe),
        actif=False,
        id_role=role.id_role,
    ))
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "Cet email est déjà utilisé")
    return {"message": "Votre demande a été enregistrée. Un administrateur doit valider "
                       "votre compte avant votre première connexion."}


# ---------- Mot de passe oublié (public) ----------
@router.post("/auth/mot-de-passe-oublie")
def mot_de_passe_oublie(data: schemas.MotDePasseOublieIn, taches: BackgroundTasks,
                        db: Session = Depends(get_db)):
    utilisateur = (db.query(models.Utilisateur)
                     .filter(func.lower(models.Utilisateur.email) == data.email.strip().lower())
                     .first())
    if utilisateur and utilisateur.actif:
        base = os.getenv("FRONTEND_URL", "http://localhost:5173").rstrip("/")
        lien = f"{base}/reinitialiser?token={creer_token_reinitialisation(utilisateur)}"
        corps = (
            f"Bonjour {utilisateur.prenom},\n\n"
            "Vous avez demandé la réinitialisation de votre mot de passe.\n"
            "Cliquez sur le lien ci-dessous (valable 30 minutes, utilisable une seule fois) :\n\n"
            f"{lien}\n\n"
            "Si vous n'êtes pas à l'origine de cette demande, ignorez ce message : "
            "votre mot de passe reste inchangé."
        )
        taches.add_task(envoyer_email, utilisateur.email,
                        "Réinitialisation de votre mot de passe", corps)

    # Même réponse dans tous les cas : on ne révèle pas quelles adresses existent
    return {"message": "Si un compte actif correspond à cette adresse, "
                       "un lien de réinitialisation vient d'être envoyé."}


@router.post("/auth/reinitialiser-mot-de-passe")
def reinitialiser(data: schemas.ReinitialisationIn, db: Session = Depends(get_db)):
    utilisateur = utilisateur_depuis_token_reinitialisation(data.token, db)
    utilisateur.mot_de_passe = hacher_mot_de_passe(data.mot_de_passe)
    db.commit()
    return {"message": "Votre mot de passe a été modifié."}


# ---------- Gestion des utilisateurs (administrateur) ----------
@router.get("/roles", response_model=list[schemas.RoleOut], dependencies=[Depends(exiger_admin)])
def lister_roles(db: Session = Depends(get_db)):
    return db.query(models.Role).order_by(models.Role.id_role).all()


@router.get("/utilisateurs", response_model=list[schemas.UtilisateurOut],
            dependencies=[Depends(exiger_admin)])
def lister_utilisateurs(db: Session = Depends(get_db)):
    liste = db.query(models.Utilisateur).order_by(models.Utilisateur.id_utilisateur).all()
    return [sortie(u) for u in liste]


@router.post("/utilisateurs", response_model=schemas.UtilisateurOut, status_code=201,
             dependencies=[Depends(exiger_admin)])
def creer_utilisateur(data: schemas.UtilisateurCreate, db: Session = Depends(get_db)):
    if not db.get(models.Role, data.id_role):
        raise HTTPException(404, "Rôle introuvable")
    email = data.email.strip().lower()
    if db.query(models.Utilisateur).filter(func.lower(models.Utilisateur.email) == email).first():
        raise HTTPException(409, "Cet email est déjà utilisé")

    utilisateur = models.Utilisateur(
        nom=data.nom.strip(),
        prenom=data.prenom.strip(),
        email=email,
        mot_de_passe=hacher_mot_de_passe(data.mot_de_passe),
        id_role=data.id_role,
    )
    db.add(utilisateur)
    db.commit()
    db.refresh(utilisateur)
    return sortie(utilisateur)


@router.patch("/utilisateurs/{id_utilisateur}/actif", response_model=schemas.UtilisateurOut)
def basculer_actif(id_utilisateur: int,
                   admin: models.Utilisateur = Depends(exiger_admin),
                   db: Session = Depends(get_db)):
    utilisateur = db.get(models.Utilisateur, id_utilisateur)
    if not utilisateur:
        raise HTTPException(404, "Utilisateur introuvable")
    if utilisateur.id_utilisateur == admin.id_utilisateur:
        raise HTTPException(400, "Vous ne pouvez pas désactiver votre propre compte")
    utilisateur.actif = not utilisateur.actif
    db.commit()
    db.refresh(utilisateur)
    return sortie(utilisateur)


@router.patch("/utilisateurs/{id_utilisateur}/role", response_model=schemas.UtilisateurOut)
def changer_role(id_utilisateur: int, data: schemas.RoleUpdate,
                 admin: models.Utilisateur = Depends(exiger_admin),
                 db: Session = Depends(get_db)):
    utilisateur = db.get(models.Utilisateur, id_utilisateur)
    if not utilisateur:
        raise HTTPException(404, "Utilisateur introuvable")
    if utilisateur.id_utilisateur == admin.id_utilisateur:
        raise HTTPException(400, "Vous ne pouvez pas modifier votre propre rôle")
    role = db.get(models.Role, data.id_role)
    if not role:
        raise HTTPException(404, "Rôle introuvable")
    utilisateur.id_role = role.id_role
    db.commit()
    db.refresh(utilisateur)
    return sortie(utilisateur)


@router.put("/utilisateurs/{id_utilisateur}/mot-de-passe", status_code=204,
            dependencies=[Depends(exiger_admin)])
def reinitialiser_mot_de_passe(id_utilisateur: int, data: schemas.NouveauMotDePasse,
                               db: Session = Depends(get_db)):
    utilisateur = db.get(models.Utilisateur, id_utilisateur)
    if not utilisateur:
        raise HTTPException(404, "Utilisateur introuvable")
    utilisateur.mot_de_passe = hacher_mot_de_passe(data.mot_de_passe)
    db.commit()