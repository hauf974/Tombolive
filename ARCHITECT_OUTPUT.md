Je n'arrive pas à écrire les fichiers car les permissions ne sont pas encore accordées. Pour débloquer la situation, vous pouvez :

**Option A** — Approuver les écritures individuellement : cliquez "Allow" quand la boîte de dialogue de permission apparaît pour chaque fichier.

**Option B** — Ajouter les permissions en avance. Créez manuellement `/home/hauf/tombolive/.claude/settings.json` avec :
```json
{
  "permissions": {
    "allow": ["Write", "Bash"]
  }
}
```

**Option C** — Lancer Claude Code en mode `--dangerously-skip-permissions` si c'est votre environnement local de développement.

---

En attendant, voici le contenu complet des 5 fichiers à créer. Dès que vous m'accordez la permission, je les écrirai tous.

---

<details>
<summary><strong>ARCHITECTURE.md</strong></summary>

```markdown
# ARCHITECTURE.md — Tombolive
> Version 1.0 | ARCHITECT HaufCode | 2026-05-01

## 1. Vision technique
Full-stack monolithique Node.js, rendu EJS serveur, Socket.io pour la synchronisation temps réel du tirage.

## 2. Stack
Node 20 | Express 4 | Socket.io 4 | better-sqlite3 9 | EJS 3 | Multer 1 | sharp 0.33 | qrcode 1 | express-session + connect-sqlite3 | helmet 7

## 3. Règles métier critiques
- Tirage : position MAX en premier, position 1 (gros lot) en dernier
- Exclusion : is_absent=1 OU has_won=1 → exclu des tirages suivants
- RGPD : téléphone jamais dans drawResult (broadcast), uniquement dans drawResultFull (unicast télécommande)
- Démarrage bloquant : ADMIN_USER ou ADMIN_PASS absents → process.exit(1)

## 4. Session partagée HTTP ↔ Socket.io
io.use((socket, next) => { sessionMiddleware(socket.request, socket.request.res || {}, next); });
Vérification socket.request.session.isAdmin sur événements sensibles.

## 5. Contraintes
- DATA_DIR=/app/data en Docker, images/ créé au démarrage
- APP_BASE_URL sans slash final
- trust proxy = 1 (derrière Nginx)
- Cookie secure si HTTPS
- EJS : toujours <%= %>, jamais <%- sur données user
- setTimeout(5500ms) avant émission résultat tirage
- setInterval(60s) pour mise à jour statuts tombolas
```
</details>

---

Voici maintenant les fichiers de planification complets :

---

**PHASE1.md — Fondations**

```
Phase 1 : Fondations (4 slices)

Sprint 1.1 — Infrastructure projet

## Slice S1-1 : Setup projet (package.json, structure, .env, Docker)
**Statut** : TODO
**Itérations** : 0
**Critères d'acceptation** :
- [ ] package.json avec toutes les dépendances (express, socket.io, better-sqlite3, connect-sqlite3, ejs, multer, sharp, qrcode, express-session, helmet)
- [ ] Tous les dossiers créés : db/, routes/, sockets/, middleware/, views/admin/, views/public/, public/css/, public/js/, data/images/
- [ ] .env.example avec toutes les variables documentées
- [ ] Dockerfile FROM node:20-alpine, WORKDIR /app, npm ci --omit=dev, EXPOSE 3000
- [ ] docker-compose.yml avec volume ./data:/app/data et env_file
- [ ] npm install réussit sans erreur

## Slice S1-2 : Base de données (db/database.js)
**Statut** : TODO
**Itérations** : 0
**Critères d'acceptation** :
- [ ] Connexion SQLite sur DATA_DIR/database.sqlite (créé si absent)
- [ ] Création des 4 tables : tombolas, lots, participants, draw_state (IF NOT EXISTS)
- [ ] Dossier DATA_DIR/images/ créé si absent (fs.mkdirSync)
- [ ] Module exporte l'instance db (better-sqlite3)
- [ ] Pas d'erreur au démarrage si DB vide

## Slice S1-3 : app.js (Express + Socket.io + session + middlewares)
**Statut** : TODO
**Itérations** : 0
**Critères d'acceptation** :
- [ ] Vérification ADMIN_USER et ADMIN_PASS au démarrage → process.exit(1) si absent
- [ ] Express avec helmet, trust proxy, express.json(), express.urlencoded(), express.static pour /public et /data/images
- [ ] Session configurée avec connect-sqlite3, httpOnly, sameSite: 'lax', secure selon APP_BASE_URL
- [ ] Socket.io partage le sessionMiddleware via io.use()
- [ ] EJS configuré comme view engine
- [ ] Serveur HTTP démarre sur PORT (défaut 3000)
- [ ] setInterval(60s) de mise à jour des statuts tombolas

## Slice S1-4 : Authentification (middleware/auth.js + routes/auth.js + vues login)
**Statut** : TODO
**Itérations** : 0
**Critères d'acceptation** :
- [ ] middleware/auth.js : isAuthenticated redirige vers /admin/login si session.isAdmin absent
- [ ] GET /admin/login → vue login.ejs
- [ ] POST /admin/login : compare ADMIN_USER/ADMIN_PASS, crée session.isAdmin=true, redirige /admin
- [ ] POST /admin/login echec → login.ejs avec message "Identifiants incorrects"
- [ ] GET /admin/logout → détruit session, redirige /admin/login
- [ ] views/login.ejs : formulaire HTML, champs user/password, message erreur conditionnel
- [ ] layout.ejs : structure HTML commune admin avec lien déconnexion et zone flash message
```

