import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const num = (v, d) => (v === undefined || v === '' ? d : Number(v));
const bool = (v, d) => (v === undefined || v === '' ? d : v === '1' || v === 'true');

export const config = {
  port: num(process.env.PORT, 3000),
  dbPath: process.env.DB_PATH || path.join(root, 'data', 'app.db'),
  adminToken: process.env.ADMIN_TOKEN || 'dev-admin-token',

  providerTimeoutMs: num(process.env.PROVIDER_TIMEOUT_MS, 2500),

  providerA: {
    errorRate: num(process.env.PROVIDER_A_ERROR_RATE, 0),
    timeoutRate: num(process.env.PROVIDER_A_TIMEOUT_RATE, 0),
  },
  providerB: {
    errorRate: num(process.env.PROVIDER_B_ERROR_RATE, 0),
    timeoutRate: num(process.env.PROVIDER_B_TIMEOUT_RATE, 0),
  },

  enableDebug: bool(process.env.ENABLE_DEBUG, true),
  allowClientOrderId: bool(process.env.ALLOW_CLIENT_ORDER_ID, true),

  root,
};
