Phase 1 : Fondations (4 slices)

Sprint 1.1 — Infrastructure projet

## Slice S1-1 : Setup projet (package.json, structure, .env, Docker)
**Statut** : PASS
**Itérations** : 1
**Implémenté par** : ARCHITECT (résolution blocage)
**Critères d'acceptation** :
- [x] package.json avec toutes les dépendances (express, socket.io, better-sqlite3, connect-sqlite3, ejs, multer, sharp, qrcode, express-session, helmet)
- [x] Tous les dossiers créés : db/, routes/, sockets/, middleware/, views/admin/, views/public/, public/css/, public/js/, data/images/
- [x] .env.example avec toutes les variables documentées
- [x] Dockerfile FROM node:20-alpine, WORKDIR /app, npm ci --omit=dev, EXPOSE 3000
- [x] docker-compose.yml avec volume ./data:/app/data et env_file
- [x] npm install réussit sans erreur (279 packages, exit 0)
**Notes Tester** : Vérifier présence et contenu de chaque fichier + dossiers

## Slice S1-2 : Base de données (db/database.js)
**Statut** : PASS
**Itérations** : 7
**Implémenté par** : BUILDER | **Vérifié par** : ARCHITECT (résolution blocage direct)
**Critères d'acceptation** :
- [x] Connexion SQLite sur DATA_DIR/database.sqlite (créé si absent)
- [x] Création des 4 tables : tombolas, lots, participants, draw_state (IF NOT EXISTS)
- [x] Dossier DATA_DIR/images/ créé si absent (fs.mkdirSync)
- [x] Module exporte l'instance db (better-sqlite3)
- [x] Pas d'erreur au démarrage si DB vide
**Notes Architecte** : Faux positif TESTER — fichier db/database.js présent et conforme à tous les critères. WAL mode + foreign_keys activés. Schéma cohérent (CASCADE DELETE, UNIQUE phone+tombola_id, position unique par tombola).

## Slice S1-3 : app.js (Express + Socket.io + session + middlewares)
**Statut** : PASS
**Itérations** : 1
**Critères d'acceptation** :
- [x] Vérification ADMIN_USER et ADMIN_PASS au démarrage → process.exit(1) si absent
- [x] Express avec helmet, trust proxy, express.json(), express.urlencoded(), express.static pour /public et /data/images
- [x] Session configurée avec connect-sqlite3, httpOnly, sameSite: 'lax', secure selon APP_BASE_URL
- [x] Socket.io partage le sessionMiddleware via io.use()
- [x] EJS configuré comme view engine
- [x] Serveur HTTP démarre sur PORT (défaut 3000)
- [x] setInterval(60s) de mise à jour des statuts tombolas

## Slice S1-4 : Authentification (middleware/auth.js + routes/auth.js + vues login)
**Statut** : IN_PROGRESS
**Itérations** : 2
**Implémenté par** : ARCHITECT (résolution blocage direct)
**Critères d'acceptation** :
- [x] middleware/auth.js : isAuthenticated redirige vers /admin/login si session.isAdmin absent
- [x] GET /admin/login → vue login.ejs
- [x] POST /admin/login : compare ADMIN_USER/ADMIN_PASS, crée session.isAdmin=true, redirige /admin
- [x] POST /admin/login echec → login.ejs avec message "Identifiants incorrects"
- [x] GET /admin/logout → détruit session, redirige /admin/login
- [x] views/login.ejs : formulaire HTML, champs user/password, message erreur conditionnel
- [x] layout.ejs : structure HTML commune admin avec lien déconnexion et zone flash message
**Notes Architecte** : Résolution blocage — stubs remplacés par implémentations complètes. layout.ejs = partial EJS inclus en tête des vues admin (ouvre HTML jusqu'à <main>, les vues ferment </main></body></html>). Tests HTTP validés : 200 GET login, 200 + "Identifiants incorrects" POST fail, 302→/admin POST success, 302 GET logout.
