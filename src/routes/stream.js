import express from 'express';
import { subscribe } from '../services/events.js';

const router = express.Router();

router.get('/', (req, res) => {
  res.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.flushHeaders();

  const lastSeenId = Number(req.get('Last-Event-ID') || req.query.lastEventId || 0);

  const unsubscribe = subscribe(res, Number.isFinite(lastSeenId) ? lastSeenId : 0);
  req.on('close', unsubscribe);
});

export default router;
