-- =====================================================================
-- MPD : Gestion des paiements d'assurances (PostgreSQL 14+)
-- =====================================================================

DROP SCHEMA IF EXISTS assurance CASCADE;
CREATE SCHEMA assurance;
SET search_path TO assurance;

-- 1. Sécurité / utilisateurs
CREATE TABLE role (
    id_role      SERIAL PRIMARY KEY,
    libelle      VARCHAR(50)  NOT NULL UNIQUE
);

CREATE TABLE utilisateur (
    id_utilisateur   SERIAL PRIMARY KEY,
    nom              VARCHAR(100) NOT NULL,
    prenom           VARCHAR(100) NOT NULL,
    email            VARCHAR(150) NOT NULL UNIQUE,
    mot_de_passe     VARCHAR(255) NOT NULL,
    actif            BOOLEAN      NOT NULL DEFAULT TRUE,
    date_creation    TIMESTAMP    NOT NULL DEFAULT NOW(),
    id_role          INT          NOT NULL REFERENCES role(id_role)
);

-- 2. Clients
CREATE TABLE client (
    id_client       SERIAL PRIMARY KEY,
    nom             VARCHAR(100) NOT NULL,
    prenom          VARCHAR(100) NOT NULL,
    date_naissance  DATE,
    email           VARCHAR(150) UNIQUE,
    telephone       VARCHAR(30),
    adresse         VARCHAR(255),
    ville           VARCHAR(100),
    code_postal     VARCHAR(10),
    pays            VARCHAR(60)  DEFAULT 'Madagascar',
    date_creation   TIMESTAMP    NOT NULL DEFAULT NOW()
);

-- 3. Produits d'assurance
CREATE TABLE type_assurance (
    id_type_assurance SERIAL PRIMARY KEY,
    libelle           VARCHAR(80) NOT NULL UNIQUE,
    description       TEXT
);

CREATE TABLE produit_assurance (
    id_produit        SERIAL PRIMARY KEY,
    nom               VARCHAR(120) NOT NULL,
    description       TEXT,
    prime_base        NUMERIC(12,2) NOT NULL CHECK (prime_base >= 0),
    id_type_assurance INT NOT NULL REFERENCES type_assurance(id_type_assurance)
);

-- 4. Contrats et échéances
CREATE TABLE contrat (
    id_contrat       SERIAL PRIMARY KEY,
    numero_contrat   VARCHAR(30)   NOT NULL UNIQUE,
    date_debut       DATE          NOT NULL,
    date_fin         DATE          NOT NULL,
    prime_annuelle   NUMERIC(12,2) NOT NULL CHECK (prime_annuelle >= 0),
    periodicite      VARCHAR(15)   NOT NULL
                     CHECK (periodicite IN ('MENSUELLE','TRIMESTRIELLE','SEMESTRIELLE','ANNUELLE')),
    statut           VARCHAR(15)   NOT NULL DEFAULT 'ACTIF'
                     CHECK (statut IN ('ACTIF','SUSPENDU','RESILIE','EXPIRE')),
    id_client        INT NOT NULL REFERENCES client(id_client),
    id_produit       INT NOT NULL REFERENCES produit_assurance(id_produit),
    CHECK (date_fin > date_debut)
);

CREATE TABLE echeance (
    id_echeance      SERIAL PRIMARY KEY,
    date_echeance    DATE          NOT NULL,
    montant_du       NUMERIC(12,2) NOT NULL CHECK (montant_du > 0),
    statut           VARCHAR(15)   NOT NULL DEFAULT 'A_PAYER'
                     CHECK (statut IN ('A_PAYER','PARTIEL','PAYEE','EN_RETARD')),
    id_contrat       INT NOT NULL REFERENCES contrat(id_contrat) ON DELETE CASCADE
);

-- 5. Paiements (primes encaissées)
CREATE TABLE mode_paiement (
    id_mode_paiement SERIAL PRIMARY KEY,
    libelle          VARCHAR(50) NOT NULL UNIQUE
);

