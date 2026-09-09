import { db, now } from '../db.js';
import { config } from '../config.js';
import { emitProduct } from './inventory.js';

const findExpired = db.prepare(`
  SELECT id, sku FROM orders
   WHERE status = 'created' AND stock_held = 1 AND reserved_until IS NOT NULL AND reserved_until < @now
`);

const expireOne = db.prepare(`
  UPDATE orders
     SET status = 'expired', stock_held = 0, updated_at = @now
   WHERE id = @id AND status = 'created' AND stock_held = 1
`);

const restoreStock = db.prepare('UPDATE products SET stock = stock + 1 WHERE sku = @sku');

const sweep = db.transaction((ts) => {
  const freed = [];
  for (const row of findExpired.all({ now: ts })) {
    if (expireOne.run({ id: row.id, now: ts }).changes === 1) {
      restoreStock.run({ sku: row.sku });
      freed.push(row.sku);
    }
  }
  return freed;
});

export function releaseExpired() {
  const freed = sweep(now());
  for (const sku of new Set(freed)) emitProduct(sku);
  return freed.length;
}

export function expireNow(orderId) {
  db.prepare(
    `UPDATE orders SET reserved_until = @past WHERE id = @id AND status = 'created'`
  ).run({ id: orderId, past: new Date(Date.now() - 1000).toISOString() });
  return releaseExpired();
}

let handle = null;
export function startReservationSweeper(intervalMs = config.reservationSweepMs) {
  if (handle) return;
  releaseExpired();
  handle = setInterval(releaseExpired, intervalMs);
  handle.unref?.();
}