---

**PHASE2.md — Module Admin + Public**

```
Phase 2 : Admin CRUD + Module Public (8 slices)

Sprint 2.1 — Administration tombolas

## Slice S2-1 : Liste tombolas (GET /admin + index.ejs)
**Statut** : TODO
**Itérations** : 0
**Critères d'acceptation** :
- [ ] GET /admin protégé par isAuthenticated
- [ ] Requête DB : liste tombolas avec COUNT participants
- [ ] index.ejs : tableau avec colonnes nom, statut (badge coloré), inscrits, dates, actions
- [ ] Badges colorés pour les 5 statuts selon la palette définie
- [ ] Bouton "Créer une tombola"
- [ ] Actions contextuelles : Modifier, Supprimer (confirm JS), Clôturer (si open), Lancer/Télécommande (si closed/drawing)
- [ ] Messages flash affichés et supprimés de la session

## Slice S2-2 : Création tombola (GET/POST /admin/tombola/new + form.ejs)
**Statut** : TODO
**Itérations** : 0
**Critères d'acceptation** :
- [ ] GET /admin/tombola/new → form.ejs en mode création
- [ ] POST /admin/tombola/new : validation nom (non vide, max 255), dates (début < fin), au moins 1 lot
- [ ] Insertion tombola + lots en DB avec positions calculées
- [ ] Création ligne draw_state (phase='idle')
- [ ] Redirection vers /admin/tombola/<ID>/edit avec flash succès
- [ ] form.ejs : champs nom, image, starts_at, ends_at, zone lots dynamique
- [ ] Erreurs de validation affichées inline, valeurs pré-remplies

## Slice S2-3 : Upload et traitement images (Multer + sharp)
**Statut** : TODO
**Itérations** : 0
**Critères d'acceptation** :
- [ ] Multer configuré : fileFilter (image/jpeg, image/png, image/webp), limite 2Mo
- [ ] sharp : redimensionner max 1200px large (ne pas agrandir), convertir WebP qualité 85
- [ ] Fichier sauvé sous DATA_DIR/images/<uuid>.webp
- [ ] image_path en DB stocke "images/<uuid>.webp"
- [ ] Si image > 2Mo → message d'erreur lisible, formulaire réaffiché
- [ ] Si type MIME invalide → rejet avec message

## Slice S2-4 : Édition tombola (GET/POST /admin/tombola/:id/edit)
**Statut** : TODO
**Itérations** : 0
**Critères d'acceptation** :
- [ ] GET /admin/tombola/:id/edit → form.ejs pré-rempli avec données actuelles
- [ ] Mode drawing/finished : formulaire en lecture seule (sauf image), message avertissement
- [ ] POST /admin/tombola/:id/edit : même validation que création
- [ ] Si nouvelle image → supprimer ancienne image du disque, traiter nouvelle
- [ ] Reconstruction lots : garder lots avec winner_id, supprimer/recréer les autres
- [ ] QR Code (base64 PNG) affiché dans la page édition avec lien et bouton "Copier le lien"

## Slice S2-5 : Suppression et clôture (POST /admin/tombola/:id/delete et /close)
**Statut** : TODO
**Itérations** : 0
**Critères d'acceptation** :
- [ ] POST /admin/tombola/:id/delete : interdit si statut 'drawing' (message erreur)
- [ ] Suppression image disque si présente
- [ ] Suppression DB (CASCADE lots + participants + draw_state)
- [ ] Redirection /admin avec flash succès
- [ ] POST /admin/tombola/:id/close : passe statut open → closed
- [ ] Redirection /admin avec flash succès

## Slice S2-6 : Gestion lots + drag & drop (public/js/admin-form.js)
**Statut** : TODO
**Itérations** : 0
**Critères d'acceptation** :
- [ ] Bouton "+ Ajouter un lot" : ajoute ligne avec champ texte et bouton "×"
- [ ] Bouton "×" : supprime la ligne
- [ ] draggable="true" sur chaque ligne, poignée "⠿" à gauche
- [ ] Drag & drop réordonne les lignes visuellement
- [ ] Indicateur visuel zone de dépôt (bordure pointillés)
- [ ] À la soumission : positions recalculées (premier affiché = position 1 = gros lot)
- [ ] Validation JS : au moins 1 lot, tous les noms remplis

Sprint 2.2 — Module public

## Slice S2-7 : Inscription publique (GET/POST /tombola/:id + register.ejs)
**Statut** : TODO
**Itérations** : 0
**Critères d'acceptation** :
- [ ] GET /tombola/:id → register.ejs avec état tombola
- [ ] Tombola introuvable → 404 personnalisée
- [ ] Affichage conditionnel selon statut : formulaire (open), messages informatifs (autres statuts)
- [ ] POST /tombola/:id : validation prénom (non vide), nom (non vide), téléphone (/^0[0-9]{9}$/)
- [ ] Vérification unicité téléphone, statut open, tombola exists
- [ ] Insertion participant, émission Socket.io participantCount
- [ ] Succès : redirect ?success=1, formulaire masqué, message "Votre inscription est confirmée ! Bonne chance [Prénom] !"
- [ ] Erreur : formulaire pré-rempli (sauf téléphone), message erreur inline
- [ ] Validation téléphone côté client (regex HTML5 + JS)

## Slice S2-8 : Compte à rebours + CSS public (register.ejs JS + public/css/admin.css)
**Statut** : TODO
**Itérations** : 0
**Critères d'acceptation** :
- [ ] Compte à rebours JS vanilla : format "JJ h MM min SS s", mis à jour chaque seconde, affiché si statut open
- [ ] Route GET /data/images/:filename → sert DATA_DIR/images/:filename (statique)
- [ ] admin.css : palette violet/gris, mobile-first, badges statuts, tableau responsive, formulaires
- [ ] Messages flash : bannière colorée, disparition après 4s via JS (setTimeout)
- [ ] register.ejs : nom tombola h1, image responsive, formulaire stylisé, messages erreur/succès
```

