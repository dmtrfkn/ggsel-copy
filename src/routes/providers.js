import express from 'express';
import { db, now } from '../db.js';
import { config } from '../config.js';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const findIssue = db.prepare('SELECT code FROM provider_issues WHERE request_id = ?');

const claimKeyForRequest = db.transaction((requestId, provider) => {
  const existing = findIssue.get(requestId);
  if (existing) return { code: existing.code, reused: true };

  const claimed = db.prepare(`
    UPDATE key_pool
       SET status = 'claimed', claimed_by_request_id = @rid, claimed_at = @ts
     WHERE id = (SELECT id FROM key_pool WHERE status = 'free' ORDER BY id LIMIT 1)
     RETURNING code
  `).get({ rid: requestId, ts: now() });

  if (!claimed) return { outOfStock: true };

  db.prepare(
    `INSERT INTO provider_issues (request_id, provider, code, created_at) VALUES (?, ?, ?, ?)`
  ).run(requestId, provider, claimed.code, now());

  return { code: claimed.code, reused: false };
});

function makeProviderRouter(name, faults) {
  const router = express.Router();

  router.post('/issue', async (req, res) => {
    const { request_id: requestId } = req.body || {};
    if (!requestId) {
      return res.status(400).json({ status: 'error', reason: 'request_id_required' });
    }

    const known = findIssue.get(requestId);
    if (!known && Math.random() < faults.errorRate) {
      return res.status(503).json({ status: 'error', reason: 'provider_unavailable' });
    }

    const result = claimKeyForRequest(requestId, name);
    if (result.outOfStock) {
      return res.status(409).json({ status: 'error', reason: 'out_of_stock' });
    }

    if (!result.reused && Math.random() < faults.timeoutRate) {
      await sleep(config.providerTimeoutMs + 2000);
    }

    return res.status(200).json({ status: 'ok', request_id: requestId, code: result.code });
  });

  router.get('/config', (req, res) => {
    res.json({ provider: name, faults });
  });

  router.post('/config', (req, res) => {
    if (req.get('x-admin-token') !== config.adminToken) {
      return res.status(401).json({ error: 'unauthorized' });
    }
    if (req.body?.errorRate !== undefined) faults.errorRate = Number(req.body.errorRate);
    if (req.body?.timeoutRate !== undefined) faults.timeoutRate = Number(req.body.timeoutRate);
    res.json({ provider: name, faults });
  });

  return router;
}

export const providerFaults = {
  A: { ...config.providerA },
  B: { ...config.providerB },
};

export const providerA = makeProviderRouter('A', providerFaults.A);
export const providerB = makeProviderRouter('B', providerFaults.B);
