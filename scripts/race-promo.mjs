import { ensureServer, reset, post, stats, check, summary } from './lib.mjs';

await ensureServer();
await reset();

console.log('Сценарий 6: промокод с лимитом под параллельными запросами (этап 4)\n');

async function hammer(code, limit, attempts) {
  console.log(`  промокод ${code} (лимит ${limit}), ${attempts} одновременных заказов`);
  const responses = await Promise.all(
    Array.from({ length: attempts }, (_, i) =>
      post('/api/orders', {
        sku: 'STEAM-TOPUP-1000',
        promo_code: code,
        idempotency_key: `idem_${code}_${i}_${Date.now()}`,
      })
    )
  );
  const applied = responses.filter((r) => r.status === 201 && r.data.order?.discount > 0).length;
  const rejected = responses.filter((r) => r.status === 409).length;
  const s = await stats();
  const redeemed = (s.promo_redemptions.find((x) => x.code === code) || { c: 0 }).c;

  console.log(`    применён: ${applied}, отклонён 409: ${rejected}, строк в promo_redemptions: ${redeemed}`);
  check(applied === limit, `промокод применён ровно ${limit} раз`);
  check(redeemed === limit, `в promo_redemptions ровно ${limit} строк`);
  check(applied + rejected === attempts, 'каждый запрос получил детерминированный ответ (201 или 409)');
}

await hammer('LIMIT3', 3, 30);
console.log('');
await reset();
await hammer('ONCEONLY', 1, 25);

summary('Сценарий 6');
