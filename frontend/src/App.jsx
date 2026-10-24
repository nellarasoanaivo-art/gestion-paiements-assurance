import { useEffect, useState } from "react";
import { NavLink, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { api } from "./api";
import { useAuth } from "./AuthContext";
import { libelle } from "./libelles";
import { Icone, Logo } from "./components/ui";
import Login from "./pages/Login";
import Inscription from "./pages/Inscription";
import MotDePasseOublie from "./pages/MotDePasseOublie";
import Reinitialiser from "./pages/Reinitialiser";
import Dashboard from "./pages/Dashboard";
import Clients from "./pages/Clients";
import Produits from "./pages/Produits";
import Contrats from "./pages/Contrats";
import Paiements from "./pages/Paiements";
import Factures from "./pages/Factures";
import Sinistres from "./pages/Sinistres";
import Utilisateurs from "./pages/Utilisateurs";
import Apropos from "./pages/Apropos";

const GESTION = ["ADMIN", "GESTIONNAIRE"];

const PAGES = [
  { chemin: "/tableau-de-bord", titre: "Tableau de bord", icone: "tableau", Composant: Dashboard },
  { chemin: "/clients", titre: "Clients", icone: "clients", Composant: Clients, roles: GESTION },
  { chemin: "/produits", titre: "Produits", icone: "produits", Composant: Produits, roles: GESTION },
  { chemin: "/contrats", titre: "Contrats", icone: "contrats", Composant: Contrats, roles: GESTION },
  { chemin: "/paiements", titre: "Paiements", icone: "paiements", Composant: Paiements },
  { chemin: "/factures", titre: "Factures", icone: "facture", Composant: Factures },
  { chemin: "/sinistres", titre: "Sinistres", icone: "sinistres", Composant: Sinistres, roles: GESTION },
  { chemin: "/utilisateurs", titre: "Utilisateurs", icone: "utilisateurs", Composant: Utilisateurs, roles: ["ADMIN"] },
  { chemin: "/a-propos", titre: "À propos", icone: "info", Composant: Apropos },
];

// Sur mobile, chaque cellule affiche le titre de sa colonne (tableaux en cartes)
function etiqueterTableaux() {
  document.querySelectorAll(".tableau-conteneur table").forEach((table) => {
    const entetes = [...table.querySelectorAll("thead th")].map((th) => th.textContent.trim());
    table.querySelectorAll("tbody tr").forEach((tr) => {
      [...tr.children].forEach((td, i) => {
        if (td.hasAttribute("colspan")) return;
        const etiquette = entetes[i] || "";
        if (td.getAttribute("data-label") !== etiquette) td.setAttribute("data-label", etiquette);
      });
    });
  });
}

export default function App() {
  const { utilisateur, chargement, deconnexion, aRole } = useAuth();
  const location = useLocation();
  const [enAttente, setEnAttente] = useState(0);
  const [menuOuvert, setMenuOuvert] = useState(false);
  const estAdmin = utilisateur?.role === "ADMIN";

  // Nombre de comptes à valider, actualisé à chaque changement de page
  useEffect(() => {
    if (!estAdmin) return;
    api("/utilisateurs")
      .then((liste) => setEnAttente(liste.filter((u) => !u.actif).length))
      .catch(() => {});
  }, [estAdmin, location.pathname]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  // Étiquettes des cellules pour l'affichage mobile
  useEffect(() => {
    if (!utilisateur) return;
    let attente = 0;
    const planifier = () => {
      cancelAnimationFrame(attente);
      attente = requestAnimationFrame(etiqueterTableaux);
    };
    planifier();
    const observateur = new MutationObserver(planifier);
    observateur.observe(document.body, { childList: true, subtree: true });
    return () => {
      cancelAnimationFrame(attente);
      observateur.disconnect();
    };
  }, [utilisateur]);

  // Menu mobile : touche Échap et blocage du défilement de la page
  useEffect(() => {
    document.body.classList.toggle("menu-ouvert", menuOuvert);
    const surTouche = (e) => {
      if (e.key === "Escape") setMenuOuvert(false);
    };
    window.addEventListener("keydown", surTouche);
    return () => {
      window.removeEventListener("keydown", surTouche);
      document.body.classList.remove("menu-ouvert");
    };
  }, [menuOuvert]);

  if (chargement) return <div className="ecran-centre">Chargement…</div>;

  if (!utilisateur) {
    return (
      <Routes>
        <Route path="/inscription" element={<Inscription />} />
        <Route path="/mot-de-passe-oublie" element={<MotDePasseOublie />} />
        <Route path="/reinitialiser" element={<Reinitialiser />} />
        <Route path="*" element={<Login />} />
      </Routes>
    );
  }

  const pages = PAGES.filter((p) => !p.roles || aRole(...p.roles));
  const initiales = (utilisateur.prenom[0] + utilisateur.nom[0]).toUpperCase();

  return (
    <div className="app">
      {menuOuvert && <div className="voile" onClick={() => setMenuOuvert(false)} />}

      <aside className={"menu-lateral" + (menuOuvert ? " ouvert" : "")}>
        <div className="marque">
          <Logo />
          <span className="marque-texte">
            <strong>G.P.A</strong>
            <small>Gestion des paiements d'assurances</small>
          </span>
        </div>

        <nav>
          {pages.map((p) => (
            <NavLink key={p.chemin} to={p.chemin} onClick={() => setMenuOuvert(false)}>
              <span className="nav-libelle">
                <Icone nom={p.icone} /> {p.titre}
              </span>
              {p.chemin === "/utilisateurs" && enAttente > 0 && (
                <span className="pastille" title="Comptes en attente de validation">{enAttente}</span>
              )}
            </NavLink>
          ))}
        </nav>

        <button className="menu-deconnexion" onClick={deconnexion}>
          <Icone nom="deconnexion" /> Déconnexion
        </button>
      </aside>

      <div className="zone-principale">
        <header className="barre-haute">
          <button className="btn-menu" onClick={() => setMenuOuvert(true)}
                  aria-label="Ouvrir le menu" aria-expanded={menuOuvert}>
            <Icone nom="menu" taille={26} />
          </button>

          <div className="barre-droite">
            <span className="avatar"
                  title={utilisateur.prenom + " " + utilisateur.nom + " (" + libelle(utilisateur.role) + ")"}>
              {initiales}
            </span>
            <button className="btn-deconnexion-icone" onClick={deconnexion}
                    title="Se déconnecter" aria-label="Se déconnecter">
              <Icone nom="deconnexion" taille={22} />
            </button>
          </div>
        </header>

        <main className="contenu">
          <Routes>
            {pages.map(({ chemin, Composant }) => (
              <Route key={chemin} path={chemin} element={<Composant />} />
            ))}
            <Route path="*" element={<Navigate to={pages[0].chemin} replace />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}