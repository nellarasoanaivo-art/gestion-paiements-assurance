from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routers import auth, clients, contrats, dashboard, paiements, sinistres
from security import ecriture_reservee

app = FastAPI(title="Gestion des paiements d'assurances")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Lecture : tout utilisateur connecté. Écriture : administrateur et gestionnaire.
gestion = [Depends(ecriture_reservee("ADMIN", "GESTIONNAIRE"))]

app.include_router(auth.router)
app.include_router(dashboard.router)  # filtre lui-même selon le rôle
app.include_router(clients.router, dependencies=gestion)
app.include_router(contrats.router, dependencies=gestion)
app.include_router(sinistres.router, dependencies=gestion)
app.include_router(paiements.router)  # ses propres règles (le caissier peut encaisser)


@app.get("/")
def accueil():
    return {"message": "API en marche"}