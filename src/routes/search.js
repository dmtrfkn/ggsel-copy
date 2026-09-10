import express from 'express';
import { db } from '../db.js';
import { config } from '../config.js';

const router = express.Router();

const SORTS = {
  relevance: 'rank, rowid',
  price_asc: 'price ASC, rowid',
  price_desc: 'price DESC, rowid',
  name: 'name COLLATE NOCASE ASC, rowid',
};

const intOr = (v, d) => {
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : d;
};

router.get('/', async (req, res) => {
  const q = (req.query.q || '').toString().trim();
  const type = (req.query.type || '').toString().trim();
  const min = req.query.min === undefined ? null : intOr(req.query.min, null);
  const max = req.query.max === undefined ? null : intOr(req.query.max, null);
  const sort = SORTS[req.query.sort] ? req.query.sort : 'relevance';
  const page = Math.max(0, intOr(req.query.page, 0));
  const pageSize = Math.min(100, Math.max(1, intOr(req.query.page_size, 20)));

  // Искусственная задержка — только под ENABLE_DEBUG, для проверки, что
  // устаревший ответ не перетирает свежий (задача 5, п.2).
  const delay = config.enableDebug ? Math.min(5000, Math.max(0, intOr(req.query._delay, 0))) : 0;
  if (delay) await new Promise((r) => setTimeout(r, delay));

  const where = [];
  const params = {};
  if (q) {
    where.push("name LIKE '%' || @q || '%' COLLATE NOCASE");
    params.q = q;
  }
  if (type) {
    where.push('type = @type');
    params.type = type;
  }
  if (min !== null) {
    where.push('price >= @min');
    params.min = min;
  }
  if (max !== null) {
    where.push('price <= @max');
    params.max = max;
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  // rank: точное совпадение с началом названия выше, затем вхождение.
  const rankSql = q
    ? `CASE WHEN name LIKE @q || '%' COLLATE NOCASE THEN 0 ELSE 1 END`
    : '0';

  const total = db.prepare(`SELECT COUNT(*) AS c FROM products ${whereSql}`).get(params).c;

  const items = db
    .prepare(
      `SELECT sku, name, type, price, currency, stock, ${rankSql} AS rank
         FROM products
         ${whereSql}
        ORDER BY ${SORTS[sort]}
        LIMIT @limit OFFSET @offset`
    )
    .all({ ...params, limit: pageSize, offset: page * pageSize })
    .map(({ rank, ...row }) => row);

  res.json({
    items,
    total,
    page,
    page_size: pageSize,
    pages: Math.ceil(total / pageSize),
    query: { q, type, min, max, sort },
  });
});

export default router;
