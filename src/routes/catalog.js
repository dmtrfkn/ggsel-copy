import express from 'express';
import { db } from '../db.js';

const router = express.Router();

const listFeatured = db.prepare(
  'SELECT sku, name, type, price, currency, image, stock FROM products WHERE featured = 1 ORDER BY rowid'
);
const getProduct = db.prepare(
  'SELECT sku, name, type, price, currency, image, stock FROM products WHERE sku = ?'
);
const listTypes = db.prepare('SELECT DISTINCT type FROM products ORDER BY type');

router.get('/products', (req, res) => {
  res.json({ products: listFeatured.all() });
});

router.get('/types', (req, res) => {
  res.json({ types: listTypes.all().map((r) => r.type) });
});

router.get('/products/:sku', (req, res) => {
  const product = getProduct.get(req.params.sku);
  if (!product) return res.status(404).json({ error: 'not_found' });
  res.json({ product });
});

export default router;
