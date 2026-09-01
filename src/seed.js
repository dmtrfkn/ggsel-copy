import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { db, migrate, now } from './db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const readJson = (f) => JSON.parse(fs.readFileSync(path.join(__dirname, 'seed-data', f), 'utf8'));

const reset = process.argv.includes('--reset');

migrate();

if (reset) {
  db.exec(`
    DELETE FROM promo_redemptions;
    DELETE FROM deliveries;
    DELETE FROM payment_events;
    DELETE FROM orders;
    DELETE FROM provider_issues;
    DELETE FROM key_pool;
    DELETE FROM promocodes;
    DELETE FROM products;
  `);
  console.log('reset: runtime + reference data cleared');
}

const seedAll = db.transaction(() => {
  const { products } = readJson('catalog.json');
  const insProduct = db.prepare(
    `INSERT INTO products (sku, name, type, price, currency, image)
     VALUES (@sku, @name, @type, @price, @currency, @image)
     ON CONFLICT(sku) DO UPDATE SET
       name = excluded.name, type = excluded.type,
       price = excluded.price, currency = excluded.currency, image = excluded.image`
  );
  for (const p of products) insProduct.run(p);

  const { keys } = readJson('keys.json');
  const insKey = db.prepare(`INSERT OR IGNORE INTO key_pool (code, status) VALUES (?, 'free')`);
  for (const code of keys) insKey.run(code);

  const { promocodes } = readJson('promocodes.json');
  const insPromo = db.prepare(
    `INSERT INTO promocodes (code, type, value, currency, max_uses)
     VALUES (@code, @type, @value, @currency, @max_uses)
     ON CONFLICT(code) DO UPDATE SET
       type = excluded.type, value = excluded.value,
       currency = excluded.currency, max_uses = excluded.max_uses`
  );
  for (const c of promocodes) insPromo.run({ currency: null, ...c });
});

seedAll();

const counts = {
  products: db.prepare('SELECT COUNT(*) c FROM products').get().c,
  keys_total: db.prepare('SELECT COUNT(*) c FROM key_pool').get().c,
  keys_free: db.prepare(`SELECT COUNT(*) c FROM key_pool WHERE status = 'free'`).get().c,
  promocodes: db.prepare('SELECT COUNT(*) c FROM promocodes').get().c,
};
console.log('seed done at', now(), counts);
