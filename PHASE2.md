Phase 2 : Admin CRUD + Module Public (8 slices)

Sprint 2.1 — Administration tombolas

## Slice S2-1 : Liste tombolas (GET /admin + index.ejs)
**Statut** : PASS
**Itérations** : 0
**Critères d'acceptation** :
- [x] GET /admin protégé par isAuthenticated
- [x] Requête DB : liste tombolas avec COUNT participants
- [x] index.ejs : tableau avec colonnes nom, statut (badge coloré), inscrits, dates, actions
- [x] Badges colorés pour les 5 statuts selon la palette définie
- [x] Bouton "Créer une tombola"
- [x] Actions contextuelles : Modifier, Supprimer (confirm JS), Clôturer (si open), Lancer/Télécommande (si closed/drawing)
- [x] Messages flash affichés et supprimés de la session
**Notes Architecte** : GET /admin et index.ejs sont implémentés et fonctionnels (routes/admin.js + views/admin/index.ejs). Les endpoints POST (delete, close) sont couverts par S2-5. Slice promue PASS.

## Slice S2-2 : Création tombola (GET/POST /admin/tombola/new + form.ejs)
**Statut** : PASS
**Itérations** : 1
**Critères d'acceptation** :
- [ ] GET /admin/tombola/new → render('admin/form', { title, tombola: null, lots: [], errors: [], old: {}, flash: null })
- [ ] POST /admin/tombola/new : validation name (non vide, max 255), starts_at < ends_at, lots[] au moins 1 élément non vide
- [ ] En cas d'erreur validation : re-render form avec errors[] et old={name,starts_at,ends_at} + lots[]
- [ ] Insertion DB : INSERT tombolas (status='pending'), INSERT lots (position=index+1, position 1 = premier dans le tableau = gros lot), INSERT draw_state(tombola_id, current_lot_id=NULL, phase='idle')
- [ ] Redirection vers /admin/tombola/<newId>/edit avec req.session.flash={type:'success',msg:'Tombola créée avec succès.'}
- [ ] views/admin/form.ejs créé : étend layout.ejs via <%- include('../layout') %> ou équivalent EJS
- [ ] form.ejs action="{{ tombola ? '/admin/tombola/'+tombola.id+'/edit' : '/admin/tombola/new' }}", method POST, enctype multipart/form-data
- [ ] form.ejs : champ name (text, value=old.name||tombola?.name||''), starts_at (datetime-local), ends_at (datetime-local), image (file, accept="image/jpeg,image/png,image/webp")
- [ ] form.ejs : section #lots-container affichant les lots (input[name="lots[]"]) + bouton "+ Ajouter un lot" (id="btn-add-lot")
- [ ] form.ejs : affichage erreurs inline via <% if (errors.includes('name')) { %><span class="error">...</span><% } %>

**Notes Architecte** :
Variables passées à form.ejs :
```
tombola : objet DB ou null  (null = mode création)
lots    : [{id, name, position, winner_id}] ou []
errors  : ['name','dates','lots','image'] selon erreurs
old     : {name, starts_at, ends_at}  (repopulation POST)
flash   : objet {type,msg} ou null
```
Structure des routes à ajouter dans routes/admin.js :
```javascript
const { processAndSaveImage, uploadSingle, deleteImage } = require('../middleware/upload');

function validateTombola(name, starts_at, ends_at, lots) {
  const errors = [];
  if (!name || !name.trim()) errors.push('name');
  if (name && name.trim().length > 255) errors.push('name');
  if (!starts_at || !ends_at || new Date(starts_at) >= new Date(ends_at)) errors.push('dates');
  const validLots = (lots || []).filter(l => l && l.trim());
  if (validLots.length === 0) errors.push('lots');
  return errors;
}

router.get('/tombola/new', isAuthenticated, (req, res) => {
  res.render('admin/form', { title: 'Nouvelle tombola', tombola: null, lots: [], errors: [], old: {}, flash: null });
});

router.post('/tombola/new', isAuthenticated, (req, res, next) => {
  uploadSingle('image')(req, res, async (uploadErr) => {
    try {
      const { name, starts_at, ends_at } = req.body;
      const lots = [].concat(req.body['lots[]'] || req.body.lots || []);
      const imageErrors = uploadErr ? ['image'] : [];
      const validationErrors = validateTombola(name, starts_at, ends_at, lots);
      const errors = [...new Set([...imageErrors, ...validationErrors])];
      if (errors.length > 0) {
        return res.render('admin/form', { title: 'Nouvelle tombola', tombola: null, lots: lots.map((n,i)=>({id:null,name:n,position:i+1,winner_id:null})), errors, old: {name,starts_at,ends_at}, flash: null });
      }
      let image_path = null;
      if (req.file) image_path = await processAndSaveImage(req.file.buffer);
      const validLots = lots.filter(l => l && l.trim());
      const result = db.prepare('INSERT INTO tombolas (name, image_path, starts_at, ends_at, status) VALUES (?,?,?,?,?)').run(name.trim(), image_path, starts_at, ends_at, 'pending');
      const newId = result.lastInsertRowid;
      const insertLot = db.prepare('INSERT INTO lots (tombola_id, name, position) VALUES (?,?,?)');
      validLots.forEach((lotName, i) => insertLot.run(newId, lotName.trim(), i + 1));
      db.prepare('INSERT INTO draw_state (tombola_id, phase) VALUES (?, ?)').run(newId, 'idle');
      req.session.flash = { type: 'success', msg: 'Tombola créée avec succès.' };
      res.redirect('/admin/tombola/' + newId + '/edit');
    } catch (err) { next(err); }
  });
});
```