---

**PHASE3.md — Tirage temps réel**

```
Phase 3 : Tirage temps réel (5 slices)

Sprint 3.1 — Socket.io tirage

## Slice S3-1 : Infrastructure Socket.io (sockets/draw.js — joinTombola + stateUpdate)
**Statut** : TODO
**Itérations** : 0
**Critères d'acceptation** :
- [ ] Événement joinTombola : client rejoint room tombola-<ID>
- [ ] Événement startTombola : si statut closed et phase idle → statut 'drawing', current_lot_id = lot position max, émet stateUpdate
- [ ] navigateLot : direction next/prev, ne peut pas aller vers lot avec winner_id, émet stateUpdate
- [ ] Tous événements admin vérifient socket.request.session.isAdmin → émet error si non authentifié
- [ ] État initial servi au chargement via DB (pour reconnexion)

## Slice S3-2 : Logique tirage (sockets/draw.js — startDraw + résultat)
**Statut** : TODO
**Itérations** : 0
**Critères d'acceptation** :
- [ ] startDraw : filtre éligibles (is_absent=0, has_won=0), tire au sort
- [ ] 0 éligibles → émet error "Aucun participant éligible" + option "Passer ce lot"
- [ ] draw_state mis à jour : phase='spinning', current_winner_id
- [ ] Émet stateUpdate (phase: 'spinning') à toute la room + liste participants éligibles
- [ ] Après 5500ms : émet drawResult (sans téléphone) à room + drawResultFull (avec téléphone) à socket télécommande uniquement
- [ ] draw_state mis à jour : phase='result'

## Slice S3-3 : Validation et fin (sockets/draw.js — validateWinner + markAbsent + drawFinished)
**Statut** : TODO
**Itérations** : 0
**Critères d'acceptation** :
- [ ] validateWinner : lots SET winner_id + drawn_at, participants SET has_won=1
- [ ] Lot suivant = position - 1. Si existe : draw_state current_lot_id = next, phase='idle', émet lotValidated
- [ ] Si aucun lot suivant : tombola status='finished', draw_state phase='finished', émet drawFinished avec palmarès complet
- [ ] markAbsent : participants SET is_absent=1, draw_state phase='idle', relance startDraw immédiatement
- [ ] skipLot (aucun éligible) : winner_id=NULL, drawn_at=NOW(), même logique que validateWinner pour passage au suivant
- [ ] participantCount émis à chaque nouvelle inscription réussie

## Slice S3-4 : Télécommande admin (routes/control.js + views/admin/control.ejs + public/js/control.js)
**Statut** : TODO
**Itérations** : 0
**Critères d'acceptation** :
- [ ] GET /admin/control/:id protégé isAuthenticated
- [ ] Chargement initial : tombola + lots + draw_state depuis DB
- [ ] control.ejs : zone info (nom, statut, lot en cours), bouton principal contextuel, zone résultat avec téléphone
- [ ] Mobile-first (375px référence)
- [ ] control.js : connexion Socket.io, joinTombola, écoute stateUpdate/drawResult/drawResultFull/lotValidated/drawFinished
- [ ] Bouton "Démarrer la tombola" → émet startTombola
- [ ] Bouton "Lancer le tirage" → émet startDraw
- [ ] Bouton "Valider le lot" → émet validateWinner
- [ ] Bouton "Absent / Relancer" → émet markAbsent
- [ ] Boutons navigation "Lot précédent/suivant" → émet navigateLot
- [ ] Zone résultat : Prénom Nom (grand) + téléphone + nom lot
- [ ] Affichage erreurs Socket.io (aucun éligible, etc.)

## Slice S3-5 : Écran live (routes/public.js + views/public/live.ejs + public/js/live.js + public/css/live.css)
**Statut** : TODO
**Itérations** : 0
**Critères d'acceptation** :
- [ ] GET /tombola/:id/live → live.ejs avec état initial depuis DB
- [ ] live.js : connexion Socket.io, joinTombola, gère tous les états (idle-open, idle-closed, spinning, result, finished)
- [ ] État idle-open : nom tombola, image, QR code grand, compteur inscrits temps réel, message "Scannez le QR code"
- [ ] État idle-closed : nom, image, message "Les inscriptions sont closes. Le tirage va commencer…"
- [ ] État spinning : nom lot, animation slot machine (défilement noms, ralentissement progressif 5s vers gagnant)
- [ ] État result : plein écran festif, "Félicitations !", Prénom Nom gagnant, nom lot (PAS de téléphone)
- [ ] État finished : écran palmarès, tous les gagnants du gros lot au petit lot, "Aucun gagnant" si winner_id NULL
- [ ] live.css : fond #0d0d2b, polices 5vw minimum, confettis CSS @keyframes (result + finished), responsive 1920x1080
- [ ] Animation slot machine : container 120px overflow:hidden, décélération 60ms→800ms sur 5s
```

