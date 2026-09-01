import { db, now } from '../db.js';
import { config } from '../config.js';
import { callProvider, ProviderTimeout, ProviderError, OutOfStock } from './providerClient.js';

const base = `http://127.0.0.1:${config.port}`;
const providers = [
  { name: 'A', url: `${base}/provider-a` },
  { name: 'B', url: `${base}/provider-b` },
];

const getOrder = db.prepare('SELECT * FROM orders WHERE id = ?');
const getDelivery = db.prepare('SELECT * FROM deliveries WHERE order_id = ?');

const claimDeliveringSlot = db.prepare(`
  UPDATE orders
     SET status = 'delivering', updated_at = @ts
   WHERE id = @id AND status IN ('paid', 'out_of_stock', 'delivery_failed')
`);

const finalizeDelivery = db.transaction((orderId, code, requestId, provider) => {
  const inserted = db.prepare(`
    INSERT INTO deliveries (order_id, code, request_id, provider, delivered_at)
    VALUES (@orderId, @code, @requestId, @provider, @ts)
    ON CONFLICT(order_id) DO NOTHING
  `).run({ orderId, code, requestId, provider, ts: now() });

  db.prepare(`
    UPDATE orders
       SET status = 'delivered', recovery_reason = NULL, updated_at = @ts
     WHERE id = @orderId AND status != 'delivered'
  `).run({ orderId, ts: now() });

  return { firstDelivery: inserted.changes === 1, delivery: getDelivery.get(orderId) };
});

const markRecoverable = db.transaction((orderId, reason) => {
  db.prepare(`
    UPDATE orders
       SET status = @reason, recovery_reason = @reason, updated_at = @ts
     WHERE id = @orderId AND status IN ('paid', 'delivering', 'out_of_stock', 'delivery_failed')
  `).run({ orderId, reason, ts: now() });
});

async function askProvider(provider, requestId, order) {
  const body = { request_id: requestId, sku: order.sku, order_id: order.id };
  try {
    return await callProvider(provider.url, body, config.providerTimeoutMs);
  } catch (err) {
    if (err instanceof ProviderTimeout) {
      try {
        return await callProvider(provider.url, body, config.providerTimeoutMs * 2);
      } catch (retryErr) {
        return { failed: retryErr };
      }
    }
    return { failed: err };
  }
}

export async function attemptFulfillment(orderId, { force = false } = {}) {
  const existing = getDelivery.get(orderId);
  if (existing) {
    return { status: 'delivered', delivery: existing, alreadyDelivered: true };
  }

  const order = getOrder.get(orderId);
  if (!order) return { status: 'unknown_order' };

  if (!force) {
    const moved = claimDeliveringSlot.run({ id: orderId, ts: now() });
    if (moved.changes === 0) {
      return { status: getOrder.get(orderId).status, skipped: true };
    }
  }

  const requestId = `req_${orderId}`;
  let lastReason = null;

  for (const provider of providers) {
    const result = await askProvider(provider, requestId, order);
    if (result.failed) {
      const err = result.failed;
      if (err instanceof OutOfStock) {
        lastReason = 'out_of_stock';
      } else if (err instanceof ProviderTimeout) {
        lastReason = 'delivery_failed';
      } else if (err instanceof ProviderError) {
        lastReason = 'delivery_failed';
      } else {
        lastReason = 'delivery_failed';
      }
      continue;
    }

    const done = finalizeDelivery(orderId, result.code, requestId, provider.name);
    return { status: 'delivered', delivery: done.delivery, firstDelivery: done.firstDelivery };
  }

  markRecoverable(orderId, lastReason || 'delivery_failed');
  return { status: getOrder.get(orderId).status, recoveryReason: lastReason };
}

const findStuck = db.prepare(`
  SELECT o.id
    FROM orders o
    LEFT JOIN deliveries d ON d.order_id = o.id
   WHERE d.order_id IS NULL
     AND o.status IN ('paid', 'delivering', 'out_of_stock', 'delivery_failed')
     AND o.updated_at < @cutoff
`);

export async function recoverStuck() {
  const cutoff = new Date(Date.now() - 12000).toISOString();
  const rows = findStuck.all({ cutoff });
  for (const row of rows) {
    try {
      await attemptFulfillment(row.id, { force: true });
    } catch (err) {
      console.error('recoverStuck failed for', row.id, err);
    }
  }
  return rows.length;
}

let loopHandle = null;
export function startRecoveryLoop(intervalMs = 8000) {
  if (loopHandle) return;
  recoverStuck().catch(() => {});
  loopHandle = setInterval(() => {
    recoverStuck().catch(() => {});
  }, intervalMs);
  loopHandle.unref?.();
}
