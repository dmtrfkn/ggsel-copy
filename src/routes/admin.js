import express from 'express';
import { db, now } from '../db.js';
import { config } from '../config.js';
import { attemptFulfillment } from '../services/fulfillment.js';

const router = express.Router();

router.use((req, res, next) => {
  if (req.get('x-admin-token') !== config.adminToken) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  next();
});

const unfulfilled = db.prepare(`
  SELECT o.id, o.sku, o.amount, o.currency, o.status, o.recovery_reason, o.created_at, o.updated_at
    FROM orders o
    LEFT JOIN deliveries d ON d.order_id = o.id
   WHERE d.order_id IS NULL
     AND o.status IN ('paid', 'delivering', 'out_of_stock', 'delivery_failed')
   ORDER BY o.created_at
`);

const poolStats = () => ({
  total: db.prepare('SELECT COUNT(*) AS c FROM key_pool').get().c,
  free: db.prepare(`SELECT COUNT(*) AS c FROM key_pool WHERE status = 'free'`).get().c,
  claimed: db.prepare(`SELECT COUNT(*) AS c FROM key_pool WHERE status = 'claimed'`).get().c,
});

router.get('/orders/unfulfilled', (req, res) => {
  res.json({ orders: unfulfilled.all(), pool: poolStats() });
});

router.post('/orders/:id/retry', async (req, res) => {
  const order = db.prepare('SELECT id FROM orders WHERE id = ?').get(req.params.id);
  if (!order) return res.status(404).json({ error: 'not_found' });
  const result = await attemptFulfillment(req.params.id, { force: true });
  res.json({ result, order: db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id) });
});

router.get('/pool', (req, res) => {
  res.json(poolStats());
});

router.post('/pool/refill', (req, res) => {
  const codes =
    Array.isArray(req.body?.codes) && req.body.codes.length
      ? req.body.codes
      : Array.from(
          { length: Number(req.body?.count) || 5 },
          (_, i) => `RE-${Date.now().toString(36).toUpperCase()}-${i}`
        );
  const insert = db.prepare(`INSERT OR IGNORE INTO key_pool (code, status) VALUES (?, 'free')`);
  const added = db.transaction(() => codes.reduce((n, c) => n + insert.run(c).changes, 0))();
  res.json({ added, pool: poolStats() });
});

router.post('/pool/drain', (req, res) => {
  const drained = db
    .prepare(
      `UPDATE key_pool SET status = 'claimed', claimed_by_request_id = 'drain', claimed_at = @ts WHERE status = 'free'`
    )
    .run({ ts: now() }).changes;
  res.json({ drained, pool: poolStats() });
});

export default router;
