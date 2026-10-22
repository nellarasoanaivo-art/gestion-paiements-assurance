import os

from dotenv import load_dotenv
from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routers import auth, clients, contrats, dashboard, paiements, sinistres
from security import ecriture_reservee

load_dotenv()

origines = [
    o.strip().rstrip("/")
    for o in os.getenv("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173").split(",")
    if o.strip()
]

app = FastAPI(title="Gestion des paiements d'assurances")

app.add_middleware(
    CORSMiddleware,
    allow_origins=origines,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Lecture : tout utilisateur connecté. Écriture : administrateur et gestionnaire.
gestion = [Depends(ecriture_reservee("ADMIN", "GESTIONNAIRE"))]

app.include_router(auth.router)
app.include_router(dashboard.router)
app.include_router(clients.router, dependencies=gestion)
app.include_router(contrats.router, dependencies=gestion)
app.include_router(sinistres.router, dependencies=gestion)
app.include_router(paiements.router)


@app.get("/")
def accueil():
    return {"message": "API en marche"}