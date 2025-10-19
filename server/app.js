require('./registerTfjs');
const path = require('path');
const fs = require('fs');
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
require('dotenv').config();

const authRouter = require('./routes/auth');
const adminRouter = require('./routes/admin');
const attendanceRouter = require('./routes/attendance');

const app = express();

const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || '';
const vercelUrl = process.env.VERCEL_URL;
const normalizeOrigin = (origin) => origin.replace(/\/$/, '');

const allowedOrigins = new Set(
  CLIENT_ORIGIN.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)
    .map(normalizeOrigin)
);

if (vercelUrl) {
  allowedOrigins.add(normalizeOrigin(`https://${vercelUrl}`));
  allowedOrigins.add(normalizeOrigin(`https://www.${vercelUrl}`));
}

const isLocalOrigin = (origin) => {
  if (!origin) {
    return false;
  }

  return (
    origin.includes('localhost') ||
    origin.includes('127.0.0.1') ||
    origin.includes('192.168.')
  );
};

const corsOptions = {
  origin(origin, callback) {
    if (!origin) {
      return callback(null, true);
    }

    if (isLocalOrigin(origin) || allowedOrigins.has(normalizeOrigin(origin))) {
      return callback(null, true);
    }

    callback(new Error(`Not allowed by CORS: ${origin}`));
  },
  credentials: true
};

app.use(cors(corsOptions));
app.use(express.json({ limit: '15mb' }));
app.use(cookieParser());

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api/auth', authRouter);
app.use('/api/admin', adminRouter);
app.use('/api/attendance', attendanceRouter);

app.use('/models', express.static(path.resolve(__dirname, '../models')));

if (process.env.NODE_ENV === 'production') {
  const distDir = path.resolve(__dirname, '../dist');

  if (fs.existsSync(distDir)) {
    app.use(express.static(distDir));

    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }
} else {
  app.get('/', (_req, res) => {
    res.json({ message: 'Attendance Monitoring API' });
  });
}

module.exports = app;
