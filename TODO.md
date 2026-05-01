**TODO.md**

```
# TODO.md — Tombolive

> Généré par ARCHITECT | 2026-05-01

## Phase 1 — Fondations

| Slice | Nom | Statut |
|-------|-----|--------|
| S1-1 | Setup projet (package.json, structure, .env, Docker) | PASS |
| S1-2 | Base de données (db/database.js) | PASS |
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

**Total : 17 slices | PASS : 2 | TODO : 15**
```
