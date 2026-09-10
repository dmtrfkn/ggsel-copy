import { ensureServer, reset, get, check, summary } from './lib.mjs';

await ensureServer();
await reset();

console.log('Сценарий 11: поиск по большому каталогу (фильтры, сортировка, пагинация, устаревший ответ)\n');

const search = (qs) => get('/api/search?' + qs).then((r) => r.data);

const all = await search('page_size=1');
console.log(`  всего в каталоге: ${all.total}`);
check(all.total >= 3000, 'каталог из тысяч предложений');

console.log('  фильтр по типу');
const keys = await search('type=key&page_size=50');
check(keys.items.every((x) => x.type === 'key'), 'все результаты нужного типа');
check(keys.total < all.total && keys.total > 0, 'фильтр по типу сузил выдачу');

console.log('  фильтр по цене');
const band = await search('min=1000&max=1500&page_size=50');
check(band.items.every((x) => x.price >= 1000 && x.price <= 1500), 'все результаты в диапазоне цены');

console.log('  сортировка');
const asc = (await search('sort=price_asc&page_size=30')).items.map((x) => x.price);
const desc = (await search('sort=price_desc&page_size=30')).items.map((x) => x.price);
check(asc.every((v, i) => i === 0 || v >= asc[i - 1]), 'price_asc: цены не убывают');
check(desc.every((v, i) => i === 0 || v <= desc[i - 1]), 'price_desc: цены не возрастают');

console.log('  релевантность запроса');
const steam = await search('q=steam&page_size=5');
check(steam.total > 0, `q=steam что-то нашёл (${steam.total})`);
check(/^steam/i.test(steam.items[0].name), 'сверху результат, начинающийся с "Steam"');

console.log('  пагинация');
const p0 = await search('q=ключ&sort=name&page=0&page_size=10');
const p1 = await search('q=ключ&sort=name&page=1&page_size=10');
const overlap = p0.items.filter((a) => p1.items.some((b) => b.sku === a.sku));
check(p0.items.length === 10 && p1.items.length === 10, 'страницы полные');
check(overlap.length === 0, 'страницы не пересекаются');
check(p0.pages === Math.ceil(p0.total / 10), 'число страниц согласовано с total');

console.log('  детерминизм выдачи');
const a1 = await search('q=deluxe&sort=price_asc&page_size=15');
const a2 = await search('q=deluxe&sort=price_asc&page_size=15');
check(
  JSON.stringify(a1.items.map((x) => x.sku)) === JSON.stringify(a2.items.map((x) => x.sku)),
  'одинаковый запрос даёт одинаковый порядок'
);

console.log('  устаревший ответ приходит позже свежего (проверяет инфраструктуру защиты на клиенте)');
const t = Date.now();
const slow = search('q=a&_delay=300&page_size=3').then(() => Date.now() - t);
await new Promise((r) => setTimeout(r, 40));
const fast = await search('q=steam&page_size=3').then(() => Date.now() - t);
const slowAt = await slow;
check(fast < slowAt, `быстрый ответ (${fast}мс) вернулся раньше медленного (${slowAt}мс)`);

summary('Сценарий 11');
