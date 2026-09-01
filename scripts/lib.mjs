export const BASE = process.env.BASE || 'http://localhost:3000';
export const ADMIN = { 'x-admin-token': process.env.ADMIN_TOKEN || 'dev-admin-token' };

export async function api(path, options = {}) {
  const { headers: extraHeaders, ...rest } = options;
  const res = await fetch(BASE + path, {
    ...rest,
    headers: { 'content-type': 'application/json', ...(extraHeaders || {}) },
  });
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }
  return { status: res.status, data };
}

export const post = (path, body, headers) =>
  api(path, { method: 'POST', body: JSON.stringify(body || {}), headers });
export const get = (path, headers) => api(path, { headers });

export async function ensureServer() {
  try {
    const r = await get('/debug/health');
    if (r.status === 200) return;
  } catch {}
  console.error(`\nСервер не отвечает на ${BASE}. Запусти в другом окне: npm start\n`);
  process.exit(2);
}

export const reset = () => post('/debug/reset');
export const stats = async () => (await get('/debug/stats')).data;

export async function waitForStatus(orderId, statuses, timeoutMs = 10000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const { data } = await get('/api/orders/' + orderId);
    if (data.order && statuses.includes(data.order.status)) return data.order;
    await new Promise((r) => setTimeout(r, 150));
  }
  const { data } = await get('/api/orders/' + orderId);
  return data.order || null;
}

let failures = 0;
export function check(condition, message) {
  if (condition) {
    console.log('  ✓ ' + message);
  } else {
    console.log('  ✗ ' + message);
    failures += 1;
    process.exitCode = 1;
  }
  return condition;
}

export function summary(title) {
  if (failures === 0) console.log(`\n${title}: ВСЕ ПРОВЕРКИ ПРОЙДЕНЫ\n`);
  else console.log(`\n${title}: ПРОВАЛЕНО ПРОВЕРОК — ${failures}\n`);
}