CREATE TABLE paiement (
    id_paiement      SERIAL PRIMARY KEY,
    reference        VARCHAR(40)   NOT NULL UNIQUE,
    montant          NUMERIC(12,2) NOT NULL CHECK (montant > 0),
    date_paiement    TIMESTAMP     NOT NULL DEFAULT NOW(),
    statut           VARCHAR(15)   NOT NULL DEFAULT 'VALIDE'
                     CHECK (statut IN ('EN_ATTENTE','VALIDE','REJETE','ANNULE')),
    id_echeance      INT NOT NULL REFERENCES echeance(id_echeance),
    id_mode_paiement INT NOT NULL REFERENCES mode_paiement(id_mode_paiement),
    id_utilisateur   INT NOT NULL REFERENCES utilisateur(id_utilisateur)
);

CREATE TABLE quittance (
    id_quittance     SERIAL PRIMARY KEY,
    numero           VARCHAR(30) NOT NULL UNIQUE,
    date_emission    TIMESTAMP   NOT NULL DEFAULT NOW(),
    id_paiement      INT NOT NULL UNIQUE REFERENCES paiement(id_paiement)
);

-- 6. Sinistres et indemnisations
CREATE TABLE sinistre (
    id_sinistre       SERIAL PRIMARY KEY,
    numero_sinistre   VARCHAR(30)   NOT NULL UNIQUE,
    date_survenance   DATE          NOT NULL,
    date_declaration  DATE          NOT NULL DEFAULT CURRENT_DATE,
    description       TEXT,
    montant_estime    NUMERIC(12,2) CHECK (montant_estime >= 0),
    statut            VARCHAR(15)   NOT NULL DEFAULT 'DECLARE'
                      CHECK (statut IN ('DECLARE','EN_EXPERTISE','ACCEPTE','REFUSE','CLOTURE')),
    id_contrat        INT NOT NULL REFERENCES contrat(id_contrat),
    CHECK (date_declaration >= date_survenance)
);

CREATE TABLE indemnisation (
    id_indemnisation  SERIAL PRIMARY KEY,
    montant           NUMERIC(12,2) NOT NULL CHECK (montant > 0),
    date_versement    TIMESTAMP     NOT NULL DEFAULT NOW(),
    statut            VARCHAR(15)   NOT NULL DEFAULT 'EN_ATTENTE'
                      CHECK (statut IN ('EN_ATTENTE','VERSE','ANNULE')),
    id_sinistre       INT NOT NULL REFERENCES sinistre(id_sinistre),
    id_mode_paiement  INT NOT NULL REFERENCES mode_paiement(id_mode_paiement),
    id_utilisateur    INT NOT NULL REFERENCES utilisateur(id_utilisateur)
);

-- 7. Traçabilité
CREATE TABLE journal_audit (
    id_audit          BIGSERIAL PRIMARY KEY,
    table_cible       VARCHAR(60) NOT NULL,
    id_enregistrement INT         NOT NULL,
    action            VARCHAR(10) NOT NULL CHECK (action IN ('INSERT','UPDATE','DELETE')),
    details           JSONB,
    date_action       TIMESTAMP   NOT NULL DEFAULT NOW(),
    id_utilisateur    INT REFERENCES utilisateur(id_utilisateur)
);

-- 8. Index de performance
CREATE INDEX idx_contrat_client      ON contrat(id_client);
CREATE INDEX idx_contrat_produit     ON contrat(id_produit);
CREATE INDEX idx_echeance_contrat    ON echeance(id_contrat);
CREATE INDEX idx_echeance_date_stat  ON echeance(date_echeance, statut);
CREATE INDEX idx_paiement_echeance   ON paiement(id_echeance);
CREATE INDEX idx_paiement_date       ON paiement(date_paiement);
CREATE INDEX idx_sinistre_contrat    ON sinistre(id_contrat);
CREATE INDEX idx_indemn_sinistre     ON indemnisation(id_sinistre);

-- 9. Données de référence
INSERT INTO role(libelle) VALUES ('ADMIN'),('GESTIONNAIRE'),('CAISSIER');
INSERT INTO mode_paiement(libelle) VALUES
  ('Espèces'),('Virement bancaire'),('Mobile Money'),('Chèque'),('Carte bancaire');
INSERT INTO type_assurance(libelle) VALUES
  ('Automobile'),('Santé'),('Habitation'),('Vie');