import express from 'express';
import { db } from '../db.js';
import { createOrder, getOrder } from '../services/orders.js';
import { previewPromo } from '../services/promo.js';

const router = express.Router();
const getProductPrice = db.prepare('SELECT price FROM products WHERE sku = ?');

router.post('/', (req, res) => {
  const { sku, promo_code: promoCode, idempotency_key: idempotencyKey, order_id: clientOrderId } =
    req.body || {};
  if (!sku) return res.status(400).json({ error: 'sku_required' });

  const result = createOrder({
    sku,
    promoCode: promoCode || null,
    idempotencyKey: idempotencyKey || null,
    clientOrderId: clientOrderId || null,
  });

  if (result.error) return res.status(result.status || 400).json({ error: result.error });
  res.status(result.reused ? 200 : 201).json({ order: result.order, reused: !!result.reused });
});

router.post('/preview-promo', (req, res) => {
  const { sku, code } = req.body || {};
  const product = sku ? getProductPrice.get(sku) : null;
  if (!product) return res.status(404).json({ error: 'unknown_sku' });
  if (!code) return res.status(400).json({ error: 'code_required' });
  res.json(previewPromo(code, product.price));
});

router.get('/:id', (req, res) => {
  const order = getOrder(req.params.id);
  if (!order) return res.status(404).json({ error: 'not_found' });
  res.json({ order });
});

export default router;
