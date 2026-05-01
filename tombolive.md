# Cahier de Spécifications — Tombolive

> **Version** : 1.0  
> **Statut** : Prêt pour développement autonome  
> **Cible** : Usine à code HaufCode

---

## Table des matières

1. [Vue d'ensemble du projet](#1-vue-densemble-du-projet)
2. [Stack technique & Architecture](#2-stack-technique--architecture)
3. [Structure du projet](#3-structure-du-projet)
4. [Base de données](#4-base-de-données)
5. [Variables d'environnement](#5-variables-denvironnement)
6. [Docker & Déploiement](#6-docker--déploiement)
7. [Module Authentification Admin](#7-module-authentification-admin)
8. [Module Administration — Gestion des Tombolas](#8-module-administration--gestion-des-tombolas)
9. [Module Inscription Publique](#9-module-inscription-publique)
10. [Module Tirage — Écran Public /live](#10-module-tirage--écran-public-live)
11. [Module Tirage — Télécommande Admin /control](#11-module-tirage--télécommande-admin-control)
12. [Synchronisation temps réel — Socket.io](#12-synchronisation-temps-réel--socketio)
13. [API REST — Référence complète](#13-api-rest--référence-complète)
14. [Règles métier & cas limites](#14-règles-métier--cas-limites)
15. [Sécurité & RGPD](#15-sécurité--rgpd)
16. [Design & UI — Directives](#16-design--ui--directives)

---

## 1. Vue d'ensemble du projet

**Tombolive** est une application web permettant d'organiser des tombolas événementielles en temps réel. Elle repose sur deux vues distinctes synchronisées :

- **L'écran public** (`/tombola/<ID>/live`) : projeté sur un écran géant, visible par le public.
- **La télécommande admin** (`/admin/control/<ID>`) : utilisée par l'organisateur sur son smartphone.

**Langue** : Toute l'interface (admin + public) est en **français uniquement**.

---

## 2. Stack technique & Architecture

### Choix technologiques (décision architecturale documentée)

| Composant | Technologie | Justification |
|-----------|-------------|---------------|
| Runtime | **Node.js 20 LTS** | Excellent support Socket.io, large écosystème, performance I/O |
| Framework HTTP | **Express 4** | Mature, simple, compatible avec multer et express-session |
| Temps réel | **Socket.io 4** | Reconnexion automatique, namespaces, broadcast ciblé |
| Base de données | **SQLite 3** (via `better-sqlite3`) | Fichier unique, bind mount trivial, synchrone = pas de race condition |
| Templates HTML | **EJS** | Rendu serveur sans build step, lisible par un LLM |
| Upload fichiers | **Multer** | Middleware standard pour multipart/form-data |
| QR Code | **qrcode** (npm) | Génération serveur-side en base64 PNG |
| Sessions | **express-session** + **connect-sqlite3** | Sessions persistées dans la DB SQLite |
| Images | **sharp** | Redimensionnement et conversion côté serveur |

### Flux de communication

```
Navigateur (EJS rendu serveur)
       │
       ├── HTTP REST → Express (CRUD tombolas, inscription, auth)
       │
       └── WebSocket → Socket.io (tirage en temps réel)
```

Aucun framework frontend (React, Vue, etc.). HTML/CSS/JS vanilla côté client, rendu EJS côté serveur.

---

## 3. Structure du projet

```
tombola-live/
├── docker-compose.yml
├── Dockerfile
├── .env.example
├── package.json
├── app.js                     # Point d'entrée Express + Socket.io
├── db/
│   └── database.js            # Initialisation SQLite, migrations inline
├── routes/
│   ├── auth.js                # Login / logout
│   ├── admin.js               # CRUD tombolas, lots, upload image
│   ├── control.js             # Télécommande tirage
│   └── public.js              # Inscription + écran live (vues publiques)
├── sockets/
│   └── draw.js                # Logique Socket.io tirage
├── middleware/
│   └── auth.js                # Middleware isAuthenticated
├── views/
│   ├── layout.ejs             # Layout commun admin
│   ├── login.ejs
│   ├── admin/
│   │   ├── index.ejs          # Liste des tombolas
│   │   ├── form.ejs           # Création / édition tombola
│   │   └── control.ejs        # Télécommande
│   └── public/
│       ├── register.ejs       # Page inscription
│       └── live.ejs           # Écran public tirage
├── public/
│   ├── css/
│   │   ├── admin.css
│   │   └── live.css
│   └── js/
│       ├── admin-form.js      # Drag & drop lots côté client
│       ├── control.js         # Socket client télécommande
│       └── live.js            # Socket client écran public
└── data/                      # Monté depuis l'hôte
    ├── database.sqlite
    └── images/                # Images uploadées des tombolas
```

---

## 4. Base de données

### Schéma SQLite (créé automatiquement au démarrage)

```sql
-- Tombolas
CREATE TABLE IF NOT EXISTS tombolas (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT    NOT NULL,
  image_path  TEXT,                        -- Chemin relatif ex: images/abc123.webp
  starts_at   DATETIME NOT NULL,
  ends_at     DATETIME NOT NULL,
  status      TEXT NOT NULL DEFAULT 'pending',
                                           -- 'pending' | 'open' | 'closed' | 'drawing' | 'finished'
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Lots (ordonnés par position, tirage du plus grand au plus petit)
CREATE TABLE IF NOT EXISTS lots (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  tombola_id   INTEGER NOT NULL REFERENCES tombolas(id) ON DELETE CASCADE,
  name         TEXT    NOT NULL,
  position     INTEGER NOT NULL,           -- 1 = gros lot (tiré en dernier)
  winner_id    INTEGER REFERENCES participants(id),
  drawn_at     DATETIME,
  UNIQUE(tombola_id, position)
);

-- Participants
CREATE TABLE IF NOT EXISTS participants (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  tombola_id   INTEGER NOT NULL REFERENCES tombolas(id) ON DELETE CASCADE,
  first_name   TEXT    NOT NULL,
  last_name    TEXT    NOT NULL,
  phone        TEXT    NOT NULL,
  is_absent    INTEGER NOT NULL DEFAULT 0, -- 0=présent, 1=absent (banni)
  has_won      INTEGER NOT NULL DEFAULT 0, -- 0=n'a pas gagné, 1=a déjà gagné un lot
  registered_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(tombola_id, phone)
);

-- État du tirage en cours (une ligne par tombola)
CREATE TABLE IF NOT EXISTS draw_state (
  tombola_id        INTEGER PRIMARY KEY REFERENCES tombolas(id) ON DELETE CASCADE,
  current_lot_id    INTEGER REFERENCES lots(id),
  phase             TEXT NOT NULL DEFAULT 'idle',
                                           -- 'idle' | 'spinning' | 'result' | 'finished'
  current_winner_id INTEGER REFERENCES participants(id),
  updated_at        DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### Notes sur le schéma

- `status` de tombola :
  - `pending` → date de début non atteinte
  - `open` → inscriptions ouvertes (entre starts_at et ends_at)
  - `closed` → clôturée manuellement ou date de fin atteinte, tirage pas encore lancé
  - `drawing` → tirage en cours
  - `finished` → tous les lots ont été tirés

- L'ordre de tirage va du lot de **position la plus haute vers la position 1** (le lot 1 est le gros lot, tiré en dernier).

- `has_won = 1` : ce participant est exclu de tous les tirages suivants de cette tombola (un gagnant ne peut gagner qu'un seul lot).

- `is_absent = 1` : ce participant est exclu de tous les tirages suivants de cette tombola.

- Un participant avec `is_absent = 1` **ET** `has_won = 1` est possible (cas edge : absent après avoir gagné — géré naturellement).

---

## 5. Variables d'environnement

Fichier `.env` (copié depuis `.env.example` à la première exécution) :

```env
# Authentification admin (obligatoire)
ADMIN_USER=admin
ADMIN_PASS=changeme

# Session
SESSION_SECRET=une_chaine_aleatoire_longue_ici
SESSION_MAX_AGE_HOURS=8

# Serveur
PORT=3000
APP_BASE_URL=http://localhost:3000   # URL publique pour génération des QR codes et liens

# Données
DATA_DIR=/app/data
```

**Règles** :
- Si `ADMIN_USER` ou `ADMIN_PASS` ne sont pas définis, le serveur **refuse de démarrer** et affiche une erreur explicite.
- `SESSION_MAX_AGE_HOURS` : durée de vie de la session admin en heures (défaut : 8).
- `APP_BASE_URL` : utilisé pour construire les URLs publiques d'inscription (`<APP_BASE_URL>/tombola/<ID>`) et les QR codes.

---

## 6. Docker & Déploiement

### `Dockerfile`

```dockerfile
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

RUN mkdir -p /app/data/images

EXPOSE 3000

CMD ["node", "app.js"]
```

### `docker-compose.yml`

```yaml
version: '3.8'

services:
  tombola:
    build: .
    restart: unless-stopped
    ports:
      - "3000:3000"
    volumes:
      - ./data:/app/data
    env_file:
      - .env
    environment:
      - DATA_DIR=/app/data
```

### Notes de déploiement

- Déploiement avec `docker compose up -d` (sans `--build` si l'image existe déjà).
- Le dossier `./data` sur l'hôte est créé automatiquement par Docker Compose si absent.
- La DB SQLite est initialisée au démarrage si elle n'existe pas (`/app/data/database.sqlite`).
- Les images uploadées sont stockées dans `/app/data/images/`.
- L'application est conçue pour fonctionner derrière un reverse proxy (Nginx Proxy Manager). Elle respecte les headers `X-Forwarded-For`, `X-Forwarded-Proto` via `app.set('trust proxy', 1)`.

### `package.json` — dépendances requises

```json
{
  "dependencies": {
    "better-sqlite3": "^9.x",
    "connect-sqlite3": "^0.9.x",
    "ejs": "^3.x",
    "express": "^4.x",
    "express-session": "^1.x",
    "multer": "^1.x",
    "qrcode": "^1.x",
    "sharp": "^0.33.x",
    "socket.io": "^4.x"
  }
}
```

---

## 7. Module Authentification Admin

### Routes

| Méthode | Route | Description |
|---------|-------|-------------|
| GET | `/admin/login` | Affiche le formulaire de login |
| POST | `/admin/login` | Traite les identifiants |
| GET | `/admin/logout` | Détruit la session et redirige vers `/admin/login` |

### Comportement

- Identifiants comparés aux variables d'environnement `ADMIN_USER` / `ADMIN_PASS`.
- En cas de succès : session créée, redirection vers `/admin`.
- En cas d'échec : retour sur `/admin/login` avec message d'erreur « Identifiants incorrects ».
- Toutes les routes sous `/admin/*` sont protégées par le middleware `isAuthenticated`. Si non authentifié : redirection vers `/admin/login`.
- **Aucune** route publique (`/tombola/*`) ne nécessite d'authentification.

### Middleware `isAuthenticated`

```javascript
// middleware/auth.js
module.exports = function isAuthenticated(req, res, next) {
  if (req.session && req.session.isAdmin) return next();
  return res.redirect('/admin/login');
};
```

---

## 8. Module Administration — Gestion des Tombolas

### 8.1 Liste des tombolas (`GET /admin`)

**Vue** : `views/admin/index.ejs`

Affiche un tableau listant toutes les tombolas avec :
- Nom
- Statut (badge coloré) : `En attente` / `Ouverte` / `Clôturée` / `En cours de tirage` / `Terminée`
- Nombre d'inscrits
- Dates de début et de fin (format `DD/MM/YYYY HH:mm`)
- Actions :
  - **Modifier** → `GET /admin/tombola/<ID>/edit`
  - **Supprimer** → bouton avec confirmation JavaScript (`confirm()`) → `POST /admin/tombola/<ID>/delete`
  - **Clôturer** (visible uniquement si statut `open`) → `POST /admin/tombola/<ID>/close`
  - **Lancer le tirage** (visible uniquement si statut `closed`) → lien vers `GET /admin/control/<ID>`
  - **Télécommande** (visible si statut `drawing`) → lien vers `GET /admin/control/<ID>`

Bouton principal : **« Créer une tombola »** → `GET /admin/tombola/new`

### 8.2 Création / Édition (`GET /admin/tombola/new` et `GET /admin/tombola/<ID>/edit`)

**Vue** : `views/admin/form.ejs` (même vue pour création et édition)

#### Champs du formulaire

| Champ | Type | Obligatoire | Validation |
|-------|------|-------------|------------|
| Nom de la tombola | text | Oui | Non vide, max 255 caractères |
| Image | file | Non | JPG/PNG/WebP, max 2 Mo |
| Date/Heure de début | datetime-local | Oui | Doit être < date de fin |
| Date/Heure de fin | datetime-local | Oui | Doit être > date de début |

#### Gestion des lots

Zone dédiée sous le formulaire principal.

- Liste dynamique de lots, chaque lot a :
  - Un **nom** (champ texte, obligatoire)
  - Une **position** (entier, assignée automatiquement)
- Bouton **« + Ajouter un lot »** : ajoute une ligne vide en bas.
- Bouton **« × »** sur chaque lot : supprime la ligne.
- **Drag & Drop** : les lignes sont réordonnables par glisser-déposer (utiliser l'attribut HTML `draggable` et les événements `dragstart`, `dragover`, `drop` en JS vanilla — pas de bibliothèque externe). La position est recalculée à la soumission (1 = premier dans la liste = gros lot, N = dernier = petit lot, tiré en premier).
- **Au moins 1 lot** est requis pour soumettre le formulaire.

**Attention à l'ordre** : la position `1` désigne le **gros lot** (tiré en DERNIER). La position la plus haute (ex: `5`) désigne le **petit lot** (tiré en PREMIER). L'UI affiche les lots de haut en bas dans l'ordre de tirage (du premier au dernier tiré), donc le lot affiché en tête de liste correspond à la position la plus haute.

#### Affichage du QR Code (mode édition uniquement)

Après création, dans la page d'édition :
- Afficher le QR Code (image PNG base64 générée serveur) pointant vers `<APP_BASE_URL>/tombola/<ID>`
- Afficher le lien d'inscription texte cliquable en dessous
- Bouton **« Copier le lien »** (JS `navigator.clipboard.writeText`)

#### Traitement serveur (POST)

**Création** (`POST /admin/tombola/new`) :
1. Valider les champs.
2. Si une image est fournie : traitement sharp (voir §8.3), sauvegarder dans `/app/data/images/<uuid>.webp`.
3. Insérer la tombola en DB.
4. Calculer et insérer les lots (position 1..N).
5. Créer une ligne `draw_state` pour cette tombola (`phase = 'idle'`).
6. Rediriger vers `GET /admin/tombola/<ID>/edit` avec message de succès.

**Édition** (`POST /admin/tombola/<ID>/edit`) :
1. Valider les champs.
2. Si une nouvelle image est fournie : supprimer l'ancienne image du disque (si elle existe), traiter et sauvegarder la nouvelle.
3. Mettre à jour la tombola en DB.
4. **Reconstruire entièrement la liste des lots** : supprimer tous les lots existants non encore tirés (ceux qui ont un `winner_id` sont préservés), réinsérer les lots du formulaire.

> **Restriction** : si la tombola est en statut `drawing` ou `finished`, la page d'édition affiche un message d'avertissement et désactive les champs (lecture seule), à l'exception de l'image qui reste modifiable.

#### Suppression (`POST /admin/tombola/<ID>/delete`)

1. Vérifier que la tombola n'est pas en statut `drawing` (si oui : erreur « Impossible de supprimer une tombola en cours de tirage »).
2. Supprimer l'image du disque si elle existe.
3. Supprimer la tombola en DB (CASCADE supprime lots, participants, draw_state).
4. Rediriger vers `/admin` avec message de succès.

#### Clôture manuelle (`POST /admin/tombola/<ID>/close`)

- Passer le statut de `open` à `closed`.
- Rediriger vers `/admin`.

### 8.3 Traitement des images uploadées

- Formats acceptés : `image/jpeg`, `image/png`, `image/webp`
- Taille max : **2 Mo** (rejetée avec message d'erreur si dépassée)
- Traitement avec **sharp** :
  - Redimensionner à **max 1200px de large** (conserver le ratio, ne pas agrandir)
  - Convertir en **WebP** qualité 85
  - Sauvegarder sous `/app/data/images/<uuid>.webp` (uuid v4 généré)
- Le champ `image_path` en DB stocke le chemin relatif : `images/<uuid>.webp`
- Les images sont servies via une route statique : `GET /data/images/<filename>` → fichier sur disque

### 8.4 Mise à jour automatique du statut

Un **intervalle serveur** (setInterval) toutes les **60 secondes** met à jour le statut des tombolas :
- Si `status = 'pending'` ET `NOW() >= starts_at` ET `NOW() < ends_at` → passer à `open`
- Si `status = 'open'` ET `NOW() >= ends_at` → passer à `closed`

> Cette logique doit aussi être vérifiée **à chaque requête d'inscription** pour rejeter les inscriptions si la tombola vient de passer à `closed`.

---

## 9. Module Inscription Publique

### Route

| Méthode | Route | Description |
|---------|-------|-------------|
| GET | `/tombola/<ID>` | Affiche le formulaire d'inscription |
| POST | `/tombola/<ID>` | Traite l'inscription |

**Vue** : `views/public/register.ejs`

### Affichage de la page

- Nom de la tombola (titre `<h1>`)
- Image de la tombola (si présente, affichée en pleine largeur responsive)
- **Compte à rebours** jusqu'à la date de clôture si la tombola est `open` (JS vanilla, rafraîchi toutes les secondes, format `JJ h MM min SS s`)
- Date de clôture formatée : `JJ/MM/AAAA à HH:MM`
- Formulaire d'inscription (visible uniquement si statut `open`)

### Formulaire

| Champ | Type | Validation |
|-------|------|------------|
| Prénom | text | Obligatoire, non vide |
| Nom | text | Obligatoire, non vide |
| Téléphone | text | Obligatoire, exactement 10 chiffres, commence par `0` |

### Validation téléphone (serveur ET client)

Regex : `/^0[0-9]{9}$/`

- Côté client : validation HTML5 + JS avant soumission, message d'erreur inline.
- Côté serveur : validation obligatoire, ne pas se fier uniquement au client.

### Contrôles à la soumission

1. La tombola existe → sinon 404.
2. Statut de la tombola = `open` → sinon message : « Les inscriptions sont fermées. »
3. Téléphone respecte le format → sinon message : « Le numéro de téléphone est invalide (10 chiffres, commence par 0). »
4. Téléphone non déjà inscrit à cette tombola → sinon message : « Ce numéro est déjà inscrit à cette tombola. »
5. Si tous les contrôles passent : insérer le participant.

### Retour après inscription

- Même page (`GET /tombola/<ID>`) avec message de succès : « Votre inscription est confirmée ! Bonne chance [Prénom] ! »
- Le formulaire est masqué après inscription réussie (redirection avec paramètre `?success=1`).
- Si erreur : retour sur le formulaire avec les valeurs pré-remplies (sauf téléphone) et le message d'erreur.

### Cas particuliers

- Tombola `pending` : afficher « Les inscriptions ne sont pas encore ouvertes. » + date de début.
- Tombola `closed`, `drawing` ou `finished` : afficher « Les inscriptions sont fermées. » sans formulaire.
- Tombola introuvable : page 404 personnalisée.

---

## 10. Module Tirage — Écran Public `/live`

### Route

| Méthode | Route | Description |
|---------|-------|-------------|
| GET | `/tombola/<ID>/live` | Écran public de tirage |

**Vue** : `views/public/live.ejs`

### États de l'écran public

L'écran public est **entièrement piloté par Socket.io**. Il reçoit des événements et met à jour son affichage en conséquence. Lors du chargement initial, il interroge le serveur pour récupérer l'état actuel (`draw_state`).

#### État 1 : Phase d'inscription (`phase = 'idle'`, tombola `open`)

Afficher :
- Nom de la tombola (grand, centré)
- Image de la tombola (si présente)
- **QR Code** de la page d'inscription (généré en base64 PNG, affiché en grand)
- Lien textuel sous le QR code
- **Compteur en temps réel** du nombre d'inscrits (mis à jour via Socket.io à chaque nouvelle inscription)
- Message : « Scannez le QR code pour participer ! »

> Le serveur émet un événement `participantCount` à chaque nouvelle inscription réussie.

#### État 2 : Tombola clôturée, en attente du tirage (`phase = 'idle'`, tombola `closed`)

Afficher :
- Nom de la tombola
- Image (si présente)
- Message : « Les inscriptions sont closes. Le tirage va commencer… »
- Nombre total d'inscrits

#### État 3 : Animation en cours (`phase = 'spinning'`)

Afficher :
- Nom du lot en cours (ex: « Lot n°3 — Panier garni »)
- **Zone d'animation** : défilement vertical de noms de participants

**Comportement de l'animation (effet slot machine)** :
- Les noms des participants éligibles défilent rapidement dans un container CSS à hauteur fixe.
- L'animation **ralentit progressivement** sur une durée de **5 secondes** jusqu'à s'arrêter sur le gagnant.
- Implémentation : le serveur tire le gagnant au moment où l'organisateur clique sur « Lancer », envoie le résultat dans l'événement `drawResult`. Le client anime un défilement aléatoire pendant 5 secondes, puis fait converger sur le nom du gagnant reçu.
- La liste de noms affichés pendant l'animation est la liste complète des participants éligibles (ni absents, ni déjà gagnants), reçue via Socket.io.

#### État 4 : Résultat affiché (`phase = 'result'`)

Afficher en grand (toute la page) :
- Fond festif (couleurs vives, confettis CSS animés)
- « 🎉 Félicitations ! »
- **Prénom + Nom du gagnant** (très grand, centré)
- Nom du lot gagné
- Le téléphone du gagnant **n'est jamais affiché** sur cet écran

#### État 5 : Tombola terminée (`phase = 'finished'`)

Afficher l'**écran de palmarès festif** :
- Fond festif avec animation CSS (confettis ou étoiles)
- Titre : « 🏆 Palmarès de la tombola »
- Liste de tous les gagnants, du gros lot (lot 1) au petit lot (lot N) :
  - Nom du lot | Prénom Nom du gagnant
  - En cas de lot sans gagnant (voir §14) : « Aucun gagnant »

### CSS Live

- Design plein écran, fond sombre (noir ou bleu nuit), textes clairs
- Responsive (fonctionne sur écran 1920×1080 projeté)
- Polices grandes (titres en `5vw` minimum)
- Animations CSS pures (pas de librairie externe) pour les confettis

---

## 11. Module Tirage — Télécommande Admin `/control`

### Route

| Méthode | Route | Description |
|---------|-------|-------------|
| GET | `/admin/control/<ID>` | Télécommande admin du tirage |

**Vue** : `views/admin/control.ejs` — protégée par `isAuthenticated`

### Chargement initial

Au chargement de la page :
1. Récupérer la tombola et ses lots depuis la DB.
2. Récupérer le `draw_state` depuis la DB.
3. Pré-remplir l'interface avec l'état actuel (si un tirage est en cours, afficher le bon lot et le bon état).
4. Se connecter au namespace Socket.io et rejoindre la room de la tombola.

> Ceci garantit que si la télécommande est fermée et rouverte, elle reprend exactement où elle en était.

### Interface

**Mobile-first** (viewport 375px de référence).

#### Zone d'information

- Nom de la tombola
- Statut actuel
- Lot en cours : « Lot [position] sur [total] — [Nom du lot] »
- Navigation : bouton **« ← Lot précédent »** et **« Lot suivant → »** (pour naviguer dans la liste des lots)
  - Ces boutons sont actifs uniquement si le lot actuel n'a pas encore de gagnant validé
  - Le lot suivant/précédent correspond aux positions adjacentes

#### Bouton principal : « Lancer le tirage »

- Visible si `phase = 'idle'` ou `phase = 'result'` (pour relancer si absent)
- Au clic :
  1. Émettre `startDraw` via Socket.io avec `{ tombolaId, lotId }`
  2. Le serveur effectue le tirage et émet `drawResult` à tous les clients

#### Zone résultat (visible si `phase = 'result'`)

Affiche :
- **Prénom Nom** du gagnant (grand)
- **Numéro de téléphone** du gagnant (pour vérification d'identité en présentiel)
- Nom du lot

Deux boutons d'action :

| Bouton | Action |
|--------|--------|
| ✅ **Valider le lot** | Enregistre le gagnant, passe au lot suivant |
| ❌ **Absent / Relancer** | Marque le participant comme absent, relance le tirage pour le même lot |

#### Bouton « Démarrer le tirage » (état initial)

Si statut de la tombola est `closed` et `phase = 'idle'` sans lot en cours :
- Afficher un bouton **« Démarrer la tombola »** qui initialise le `draw_state` avec le lot de position la plus haute et passe le statut à `drawing`.

#### Navigation entre lots

- La navigation (précédent/suivant) **ne peut pas revenir sur un lot déjà validé** (avec un `winner_id`).
- Elle permet de corriger une erreur de navigation avant de lancer le tirage.
- Si l'on navigue alors que `phase = 'spinning'` ou `phase = 'result'`, un avertissement JS (`confirm()`) demande confirmation.

---

## 12. Synchronisation temps réel — Socket.io

### Namespace et rooms

- Namespace : `/` (namespace par défaut)
- Room par tombola : `tombola-<ID>` (ex: `tombola-42`)
- Tous les clients (écran public + télécommande) rejoignent la room de leur tombola à la connexion.

### Événements émis par le client → serveur

| Événement | Payload | Émetteur | Description |
|-----------|---------|----------|-------------|
| `joinTombola` | `{ tombolaId }` | Tous | Rejoindre la room |
| `startDraw` | `{ tombolaId, lotId }` | Télécommande | Lancer le tirage |
| `validateWinner` | `{ tombolaId, lotId, participantId }` | Télécommande | Valider le gagnant |
| `markAbsent` | `{ tombolaId, lotId, participantId }` | Télécommande | Marquer absent + relancer |
| `navigateLot` | `{ tombolaId, direction }` | Télécommande | `direction: 'next'` ou `'prev'` |

### Événements émis par le serveur → clients

| Événement | Payload | Destinataire | Description |
|-----------|---------|--------------|-------------|
| `stateUpdate` | `{ phase, lot, participants }` | Room | Mise à jour générale de l'état |
| `drawResult` | `{ phase: 'result', lot, winner: { firstName, lastName }, participants }` | Room | Résultat du tirage |
| `drawResultFull` | `{ phase: 'result', lot, winner: { firstName, lastName, phone }, participants }` | Télécommande seulement | Résultat complet avec téléphone |
| `lotValidated` | `{ lot, winner, nextLot, phase }` | Room | Lot validé, passage au suivant |
| `drawFinished` | `{ winners: [{lot, winner}] }` | Room | Tous les lots tirés |
| `participantCount` | `{ tombolaId, count }` | Room | Nouveau participant inscrit |
| `error` | `{ message }` | Émetteur | Erreur |

> **Important RGPD** : `drawResult` (émis à toute la room, donc à l'écran public) ne contient **jamais** le numéro de téléphone. `drawResultFull` est émis **uniquement** à la socket de la télécommande (pas broadcast).

### Logique du tirage côté serveur (`sockets/draw.js`)

```
startDraw reçu :
  1. Vérifier que l'émetteur est authentifié (via session ou token dans handshake)
  2. Récupérer les participants éligibles :
     - tombola_id = tombolaId
     - is_absent = 0
     - has_won = 0
  3. Si aucun participant éligible → émettre error { message: "Aucun participant éligible" }
  4. Tirer un gagnant au hasard parmi les éligibles (Math.random)
  5. Mettre à jour draw_state :
     - phase = 'spinning'
     - current_winner_id = gagnant tiré
  6. Émettre stateUpdate (phase: 'spinning') à toute la room
  7. Attendre 5500ms (durée animation + marge)
  8. Émettre drawResult (sans téléphone) à toute la room
  9. Émettre drawResultFull (avec téléphone) à la socket de la télécommande uniquement
 10. Mettre à jour draw_state : phase = 'result'

validateWinner reçu :
  1. Mettre à jour lots SET winner_id, drawn_at
  2. Mettre à jour participants SET has_won = 1
  3. Déterminer le lot suivant (position - 1)
  4. Si lot suivant existe :
     - Mettre à jour draw_state : current_lot_id = next_lot.id, phase = 'idle', current_winner_id = NULL
     - Émettre lotValidated
  5. Si aucun lot suivant (tous tirés) :
     - Mettre à jour tombola : status = 'finished'
     - Mettre à jour draw_state : phase = 'finished'
     - Émettre drawFinished avec palmarès complet

markAbsent reçu :
  1. Mettre à jour participants SET is_absent = 1 WHERE id = participantId
  2. Mettre à jour draw_state : phase = 'idle', current_winner_id = NULL
  3. Relancer immédiatement startDraw pour le même lot
```

### Sécurité Socket.io

- Les événements `startDraw`, `validateWinner`, `markAbsent`, `navigateLot` vérifient que la session Express est valide et que `req.session.isAdmin = true`.
- Implémentation : lors du handshake Socket.io, récupérer la session via `express-session` partagée (utiliser `socket.request.session`).
- Si un client non authentifié émet ces événements : émettre `error { message: "Non autorisé" }` et ne rien faire.

---

## 13. API REST — Référence complète

### Routes publiques

| Méthode | Route | Description |
|---------|-------|-------------|
| GET | `/tombola/<ID>` | Page d'inscription |
| POST | `/tombola/<ID>` | Soumettre une inscription |
| GET | `/tombola/<ID>/live` | Écran public tirage |
| GET | `/data/images/<filename>` | Servir une image uploadée |

### Routes admin (toutes protégées par `isAuthenticated`)

| Méthode | Route | Description |
|---------|-------|-------------|
| GET | `/admin` | Liste des tombolas |
| GET | `/admin/login` | Page de connexion |
| POST | `/admin/login` | Traitement connexion |
| GET | `/admin/logout` | Déconnexion |
| GET | `/admin/tombola/new` | Formulaire de création |
| POST | `/admin/tombola/new` | Créer une tombola |
| GET | `/admin/tombola/<ID>/edit` | Formulaire d'édition |
| POST | `/admin/tombola/<ID>/edit` | Modifier une tombola |
| POST | `/admin/tombola/<ID>/delete` | Supprimer une tombola |
| POST | `/admin/tombola/<ID>/close` | Clôturer manuellement |
| GET | `/admin/control/<ID>` | Télécommande tirage |

### Codes de retour HTTP

- `200` : succès
- `302` : redirection (après POST)
- `404` : tombola introuvable
- `400` : erreur de validation (affiché dans la vue, pas en JSON)
- `403` : non autorisé (redirect vers login)

> Toutes les réponses sont des pages HTML (rendu EJS). Pas d'API JSON REST (sauf les WebSockets).

---

## 14. Règles métier & cas limites

### Tableau récapitulatif

| Cas | Règle |
|-----|-------|
| Unicité téléphone | Un numéro de téléphone = une seule inscription par tombola. Vérifié en DB (UNIQUE) et en amont avec message d'erreur lisible. |
| Ordre de tirage | Du lot de position la plus haute (petit lot) vers la position 1 (gros lot). |
| Absence | `is_absent = 1` → exclu de tous les tirages suivants de cette tombola, même s'il a déjà gagné. |
| Exclusion des gagnants | `has_won = 1` → exclu de tous les tirages suivants de cette tombola. |
| RGPD | Le numéro de téléphone ne figure jamais sur l'écran public `/live`. Il est visible uniquement dans la télécommande `/admin/control`. |
| État du tirage | Le serveur est la source de vérité. Tout client qui se (re)connecte reçoit l'état courant via `draw_state`. |
| Tombola `drawing` | Impossible à modifier (formulaire en lecture seule) ou supprimer. |
| Lot sans gagnant | Si tous les participants éligibles sont absents pour un lot : émettre `error` à la télécommande, afficher « Aucun participant éligible pour ce lot ». Proposer le bouton **« Passer ce lot »** qui valide le lot sans gagnant (`winner_id = NULL`, `drawn_at = NOW()`). Le palmarès affiche « Aucun gagnant » pour ce lot. |
| Relance après absent | Après `markAbsent`, le même lot est retracé immédiatement avec les participants restants (excluant le nouveau absent). |
| Navigation lots | On ne peut pas naviguer vers un lot déjà validé (`winner_id IS NOT NULL`). |
| Tombola sans participant | Si 0 inscrit au moment de démarrer le tirage : émettre `error { message: "Aucun participant inscrit à cette tombola." }` |
| Tombola `finished` | Immuable. Aucune action possible sauf suppression (depuis l'admin). |

### Algorithme de tirage

```javascript
// Participants éligibles = inscrits ET non absents ET n'ayant pas encore gagné
const eligibles = participants.filter(p => p.is_absent === 0 && p.has_won === 0);
if (eligibles.length === 0) { /* cas limite ci-dessus */ }
const winner = eligibles[Math.floor(Math.random() * eligibles.length)];
```

---

## 15. Sécurité & RGPD

### Mesures de sécurité

- **Sessions** : cookies `httpOnly`, `secure` si `APP_BASE_URL` commence par `https://`, `sameSite: 'lax'`.
- **Headers** : utiliser `helmet` (ajouter aux dépendances) pour les headers de sécurité HTTP.
- **Upload** : validation du type MIME côté serveur (pas uniquement l'extension). Multer configuré avec `fileFilter` vérifiant `mimetype`.
- **SQL Injection** : utiliser exclusivement les requêtes préparées de `better-sqlite3` (paramètres `?` ou nommés).
- **Téléphone** : validé par regex avant insertion.
- **XSS** : EJS auto-escape par défaut (`<%= %>` et non `<%- %>`). Ne jamais utiliser `<%-` sur des données utilisateur.
- **Authentification Socket** : vérifier la session à chaque événement sensible (voir §12).

### RGPD

- Le numéro de téléphone est collecté uniquement pour vérification d'identité lors du tirage.
- Il n'est affiché que dans l'interface `/admin/control` (visible uniquement par l'organisateur).
- Il n'apparaît jamais dans les URLs, les logs applicatifs, ou sur l'écran public.
- Il n'y a pas d'export incluant les numéros de téléphone.
- Suppression d'une tombola = suppression complète des données participants (CASCADE DB + image disque).

---

## 16. Design & UI — Directives

### Principes généraux

- **Mobile-first** pour toutes les vues admin.
- **Plein écran** pour la vue `/live` (optimisée 1920×1080).
- Pas de framework CSS externe (Bootstrap, Tailwind…). CSS vanilla uniquement.
- Pas de framework JS externe sauf Socket.io (chargé via CDN depuis le serveur, ou bundlé dans `/public/js/`).

### Palette de couleurs suggérée

| Usage | Couleur |
|-------|---------|
| Fond admin | `#f5f5f5` |
| Accent admin | `#6c3fc5` (violet) |
| Fond live | `#0d0d2b` (bleu nuit) |
| Texte live | `#ffffff` |
| Accent live (gagnant) | `#ffd700` (or) |
| Succès | `#28a745` |
| Danger | `#dc3545` |
| En attente | `#6c757d` |

### Statuts — badges colorés (admin)

| Statut | Couleur badge |
|--------|---------------|
| `pending` / En attente | Gris `#6c757d` |
| `open` / Ouverte | Vert `#28a745` |
| `closed` / Clôturée | Orange `#fd7e14` |
| `drawing` / En cours | Violet `#6c3fc5` |
| `finished` / Terminée | Bleu `#17a2b8` |

### Animations CSS (écran live)

#### Confettis (états `result` et `finished`)
```css
/* Implémenter avec @keyframes sur des éléments <div> générés dynamiquement en JS */
/* Couleurs alternées : #ffd700, #ff6b6b, #4ecdc4, #6c3fc5, #ffffff */
/* Chute de haut en bas avec rotation et oscillation horizontale */
/* Durée : 3-5s, en boucle infinie */
```

#### Défilement noms (animation slot machine)
```css
/* Container height: 120px, overflow: hidden */
/* Transition: transform sur une liste de <div> empilés */
/* Vitesse initiale : 60ms entre chaque frame */
/* Décélération progressive : augmenter l'intervalle de 60ms → 800ms sur 5s */
```

### Formulaire drag & drop (lots)

- Chaque ligne de lot possède une poignée (icône `⠿` ou `≡`) à gauche.
- `draggable="true"` sur la ligne entière.
- Indicateur visuel de la zone de dépôt (bordure en pointillés).
- À la soumission : les positions sont recalculées selon l'ordre affiché (le premier affiché = gros lot = position 1, le dernier = petit lot = position N).

### Messages flash

Implémenter un système de messages flash léger avec `express-session` :
- `req.session.flash = { type: 'success' | 'error', message: '...' }`
- Lu et affiché dans le layout, puis supprimé de la session.
- Affichage sous forme de bannière colorée en haut de page (disparaît après 4 secondes via JS ou `setTimeout`).

---

## Annexe A — Exemple de flux complet (scénario de bout en bout)

1. L'organisateur crée une tombola « Soirée Gala 2025 » avec 3 lots : « Panier garni » (pos 3), « Séjour spa » (pos 2), « Voiture » (pos 1).
2. Les participants scannent le QR code et s'inscrivent sur `/tombola/1`.
3. L'organisateur clôture manuellement depuis `/admin`.
4. L'organisateur ouvre `/admin/control/1` sur son téléphone, l'écran public `/tombola/1/live` est projeté.
5. L'organisateur clique **« Démarrer la tombola »** → statut passe à `drawing`, `current_lot_id` = lot 3 (Panier garni).
6. L'écran public affiche le nom du lot 3.
7. L'organisateur clique **« Lancer le tirage »** → animation 5s → gagnant affiché.
8. Sur la télécommande : nom + prénom + téléphone du gagnant.
9. L'organisateur vérifie l'identité, clique **« Valider le lot »** → `has_won = 1`, passage au lot 2.
10. Répétition pour lot 2 (Séjour spa).
11. Au lot 1 (Voiture), un participant tiré ne se présente pas → **« Absent / Relancer »** → `is_absent = 1`, nouveau tirage.
12. Gagnant validé pour lot 1 → `phase = 'finished'` → écran palmarès festif.

---

## Annexe B — Checklist de démarrage pour le développeur LLM

- [ ] Initialiser le projet Node.js avec `npm init`
- [ ] Installer toutes les dépendances listées en §6
- [ ] Créer la structure de dossiers en §3
- [ ] Implémenter `db/database.js` avec création du schéma au démarrage
- [ ] Implémenter `app.js` : Express + Socket.io + session partagée + serveur HTTP
- [ ] Implémenter le middleware auth
- [ ] Implémenter les routes dans l'ordre : auth → admin (CRUD) → public (inscription) → control → live
- [ ] Implémenter `sockets/draw.js` avec toute la logique de tirage
- [ ] Créer toutes les vues EJS
- [ ] Créer le CSS admin et live
- [ ] Créer les scripts JS client (drag & drop, socket live, socket control)
- [ ] Créer `Dockerfile` et `docker-compose.yml`
- [ ] Créer `.env.example`
- [ ] Tester le flux complet (§ Annexe A)
