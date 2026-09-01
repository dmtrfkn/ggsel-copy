import { ensureServer, reset, post, stats, waitForStatus, check, summary } from './lib.mjs';

await ensureServer();
await reset();

console.log('Сценарий 1: 50 параллельных вебхуков "paid" с ОДНИМ event_id по одному заказу');
console.log('Ожидание: 1 факт выдачи, израсходован ровно 1 ключ, повторы отсекаются по event_id\n');

const { data: created } = await post('/api/orders', { sku: 'KEY-CS2-PRIME' });
const orderId = created.order.id;
const before = await stats();

const event = {
  event_id: 'evt_same_001',
  order_id: orderId,
  status: 'paid',
  amount: 1290,
  currency: 'RUB',
  created_at: new Date().toISOString(),
};

const results = await Promise.all(Array.from({ length: 50 }, () => post('/webhook/payment', event)));
const ok200 = results.filter((r) => r.status === 200).length;
const dupes = results.filter((r) => r.data && r.data.duplicate).length;

const order = await waitForStatus(orderId, ['delivered'], 12000);
const after = await stats();

console.log(`  ответов 200: ${ok200}/50, из них "duplicate": ${dupes}`);
console.log(`  статус заказа: ${order?.status}, ключ: ${order?.delivery?.code}`);
console.log(`  пул claimed: ${before.pool.claimed} → ${after.pool.claimed}`);
console.log(`  записей выдачи: ${before.deliveries} → ${after.deliveries}`);
console.log(`  выдач поставщика: ${before.provider_issues} → ${after.provider_issues}\n`);

check(order?.status === 'delivered', 'заказ доведён до delivered');
check(dupes === 49, '49 из 50 вебхуков отсечены как повтор event_id');
check(after.deliveries - before.deliveries === 1, 'ровно одна запись выдачи');
check(after.pool.claimed - before.pool.claimed === 1, 'израсходован ровно один ключ');
check(after.provider_issues - before.provider_issues === 1, 'поставщик выдал код ровно один раз');

summary('Сценарий 1');
