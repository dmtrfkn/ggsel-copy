import express from 'express';
import { db } from '../db.js';
import { seed } from '../seed-core.js';
import { providerFaults } from './providers.js';
import { publish, _stats as streamStats } from '../services/events.js';
import { expireNow } from '../services/reservations.js';

export function makeDebugRouter() {
  const router = express.Router();

  router.get('/health', (req, res) => res.json({ ok: true }));

  router.get('/stream', (req, res) => res.json(streamStats()));

  router.post('/publish', (req, res) => {
    const { type = 'debug', data = {} } = req.body || {};
    const id = publish(type, data);
    res.json({ ok: true, id });
  });

  router.get('/stats', (req, res) => {
    const ordersByStatus = db
      .prepare('SELECT status, COUNT(*) AS c FROM orders GROUP BY status')
      .all()
      .reduce((acc, r) => ({ ...acc, [r.status]: r.c }), {});

    res.json({
      pool: {
        total: db.prepare('SELECT COUNT(*) AS c FROM key_pool').get().c,
        free: db.prepare(`SELECT COUNT(*) AS c FROM key_pool WHERE status = 'free'`).get().c,
        claimed: db.prepare(`SELECT COUNT(*) AS c FROM key_pool WHERE status = 'claimed'`).get().c,
      },
      orders: {
        total: db.prepare('SELECT COUNT(*) AS c FROM orders').get().c,
        by_status: ordersByStatus,
      },
      deliveries: db.prepare('SELECT COUNT(*) AS c FROM deliveries').get().c,
      payment_events: db.prepare('SELECT COUNT(*) AS c FROM payment_events').get().c,
      provider_issues: db.prepare('SELECT COUNT(*) AS c FROM provider_issues').get().c,
      promo_redemptions: db
        .prepare('SELECT code, COUNT(*) AS c FROM promo_redemptions GROUP BY code')
        .all(),
      provider_faults: providerFaults,
    });
  });

  router.post('/reset', (req, res) => {
    const result = seed({ reset: true });
    res.json({ ok: true, seed: result });
  });

  router.post('/orders/:id/expire-reservation', (req, res) => {
    const freed = expireNow(req.params.id);
    res.json({ ok: true, freed });
  });

  return router;
}
