import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const PORT = process.env.RACE_PORT || 3999;
const BASE = `http://localhost:${PORT}`;
const dbPath = path.join(root, 'data', 'race-all.db');

for (const suffix of ['', '-wal', '-shm']) {
  try { fs.unlinkSync(dbPath + suffix); } catch {}
}

const server = spawn('node', ['src/server.js'], {
  cwd: root,
  env: {
    ...process.env,
    PORT: String(PORT),
    DB_PATH: dbPath,
    ENABLE_DEBUG: '1',
    ALLOW_CLIENT_ORDER_ID: '1',
    PROVIDER_A_ERROR_RATE: '0',
    PROVIDER_A_TIMEOUT_RATE: '0',
    PROVIDER_B_ERROR_RATE: '0',
    PROVIDER_B_TIMEOUT_RATE: '0',
  },
  stdio: 'ignore',
});

async function waitHealthy() {
  for (let i = 0; i < 50; i += 1) {
    try {
      const r = await fetch(BASE + '/debug/health');
      if (r.ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error('test server did not start');
}

function runScript(file) {
  return new Promise((resolve) => {
    const p = spawn('node', ['scripts/' + file], {
      cwd: root,
      env: { ...process.env, BASE },
      stdio: 'inherit',
    });
    p.on('exit', (code) => resolve(code ?? 1));
  });
}

const scripts = [
  'race-webhooks.mjs',
  'race-webhooks-distinct.mjs',
  'webhook-before-order.mjs',
  'double-click-buy.mjs',
  'empty-pool-recovery.mjs',
  'race-promo.mjs',
  'provider-faults.mjs',
];

let failed = 0;
try {
  await waitHealthy();
  for (const s of scripts) {
    console.log('\n' + '='.repeat(70));
    const code = await runScript(s);
    if (code !== 0) failed += 1;
  }
} finally {
  server.kill();
}

console.log('\n' + '='.repeat(70));
console.log(failed === 0 ? 'ИТОГ: все сценарии прошли' : `ИТОГ: провалено сценариев - ${failed}`);
process.exit(failed === 0 ? 0 : 1);
