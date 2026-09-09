import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';
import { config } from './config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

fs.mkdirSync(path.dirname(config.dbPath), { recursive: true });

export const db = new Database(config.dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.pragma('busy_timeout = 5000');

const hasColumn = (table, column) =>
  db
    .prepare(`PRAGMA table_info(${table})`)
    .all()
    .some((c) => c.name === column);

export function migrate() {
  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  db.exec(schema);

  if (!hasColumn('products', 'stock')) {
    db.exec(`ALTER TABLE products ADD COLUMN stock INTEGER NOT NULL DEFAULT 0`);
  }
  if (!hasColumn('orders', 'stock_held')) {
    db.exec(`ALTER TABLE orders ADD COLUMN stock_held INTEGER NOT NULL DEFAULT 0`);
  }
  if (!hasColumn('orders', 'reserved_until')) {
    db.exec(`ALTER TABLE orders ADD COLUMN reserved_until TEXT`);
  }
}

migrate();

export const now = () => new Date().toISOString();
