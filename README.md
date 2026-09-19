# Love and Charity (L&C) — Application de Gestion & Contrôle de Kermesse

Application web professionnelle complète conçue pour l'association **Love and Charity (L&C)** afin d'assurer l'organisation, la gestion, la traçabilité et le contrôle rigoureux d'une kermesse associative.

---

## 🔴 Identité Visuelle & Thème
- **Nom officiel** : Love and Charity
- **Nom court / Logo** : L&C
- **Couleurs principales** :
  - 🔴 **Rouge** (`#dc2626` / `#b91c1c`) : Boutons d'action, accents, alertes critiques, navigation active
  - ⚪ **Blanc** (`#ffffff`) : Fond des cartes, modales, contrastes
  - ⚫ **Noir / Gris foncé** (`#0f172a` / `#1e293b`) : Typographie, barre latérale, contrastes structurels
- **Couleurs des stands** : Les couleurs (Bleu, Vert, Jaune, Rouge, etc.) sont exclusivement utilisées comme balises et repères visuels pour identifier les stands et les équipes sans altérer la charte Love and Charity.

---

## 🛡️ Règle Fondamentale : Base de Données 100% Vierge
L'application est fournie **strictement sans fausses données de démonstration** :
- 0 faux stand
- 0 faux membre
- 0 faux jeu
- 0 faux ticket
- 0 faux produit
- 0 faux matériel
- 0 faux incident

Tous les tableaux et tableaux de bord intègrent des états vides soignés (*Empty States*) avec des boutons d'action explicites.

---

## 👑 Seule Exception : Le SuperAdministrateur Original « Mounir »
Le seul enregistrement existant au démarrage de la base est le compte initial du SuperAdministrateur :
- **Login** : `Mounir`
- **Mot de passe initial (temporaire)** : `Mounir@Kermesse#2026!`

### Règles de protection absolue (verrouillées par TRIGGER PostgreSQL) :
1. **Changement obligatoire** : Dès la première connexion, le système bloque tout accès et oblige Mounir à définir un nouveau mot de passe personnel sécurisé.
2. **Inviolabilité** : Le compte `Mounir` ne peut jamais être :
   - Supprimé
   - Désactivé
   - Rétrogradé
   - Renommé
   - Modifié par un autre administrateur.

---

## 🚀 Architecture Technique
- **Frontend** : HTML5, CSS3 responsive (Desktop, Tablette, Mobile), Vanilla JavaScript modulaire.
- **Hébergement Frontend** : Prêt pour déploiement direct et gratuit sur **GitHub Pages**.
- **Backend / Base de Données** : **Supabase** (PostgreSQL relationnel, Row Level Security - RLS, Fonctions RPC sécurisées `pgcrypto`, Triggers d'intégrité et de calcul d'écarts).
- **Mode Hors-ligne (Offline-ready)** : File d'attente locale (`localStorage`) pour enregistrer les ventes et mouvements en cas de perte de connexion réseau, avec resynchronisation automatique au retour d'Internet.

---

## 📂 Structure des Fichiers

```
kermesse-love-and-charity/
├── index.html                  # Application principale SPA (routage par modules)
├── login.html                  # Page de connexion Login + Mot de passe
├── change-password.html        # Écran de changement obligatoire de mot de passe
├── README.md                   # Ce guide complet
├── assets/
│   └── logo.svg                # Logo vectoriel officiel Love & Charity
├── css/
│   ├── style.css               # Charte Love & Charity (Rouge, Blanc, Noir)
│   └── responsive.css          # Optimisations mobiles et tablettes
├── js/
│   ├── config.js               # Paramètres et mémorisation des clés Supabase
│   ├── supabase.js             # Initialisation et couche réseau Supabase
│   ├── auth.js                 # Authentification Login + Mot de passe & sessions
│   ├── permissions.js          # Matrice des permissions & filtrage dynamique du menu
│   ├── audit.js                # Journalisation automatique de toutes les actions
│   ├── offline.js              # Gestionnaire de file d'attente hors-ligne
│   ├── notify.js               # Notifications Toast et modales de confirmation
│   └── modules/
│       ├── dashboard.js        # KPI réels & alertes proactives
│       ├── members.js          # Bénévoles ("Une personne -> Une responsabilité")
│       ├── teams.js            # Équipes avec couleurs configurables
│       ├── stands.js           # Stands (Couleur + N°), staffing & caissiers
│       ├── roles.js            # Comptes administrateurs & rôles métier
│       ├── tickets.js          # Billets rectangulaires, triangulaires & jetons
│       ├── cash.js             # Caisses, ventes, monnaie, calcul d'écarts & clôtures
│       ├── games.js            # Attractions & jeux de kermesse
│       ├── stocks.js           # Nourriture & boissons, pertes et mouvements
│       ├── gifts.js            # Lots/cadeaux, dotations et distributions
│       ├── inventory.js        # Inventaires comparatifs (Théorique vs Réel)
│       ├── locations.js        # Emplacements physiques & détails d'accès
│       ├── materials.js        # Matériel (À nous, Emprunté, Loué, Propriétaires)
│       ├── loans.js            # Emprunts/locations, dates limites et contacts
│       ├── movements.js        # Chaîne de transfert entre lieux et bénévoles
│       ├── returns.js          # Plan de restitution & itinéraire par bénévole
│       ├── expenses.js         # Dépenses avec justificatifs
│       ├── closures.js         # Clôtures définitives avec verrouillage des données
│       ├── incidents.js        # Déclarations, alertes et résolutions d'incidents
│       ├── history.js          # Journal d'audit complet immuable
│       ├── reports.js          # Bilans officiels imprimables
│       └── settings.js         # Configuration des identifiants Supabase
└── sql/
    ├── 01_schema.sql           # 28 tables relationnelles complètes
    ├── 02_security_rls.sql     # Politiques RLS (Row Level Security)
    ├── 03_functions_triggers.sql # Triggers protection Mounir, stocks et RPC auth
    ├── 04_initial_superadmin.sql # Création de Mounir et des rôles système
    └── schema_complete_all_in_one.sql # Script SQL complet TOUT-EN-UN
```

