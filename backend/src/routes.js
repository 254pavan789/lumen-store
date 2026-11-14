'use strict';

/**
 * REST API routes.
 * Express only maps HTTP -> engine action; all validation, stock logic,
 * SQL JOINs and transactions run inside the Python engine.
 */
const express = require('express');

function buildRouter(engine) {
  const router = express.Router();

  // Wrap an engine action as an Express handler
  const run = (action) => async (req, res, next) => {
    try {
      const { status, body } = await engine.call(action, {
        params: req.params,
        query: req.query,
        body: req.body,
      });
      res.status(status).json(body);
    } catch (err) {
      next(err);
    }
  };

  // ---------------------------------------------------------------- system
  router.get('/health', run('system.health'));
  router.get('/dashboard', run('dashboard.summary'));
  router.get('/stock', run('stock.overview'));

  // ---------------------------------------------------------------- item types
  router.get('/item-types', run('itemTypes.list'));
  router.post('/item-types', run('itemTypes.create'));
  router.get('/item-types/:id', run('itemTypes.get'));
  router.put('/item-types/:id', run('itemTypes.update'));
  router.delete('/item-types/:id', run('itemTypes.delete'));

  // ---------------------------------------------------------------- items
  router.get('/items', run('items.list'));
  router.post('/items', run('items.create'));
  router.get('/items/:id', run('items.get'));
  router.put('/items/:id', run('items.update'));
  router.patch('/items/:id/status', run('items.setStatus'));
  router.delete('/items/:id', run('items.delete'));

  // ---------------------------------------------------------------- purchases
  router.get('/purchases', run('purchases.list'));
  router.post('/purchases', run('purchases.create'));
  router.get('/purchases/next-order-id', run('purchases.nextOrderId'));
  router.get('/purchases/:id', run('purchases.get'));
  router.put('/purchases/:id', run('purchases.update'));
  router.post('/purchases/:id/cancel', run('purchases.cancel'));

  // There is deliberately NO delete route for purchases. Any other method on a
  // purchase URL (DELETE, PATCH, ...) is answered with 405 and an explanation.
  router.all(['/purchases', '/purchases/:id'], (req, res) => {
    const allow = req.params.id ? 'GET, PUT' : 'GET, POST';
    res.set('Allow', allow).status(405).json({
      success: false,
      error: {
        code: 'METHOD_NOT_ALLOWED',
        message:
          req.method === 'DELETE'
            ? 'Purchases cannot be deleted. They are historical transactions kept for audit and stock traceability. Use POST /api/purchases/:id/cancel to cancel an order instead.'
            : `Method ${req.method} is not allowed on this resource`,
      },
    });
  });

  // Unknown API route
  router.use((req, res) => {
    res.status(404).json({
      success: false,
      error: { code: 'ROUTE_NOT_FOUND', message: `API route not found: ${req.method} ${req.originalUrl}` },
    });
  });

  return router;
}

module.exports = { buildRouter };
