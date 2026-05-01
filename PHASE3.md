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
