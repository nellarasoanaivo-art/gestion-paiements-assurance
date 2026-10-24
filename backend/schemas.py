import re
from datetime import date, datetime
from decimal import Decimal
from typing import Literal, Optional
from pydantic import (BaseModel, ConfigDict, Field, field_validator, model_validator)

LIMITE_NAISSANCE = date(2006, 12, 31)
REGEX_EMAIL = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def normaliser_telephone(valeur: str) -> str:
    t = re.sub(r"[\s.\-()]", "", valeur)
    if t.startswith("+261"):
        t = "0" + t[4:]
    elif t.startswith("00261"):
        t = "0" + t[5:]
    return t


def capitaliser(texte: str) -> str:
    return re.sub(r"[^\s\-']+", lambda m: m.group(0)[:1].upper() + m.group(0)[1:].lower(),
                  texte.strip())


class ClientCreate(BaseModel):
    nom: str = Field(min_length=1, max_length=100)
    prenom: str = Field(min_length=1, max_length=100)
    sexe: Literal["F", "M"]
    cin: str
    date_naissance: date
    email: str = Field(max_length=150)
    telephone: str
    adresse: Optional[str] = Field(default=None, max_length=255)
    ville: Optional[str] = Field(default=None, max_length=100)
    code_postal: Optional[str] = Field(default=None, max_length=10)

    @field_validator("nom")
    @classmethod
    def _nom(cls, v: str) -> str:
        v = v.strip().upper()
        if not v:
            raise ValueError("Le nom est obligatoire")
        return v

    @field_validator("prenom")
    @classmethod
    def _prenom(cls, v: str) -> str:
        v = capitaliser(v)
        if not v:
            raise ValueError("Le prénom est obligatoire")
        return v

    @field_validator("cin")
    @classmethod
    def _cin(cls, v: str) -> str:
        v = re.sub(r"\s", "", v)
        if not re.fullmatch(r"\d{12}", v):
            raise ValueError("Le CIN doit comporter exactement 12 chiffres")
        return v

    @field_validator("date_naissance")
    @classmethod
    def _naissance(cls, v: date) -> date:
        if v > LIMITE_NAISSANCE:
            raise ValueError("La date de naissance ne peut pas dépasser le 31/12/2006")
        if v < date(1900, 1, 1):
            raise ValueError("Date de naissance invalide")
        return v

    @field_validator("email")
    @classmethod
    def _email(cls, v: str) -> str:
        v = v.strip().lower()
        if not REGEX_EMAIL.match(v):
            raise ValueError("Format d'email invalide (exemple : exemple@gmail.com)")
        return v

    @field_validator("telephone")
    @classmethod
    def _telephone(cls, v: str) -> str:
        v = normaliser_telephone(v)
        if not re.fullmatch(r"0\d{9}", v):
            raise ValueError("Numéro de téléphone invalide (exemple : 034 12 345 67)")
        return v

    @field_validator("adresse", "ville", "code_postal")
    @classmethod
    def _facultatifs(cls, v: Optional[str]) -> Optional[str]:
        return (v.strip() or None) if v else None

    @model_validator(mode="after")
    def _coherence_cin(self):
        attendu = "2" if self.sexe == "F" else "1"
        if self.cin[5] != attendu:
            raise ValueError(
                f"Le 6e chiffre du CIN doit être {attendu} pour "
                f"{'une femme' if self.sexe == 'F' else 'un homme'}"
            )
        return self


class ClientOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id_client: int
    nom: str
    prenom: str
    sexe: Optional[str] = None
    cin: Optional[str] = None
    date_naissance: Optional[date] = None
    email: Optional[str] = None
    telephone: Optional[str] = None
    adresse: Optional[str] = None
    ville: Optional[str] = None
    code_postal: Optional[str] = None
    pays: Optional[str] = None
    date_creation: Optional[datetime] = None



class TypeAssuranceOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id_type_assurance: int
    libelle: str
    description: Optional[str] = None
    prime_reference: Decimal


class ProduitCreate(BaseModel):
    nom: str = Field(min_length=1, max_length=120)
    description: Optional[str] = None
    prime_base: Decimal = Field(ge=0)
    ids_types: list[int] = Field(min_length=1)


class ProduitOut(BaseModel):
    id_produit: int
    nom: str
    description: Optional[str] = None
    prime_base: Decimal
    id_type_assurance: Optional[int] = None
    ids_types: list[int]
    types: list[str]



