const $ = (s) => document.querySelector(s);
let token = localStorage.getItem('adminToken') || '';
$('#token').value = token;

async function adm(path, options = {}) {
  const res = await fetch(path, {
    ...options,
    headers: { 'content-type': 'application/json', 'x-admin-token': token, ...(options.headers || {}) },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error || res.statusText), { status: res.status });
  return data;
}

async function load() {
  if (!token) return;
  try {
    const data = await adm('/admin/orders/unfulfilled');
    $('#conn').textContent = 'подключено';
    $('#pool').innerHTML =
      `<span>всего: ${data.pool.total}</span><span>свободно: ${data.pool.free}</span><span>занято: ${data.pool.claimed}</span>`;

    const rows = data.orders;
    $('#rows').innerHTML = rows.length
      ? rows
          .map(
            (o) => `<tr>
              <td>${o.id}</td>
              <td>${o.sku}</td>
              <td>${o.amount} ${o.currency}</td>
              <td><span class="pill">${o.status}</span></td>
              <td class="muted">${o.recovery_reason || '—'}</td>
              <td><button class="retry" data-id="${o.id}">Повторить выдачу</button></td>
            </tr>`
          )
          .join('')
      : '<tr><td colspan="6" class="muted">Пусто — все оплаченные заказы выданы</td></tr>';
  } catch (e) {
    $('#conn').textContent = e.status === 401 ? 'неверный токен' : 'ошибка';
  }
}

$('#save').addEventListener('click', () => {
  token = $('#token').value.trim();
  localStorage.setItem('adminToken', token);
  load();
});
$('#reload').addEventListener('click', load);

$('#refill').addEventListener('click', async () => {
  await adm('/admin/pool/refill', { method: 'POST', body: JSON.stringify({ count: 5 }) });
  load();
});
$('#drain').addEventListener('click', async () => {
  await adm('/admin/pool/drain', { method: 'POST', body: JSON.stringify({}) });
  load();
});

$('#rows').addEventListener('click', async (e) => {
  const btn = e.target.closest('.retry');
  if (!btn) return;
  btn.disabled = true;
  btn.textContent = '...';
  try {
    await adm('/admin/orders/' + btn.dataset.id + '/retry', { method: 'POST', body: JSON.stringify({}) });
  } finally {
    load();
  }
});

load();