## Slice S2-3 : Upload et traitement images (Multer + sharp)
**Statut** : PASS
**Itérations** : 0
**Critères d'acceptation** :
- [x] Multer configuré : fileFilter (image/jpeg, image/png, image/webp), limite 2Mo
- [x] sharp : redimensionner max 1200px large (ne pas agrandir), convertir WebP qualité 85
- [x] Fichier sauvé sous DATA_DIR/images/<uuid>.webp
- [x] image_path en DB stocke "images/<uuid>.webp"
- [x] Si image > 2Mo → message d'erreur lisible, formulaire réaffiché
- [x] Si type MIME invalide → rejet avec message
**Notes Architecte** : middleware/upload.js est complet et fonctionnel (processAndSaveImage, deleteImage, uploadSingle). Slice promue PASS.

## Slice S2-4 : Édition tombola (GET/POST /admin/tombola/:id/edit)
**Statut** : TODO
**Itérations** : 0
**Dépend de** : S2-2 (form.ejs doit exister)
**Critères d'acceptation** :
- [ ] GET /admin/tombola/:id/edit → tombola introuvable → redirect /admin avec flash erreur
- [ ] GET /admin/tombola/:id/edit → render('admin/form', { tombola, lots (ordonnés par position), errors:[], old:{}, flash, qrCode, appUrl })
- [ ] form.ejs : si tombola.status in ['drawing','finished'] → champs name/starts_at/ends_at/lots disabled + message avertissement visible, champ image reste actif
- [ ] form.ejs : section QR code visible uniquement en mode édition : <img src="<%= qrCode %>"> + lien appUrl + bouton "Copier le lien" (navigator.clipboard)
- [ ] POST /admin/tombola/:id/edit : même validation que S2-2 (réutiliser validateTombola)
- [ ] Si nouvelle image et ancienne image existait → deleteImage(ancienne) avant processAndSaveImage
- [ ] Si status in ['drawing','finished'] → ignorer modifications name/dates/lots (seule l'image est mise à jour)
- [ ] Reconstruction lots : pour chaque lot existant avec winner_id NOT NULL → conserver ; DELETE lots WHERE tombola_id=id AND winner_id IS NULL ; réinsérer lots depuis le formulaire
- [ ] Redirection vers /admin/tombola/<id>/edit avec flash succès

**Notes Architecte** :
Génération QR code (package `qrcode` déjà installé) :
```javascript
const QRCode = require('qrcode');
// Dans le handler GET :
const appUrl = process.env.APP_URL || 'http://localhost:3000';
const registrationUrl = appUrl + '/tombola/' + tombola.id;
const qrCode = await QRCode.toDataURL(registrationUrl);  // base64 PNG "data:image/png;base64,..."
// Passer { tombola, lots, errors:[], old:{}, flash, qrCode, appUrl: registrationUrl } au render
```
Reconstruction lots (transaction) :
```javascript
const rebuildLots = db.transaction((tombola_id, newLotNames) => {
  db.prepare('DELETE FROM lots WHERE tombola_id = ? AND winner_id IS NULL').run(tombola_id);
  const preserved = db.prepare('SELECT position FROM lots WHERE tombola_id = ? AND winner_id IS NOT NULL').all(tombola_id).map(l => l.position);
  const usedPositions = new Set(preserved);
  let pos = 1;
  newLotNames.filter(n => n && n.trim()).forEach(name => {
    while (usedPositions.has(pos)) pos++;
    db.prepare('INSERT INTO lots (tombola_id, name, position) VALUES (?,?,?)').run(tombola_id, name.trim(), pos);
    pos++;
  });
});
```
Routes à ajouter dans admin.js après les routes /tombola/new :
```javascript
router.get('/tombola/:id/edit', isAuthenticated, async (req, res, next) => {
  try {
    const tombola = db.prepare('SELECT * FROM tombolas WHERE id = ?').get(req.params.id);
    if (!tombola) { req.session.flash = { type: 'error', msg: 'Tombola introuvable.' }; return res.redirect('/admin'); }
    const lots = db.prepare('SELECT * FROM lots WHERE tombola_id = ? ORDER BY position ASC').all(tombola.id);
    const flash = req.session.flash || null; delete req.session.flash;
    const appUrl = (process.env.APP_URL || 'http://localhost:3000') + '/tombola/' + tombola.id;
    const qrCode = await QRCode.toDataURL(appUrl);
    res.render('admin/form', { title: 'Modifier ' + tombola.name, tombola, lots, errors: [], old: {}, flash, qrCode, appUrl });
  } catch (err) { next(err); }
});

router.post('/tombola/:id/edit', isAuthenticated, (req, res, next) => {
  uploadSingle('image')(req, res, async (uploadErr) => {
    try {
      const tombola = db.prepare('SELECT * FROM tombolas WHERE id = ?').get(req.params.id);
      if (!tombola) return res.redirect('/admin');
      const readOnly = ['drawing', 'finished'].includes(tombola.status);
      const { name, starts_at, ends_at } = req.body;
      const lots = [].concat(req.body['lots[]'] || req.body.lots || []);
      if (!readOnly) {
        const imageErrors = uploadErr ? ['image'] : [];
        const validationErrors = validateTombola(name, starts_at, ends_at, lots);
        const errors = [...new Set([...imageErrors, ...validationErrors])];
        if (errors.length > 0) {
          const appUrl = (process.env.APP_URL || 'http://localhost:3000') + '/tombola/' + tombola.id;
          const qrCode = await QRCode.toDataURL(appUrl);
          const currentLots = db.prepare('SELECT * FROM lots WHERE tombola_id = ? ORDER BY position ASC').all(tombola.id);
          return res.render('admin/form', { title: 'Modifier ' + tombola.name, tombola, lots: currentLots, errors, old: {name,starts_at,ends_at}, flash: null, qrCode, appUrl });
        }
      }
      let image_path = tombola.image_path;
      if (req.file && !uploadErr) {
        if (tombola.image_path) deleteImage(tombola.image_path);
        image_path = await processAndSaveImage(req.file.buffer);
      }
      if (!readOnly) {
        db.prepare('UPDATE tombolas SET name=?, starts_at=?, ends_at=?, image_path=? WHERE id=?').run(name.trim(), starts_at, ends_at, image_path, tombola.id);
        rebuildLots(tombola.id, lots);
      } else {
        db.prepare('UPDATE tombolas SET image_path=? WHERE id=?').run(image_path, tombola.id);
      }
      req.session.flash = { type: 'success', msg: 'Tombola mise à jour.' };
      res.redirect('/admin/tombola/' + tombola.id + '/edit');
    } catch (err) { next(err); }
  });
});
```

## Slice S2-5 : Suppression et clôture (POST /admin/tombola/:id/delete et /close)
**Statut** : TODO
**Itérations** : 0
**Critères d'acceptation** :
- [ ] POST /admin/tombola/:id/delete : interdit si statut 'drawing' (flash erreur + redirect /admin)
- [ ] Suppression image disque si tombola.image_path présent (deleteImage)
- [ ] Suppression DB (CASCADE lots + participants + draw_state via ON DELETE CASCADE)
- [ ] Redirection /admin avec flash succès
- [ ] POST /admin/tombola/:id/close : passe statut open → closed uniquement
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
