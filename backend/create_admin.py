import getpass

import models
from database import SessionLocal
from security import hacher_mot_de_passe


def main():
    db = SessionLocal()
    role = db.query(models.Role).filter(models.Role.libelle == "ADMIN").first()
    if not role:
        print("Rôle ADMIN introuvable : chargez d'abord le MPD.")
        return

    email = input("Email de l'administrateur : ").strip().lower()
    nom = input("Nom : ").strip() or "Admin"
    prenom = input("Prénom : ").strip() or "Admin"
    mot_de_passe = getpass.getpass("Mot de passe (8 caractères minimum) : ")
    if len(mot_de_passe) < 8:
        print("Mot de passe trop court.")
        return

    utilisateur = db.query(models.Utilisateur).filter(models.Utilisateur.email == email).first()
    if utilisateur:
        utilisateur.mot_de_passe = hacher_mot_de_passe(mot_de_passe)
        utilisateur.id_role = role.id_role
        utilisateur.actif = True
        print("Compte existant mis à jour.")
    else:
        db.add(models.Utilisateur(
            nom=nom, prenom=prenom, email=email,
            mot_de_passe=hacher_mot_de_passe(mot_de_passe), id_role=role.id_role,
        ))
        print("Compte administrateur créé.")
    db.commit()


if __name__ == "__main__":
    main()