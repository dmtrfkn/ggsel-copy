import express from 'express';
import path from 'node:path';
import { config } from './config.js';
import { migrate } from './db.js';
import { seed } from './seed-core.js';
import catalogRouter from './routes/catalog.js';
import ordersRouter from './routes/orders.js';
import payRouter from './routes/pay.js';
import webhookRouter from './routes/webhook.js';
import adminRouter from './routes/admin.js';
import { providerA, providerB } from './routes/providers.js';
import { makeDebugRouter } from './routes/debug.js';
import { startRecoveryLoop } from './services/fulfillment.js';

migrate();
seed({ reset: false });

const app = express();
app.use(express.json());

app.use('/api/catalog', catalogRouter);
app.use('/api/orders', ordersRouter);
app.use('/api/pay', payRouter);
app.use('/webhook', webhookRouter);
app.use('/provider-a', providerA);
app.use('/provider-b', providerB);
app.use('/admin', adminRouter);
if (config.enableDebug) app.use('/debug', makeDebugRouter());

app.use(express.static(path.join(config.root, 'public')));

app.listen(config.port, () => {
  console.log(`ggsel-copy running on http://localhost:${config.port}`);
  startRecoveryLoop();
});
