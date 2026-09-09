import { db, now } from '../db.js';
import { attemptFulfillment } from './fulfillment.js';
import { emitProduct } from './inventory.js';

const getOrder = db.prepare('SELECT * FROM orders WHERE id = ?');
const hasEvent = db.prepare(
  'SELECT 1 FROM payment_events WHERE order_id = ? AND status = ? LIMIT 1'
);
const releaseHold = db.prepare(
  `UPDATE orders SET stock_held = 0 WHERE id = @id AND stock_held = 1`
);
const restoreStock = db.prepare(`UPDATE products SET stock = stock + 1 WHERE sku = @sku`);

const applyPaymentState = db.transaction((orderId) => {
  const order = getOrder.get(orderId);
  if (!order) return { buffered: true };

  const paid = hasEvent.get(orderId, 'paid');
  const failed = hasEvent.get(orderId, 'failed');
  let stockReleased = false;

  if (order.status === 'created') {
    if (paid) {
      db.prepare(
        `UPDATE orders SET status = 'paid', updated_at = @ts WHERE id = @id AND status = 'created'`
      ).run({ id: orderId, ts: now() });
    } else if (failed) {
      const moved = db
        .prepare(
          `UPDATE orders SET status = 'payment_failed', updated_at = @ts WHERE id = @id AND status = 'created'`
        )
        .run({ id: orderId, ts: now() });
      if (moved.changes === 1 && releaseHold.run({ id: orderId }).changes === 1) {
        restoreStock.run({ sku: order.sku });
        stockReleased = true;
      }
    }
  }

  db.prepare(
    `UPDATE payment_events SET processed_at = @ts WHERE order_id = @id AND processed_at IS NULL`
  ).run({ id: orderId, ts: now() });

  return { order: getOrder.get(orderId), stockReleased, sku: order.sku };
});

export async function reconcileOrder(orderId) {
  const { buffered, order, stockReleased, sku } = applyPaymentState(orderId);
  if (buffered) return { buffered: true };

  if (stockReleased) emitProduct(sku);

  if (['paid', 'delivering', 'out_of_stock', 'delivery_failed'].includes(order.status)) {
    await attemptFulfillment(orderId);
  }
  return { status: getOrder.get(orderId).status };
}
