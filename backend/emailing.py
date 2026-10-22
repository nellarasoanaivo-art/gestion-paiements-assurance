import os
import smtplib
import ssl
from email.message import EmailMessage

from dotenv import load_dotenv

load_dotenv()


def envoyer_email(destinataire: str, sujet: str, corps: str) -> None:
    hote = os.getenv("SMTP_HOST")

    # Mode développement : pas de SMTP, on affiche le message dans le terminal
    if not hote:
        print("\n" + "=" * 70)
        print("EMAIL (SMTP non configuré : mode développement)")
        print("À     :", destinataire)
        print("Objet :", sujet)
        print(corps)
        print("=" * 70 + "\n", flush=True)
        return

    port = int(os.getenv("SMTP_PORT", "587"))
    login = os.getenv("SMTP_USER")
    mot_de_passe = os.getenv("SMTP_PASSWORD")

    message = EmailMessage()
    message["From"] = os.getenv("SMTP_FROM") or login
    message["To"] = destinataire
    message["Subject"] = sujet
    message.set_content(corps)

    try:
        contexte = ssl.create_default_context()
        if port == 465:
            with smtplib.SMTP_SSL(hote, port, context=contexte, timeout=20) as serveur:
                if login:
                    serveur.login(login, mot_de_passe)
                serveur.send_message(message)
        else:
            with smtplib.SMTP(hote, port, timeout=20) as serveur:
                serveur.starttls(context=contexte)
                if login:
                    serveur.login(login, mot_de_passe)
                serveur.send_message(message)
    except Exception as e:  # l'erreur reste dans le terminal, jamais envoyée au client
        print("ERREUR ENVOI EMAIL :", e, flush=True)