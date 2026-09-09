const $ = (s) => document.querySelector(s);

const els = {
  q: $('#q'),
  type: $('#type'),
  min: $('#min'),
  max: $('#max'),
  sort: $('#sort'),
  list: $('#list'),
  meta: $('#meta'),
  moreWrap: $('#moreWrap'),
};

const state = { q: '', type: '', min: '', max: '', sort: 'relevance', page: 0 };

let reqSeq = 0;
let inflight = null;
let debounceT = null;

function readUrl() {
  const p = new URLSearchParams(location.search);
  state.q = p.get('q') || '';
  state.type = p.get('type') || '';
  state.min = p.get('min') || '';
  state.max = p.get('max') || '';
  state.sort = p.get('sort') || 'relevance';
  state.page = Math.max(0, parseInt(p.get('page'), 10) || 0);
}

function writeUrl() {
  const p = new URLSearchParams();
  if (state.q) p.set('q', state.q);
  if (state.type) p.set('type', state.type);
  if (state.min !== '') p.set('min', state.min);
  if (state.max !== '') p.set('max', state.max);
  if (state.sort !== 'relevance') p.set('sort', state.sort);
  if (state.page > 0) p.set('page', state.page);
  const qs = p.toString();
  history.replaceState(null, '', location.pathname + (qs ? '?' + qs : ''));
}

function applyStateToForm() {
  els.q.value = state.q;
  els.type.value = state.type;
  els.min.value = state.min;
  els.max.value = state.max;
  els.sort.value = state.sort;
}

function rowHtml(item) {
  const soldOut = item.stock <= 0;
  const row = document.createElement('div');
  row.className = 's-row';
  row.innerHTML = `
    <div>
      <div class="s-row__name"></div>
      <div class="s-row__sub"></div>
    </div>
    <div style="display:flex;align-items:center;gap:12px">
      <span class="s-row__price"></span>
      <button class="s-row__buy" type="button"></button>
    </div>`;
  row.querySelector('.s-row__name').textContent = item.name;
  row.querySelector('.s-row__sub').textContent =
    `${item.type} · ${soldOut ? 'нет в наличии' : 'в наличии: ' + item.stock} · ${item.sku}`;
  row.querySelector('.s-row__price').textContent = `${item.price} ₽`;
  const buy = row.querySelector('.s-row__buy');
  buy.textContent = soldOut ? 'Раскуплено' : 'Купить';
  buy.disabled = soldOut;
  buy.addEventListener('click', () => buyNow(item.sku, buy));
  return row;
}

async function buyNow(sku, btn) {
  btn.disabled = true;
  btn.textContent = '...';
  try {
    const res = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ sku }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'fail');
    location.href = 'order.html?id=' + encodeURIComponent(data.order.id);
  } catch (e) {
    btn.textContent = e.message === 'out_of_stock' ? 'Раскуплено' : 'Ошибка';
  }
}

async function run({ append = false } = {}) {
  const mySeq = ++reqSeq;
  if (inflight) inflight.abort();
  inflight = new AbortController();

  const p = new URLSearchParams({ sort: state.sort, page: String(state.page), page_size: '20' });
  if (state.q) p.set('q', state.q);
  if (state.type) p.set('type', state.type);
  if (state.min !== '') p.set('min', state.min);
  if (state.max !== '') p.set('max', state.max);

  els.list.classList.add('is-loading');

  let data;
  try {
    const res = await fetch('/api/search?' + p.toString(), { signal: inflight.signal });
    data = await res.json();
  } catch (e) {
    if (e.name === 'AbortError') return; // более свежий запрос уже в пути
    els.meta.textContent = 'Ошибка поиска';
    els.list.classList.remove('is-loading');
    return;
  }

  // Устаревший ответ (пришёл позже более нового) — не трогаем DOM.
  if (mySeq !== reqSeq) return;

  els.list.classList.remove('is-loading');

  const frag = document.createDocumentFragment();
  for (const item of data.items) frag.append(rowHtml(item));

  if (append) els.list.append(frag);
  else els.list.replaceChildren(frag);

  els.meta.textContent = data.total
    ? `Найдено ${data.total} · страница ${data.page + 1} из ${data.pages}`
    : 'Ничего не найдено';
  if (!data.total && !append) {
    els.list.replaceChildren(Object.assign(document.createElement('div'), {
      className: 's-empty',
      textContent: 'По этим условиям ничего нет — измените запрос или фильтры',
    }));
  }

  els.moreWrap.replaceChildren();
  if (data.page + 1 < data.pages) {
    const more = document.createElement('button');
    more.className = 's-more';
    more.textContent = 'Показать ещё';
    more.addEventListener('click', () => {
      state.page += 1;
      writeUrl();
      run({ append: true });
    });
    els.moreWrap.append(more);
  }
}

function onFilterChange(fromInput) {
  state.q = els.q.value.trim();
  state.type = els.type.value;
  state.min = els.min.value;
  state.max = els.max.value;
  state.sort = els.sort.value;
  state.page = 0;
  writeUrl();

  if (fromInput) {
    clearTimeout(debounceT);
    debounceT = setTimeout(() => run(), 150);
  } else {
    run();
  }
}

async function loadTypes() {
  try {
    const { types } = await (await fetch('/api/catalog/types')).json();
    for (const t of types) {
      const o = document.createElement('option');
      o.value = t;
      o.textContent = t;
      els.type.append(o);
    }
  } catch {}
}

els.q.addEventListener('input', () => onFilterChange(true));
for (const el of [els.type, els.min, els.max, els.sort]) {
  el.addEventListener('change', () => onFilterChange(false));
}
window.addEventListener('popstate', () => {
  readUrl();
  applyStateToForm();
  run();
});

(async () => {
  readUrl();
  await loadTypes();
  applyStateToForm();
  run();
})();
