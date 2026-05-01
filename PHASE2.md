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
