import { ensureServer, reset, post, get, stats, waitForStatus, check, summary } from './lib.mjs';

await ensureServer();
await reset();

console.log('Сценарий 3: вебхук раньше заказа и события не по порядку\n');

const orderId = 'ord_ooo_' + Date.now();
const paidEvent = {
  event_id: 'evt_ooo_paid',
  order_id: orderId,
  status: 'paid',
  amount: 1990,
  currency: 'RUB',
  created_at: new Date().toISOString(),
};

console.log('  1) шлём "paid" до того, как заказ создан');
const early = await post('/webhook/payment', paidEvent);
check(early.status === 200, 'вебхук без существующего заказа принят с 200 (не 5xx, не падение)');

console.log('  2) повтор того же вебхука (тот же event_id)');
const repeat = await post('/webhook/payment', paidEvent);
check(repeat.data && repeat.data.duplicate === true, 'повтор помечен как duplicate');

console.log('  3) создаём заказ с этим order_id');
const { data: created } = await post('/api/orders', { sku: 'KEY-GTA5', order_id: orderId });
check(created.order && created.order.id === orderId, 'заказ создан');

const order = await waitForStatus(orderId, ['delivered'], 10000);
check(order?.status === 'delivered', 'буферизованный вебхук довёл заказ до delivered');

console.log('  4) запоздалый "failed" по уже оплаченному заказу (событие не по порядку)');
const late = await post('/webhook/payment', {
  event_id: 'evt_ooo_failed_late',
  order_id: orderId,
  status: 'failed',
  amount: 1990,
  currency: 'RUB',
  created_at: new Date(Date.now() - 60000).toISOString(),
});
check(late.status === 200, 'запоздалый failed принят с 200');
const afterLate = await waitForStatus(orderId, ['delivered'], 2000);
check(afterLate?.status === 'delivered', 'заказ остался delivered, успешная оплата не потеряна');

const s = await stats();
console.log(`\n  выдач: ${s.deliveries}, израсходовано ключей: ${s.pool.claimed}`);
check(s.deliveries === 1, 'ровно одна запись выдачи');
check(s.pool.claimed === 1, 'израсходован ровно один ключ');

summary('Сценарий 3');
