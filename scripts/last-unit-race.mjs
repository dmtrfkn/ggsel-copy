import { ensureServer, reset, post, get, stats, waitForStatus, check, summary, ADMIN } from './lib.mjs';

await ensureServer();
await reset();

const SKU = 'KEY-EFT';
const RACERS = 8;

console.log(`Сценарий 8: гонка за последней единицей (${RACERS} одновременных POST /api/orders на ${SKU} при остатке 1)\n`);

console.log('  ставим остаток = 1');
await post('/admin/products/' + SKU, { stock: 1 }, ADMIN);

const results = await Promise.all(
  Array.from({ length: RACERS }, () => post('/api/orders', { sku: SKU }))
);

const won = results.filter((r) => r.status === 201);
const lost = results.filter((r) => r.status === 409);
console.log(`  201 (получил заказ): ${won.length}, 409 (отказ): ${lost.length}`);

check(won.length === 1, 'ровно один покупатель получил заказ');
check(lost.length === RACERS - 1, 'все остальные получили отказ');
check(
  lost.every((r) => r.data.error === 'out_of_stock' && r.data.message),
  'у проигравших понятный ответ: out_of_stock + message'
);
check(
  lost.every((r) => Array.isArray(r.data.alternatives) && r.data.alternatives.length > 0),
  'проигравшим предложены другие товары в наличии'
);

const { data: catalog } = await get('/api/catalog/products');
const stock = catalog.products.find((p) => p.sku === SKU).stock;
console.log(`  остаток ${SKU}: ${stock}`);
check(stock === 0, 'остаток дошёл до нуля');

const s1 = await stats();
console.log(`  заказов в БД: ${s1.orders.total}, по статусам: ${JSON.stringify(s1.orders.by_status)}`);
check(s1.orders.total === 1, 'в БД создан ровно один заказ (у проигравших заказа нет)');

console.log('  победитель оплачивает');
const winnerId = won[0].data.order.id;
await post('/api/pay/' + winnerId, { result: 'success' });
const winner = await waitForStatus(winnerId, ['delivered'], 10000);
check(winner?.status === 'delivered', `заказ победителя доведён до delivered (ключ ${winner?.delivery?.code})`);

const s2 = await stats();
check(s2.deliveries === 1, 'ровно одна запись выдачи');
check(s2.pool.claimed === 1, 'израсходован ровно один ключ');

console.log('\n  --- возврат резерва при неуспешной оплате ---');
await reset();
await post('/admin/products/' + SKU, { stock: 1 }, ADMIN);
const { data: held } = await post('/api/orders', { sku: SKU });
const afterHold = (await get('/api/catalog/products')).data.products.find((p) => p.sku === SKU).stock;
check(afterHold === 0, 'создание заказа заняло единицу (остаток 0)');

await post('/api/pay/' + held.order.id, { result: 'failed' });
await waitForStatus(held.order.id, ['payment_failed'], 5000);
const afterFail = (await get('/api/catalog/products')).data.products.find((p) => p.sku === SKU).stock;
console.log(`  остаток после failed-оплаты: ${afterFail}`);
check(afterFail === 1, 'неуспешная оплата вернула единицу в продажу');

const { status: reorderStatus } = await post('/api/orders', { sku: SKU });
check(reorderStatus === 201, 'освободившуюся единицу можно купить снова');

summary('Сценарий 8');
