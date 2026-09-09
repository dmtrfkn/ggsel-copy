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
              <td class="muted">${o.recovery_reason || '-'}</td>
              <td><button class="retry" data-id="${o.id}">Повторить выдачу</button></td>
            </tr>`
          )
          .join('')
      : '<tr><td colspan="6" class="muted">Пусто - все оплаченные заказы выданы</td></tr>';
  } catch (e) {
    $('#conn').textContent = e.status === 401 ? 'неверный токен' : 'ошибка';
  }
}

async function loadCatalog() {
  if (!token) return;
  try {
    const { products } = await adm('/admin/products');
    $('#catRows').innerHTML = products
      .map(
        (p) => `<tr>
          <td>${p.sku}</td>
          <td>${p.name}</td>
          <td><input type="number" class="c-price" data-sku="${p.sku}" value="${p.price}" min="0" step="1" style="width:90px" /></td>
          <td><input type="number" class="c-stock" data-sku="${p.sku}" value="${p.stock}" min="0" step="1" style="width:70px" /></td>
          <td><button class="retry c-apply" data-sku="${p.sku}">Применить</button></td>
        </tr>`
      )
      .join('');
  } catch (e) {
    $('#catRows').innerHTML = `<tr><td colspan="5" class="muted">${
      e.status === 401 ? 'неверный токен' : 'ошибка загрузки'
    }</td></tr>`;
  }
}

$('#catRows').addEventListener('click', async (e) => {
  const btn = e.target.closest('.c-apply');
  if (!btn) return;
  const sku = btn.dataset.sku;
  const price = $(`.c-price[data-sku="${sku}"]`).value;
  const stock = $(`.c-stock[data-sku="${sku}"]`).value;
  btn.disabled = true;
  btn.textContent = '...';
  try {
    await adm('/admin/products/' + encodeURIComponent(sku), {
      method: 'POST',
      body: JSON.stringify({ price, stock }),
    });
    btn.textContent = 'ок';
  } catch {
    btn.textContent = 'ошибка';
  } finally {
    setTimeout(() => {
      btn.disabled = false;
      btn.textContent = 'Применить';
    }, 900);
  }
});
$('#reloadCat').addEventListener('click', loadCatalog);

$('#save').addEventListener('click', () => {
  token = $('#token').value.trim();
  localStorage.setItem('adminToken', token);
  load();
  loadCatalog();
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
loadCatalog();
