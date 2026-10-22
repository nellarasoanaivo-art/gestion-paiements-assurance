from sqlalchemy import (Column, Integer, BigInteger, String, Date, DateTime,
                        Numeric, Boolean, Text, ForeignKey, Table, func, text)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship
from database import Base


class Role(Base):
    __tablename__ = "role"
    id_role = Column(Integer, primary_key=True)
    libelle = Column(String(50), nullable=False, unique=True)


class Utilisateur(Base):
    __tablename__ = "utilisateur"
    id_utilisateur = Column(Integer, primary_key=True)
    nom = Column(String(100), nullable=False)
    prenom = Column(String(100), nullable=False)
    email = Column(String(150), nullable=False, unique=True)
    mot_de_passe = Column(String(255), nullable=False)
    actif = Column(Boolean, nullable=False, server_default=text("true"))
    date_creation = Column(DateTime, nullable=False, server_default=func.now())
    id_role = Column(Integer, ForeignKey("role.id_role"), nullable=False)
    role = relationship("Role")


class Client(Base):
    __tablename__ = "client"
    id_client = Column(Integer, primary_key=True)
    nom = Column(String(100), nullable=False)
    prenom = Column(String(100), nullable=False)
    sexe = Column(String(1))
    cin = Column(String(12), unique=True)
    date_naissance = Column(Date)
    email = Column(String(150), unique=True)
    telephone = Column(String(30))
    adresse = Column(String(255))
    ville = Column(String(100))
    code_postal = Column(String(10))
    pays = Column(String(60), server_default=text("'Madagascar'"))
    date_creation = Column(DateTime, nullable=False, server_default=func.now())
    contrats = relationship("Contrat", back_populates="client")


class TypeAssurance(Base):
    __tablename__ = "type_assurance"
    id_type_assurance = Column(Integer, primary_key=True)
    libelle = Column(String(80), nullable=False, unique=True)
    description = Column(Text)
    prime_reference = Column(Numeric(12, 2), nullable=False, server_default=text("0"))


produit_type = Table(
    "produit_type", Base.metadata,
    Column("id_produit", Integer, ForeignKey("produit_assurance.id_produit", ondelete="CASCADE"),
           primary_key=True),
    Column("id_type_assurance", Integer, ForeignKey("type_assurance.id_type_assurance"),
           primary_key=True),
)


class ProduitAssurance(Base):
    __tablename__ = "produit_assurance"
    id_produit = Column(Integer, primary_key=True)
    nom = Column(String(120), nullable=False)
    description = Column(Text)
    prime_base = Column(Numeric(12, 2), nullable=False)
    id_type_assurance = Column(Integer, ForeignKey("type_assurance.id_type_assurance"), nullable=False)
    types = relationship("TypeAssurance", secondary=produit_type)


class Contrat(Base):
    __tablename__ = "contrat"
    id_contrat = Column(Integer, primary_key=True)
    numero_contrat = Column(String(30), nullable=False, unique=True)
    date_debut = Column(Date, nullable=False)
    date_fin = Column(Date, nullable=False)
    prime_annuelle = Column(Numeric(12, 2), nullable=False)
    periodicite = Column(String(15), nullable=False)
    statut = Column(String(15), nullable=False, server_default=text("'ACTIF'"))
    id_client = Column(Integer, ForeignKey("client.id_client"), nullable=False)
    id_produit = Column(Integer, ForeignKey("produit_assurance.id_produit"), nullable=False)
    client = relationship("Client", back_populates="contrats")
    echeances = relationship("Echeance", back_populates="contrat")


class Echeance(Base):
    __tablename__ = "echeance"
    id_echeance = Column(Integer, primary_key=True)
    date_echeance = Column(Date, nullable=False)
    montant_du = Column(Numeric(12, 2), nullable=False)
    statut = Column(String(15), nullable=False, server_default=text("'A_PAYER'"))
    id_contrat = Column(Integer, ForeignKey("contrat.id_contrat"), nullable=False)
    contrat = relationship("Contrat", back_populates="echeances")
    paiements = relationship("Paiement", back_populates="echeance")


class ModePaiement(Base):
    __tablename__ = "mode_paiement"
    id_mode_paiement = Column(Integer, primary_key=True)
    libelle = Column(String(50), nullable=False, unique=True)


class Paiement(Base):
    __tablename__ = "paiement"
    id_paiement = Column(Integer, primary_key=True)
    reference = Column(String(40), nullable=False, unique=True)
    montant = Column(Numeric(12, 2), nullable=False)
    date_paiement = Column(DateTime, nullable=False, server_default=func.now())
    statut = Column(String(15), nullable=False, server_default=text("'VALIDE'"))
    id_echeance = Column(Integer, ForeignKey("echeance.id_echeance"), nullable=False)
    id_mode_paiement = Column(Integer, ForeignKey("mode_paiement.id_mode_paiement"), nullable=False)
    id_utilisateur = Column(Integer, ForeignKey("utilisateur.id_utilisateur"), nullable=False)
    echeance = relationship("Echeance", back_populates="paiements")
    quittance = relationship("Quittance", back_populates="paiement", uselist=False)


class Quittance(Base):
    __tablename__ = "quittance"
    id_quittance = Column(Integer, primary_key=True)
    numero = Column(String(30), nullable=False, unique=True)
    date_emission = Column(DateTime, nullable=False, server_default=func.now())
    id_paiement = Column(Integer, ForeignKey("paiement.id_paiement"), nullable=False, unique=True)
    paiement = relationship("Paiement", back_populates="quittance")


class Sinistre(Base):
    __tablename__ = "sinistre"
    id_sinistre = Column(Integer, primary_key=True)
    numero_sinistre = Column(String(30), nullable=False, unique=True)
    date_survenance = Column(Date, nullable=False)
    date_declaration = Column(Date, nullable=False, server_default=func.current_date())
    description = Column(Text)
    montant_estime = Column(Numeric(12, 2))
    statut = Column(String(15), nullable=False, server_default=text("'DECLARE'"))
    id_contrat = Column(Integer, ForeignKey("contrat.id_contrat"), nullable=False)


class Indemnisation(Base):
    __tablename__ = "indemnisation"
    id_indemnisation = Column(Integer, primary_key=True)
    montant = Column(Numeric(12, 2), nullable=False)
    date_versement = Column(DateTime, nullable=False, server_default=func.now())
    statut = Column(String(15), nullable=False, server_default=text("'EN_ATTENTE'"))
    id_sinistre = Column(Integer, ForeignKey("sinistre.id_sinistre"), nullable=False)
    id_mode_paiement = Column(Integer, ForeignKey("mode_paiement.id_mode_paiement"), nullable=False)
    id_utilisateur = Column(Integer, ForeignKey("utilisateur.id_utilisateur"), nullable=False)


class JournalAudit(Base):
    __tablename__ = "journal_audit"
    id_audit = Column(BigInteger, primary_key=True)
    table_cible = Column(String(60), nullable=False)
    id_enregistrement = Column(Integer, nullable=False)
    action = Column(String(10), nullable=False)
    details = Column(JSONB)
    date_action = Column(DateTime, nullable=False, server_default=func.now())
    id_utilisateur = Column(Integer, ForeignKey("utilisateur.id_utilisateur"))