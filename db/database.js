'use strict';

const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');

const imagesDir = path.join(DATA_DIR, 'images');
fs.mkdirSync(imagesDir, { recursive: true });

const dbPath = path.join(DATA_DIR, 'database.sqlite');
const db = new Database(dbPath);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS tombolas (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT    NOT NULL,
    image_path  TEXT,
    starts_at   DATETIME NOT NULL,
    ends_at     DATETIME NOT NULL,
    status      TEXT NOT NULL DEFAULT 'pending',
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS lots (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    tombola_id   INTEGER NOT NULL REFERENCES tombolas(id) ON DELETE CASCADE,
    name         TEXT    NOT NULL,
    position     INTEGER NOT NULL,
    winner_id    INTEGER REFERENCES participants(id),
    drawn_at     DATETIME,
    UNIQUE(tombola_id, position)
  );

  CREATE TABLE IF NOT EXISTS participants (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    tombola_id    INTEGER NOT NULL REFERENCES tombolas(id) ON DELETE CASCADE,
    first_name    TEXT    NOT NULL,
    last_name     TEXT    NOT NULL,
    phone         TEXT    NOT NULL,
    is_absent     INTEGER NOT NULL DEFAULT 0,
    has_won       INTEGER NOT NULL DEFAULT 0,
    registered_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tombola_id, phone)
  );

  CREATE TABLE IF NOT EXISTS draw_state (
    tombola_id        INTEGER PRIMARY KEY REFERENCES tombolas(id) ON DELETE CASCADE,
    current_lot_id    INTEGER REFERENCES lots(id),
    phase             TEXT NOT NULL DEFAULT 'idle',
    current_winner_id INTEGER REFERENCES participants(id),
    updated_at        DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

module.exports = db;
