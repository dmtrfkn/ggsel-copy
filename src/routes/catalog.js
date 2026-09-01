import express from 'express';
import { db } from '../db.js';

const router = express.Router();

const listProducts = db.prepare(
  'SELECT sku, name, type, price, currency, image FROM products ORDER BY rowid'
);
const getProduct = db.prepare(
  'SELECT sku, name, type, price, currency, image FROM products WHERE sku = ?'
);

router.get('/products', (req, res) => {
  res.json({ products: listProducts.all() });
});

router.get('/products/:sku', (req, res) => {
  const product = getProduct.get(req.params.sku);
  if (!product) return res.status(404).json({ error: 'not_found' });
  res.json({ product });
});

export default router;
