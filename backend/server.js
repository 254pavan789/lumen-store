'use strict';

/**
 * Item & Purchase Management System - Express server
 *
 *   node backend/server.js         (or: npm start)
 *
 * Serves the REST API under /api and the frontend (frontend/) on the same
 * port. Business logic is executed by the Python engine (engine/engine.py).
 */
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const express = require('express');
const cors = require('cors');
const { PythonBridge } = require('./src/pythonBridge');
const { buildRouter } = require('./src/routes');

const PORT = Number(process.env.PORT || 3000);
const FRONTEND_DIR = path.resolve(__dirname, '..', 'frontend');

const engine = new PythonBridge().start();
const app = express();

app.disable('x-powered-by');
app.use(cors({ origin: process.env.CORS_ORIGIN || true }));

// Tiny request logger
app.use((req, res, next) => {
  if (!req.path.startsWith('/api')) return next();
  const started = Date.now();
  res.on('finish', () => {
    console.log(`${req.method.padEnd(6)} ${req.originalUrl} -> ${res.statusCode} (${Date.now() - started}ms)`);
  });
  next();
});

app.use(express.json({ limit: '200kb', strict: false }));

// Malformed JSON / wrong content -> clear 400 instead of an HTML error page
app.use((err, req, res, next) => {
  if (err && (err.type === 'entity.parse.failed' || err instanceof SyntaxError)) {
    return res.status(400).json({
      success: false,
      error: { code: 'MALFORMED_JSON', message: 'Malformed JSON in request body' },
    });
  }
  if (err && err.type === 'entity.too.large') {
    return res.status(413).json({
      success: false,
      error: { code: 'PAYLOAD_TOO_LARGE', message: 'Request body is too large' },
    });
  }
  return next(err);
});

app.use('/api', buildRouter(engine));

// Frontend (static SPA)
app.use(express.static(FRONTEND_DIR, { extensions: ['html'], maxAge: 0 }));
app.get(/^\/(?!api\/).*/, (req, res) => res.sendFile(path.join(FRONTEND_DIR, 'index.html')));

// Final safety net - never leak stack traces
app.use((err, req, res, next) => {
  console.error('[server] unexpected error:', err);
  if (res.headersSent) return next(err);
  res.status(500).json({
    success: false,
    error: { code: 'INTERNAL_ERROR', message: 'An unexpected server error occurred. Please try again.' },
  });
});

const server = app.listen(PORT, () => {
  console.log('');
  console.log('  Item & Purchase Management System');
  console.log(`  App:  http://localhost:${PORT}`);
  console.log(`  API:  http://localhost:${PORT}/api/health`);
  console.log('');
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n[server] Port ${PORT} is already in use. Change PORT in .env or stop the other process.\n`);
  } else {
    console.error('[server] failed to start:', err.message);
  }
  engine.stop();
  process.exit(1);
});

function shutdown(signal) {
  console.log(`\n[server] ${signal} received, shutting down...`);
  engine.stop();
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 3000).unref();
}
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

module.exports = app;
