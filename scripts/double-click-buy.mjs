import { ensureServer, reset, post, stats, check, summary } from './lib.mjs';

await ensureServer();
await reset();

console.log('Сценарий 4: двойной клик "Купить" (два одновременных POST /api/orders с одним idempotency_key)\n');

const key = 'idem_double_' + Date.now();
const [a, b] = await Promise.all([
  post('/api/orders', { sku: 'KEY-EFT', idempotency_key: key }),
  post('/api/orders', { sku: 'KEY-EFT', idempotency_key: key }),
]);

console.log(`  ответ A: ${a.status}, заказ ${a.data.order?.id}`);
console.log(`  ответ B: ${b.status}, заказ ${b.data.order?.id}`);

check(!!a.data.order && !!b.data.order, 'оба запроса вернули заказ');
check(a.data.order.id === b.data.order.id, 'вернулся один и тот же заказ');

const s = await stats();
console.log(`  заказов в БД: ${s.orders.total}`);
check(s.orders.total === 1, 'в БД создан ровно один заказ');

summary('Сценарий 4');