---

**TODO.md**

```
# TODO.md — Tombolive

> Généré par ARCHITECT | 2026-05-01

## Phase 1 — Fondations

| Slice | Nom | Statut |
|-------|-----|--------|
| S1-1 | Setup projet (package.json, structure, .env, Docker) | TODO |
| S1-2 | Base de données (db/database.js) | TODO |
| S1-3 | app.js (Express + Socket.io + session + middlewares) | TODO |
| S1-4 | Authentification (middleware/auth + routes/auth + vues login) | TODO |

## Phase 2 — Admin CRUD + Module Public

| Slice | Nom | Statut |
|-------|-----|--------|
| S2-1 | Liste tombolas (GET /admin + index.ejs) | TODO |
| S2-2 | Création tombola (GET/POST /admin/tombola/new + form.ejs) | TODO |
| S2-3 | Upload images (Multer + sharp) | TODO |
| S2-4 | Édition tombola (GET/POST /admin/tombola/:id/edit) | TODO |
| S2-5 | Suppression et clôture | TODO |
| S2-6 | Gestion lots + drag & drop (admin-form.js) | TODO |
| S2-7 | Inscription publique (GET/POST /tombola/:id + register.ejs) | TODO |
| S2-8 | Compte à rebours + CSS public | TODO |

## Phase 3 — Tirage temps réel

| Slice | Nom | Statut |
|-------|-----|--------|
| S3-1 | Infrastructure Socket.io (joinTombola + startTombola + navigateLot) | TODO |
| S3-2 | Logique tirage (startDraw + drawResult) | TODO |
| S3-3 | Validation et fin (validateWinner + markAbsent + drawFinished) | TODO |
| S3-4 | Télécommande admin (control.ejs + control.js) | TODO |
| S3-5 | Écran live (live.ejs + live.js + live.css) | TODO |

**Total : 17 slices**
```

---

Pour débloquer l'écriture des fichiers, la méthode la plus simple est d'approuver la prochaine demande de permission Write, ou d'utiliser :

```bash
# Depuis le terminal dans /home/hauf/tombolive :
mkdir -p .claude && echo '{"permissions":{"allow":["Write","Bash(*)"]}}' > .claude/settings.json
```

Ensuite, relancez-moi et j'écrirai tous les fichiers automatiquement.

NEXT: HUMAN