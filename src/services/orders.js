import crypto from 'node:crypto';
import { db, now } from '../db.js';
import { config } from '../config.js';
import { getPromo, computeDiscount, redeemPromoWithin } from './promo.js';

const getProduct = db.prepare('SELECT * FROM products WHERE sku = ?');
const getOrderRow = db.prepare('SELECT * FROM orders WHERE id = ?');
const getOrderByIdem = db.prepare('SELECT * FROM orders WHERE idempotency_key = ?');
const getDelivery = db.prepare('SELECT code, provider, delivered_at FROM deliveries WHERE order_id = ?');

const insertOrder = db.prepare(`
  INSERT INTO orders
    (id, idempotency_key, sku, base_amount, discount, amount, currency, promo_code, status, created_at, updated_at)
  VALUES
    (@id, @idempotencyKey, @sku, @baseAmount, @discount, @amount, @currency, @promoCode, 'created', @ts, @ts)
`);

export function getOrder(id) {
  const order = getOrderRow.get(id);
  if (!order) return null;
  return { ...order, delivery: getDelivery.get(id) || null };
}

const createTx = db.transaction(({ id, product, promo, idempotencyKey }) => {
  let discount = 0;
  if (promo) {
    const redeemed = redeemPromoWithin(promo.code, id);
    if (!redeemed.ok) return { error: 'promo_limit_reached', status: 409 };
    discount = computeDiscount(promo, product.price);
  }
  const amount = Math.max(0, product.price - discount);
  insertOrder.run({
    id,
    idempotencyKey: idempotencyKey || null,
    sku: product.sku,
    baseAmount: product.price,
    discount,
    amount,
    currency: product.currency,
    promoCode: promo ? promo.code : null,
    ts: now(),
  });
  return { ok: true };
});

export function createOrder({ sku, promoCode, idempotencyKey, clientOrderId }) {
  const product = getProduct.get(sku);
  if (!product) return { error: 'unknown_sku', status: 404 };

  if (idempotencyKey) {
    const existing = getOrderByIdem.get(idempotencyKey);
    if (existing) return { order: getOrder(existing.id), reused: true };
  }

  let promo = null;
  if (promoCode) {
    promo = getPromo.get(promoCode);
    if (!promo) return { error: 'unknown_promo', status: 400 };
  }

  const id =
    config.allowClientOrderId && clientOrderId
      ? String(clientOrderId)
      : `ord_${crypto.randomUUID().slice(0, 12)}`;

  try {
    const result = createTx({ id, product, promo, idempotencyKey });
    if (result.error) return result;
  } catch (err) {
    if (/UNIQUE/i.test(String(err.message))) {
      const existing = idempotencyKey ? getOrderByIdem.get(idempotencyKey) : getOrderRow.get(id);
      if (existing) return { order: getOrder(existing.id), reused: true };
    }
    throw err;
  }

  return { order: getOrder(id) };
}
