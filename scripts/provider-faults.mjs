import { ensureServer, reset, post, stats, waitForStatus, check, summary, ADMIN } from './lib.mjs';

await ensureServer();

const setFaults = (provider, faults) =>
  post(`/provider-${provider}/config`, faults, ADMIN);

console.log('Сценарий 7: сбои поставщиков — ловушка таймаута и переключение на резервного\n');

console.log('  A) поставщик A всегда "зависает" (timeout), повтор с тем же request_id должен вернуть тот же ключ');
await reset();
await setFaults('a', { errorRate: 0, timeoutRate: 1 });
await setFaults('b', { errorRate: 0, timeoutRate: 0 });

let before = await stats();
let { data: created } = await post('/api/orders', { sku: 'KEY-CS2-PRIME' });
await post('/api/pay/' + created.order.id, { result: 'success' });
let order = await waitForStatus(created.order.id, ['delivered', 'out_of_stock', 'delivery_failed'], 15000);
let after = await stats();

console.log(`    статус: ${order?.status}, ключ: ${order?.delivery?.code}, поставщик: ${order?.delivery?.provider}`);
console.log(`    ключей израсходовано: +${after.pool.claimed - before.pool.claimed}, выдач поставщика: +${after.provider_issues - before.provider_issues}`);
check(order?.status === 'delivered', 'заказ доведён до delivered несмотря на таймаут A');
check(after.pool.claimed - before.pool.claimed === 1, 'после таймаута и повтора израсходован ровно один ключ');
check(after.deliveries - before.deliveries === 1, 'ровно одна запись выдачи');

console.log('\n  B) поставщик A всегда падает 5xx, заказ должен уйти на резервного B');
await reset();
await setFaults('a', { errorRate: 1, timeoutRate: 0 });
await setFaults('b', { errorRate: 0, timeoutRate: 0 });

before = await stats();
({ data: created } = await post('/api/orders', { sku: 'KEY-GTA5' }));
await post('/api/pay/' + created.order.id, { result: 'success' });
order = await waitForStatus(created.order.id, ['delivered', 'out_of_stock', 'delivery_failed'], 15000);
after = await stats();

console.log(`    статус: ${order?.status}, ключ: ${order?.delivery?.code}, поставщик: ${order?.delivery?.provider}`);
check(order?.status === 'delivered', 'заказ выдан резервным поставщиком B');
check(order?.delivery?.provider === 'B', 'выдача пришла именно от B');
check(after.pool.claimed - before.pool.claimed === 1, 'израсходован ровно один ключ');

console.log('\n  C) оба поставщика падают 5xx → восстановимое состояние, затем чиним и добираем');
await reset();
await setFaults('a', { errorRate: 1, timeoutRate: 0 });
await setFaults('b', { errorRate: 1, timeoutRate: 0 });

before = await stats();
({ data: created } = await post('/api/orders', { sku: 'KEY-EFT' }));
await post('/api/pay/' + created.order.id, { result: 'success' });
order = await waitForStatus(created.order.id, ['delivery_failed', 'out_of_stock'], 15000);
check(order?.status === 'delivery_failed', 'оба поставщика недоступны → статус delivery_failed (без падения)');

await setFaults('a', { errorRate: 0, timeoutRate: 0 });
await post('/admin/orders/' + created.order.id + '/retry', {}, ADMIN);
order = await waitForStatus(created.order.id, ['delivered'], 15000);
after = await stats();
check(order?.status === 'delivered', 'после восстановления поставщика retry довёл заказ до delivered');
check(after.pool.claimed - before.pool.claimed === 1, 'израсходован ровно один ключ за весь сценарий');

await setFaults('a', { errorRate: 0, timeoutRate: 0 });
await setFaults('b', { errorRate: 0, timeoutRate: 0 });

summary('Сценарий 7');
