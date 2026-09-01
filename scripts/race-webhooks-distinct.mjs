import { ensureServer, reset, post, stats, waitForStatus, check, summary } from './lib.mjs';

await ensureServer();
await reset();

console.log('Сценарий 2: 50 параллельных вебхуков "paid" с РАЗНЫМИ event_id по одному заказу');
console.log('Ожидание: ни один не отсекается как повтор, но выдача всё равно ровно одна\n');

const { data: created } = await post('/api/orders', { sku: 'KEY-GTA5' });
const orderId = created.order.id;
const before = await stats();

const events = Array.from({ length: 50 }, (_, i) => ({
  event_id: `evt_distinct_${i}`,
  order_id: orderId,
  status: 'paid',
  amount: 1990,
  currency: 'RUB',
  created_at: new Date().toISOString(),
}));

const results = await Promise.all(events.map((e) => post('/webhook/payment', e)));
const dupes = results.filter((r) => r.data && r.data.duplicate).length;

const order = await waitForStatus(orderId, ['delivered'], 12000);
const after = await stats();

console.log(`  ответов 200: ${results.filter((r) => r.status === 200).length}/50, "duplicate": ${dupes}`);
console.log(`  статус заказа: ${order?.status}, ключ: ${order?.delivery?.code}`);
console.log(`  пул claimed: ${before.pool.claimed} → ${after.pool.claimed}`);
console.log(`  записей выдачи: ${before.deliveries} → ${after.deliveries}\n`);

check(order?.status === 'delivered', 'заказ доведён до delivered');
check(dupes === 0, 'все 50 событий уникальны (не duplicate)');
check(after.deliveries - before.deliveries === 1, 'ровно одна запись выдачи');
check(after.pool.claimed - before.pool.claimed === 1, 'израсходован ровно один ключ');
check(after.provider_issues - before.provider_issues === 1, 'поставщик выдал код ровно один раз');

summary('Сценарий 2');