---

## 🛠️ Instructions de Configuration Supabase

### Étape 1 : Créer votre projet Supabase
1. Rendez-vous sur [supabase.com](https://supabase.com) et créez un projet gratuit (ou utilisez votre projet existant).
2. Notez votre mot de passe de base de données.

### Étape 2 : Exécuter le script SQL Tout-en-un
1. Dans votre tableau de bord Supabase, cliquez sur **SQL Editor** dans le menu de gauche.
2. Cliquez sur **New query**.
3. Ouvrez le fichier `sql/schema_complete_all_in_one.sql` de ce projet.
4. Copiez l'intégralité du contenu et collez-le dans l'éditeur SQL de Supabase.
5. Cliquez sur le bouton vert **RUN**.
6. Le script crée automatiquement :
   - Les 28 tables avec index et contraintes
   - Les politiques de sécurité RLS
   - Les triggers de calcul de stock et de protection de Mounir
   - Les rôles système de la kermesse
   - Le compte SuperAdministrateur original `Mounir`.

### Étape 3 : Récupérer vos clés API Supabase
1. Dans Supabase, allez dans **Project Settings** (icône d'engrenage en bas à gauche) ➔ **API**.
2. Copiez :
   - **Project URL** (ex: `https://xyzabcdefghijklm.supabase.co`)
   - **Project API anon key** (clé publique `anon`, longue chaîne commençant par `eyJhbGci...`).

---

## 🌐 Connexion du Frontend à Supabase

1. Ouvrez la page `login.html` dans votre navigateur (ou sur GitHub Pages).
2. Cliquez sur le bouton **⚙️ Config Supabase** en bas à droite de la boîte de connexion.
3. Collez votre **Project URL** et votre **Clé Anon**.
4. Cliquez sur **Enregistrer**.
5. Connectez-vous avec :
   - **LOGIN** : `Mounir`
   - **MOT DE PASSE** : `Mounir@Kermesse#2026!`
6. L'application vous redirige immédiatement vers l'écran de **Changement de Mot de Passe**.
7. Définissez votre nouveau mot de passe personnel (au moins 8 caractères).
8. Vous accédez ensuite à l'application complète !

---

## 🚀 Publication sur GitHub Pages

1. Créez un nouveau dépôt sur [GitHub](https://github.com/) (ex: `kermesse-love-and-charity`).
2. Poussez l'intégralité des fichiers du dossier à la racine de votre branche `main`.
3. Sur GitHub, allez dans **Settings** ➔ **Pages**.
4. Sous **Build and deployment** / **Branch**, sélectionnez `main` et `/ (root)`.
5. Cliquez sur **Save**.
6. Votre application sera accessible publiquement en quelques secondes à l'adresse :
   `https://<votre-compte>.github.io/kermesse-love-and-charity/`

---

## 🎟️ Fonctionnalités Clés Implémentées

| Domaine | Fonctionnalités |
| :--- | :--- |
| **Sécurité & Rôles** | Authentification par **Login + Mot de passe**, Mounir protégé, rôles adaptés avec filtrage dynamique de l'interface. |
| **Organisation** | Bénévoles avec règle « Une personne -> une responsabilité », Équipes avec couleurs (Noir=Org, Blanc=Trésorière...), Stands Couleur + Numéro (ex: Rouge 1). |
| **Contrôle Staffing** | Détection automatique : Stand sans responsable, stand sans caissier (moins de 2 caissiers), stand sous-staffé, mixité pour la surveillance des manèges. |
| **Billetterie & Jetons** | Tickets rectangulaires (jeux), Tickets triangulaires (lots), Jetons de monnaie (50F, 100F, 200F, 250F). Règle : **Pas de jeton = pas de remboursement**. |
| **Caisses & Finances** | Fond initial, ventes, dépenses autorisées, remboursements, calcul automatique de l'écart `Compté - Attendu`. Incident automatique si écart. |
| **Stocks & Lots** | Mouvements nourriture (entrées/sorties/pertes), lots en stock central et sur stands, inventaires comparatifs Théorique vs Réel. |
| **Logistique Matériel** | Inventaire complet (À nous / Emprunté / Loué), propriétaires (Écoles, tiers), suivi des emprunts avec alertes de dépassement. |
| **Restitutions** | Génération automatique des retours après kermesse, tournées par bénévole organisées en stations d'itinéraires (Station 1, 2, 3...). |
| **Incidents & Alertes** | Signalement immédiat (disparition d'argent, nourriture, matériel, enfant non surveillé, ticket suspect), suivi et résolution. |
| **Clôtures & Traçabilité**| Clôture définitive avec gel des modifications et snapshot. Journal d'activité immuable consignant toutes les actions. |

---

Développé pour la fondation **Love and Charity (L&C)** — Pour une kermesse solidaire, parfaitement gérée et sans faille organisationnelle.
