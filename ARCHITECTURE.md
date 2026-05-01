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
