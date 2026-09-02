import { ensureServer, reset, post, get, stats, waitForStatus, check, summary, ADMIN } from './lib.mjs';

await ensureServer();
await reset();

console.log('Сценарий 5: пул закончился в момент выдачи -> восстановимое состояние -> пополнение -> повторная выдача\n');

console.log('  1) опустошаем пул ключей');
await post('/admin/pool/drain', {}, ADMIN);

const { data: created } = await post('/api/orders', { sku: 'KEY-CS2-PRIME' });
const orderId = created.order.id;

console.log('  2) оплачиваем заказ (вебхук-заглушка)');
await post('/api/pay/' + orderId, { result: 'success' });

let order = await waitForStatus(orderId, ['out_of_stock', 'delivery_failed', 'delivered'], 10000);
check(order?.status === 'out_of_stock', 'заказ перешёл в восстановимое состояние out_of_stock (без падения)');

const health = await get('/debug/health');
check(health.status === 200, 'сервер жив после нехватки ключей');

const unfulfilled = await get('/admin/orders/unfulfilled', ADMIN);
check(
  unfulfilled.data.orders.some((o) => o.id === orderId),
  'заказ виден в админ-списке "оплачен, но не выдан"'
);

console.log('  3) пополняем пул и запускаем повторную выдачу из админки');
await post('/admin/pool/refill', { count: 3 }, ADMIN);
await post('/admin/orders/' + orderId + '/retry', {}, ADMIN);

order = await waitForStatus(orderId, ['delivered'], 10000);
check(order?.status === 'delivered', 'после пополнения повторная выдача довела заказ до delivered');

const s1 = await stats();

console.log('  4) повторяем retry ещё раз - должно быть идемпотентно');
await post('/admin/orders/' + orderId + '/retry', {}, ADMIN);
await post('/admin/orders/' + orderId + '/retry', {}, ADMIN);
const s2 = await stats();

console.log(`  выдач: ${s1.deliveries} -> ${s2.deliveries}, ключей израсходовано: ${s1.pool.claimed} -> ${s2.pool.claimed}`);
check(s2.deliveries === s1.deliveries, 'повторный retry не создал вторую запись выдачи');
check(s2.pool.claimed === s1.pool.claimed, 'повторный retry не израсходовал второй ключ');
check(order?.delivery?.code, `ключ выдан: ${order?.delivery?.code}`);

summary('Сценарий 5');
