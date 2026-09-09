import express from 'express';
import { config } from '../config.js';
import { db } from '../db.js';

const router = express.Router();
const getOrder = db.prepare('SELECT id, amount, currency, status FROM orders WHERE id = ?');

const DONE = new Set(['paid', 'delivering', 'delivered']);

router.post('/:orderId', async (req, res) => {
  const order = getOrder.get(req.params.orderId);
  if (!order) return res.status(404).json({ error: 'unknown_order' });

  if (order.status === 'expired') {
    return res.status(409).json({ error: 'reservation_expired', status: order.status });
  }
  if (order.status === 'payment_failed') {
    return res.status(409).json({ error: 'payment_failed', status: order.status });
  }
  // Повторная оплата уже оплаченного заказа ничего не меняет (двойной клик,
  // Назад после оплаты, refresh). Вебхук не шлём — просто отдаём текущий статус.
  if (DONE.has(order.status)) {
    return res.json({ noop: true, status: order.status });
  }

  const failed = (req.body?.result || 'success') === 'failed';
  const payload = {
    // Стабильный event_id: повтор той же оплаты отсекается на вставке
    // payment_events по ON CONFLICT(event_id), а не создаёт новое событие.
    event_id: req.body?.event_id || `evt_${order.id}_${failed ? 'failed' : 'paid'}`,
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