Periodicite = Literal["MENSUELLE", "TRIMESTRIELLE", "SEMESTRIELLE", "ANNUELLE"]


class ContratCreate(BaseModel):
    numero_contrat: str = Field(min_length=1, max_length=30)
    date_debut: date
    date_fin: date
    prime_annuelle: Decimal = Field(gt=0)
    periodicite: Periodicite
    id_client: int
    id_produit: int

    @model_validator(mode="after")
    def verifier_dates(self):
        if self.date_fin <= self.date_debut:
            raise ValueError("date_fin doit être postérieure à date_debut")
        return self


class ContratUpdate(ContratCreate):
    statut: Literal["ACTIF", "SUSPENDU", "RESILIE", "EXPIRE"]


class ContratOut(ContratCreate):
    model_config = ConfigDict(from_attributes=True)
    id_contrat: int
    statut: Optional[str] = None


class EcheanceOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id_echeance: int
    date_echeance: date
    montant_du: Decimal
    statut: Optional[str] = None
    id_contrat: int


class EcheanceDetail(EcheanceOut):
    montant_paye: Decimal
    reste: Decimal



class ModePaiementOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id_mode_paiement: int
    libelle: str


class PaiementCreate(BaseModel):
    id_echeance: int
    id_mode_paiement: int
    montant: Decimal = Field(gt=0)


class PaiementDetail(BaseModel):
    id_paiement: int
    reference: str
    montant: Decimal
    date_paiement: Optional[datetime] = None
    statut: Optional[str] = None
    id_echeance: int
    id_mode_paiement: int
    id_utilisateur: int
    mode_paiement: str
    numero_contrat: str
    client: str
    date_echeance: date
    montant_echeance: Decimal
    operateur: str
    numero_quittance: Optional[str] = None



StatutSinistre = Literal["DECLARE", "EN_EXPERTISE", "ACCEPTE", "REFUSE", "CLOTURE"]


class SinistreCreate(BaseModel):
    numero_sinistre: str = Field(min_length=1, max_length=30)
    date_survenance: date
    date_declaration: Optional[date] = None
    description: Optional[str] = None
    montant_estime: Optional[Decimal] = Field(default=None, ge=0)
    id_contrat: int

    @model_validator(mode="after")
    def verifier_dates(self):
        if self.date_survenance > date.today():
            raise ValueError("La date de survenance ne peut pas être dans le futur")
        if self.date_declaration and self.date_declaration < self.date_survenance:
            raise ValueError("La date de déclaration doit être postérieure à la survenance")
        return self


class SinistreOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id_sinistre: int
    numero_sinistre: str
    date_survenance: date
    date_declaration: Optional[date] = None
    description: Optional[str] = None
    montant_estime: Optional[Decimal] = None
    statut: Optional[str] = None
    id_contrat: int


class SinistreStatutUpdate(BaseModel):
    statut: StatutSinistre


class IndemnisationCreate(BaseModel):
    id_sinistre: int
    id_mode_paiement: int
    montant: Decimal = Field(gt=0)


class IndemnisationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id_indemnisation: int
    montant: Decimal
    date_versement: Optional[datetime] = None
    statut: Optional[str] = None
    id_sinistre: int
    id_mode_paiement: int
    id_utilisateur: int


class LoginIn(BaseModel):
    email: str
    mot_de_passe: str


class RoleOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id_role: int
    libelle: str


class UtilisateurOut(BaseModel):
    id_utilisateur: int
    nom: str
    prenom: str
    email: str
    actif: bool
    role: str


class UtilisateurCreate(BaseModel):
    nom: str = Field(min_length=1, max_length=100)
    prenom: str = Field(min_length=1, max_length=100)
    email: str = Field(pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$", max_length=150)
    mot_de_passe: str = Field(min_length=8, max_length=72)
    id_role: int


class NouveauMotDePasse(BaseModel):
    mot_de_passe: str = Field(min_length=8, max_length=72)


class InscriptionIn(BaseModel):
    nom: str = Field(min_length=1, max_length=100)
    prenom: str = Field(min_length=1, max_length=100)
    email: str = Field(pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$", max_length=150)
    mot_de_passe: str = Field(min_length=8, max_length=72)


class MotDePasseOublieIn(BaseModel):
    email: str = Field(max_length=150)


class ReinitialisationIn(BaseModel):
    token: str
    mot_de_passe: str = Field(min_length=8, max_length=72)


class RoleUpdate(BaseModel):
    id_role: int