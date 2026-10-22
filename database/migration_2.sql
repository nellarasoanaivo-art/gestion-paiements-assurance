\encoding UTF8
SET search_path TO assurance;

-- Clients : sexe et CIN, unicité
ALTER TABLE client ADD COLUMN IF NOT EXISTS sexe CHAR(1);
ALTER TABLE client ADD COLUMN IF NOT EXISTS cin VARCHAR(12);
ALTER TABLE client DROP CONSTRAINT IF EXISTS client_sexe_check;
ALTER TABLE client ADD CONSTRAINT client_sexe_check CHECK (sexe IN ('F','M'));
CREATE UNIQUE INDEX IF NOT EXISTS ux_client_cin ON client (cin);
CREATE UNIQUE INDEX IF NOT EXISTS ux_client_telephone ON client (telephone);
CREATE UNIQUE INDEX IF NOT EXISTS ux_client_nom_prenom ON client (lower(nom), lower(prenom));

-- Types d'assurance : prix de référence
ALTER TABLE type_assurance ADD COLUMN IF NOT EXISTS prime_reference NUMERIC(12,2) NOT NULL DEFAULT 0;
UPDATE type_assurance SET prime_reference = 1200000 WHERE libelle LIKE 'Auto%';
UPDATE type_assurance SET libelle = 'Santé', prime_reference = 900000 WHERE libelle LIKE 'Sant%';
UPDATE type_assurance SET prime_reference = 600000 WHERE libelle = 'Habitation';
UPDATE type_assurance SET prime_reference = 1500000 WHERE libelle = 'Vie';

INSERT INTO type_assurance (libelle, prime_reference) VALUES
  ('Voyage', 150000),
  ('Responsabilité civile', 300000),
  ('Incendie', 450000),
  ('Transport de marchandises', 800000),
  ('Accidents corporels', 250000),
  ('Éducation', 400000),
  ('Obsèques', 350000),
  ('Agricole', 500000),
  ('Multirisque professionnelle', 1100000)
ON CONFLICT (libelle) DO NOTHING;

-- Un produit peut couvrir plusieurs types
CREATE TABLE IF NOT EXISTS produit_type (
    id_produit        INT NOT NULL REFERENCES produit_assurance(id_produit) ON DELETE CASCADE,
    id_type_assurance INT NOT NULL REFERENCES type_assurance(id_type_assurance),
    PRIMARY KEY (id_produit, id_type_assurance)
);
INSERT INTO produit_type (id_produit, id_type_assurance)
SELECT id_produit, id_type_assurance FROM produit_assurance
ON CONFLICT DO NOTHING;