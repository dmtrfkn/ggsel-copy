import express from 'express';
import { db, now } from '../db.js';
import { reconcileOrder } from '../services/reconcile.js';

const router = express.Router();

const recordEvent = db.prepare(`
  INSERT INTO payment_events (event_id, order_id, status, amount, currency, raw, received_at)
  VALUES (@eventId, @orderId, @status, @amount, @currency, @raw, @ts)
  ON CONFLICT(event_id) DO NOTHING
`);

router.post('/payment', async (req, res) => {
  const body = req.body || {};
  if (!body.event_id || !body.order_id || !body.status) {
    return res.status(400).json({ error: 'event_id_order_id_status_required' });
  }

  const inserted = recordEvent.run({
    eventId: body.event_id,
    orderId: body.order_id,
    status: body.status,
    amount: body.amount ?? null,
    currency: body.currency ?? null,
    raw: JSON.stringify(body),
    ts: now(),
  });

  if (inserted.changes === 0) {
    return res.status(200).json({ ok: true, duplicate: true });
  }

  try {
    await reconcileOrder(body.order_id);
  } catch (err) {
    console.error('reconcile after webhook failed:', err);
  }

  return res.status(200).json({ ok: true });
});

export default router;
