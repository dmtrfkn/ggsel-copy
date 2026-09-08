import { db, now } from '../db.js';
import { attemptFulfillment } from './fulfillment.js';
import { emitProduct } from './inventory.js';

const getOrder = db.prepare('SELECT * FROM orders WHERE id = ?');
const hasEvent = db.prepare(
  'SELECT 1 FROM payment_events WHERE order_id = ? AND status = ? LIMIT 1'
);
const consumeStock = db.prepare(
  `UPDATE products SET stock = stock - 1 WHERE sku = @sku AND stock > 0`
);

const applyPaymentState = db.transaction((orderId) => {
  const order = getOrder.get(orderId);
  if (!order) return { buffered: true };

  const paid = hasEvent.get(orderId, 'paid');
  const failed = hasEvent.get(orderId, 'failed');
  let stockConsumed = false;

  if (order.status === 'created') {
    if (paid) {
      const moved = db
        .prepare(
          `UPDATE orders SET status = 'paid', updated_at = @ts WHERE id = @id AND status = 'created'`
        )
        .run({ id: orderId, ts: now() });
      if (moved.changes === 1) {
        stockConsumed = consumeStock.run({ sku: order.sku }).changes === 1;
      }
    } else if (failed) {
      db.prepare(
        `UPDATE orders SET status = 'payment_failed', updated_at = @ts WHERE id = @id AND status = 'created'`
      ).run({ id: orderId, ts: now() });
    }
  }

  db.prepare(
    `UPDATE payment_events SET processed_at = @ts WHERE order_id = @id AND processed_at IS NULL`
  ).run({ id: orderId, ts: now() });

  return { order: getOrder.get(orderId), stockConsumed, sku: order.sku };
});

export async function reconcileOrder(orderId) {
  const { buffered, order, stockConsumed, sku } = applyPaymentState(orderId);
  if (buffered) return { buffered: true };

  if (stockConsumed) emitProduct(sku);

  if (['paid', 'delivering', 'out_of_stock', 'delivery_failed'].includes(order.status)) {
    await attemptFulfillment(orderId);
  }
  return { status: getOrder.get(orderId).status };
}
