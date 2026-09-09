import { ensureServer, reset, post, get, stats, waitForStatus, check, summary } from './lib.mjs';

await ensureServer();
await reset();

console.log('Сценарий 10: устойчивость покупки (двойной клик, повтор оплаты, оплата финального заказа)\n');

const idem = 'idem_resilience_' + Date.now();

console.log('  1) двойной клик "Создать заказ" (2 параллельных POST с одним idempotency_key)');
const [c1, c2] = await Promise.all([
  post('/api/orders', { sku: 'KEY-CS2-PRIME', idempotency_key: idem }),
  post('/api/orders', { sku: 'KEY-CS2-PRIME', idempotency_key: idem }),
]);
check(!!c1.data.order && !!c2.data.order, 'оба ответа содержат заказ');
check(c1.data.order.id === c2.data.order.id, 'вернулся один и тот же заказ');
check((await stats()).orders.total === 1, 'в БД ровно один заказ');
const orderId = c1.data.order.id;

console.log('  2) повторный "Создать заказ" тем же ключом после паузы');
const c3 = await post('/api/orders', { sku: 'KEY-CS2-PRIME', idempotency_key: idem });
check(c3.data.order.id === orderId && (await stats()).orders.total === 1, 'снова тот же заказ, второго не появилось');

console.log('  3) двойной клик "Оплатить" (2 параллельных POST /api/pay)');
const [p1, p2] = await Promise.all([
  post('/api/pay/' + orderId, { result: 'success' }),
  post('/api/pay/' + orderId, { result: 'success' }),
]);
check(p1.status === 200 && p2.status === 200, 'обе оплаты вернули 200');
const delivered = await waitForStatus(orderId, ['delivered'], 10000);
check(delivered?.status === 'delivered', `заказ доведён до delivered (ключ ${delivered?.delivery?.code})`);

const s = await stats();
console.log(`  выдач: ${s.deliveries}, ключей: ${s.pool.claimed}, payment_events: ${s.payment_events}`);
check(s.deliveries === 1, 'ровно одна запись выдачи');
check(s.pool.claimed === 1, 'израсходован ровно один ключ');
check(s.payment_events === 1, 'ровно одно событие оплаты (стабильный event_id)');

console.log('  4) повторная оплата уже выданного заказа (Назад / refresh после оплаты)');
const rePay = await post('/api/pay/' + orderId, { result: 'success' });
check(rePay.status === 200 && rePay.data.noop === true, 'ответ noop, вебхук не отправлен');
const s2 = await stats();
check(
  s2.deliveries === s.deliveries && s2.pool.claimed === s.pool.claimed && s2.payment_events === s.payment_events,
  'ничего не изменилось: выдачи, ключи и события оплаты те же'
);

console.log('  5) оплата заказа с неуспешной оплатой');
const { data: made } = await post('/api/orders', { sku: 'KEY-CS2-PRIME' });
await post('/api/pay/' + made.order.id, { result: 'failed' });
await waitForStatus(made.order.id, ['payment_failed'], 5000);
const payFailed = await post('/api/pay/' + made.order.id, { result: 'success' });
check(payFailed.status === 409 && payFailed.data.error === 'payment_failed', 'оплатить проваленный заказ нельзя (409)');

summary('Сценарий 10');
