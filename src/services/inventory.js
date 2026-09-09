import { db } from '../db.js';
import { publish } from './events.js';

const getProduct = db.prepare(
  'SELECT sku, name, price, currency, stock FROM products WHERE sku = ?',
);
const listProducts = db.prepare(
  'SELECT sku, name, price, currency, stock FROM products ORDER BY rowid',
);

export function listInventory() {
  return listProducts.all();
}

const claimStmt = db.prepare(
  'UPDATE products SET stock = stock - 1 WHERE sku = @sku AND stock > 0',
);
const restoreStmt = db.prepare('UPDATE products SET stock = stock + 1 WHERE sku = @sku');

export function claimStock(sku) {
  return claimStmt.run({ sku }).changes === 1;
}

export function restoreStock(sku) {
  restoreStmt.run({ sku });
}

export function suggestAlternatives(sku, limit = 3) {
  return db
    .prepare(
      `SELECT sku, name, price, currency, stock FROM products
        WHERE sku != @sku AND stock > 0
        ORDER BY rowid LIMIT @limit`,
    )
    .all({ sku, limit });
}

export function emitProduct(sku) {
  const p = getProduct.get(sku);
  if (p) publish('product.updated', { sku: p.sku, price: p.price, stock: p.stock });
  return p || null;
}

export function setProductFields(sku, { price, stock }) {
  const current = getProduct.get(sku);
  if (!current) return { error: 'unknown_sku', status: 404 };

  const sets = [];
  const params = { sku };
  if (price != null) {
    if (!Number.isInteger(price) || price < 0) return { error: 'bad_price', status: 400 };
    sets.push('price = @price');
    params.price = price;
  }
  if (stock != null) {
    if (!Number.isInteger(stock) || stock < 0) return { error: 'bad_stock', status: 400 };
    sets.push('stock = @stock');
    params.stock = stock;
  }
  if (!sets.length) return { product: current, unchanged: true };

  db.prepare(`UPDATE products SET ${sets.join(', ')} WHERE sku = @sku`).run(params);
  return { product: emitProduct(sku) };
}
