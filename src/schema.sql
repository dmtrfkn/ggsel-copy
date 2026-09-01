PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS products (
  sku        TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  type       TEXT NOT NULL,
  price      INTEGER NOT NULL,
  currency   TEXT NOT NULL,
  image      TEXT
);

CREATE TABLE IF NOT EXISTS key_pool (
  id                     INTEGER PRIMARY KEY AUTOINCREMENT,
  code                   TEXT UNIQUE NOT NULL,
  status                 TEXT NOT NULL DEFAULT 'free',
  claimed_by_request_id  TEXT,
  claimed_at             TEXT
);

CREATE TABLE IF NOT EXISTS provider_issues (
  request_id  TEXT PRIMARY KEY,
  provider    TEXT NOT NULL,
  code        TEXT NOT NULL,
  created_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS orders (
  id               TEXT PRIMARY KEY,
  idempotency_key  TEXT UNIQUE,
  sku              TEXT NOT NULL REFERENCES products(sku),
  base_amount      INTEGER NOT NULL,
  discount         INTEGER NOT NULL DEFAULT 0,
  amount           INTEGER NOT NULL,
  currency         TEXT NOT NULL,
  promo_code       TEXT,
  status           TEXT NOT NULL DEFAULT 'created',
  recovery_reason  TEXT,
  created_at       TEXT NOT NULL,
  updated_at       TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);

CREATE TABLE IF NOT EXISTS payment_events (
  event_id     TEXT PRIMARY KEY,
  order_id     TEXT NOT NULL,
  status       TEXT NOT NULL,
  amount       INTEGER,
  currency     TEXT,
  raw          TEXT NOT NULL,
  received_at  TEXT NOT NULL,
  processed_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_payment_events_order ON payment_events(order_id);

CREATE TABLE IF NOT EXISTS deliveries (
  order_id      TEXT PRIMARY KEY REFERENCES orders(id),
  code          TEXT NOT NULL,
  request_id    TEXT NOT NULL,
  provider      TEXT NOT NULL,
  delivered_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS promocodes (
  code      TEXT PRIMARY KEY,
  type      TEXT NOT NULL,
  value     INTEGER NOT NULL,
  currency  TEXT,
  max_uses  INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS promo_redemptions (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  code       TEXT NOT NULL REFERENCES promocodes(code),
  order_id   TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_promo_redemptions_code ON promo_redemptions(code);
