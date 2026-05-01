'use strict';

const express = require('express');
const router = express.Router();
const QRCode = require('qrcode');
const db = require('../db/database');
const isAuthenticated = require('../middleware/auth');
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

// GET /admin
router.get('/', isAuthenticated, (req, res) => {
  const tombolas = db.prepare(`
    SELECT t.*, COUNT(p.id) AS participants_count
    FROM tombolas t
    LEFT JOIN participants p ON p.tombola_id = t.id
    GROUP BY t.id
    ORDER BY t.created_at DESC
  `).all();
  const flash = req.session.flash || null;
  delete req.session.flash;
  res.render('admin/index', { title: 'Administration', tombolas, flash });
});

// GET /admin/tombola/new
router.get('/tombola/new', isAuthenticated, (req, res) => {
  const flash = req.session.flash || null;
  delete req.session.flash;
  res.render('admin/form', { title: 'Nouvelle tombola', tombola: null, lots: [], errors: [], old: {}, flash, qrCode: null, appUrl: null });
});

// POST /admin/tombola/new
router.post('/tombola/new', isAuthenticated, (req, res, next) => {
  uploadSingle('image')(req, res, async (uploadErr) => {
    try {
      const { name, starts_at, ends_at } = req.body;
      const lots = [].concat(req.body['lots[]'] || req.body.lots || []);
      const imageErrors = uploadErr ? ['image'] : [];
      const validationErrors = validateTombola(name, starts_at, ends_at, lots);
      const errors = [...new Set([...imageErrors, ...validationErrors])];
      if (errors.length > 0) {
        return res.render('admin/form', {
          title: 'Nouvelle tombola',
          tombola: null,
          lots: lots.map((n, i) => ({ id: null, name: n, position: i + 1, winner_id: null })),
          errors,
          old: { name, starts_at, ends_at },
          flash: null,
          qrCode: null,
          appUrl: null,
        });
      }
      let image_path = null;
      if (req.file && !uploadErr) image_path = await processAndSaveImage(req.file.buffer);
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

// GET /admin/tombola/:id/edit
router.get('/tombola/:id/edit', isAuthenticated, async (req, res, next) => {
  try {
    const tombola = db.prepare('SELECT * FROM tombolas WHERE id = ?').get(req.params.id);
    if (!tombola) {
      req.session.flash = { type: 'error', msg: 'Tombola introuvable.' };
      return res.redirect('/admin');
    }
    const lots = db.prepare('SELECT * FROM lots WHERE tombola_id = ? ORDER BY position ASC').all(tombola.id);
    const flash = req.session.flash || null;
    delete req.session.flash;
    const appUrl = (process.env.APP_URL || 'http://localhost:3000') + '/tombola/' + tombola.id;
    const qrCode = await QRCode.toDataURL(appUrl);
    res.render('admin/form', { title: 'Modifier ' + tombola.name, tombola, lots, errors: [], old: {}, flash, qrCode, appUrl });
  } catch (err) { next(err); }
});

// POST /admin/tombola/:id/edit
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
          return res.render('admin/form', { title: 'Modifier ' + tombola.name, tombola, lots: currentLots, errors, old: { name, starts_at, ends_at }, flash: null, qrCode, appUrl });
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

module.exports = router;
