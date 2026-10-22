import hashlib
import hmac
import os
from datetime import datetime, timedelta, timezone

import bcrypt
import jwt
from dotenv import load_dotenv
from fastapi import Depends, HTTPException, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

import models
from database import get_db

load_dotenv()

SECRET_KEY = os.getenv("SECRET_KEY")
if not SECRET_KEY:
    raise RuntimeError("SECRET_KEY manquante : ajoutez-la dans backend/.env")

ALGORITHME = "HS256"
DUREE_SESSION = timedelta(hours=8)
DUREE_REINITIALISATION = timedelta(minutes=30)
METHODES_ECRITURE = {"POST", "PUT", "PATCH", "DELETE"}
schema_bearer = HTTPBearer(auto_error=False)


def hacher_mot_de_passe(mot_de_passe: str) -> str:
    # bcrypt ne lit que les 72 premiers octets
    return bcrypt.hashpw(mot_de_passe.encode("utf-8")[:72], bcrypt.gensalt()).decode("utf-8")


def verifier_mot_de_passe(mot_de_passe: str, hache: str) -> bool:
    try:
        return bcrypt.checkpw(mot_de_passe.encode("utf-8")[:72], hache.encode("utf-8"))
    except ValueError:
        return False


def creer_token(utilisateur: models.Utilisateur) -> str:
    charge = {
        "sub": str(utilisateur.id_utilisateur),
        "typ": "access",
        "exp": datetime.now(timezone.utc) + DUREE_SESSION,
    }
    return jwt.encode(charge, SECRET_KEY, algorithm=ALGORITHME)


# ---------- Réinitialisation du mot de passe ----------
def _empreinte(utilisateur: models.Utilisateur) -> str:
    """Change dès que le mot de passe change : le lien devient alors inutilisable."""
    return hashlib.sha256(utilisateur.mot_de_passe.encode("utf-8")).hexdigest()[:16]


def creer_token_reinitialisation(utilisateur: models.Utilisateur) -> str:
    charge = {
        "sub": str(utilisateur.id_utilisateur),
        "typ": "reset",
        "fp": _empreinte(utilisateur),
        "exp": datetime.now(timezone.utc) + DUREE_REINITIALISATION,
    }
    return jwt.encode(charge, SECRET_KEY, algorithm=ALGORITHME)


def utilisateur_depuis_token_reinitialisation(token: str, db: Session) -> models.Utilisateur:
    erreur = HTTPException(
        400, "Ce lien est invalide ou a expiré. Refaites une demande de réinitialisation."
    )
    try:
        charge = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHME])
        if charge.get("typ") != "reset":
            raise ValueError("type de jeton invalide")
        id_utilisateur = int(charge["sub"])
    except (jwt.PyJWTError, KeyError, ValueError):
        raise erreur

    utilisateur = db.get(models.Utilisateur, id_utilisateur)
    if (utilisateur is None or not utilisateur.actif
            or not hmac.compare_digest(str(charge.get("fp", "")), _empreinte(utilisateur))):
        raise erreur
    return utilisateur


# ---------- Utilisateur courant et rôles ----------
def get_current_user(
    identifiants: HTTPAuthorizationCredentials = Depends(schema_bearer),
    db: Session = Depends(get_db),
) -> models.Utilisateur:
    if identifiants is None:
        raise HTTPException(401, "Authentification requise")
    try:
        charge = jwt.decode(identifiants.credentials, SECRET_KEY, algorithms=[ALGORITHME])
        if charge.get("typ") != "access":
            raise ValueError("type de jeton invalide")
        id_utilisateur = int(charge["sub"])
    except (jwt.PyJWTError, KeyError, ValueError):
        raise HTTPException(401, "Session expirée ou invalide")

    utilisateur = db.get(models.Utilisateur, id_utilisateur)
    if utilisateur is None or not utilisateur.actif:
        raise HTTPException(401, "Compte inexistant ou désactivé")
    return utilisateur


def exiger_roles(*roles: str):
    """Autorise uniquement les rôles indiqués (toutes méthodes)."""
    def verifier(utilisateur: models.Utilisateur = Depends(get_current_user)):
        if utilisateur.role.libelle not in roles:
            raise HTTPException(403, "Action non autorisée pour votre rôle")
        return utilisateur
    return verifier


def ecriture_reservee(*roles: str):
    """Lecture ouverte à tout utilisateur connecté ; écriture réservée aux rôles indiqués."""
    def verifier(request: Request, utilisateur: models.Utilisateur = Depends(get_current_user)):
        if request.method in METHODES_ECRITURE and utilisateur.role.libelle not in roles:
            raise HTTPException(403, "Action non autorisée pour votre rôle")
        return utilisateur
    return verifier