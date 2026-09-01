import express from 'express';
import crypto from 'node:crypto';
import { config } from '../config.js';
import { db } from '../db.js';

const router = express.Router();
const getOrder = db.prepare('SELECT id, amount, currency FROM orders WHERE id = ?');

router.post('/:orderId', async (req, res) => {
  const order = getOrder.get(req.params.orderId);
  if (!order) return res.status(404).json({ error: 'unknown_order' });

  const failed = (req.body?.result || 'success') === 'failed';
  const payload = {
    event_id: req.body?.event_id || `evt_${crypto.randomUUID().slice(0, 12)}`,
    order_id: order.id,
    status: failed ? 'failed' : 'paid',
    amount: order.amount,
    currency: order.currency,
    created_at: new Date().toISOString(),
  };

  const response = await fetch(`http://127.0.0.1:${config.port}/webhook/payment`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const webhookBody = await response.json().catch(() => ({}));

  res.json({ sent: payload, webhook_status: response.status, webhook_response: webhookBody });
});

export default router;
