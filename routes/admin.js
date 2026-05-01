'use strict';

const express = require('express');
const router = express.Router();
const db = require('../db/database');
const isAuthenticated = require('../middleware/auth');

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

module.exports = router;
