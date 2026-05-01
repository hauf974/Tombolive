'use strict';

const http = require('http');
const path = require('path');
const express = require('express');
const helmet = require('helmet');
const session = require('express-session');
const { Server } = require('socket.io');
const ConnectSQLite = require('connect-sqlite3')(session);

if (!process.env.ADMIN_USER || !process.env.ADMIN_PASS) {
  console.error('FATAL: ADMIN_USER and ADMIN_PASS environment variables are required');
  process.exit(1);
}

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const PORT = parseInt(process.env.PORT, 10) || 3000;
const APP_BASE_URL = process.env.APP_BASE_URL || 'http://localhost:3000';
const SESSION_SECRET = process.env.SESSION_SECRET || 'changeme-please-set-a-secret';
const SESSION_MAX_AGE_HOURS = parseInt(process.env.SESSION_MAX_AGE_HOURS, 10) || 8;

const db = require('./db/database');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.set('trust proxy', 1);
app.use(helmet());

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/data/images', express.static(path.join(DATA_DIR, 'images')));

const isSecure = APP_BASE_URL.startsWith('https://');

const sessionMiddleware = session({
  store: new ConnectSQLite({
    db: 'sessions.sqlite',
    dir: DATA_DIR,
  }),
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: isSecure,
    maxAge: SESSION_MAX_AGE_HOURS * 60 * 60 * 1000,
  },
});

app.use(sessionMiddleware);

io.use((socket, next) => {
  sessionMiddleware(socket.request, socket.request.res || {}, next);
});

const updateTombolaStatuses = () => {
  const now = new Date().toISOString();
  db.prepare(`
    UPDATE tombolas
    SET status = 'open'
    WHERE status = 'pending' AND starts_at <= ? AND ends_at > ?
  `).run(now, now);
  db.prepare(`
    UPDATE tombolas
    SET status = 'closed'
    WHERE status = 'open' AND ends_at <= ?
  `).run(now);
};

updateTombolaStatuses();
setInterval(updateTombolaStatuses, 60 * 1000);

require('./sockets/draw')(io, db);

const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const controlRoutes = require('./routes/control');
const publicRoutes = require('./routes/public');

app.use('/', authRoutes);
app.use('/admin', adminRoutes);
app.use('/admin', controlRoutes);
app.use('/', publicRoutes);

app.use((req, res) => {
  res.status(404).render('404', { title: 'Page introuvable' });
});

server.listen(PORT, () => {
  console.log(`Tombolive démarré sur le port ${PORT}`);
});

module.exports = { app, io };
