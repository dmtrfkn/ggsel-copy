import { db, now } from '../db.js';

const getPromo = db.prepare('SELECT * FROM promocodes WHERE code = ?');
const countUses = db.prepare('SELECT COUNT(*) AS c FROM promo_redemptions WHERE code = ?');

export function computeDiscount(promo, baseAmount) {
  if (!promo) return 0;
  if (promo.type === 'percent') return Math.floor((baseAmount * promo.value) / 100);
  if (promo.type === 'amount') return Math.min(promo.value, baseAmount);
  return 0;
}

export function previewPromo(code, baseAmount) {
  const promo = getPromo.get(code);
  if (!promo) return { valid: false, reason: 'unknown_code', discount: 0, remaining: 0 };
  const used = countUses.get(code).c;
  const remaining = Math.max(0, promo.max_uses - used);
  const discount = computeDiscount(promo, baseAmount);
  return {
    valid: remaining > 0,
    reason: remaining > 0 ? null : 'limit_reached',
    type: promo.type,
    value: promo.value,
    discount,
    remaining,
    payable: Math.max(0, baseAmount - discount),
  };
}

const conditionalRedeem = db.prepare(`
  INSERT INTO promo_redemptions (code, order_id, created_at)
  SELECT @code, @orderId, @ts
   WHERE (SELECT COUNT(*) FROM promo_redemptions WHERE code = @code)
       < (SELECT max_uses FROM promocodes WHERE code = @code)
`);

export function redeemPromoWithin(code, orderId) {
  const res = conditionalRedeem.run({ code, orderId, ts: now() });
  return { ok: res.changes === 1 };
}

export function releasePromo(orderId) {
  db.prepare('DELETE FROM promo_redemptions WHERE order_id = ?').run(orderId);
}

export { getPromo };
