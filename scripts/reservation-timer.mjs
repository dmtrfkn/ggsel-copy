import { ensureServer, reset, post, get, stats, waitForStatus, check, summary, ADMIN } from './lib.mjs';

await ensureServer();
await reset();

const SKU = 'KEY-EFT';

console.log('Сценарий 9: бронь с таймером (истечение возвращает товар всем; успешная оплата до нуля уходит в выдачу)\n');

console.log('  ставим остаток = 1');
await post('/admin/products/' + SKU, { stock: 1 }, ADMIN);

console.log('  1) создаём заказ -> единица под бронью');
const { data: made } = await post('/api/orders', { sku: SKU });
const orderId = made.order.id;
check(!!made.order.reserved_until, `у заказа есть срок брони (reserved_until = ${made.order.reserved_until})`);

let stock = (await get('/api/catalog/products')).data.products.find((p) => p.sku === SKU).stock;
check(stock === 0, 'остаток занят бронью (0)');

console.log('  2) второй заказ на тот же sku, пока бронь жива');
const dup = await post('/api/orders', { sku: SKU });
check(dup.status === 409 && dup.data.error === 'out_of_stock', 'вторую бронь на ту же единицу оформить нельзя (409)');

console.log('  3) форсируем истечение брони');
await post('/debug/orders/' + orderId + '/expire-reservation');
const expired = await waitForStatus(orderId, ['expired'], 5000);
check(expired?.status === 'expired', 'по истечении бронь снята, заказ expired');

stock = (await get('/api/catalog/products')).data.products.find((p) => p.sku === SKU).stock;
check(stock === 1, 'товар вернулся в продажу для всех (остаток снова 1)');

console.log('  4) оплата истёкшего заказа');
const latePay = await post('/api/pay/' + orderId, { result: 'success' });
check(latePay.status === 409 && latePay.data.error === 'reservation_expired', 'оплатить истёкшую бронь нельзя (409 reservation_expired)');

console.log('  5) освободившуюся единицу берёт другой покупатель и платит вовремя');
const { data: made2 } = await post('/api/orders', { sku: SKU });
check(!!made2.order, 'новый заказ на вернувшуюся единицу создан');
await post('/api/pay/' + made2.order.id, { result: 'success' });
const delivered = await waitForStatus(made2.order.id, ['delivered'], 10000);
check(delivered?.status === 'delivered', `оплата до истечения -> выдача (ключ ${delivered?.delivery?.code})`);

console.log('  6) повторное истечение уже выданного заказа - ничего не меняет');
const before = await stats();
await post('/debug/orders/' + made2.order.id + '/expire-reservation');
const after = await stats();
const stillStock = (await get('/api/catalog/products')).data.products.find((p) => p.sku === SKU).stock;
check((await get('/api/orders/' + made2.order.id)).data.order.status === 'delivered', 'выданный заказ остался delivered');
check(after.deliveries === before.deliveries && stillStock === 0, 'остаток и число выдач не изменились (таймер уже ни на что не влияет)');

summary('Сценарий 9');
