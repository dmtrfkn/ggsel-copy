const API = '';

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

async function api(path, options) {
  const res = await fetch(API + path, {
    headers: { 'content-type': 'application/json' },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error || res.statusText), { data, status: res.status });
  return data;
}

const palette = ['#1b2838', '#229ed9', '#e2231a', '#f5a623', '#f09819', '#0a84ff', '#10a37f', '#0070d1', '#111111', '#4b6cb7', '#6d28d9', '#db2777'];
const colorFor = (i) => palette[i % palette.length];
const initial = (name) => (name.match(/[A-Za-zА-Яа-я0-9]/) || ['?'])[0].toUpperCase();

const PRODUCT_IMAGE = 'assets/pubg.avif';

const bannerSlides = [
  { title: 'Ключи и пополнения', text: 'Мгновенная автоматическая выдача', bg: 'linear-gradient(120deg, #1f2937, #0b1220)' },
  { title: 'Steam, PSN, Xbox', text: 'Гифт-карты и подписки со скидкой', bg: 'linear-gradient(120deg, #0f766e, #0b3b37)' },
  { title: 'CS2 Prime', text: 'Активация за секунды', bg: 'linear-gradient(120deg, #7c2d12, #2a0f06)' },
  { title: 'Discord Nitro', text: 'Подписка на 1 месяц', bg: 'linear-gradient(120deg, #4338ca, #221f5c)' },
  { title: 'Промокоды', text: 'WELCOME10 даёт минус 10%', bg: 'linear-gradient(120deg, #155e75, #06232e)' },
];

function toast(message) {
  let el = $('#toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'toast';
    el.className = 'toast';
    document.body.appendChild(el);
  }
  el.textContent = message;
  el.classList.add('show');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => el.classList.remove('show'), 2200);
}

const services = ['Steam', 'Telegram', 'Roblox', 'Brawl Stars', 'PUBG Mob..', 'App Store', 'ChatGPT', 'PlaySt..', 'TikTok', 'Mobile Leg..'];

const catalogColumns = [
  { title: 'Steam', items: ['Игры и DLC', 'Пополнение баланса', 'Подарочные карты', 'Коллекционные карточки', 'Смена региона'] },
  { title: 'PlayStation', items: ['Игры и DLC', 'Пополнение баланса', 'Новые аккаунты', 'PS Plus', 'EA Play'] },
  { title: 'Xbox', items: ['Игры и DLC', 'Пополнение баланса', 'Новые аккаунты', 'Xbox Game Pass', 'Услуги'] },
  { title: 'Nintendo', items: ['Игры и DLC', 'Подарочные карты', 'Новые аккаунты', 'NS Online'] },
  { title: 'Battle.net', items: ['World of Warcraft', 'Подарочные карты', 'Прямое пополнение', 'Новые аккаунты', 'Смена региона'] },
];

const chips = [
  { name: 'Донат', icon: '🎁', active: true },
  { name: 'Подписки', icon: '🔁' },
  { name: 'Предметы', icon: '🎽' },
  { name: 'Аккаунты', icon: '👤' },
  { name: 'Ключи', icon: '🔑' },
  { name: 'Игровая валюта', icon: '💎' },
  { name: 'Другое', icon: '🗂' },
];

function renderBanner() {
  const track = $('#bannerTrack');
  const dots = $('#bannerDots');
  track.innerHTML = bannerSlides
    .map((s) => `<div class="banner__slide" style="background:${s.bg}"><div><h3>${s.title}</h3><p>${s.text}</p></div></div>`)
    .join('');
  dots.innerHTML = bannerSlides.map((_, i) => `<span data-i="${i}"></span>`).join('');

  let index = 0;
  let timer = null;

  const go = (i) => {
    index = (i + bannerSlides.length) % bannerSlides.length;
    track.style.transform = `translateX(-${index * 100}%)`;
    $$('#bannerDots span').forEach((d, di) => d.classList.toggle('is-active', di === index));
  };
  const start = () => { timer = setInterval(() => go(index + 1), 4000); };
  const stop = () => clearInterval(timer);

  $('#bannerNext').addEventListener('click', () => { go(index + 1); stop(); start(); });
  $('#bannerPrev').addEventListener('click', () => { go(index - 1); stop(); start(); });
  dots.addEventListener('click', (e) => {
    const t = e.target.closest('span');
    if (!t) return;
    go(Number(t.dataset.i));
    stop();
    start();
  });
  $('#banner').addEventListener('mouseenter', stop);
  $('#banner').addEventListener('mouseleave', start);

  go(0);
  start();
}

function renderCatalogMenu() {
  const col = (title, items) =>
    `<div class="mm-col"><h4>${title} <span class="soon">скоро</span></h4>${items
      .map((i) => `<a href="#" data-soon>${i}</a>`)
      .join('')}</div>`;

  $('#catalogCols').innerHTML =
    catalogColumns.map((c) => col(c.title, c.items)).join('') +
    col('Подборки', ['Скидки 90%', 'Популярные издатели', 'Лучшие серии игр', 'Steam Deck', 'Bundle-наборы']);

  const btn = $('#catalogBtn');
  const menu = $('#catalogMenu');

  const setOpen = (open) => {
    menu.hidden = !open;
    btn.setAttribute('aria-expanded', String(open));
  };

  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    setOpen(menu.hidden);
  });
  document.addEventListener('click', (e) => {
    if (!menu.hidden && !menu.contains(e.target) && e.target !== btn) setOpen(false);
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') setOpen(false);
  });

  menu.addEventListener('click', (e) => {
    const target = e.target.closest('a[data-soon], .catalog-menu__side li:not(.is-active)');
    if (!target) return;
    e.preventDefault();
    toast('Раздел в разработке, скоро откроется');
  });
}

function renderServices() {
  const el = $('#services');
  el.innerHTML =
    services
      .map(
        (name, i) =>
          `<div class="service"><div class="service__ico" style="background:${colorFor(i)}">${initial(name)}</div><div class="service__name">${name}</div></div>`
      )
      .join('') +
    `<div class="service"><div class="service__ico service__ico--more">·</div><div class="service__name service__name--link">еще 841</div></div>`;
}

function renderCurrency() {
  $('#currency').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    $$('#currency button').forEach((x) => x.classList.toggle('is-active', x === b));
  });
}

function renderChips() {
  $('#chips').innerHTML = chips
    .map(
      (c) => `<button class="chip${c.active ? ' is-active' : ''}"><span>${c.icon}</span>${c.name}</button>`
    )
    .join('');
  $('#chips').addEventListener('click', (e) => {
    const b = e.target.closest('.chip');
    if (!b) return;
    $$('#chips .chip').forEach((x) => x.classList.toggle('is-active', x === b));
  });
}

function renderPromoBox() {
  $('#promoToggle').addEventListener('click', () => {
    $('#promoBox').hidden = !$('#promoBox').hidden;
  });
  $('#promoApply').addEventListener('click', async () => {
    const code = $('#promoInput').value.trim();
    const out = $('#promoResult');
    if (!code) return;
    try {
      const r = await api('/api/orders/preview-promo', {
        method: 'POST',
        body: JSON.stringify({ sku: 'STEAM-TOPUP-500', code }),
      });
      if (r.valid) {
        out.textContent = `-${r.discount} ₽, к оплате ${r.payable} ₽, осталось применений: ${r.remaining}`;
        out.className = 'topup__promo-result ok';
      } else {
        out.textContent = r.reason === 'limit_reached' ? 'Лимит промокода исчерпан' : 'Промокод не найден';
        out.className = 'topup__promo-result err';
      }
    } catch (e) {
      out.textContent = 'Ошибка проверки промокода';
      out.className = 'topup__promo-result err';
    }
  });
}

let products = [];

function cardHtml(p) {
  const old = Math.round(p.price * 1.5);
  const soldOut = p.stock <= 0;
  const low = !soldOut && p.stock <= 5;
  const stockClass = soldOut ? 'is-out' : low ? 'is-low' : '';
  const stockText = soldOut ? 'Нет в наличии' : `В наличии: ${p.stock}`;
  return `<article class="card" data-sku="${p.sku}">
    <div class="card__media"><img alt="${p.name}" src="${PRODUCT_IMAGE}" loading="lazy" /></div>
    <div class="card__body">
      <div class="card__title">${p.name}</div>
      <div class="card__price"><b>${p.price} ₽</b><s>${old} ₽</s></div>
      <div class="card__stock ${stockClass}">${stockText}</div>
      <button class="card__buy" ${soldOut ? 'disabled' : ''}>${soldOut ? 'Раскуплено' : 'Купить'}</button>
    </div>
  </article>`;
}

let visibleSkus = [];

async function renderCards() {
  const data = await api('/api/catalog/products');
  products = data.products;
  visibleSkus = products.slice(0, 5).map((p) => p.sku);
  $('#cards').innerHTML = products.slice(0, 5).map(cardHtml).join('');
}

$('#cards').addEventListener('click', (e) => {
  const buy = e.target.closest('.card__buy');
  if (!buy || buy.disabled) return;
  openBuy(e.target.closest('.card').dataset.sku);
});

function patchCard(p) {
  const card = $(`.card[data-sku="${p.sku}"]`);
  if (card) card.outerHTML = cardHtml(p);
}

function applyProductUpdate({ sku, price, stock }) {
  const p = products.find((x) => x.sku === sku);
  if (!p) return;
  if (price != null) p.price = price;
  if (stock != null) p.stock = stock;
  if (visibleSkus.includes(sku)) patchCard(p);
  onProductUpdateForModal(p);
}

let onProductUpdateForModal = () => {};

function setConn(state) {
  let dot = $('#connDot');
  if (!dot) {
    dot = document.createElement('div');
    dot.id = 'connDot';
    document.body.appendChild(dot);
  }
  dot.className = 'conn-dot conn-dot--' + state;
  dot.textContent = state === 'live' ? 'обновления в реальном времени' : 'переподключение...';
  dot.hidden = false;
  if (state === 'live') {
    clearTimeout(setConn._t);
    setConn._t = setTimeout(() => { dot.hidden = true; }, 2000);
  }
}

function connectStream() {
  let everOpen = false;
  const es = new EventSource('/api/stream');

  es.addEventListener('product.updated', (e) => {
    try { applyProductUpdate(JSON.parse(e.data)); } catch {}
  });

  es.onopen = () => {
    setConn('live');
    if (everOpen) resyncCatalog();
    everOpen = true;
  };

  es.onerror = () => setConn('reconnecting');
}

async function resyncCatalog() {
  try {
    const data = await api('/api/catalog/products');
    products = data.products;
    for (const p of products) {
      if (visibleSkus.includes(p.sku)) patchCard(p);
      onProductUpdateForModal(p);
    }
  } catch {}
}

const PENDING_KEY = 'ggsel_pending';
const TERMINAL = new Set(['delivered', 'payment_failed', 'expired']);
const getPending = () => {
  try {
    return JSON.parse(localStorage.getItem(PENDING_KEY) || 'null');
  } catch {
    return null;
  }
};
const setPending = (o) => {
  try {
    localStorage.setItem(PENDING_KEY, JSON.stringify(o));
  } catch {}
};
const clearPending = () => {
  try {
    localStorage.removeItem(PENDING_KEY);
  } catch {}
};

async function renderResumeBar() {
  const pending = getPending();
  if (!pending?.id) return;
  let order;
  try {
    order = (await api('/api/orders/' + encodeURIComponent(pending.id))).order;
  } catch {
    return clearPending();
  }
  if (TERMINAL.has(order.status)) return clearPending();

  let bar = $('#resumeBar');
  if (!bar) {
    bar = document.createElement('div');
    bar.id = 'resumeBar';
    bar.className = 'resume-bar';
    $('.page').prepend(bar);
  }
  const paid = order.status !== 'created';
  bar.innerHTML = `
    <span>${paid ? 'Заказ оплачен, идёт выдача' : 'Незавершённый заказ'}: <b>${order.sku}</b> (${order.id})</span>
    <span class="resume-bar__actions">
      <button id="resumeGo">${paid ? 'Открыть статус' : 'Продолжить оплату'}</button>
      <button id="resumeDrop" class="ghost">Скрыть</button>
    </span>`;
  $('#resumeGo').addEventListener('click', () => {
    if (paid) location.href = 'order.html?id=' + encodeURIComponent(order.id);
    else openBuy(order.sku);
  });
  $('#resumeDrop').addEventListener('click', () => {
    clearPending();
    bar.remove();
  });
}

const modal = $('#modal');
const modalBody = $('#modalBody');
let modalTimer = null;
const clearModalTimer = () => {
  if (modalTimer) clearInterval(modalTimer);
  modalTimer = null;
};
const closeModal = () => {
  modal.hidden = true;
  onProductUpdateForModal = () => {};
  clearModalTimer();
};
$('#modalClose').addEventListener('click', closeModal);
modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });

async function openBuy(sku, presetPromo = '') {
  const product = products.find((p) => p.sku === sku);
  if (!product) return;
  modal.hidden = false;

  const idem = 'idem_' + crypto.randomUUID();
  let appliedPromo = null;
  let stage = 'draw';
  let shownPrice = product.price;
  let priceNote = '';
  const cur = () => products.find((p) => p.sku === sku) || product;

  const draw = (note = '') => {
    const p = cur();
    shownPrice = p.price;
    const soldOut = p.stock <= 0;
    modalBody.innerHTML = `
      <h3>Оформление заказа</h3>
      <div class="m-row"><span>${p.name}</span><b>${p.price} ₽</b></div>
      ${priceNote ? `<div class="m-note warn">${priceNote}</div>` : ''}
      <div class="m-promo">
        <input type="text" id="mPromo" placeholder="Промокод" value="${presetPromo}" />
        <button id="mPromoBtn">Применить</button>
      </div>
      <div class="m-note ${note.startsWith('OK') ? 'ok' : note ? 'err' : ''}" id="mNote">${note.replace(/^OK:? ?/, '')}</div>
      <div class="m-actions">
        <button class="btn-primary" id="mCreate" ${soldOut ? 'disabled' : ''}>${soldOut ? 'Раскуплено' : 'Создать заказ'}</button>
      </div>`;

    $('#mPromoBtn').addEventListener('click', async () => {
      const code = $('#mPromo').value.trim();
      if (!code) return;
      try {
        const r = await api('/api/orders/preview-promo', {
          method: 'POST',
          body: JSON.stringify({ sku, code }),
        });
        if (r.valid) {
          appliedPromo = code;
          draw(`OK: скидка -${r.discount} ₽, к оплате ${r.payable} ₽ (осталось ${r.remaining})`);
        } else {
          appliedPromo = null;
          draw(r.reason === 'limit_reached' ? 'Лимит промокода исчерпан' : 'Промокод не найден');
        }
      } catch {
        draw('Ошибка проверки промокода');
      }
    });

    $('#mCreate').addEventListener('click', async () => {
      $('#mCreate').disabled = true;
      try {
        const r = await api('/api/orders', {
          method: 'POST',
          body: JSON.stringify({ sku, idempotency_key: idem, promo_code: appliedPromo || undefined }),
        });
        setPending({ id: r.order.id, sku });
        drawPay(r.order);
      } catch (e) {
        if (e.data?.error === 'out_of_stock') {
          const p = products.find((x) => x.sku === sku);
          if (p) {
            p.stock = 0;
            if (visibleSkus.includes(sku)) patchCard(p);
          }
          drawSoldOut(e.data);
          return;
        }
        $('#mCreate').disabled = false;
        draw(e.data?.error === 'promo_limit_reached' ? 'Лимит промокода исчерпан' : 'Не удалось создать заказ');
      }
    });
  };

  const drawSoldOut = (data) => {
    stage = 'lost';
    const alts = data?.alternatives || [];
    modalBody.innerHTML = `
      <h3>Не получилось</h3>
      <div class="m-note warn">${data?.message || 'Этот товар только что раскупили'}. Последнюю единицу оформили за секунду до вас — оплата с вас не списана.</div>
      ${
        alts.length
          ? `<p class="m-note">Есть в наличии:</p><div class="alt-list">${alts
              .map((a) => `<button class="alt" data-sku="${a.sku}">${a.name} - ${a.price} ₽</button>`)
              .join('')}</div>`
          : ''
      }
      <div class="m-actions">
        <button class="btn-primary" id="backCatalog">Вернуться к каталогу</button>
      </div>`;
    $('#backCatalog').addEventListener('click', closeModal);
    modalBody.querySelectorAll('.alt').forEach((b) =>
      b.addEventListener('click', () => openBuy(b.dataset.sku))
    );
  };

  const drawExpired = () => {
    stage = 'lost';
    clearModalTimer();
    clearPending();
    modalBody.innerHTML = `
      <h3>Бронь истекла</h3>
      <div class="m-note warn">Время на оплату вышло, бронь снята и товар вернулся в продажу. Оплата не списана.</div>
      <div class="m-actions">
        <button class="btn-primary" id="backCatalog">Вернуться к каталогу</button>
      </div>`;
    $('#backCatalog').addEventListener('click', closeModal);
  };

  const drawPay = (order) => {
    stage = 'pay';
    clearModalTimer();
    const raised = order.base_amount > shownPrice;
    const until = order.reserved_until ? Date.parse(order.reserved_until) : 0;
    modalBody.innerHTML = `
      <h3>Заказ ${order.id}</h3>
      <div class="m-row"><span>Товар</span><span>${order.sku}</span></div>
      <div class="m-row"><span>Цена</span><span>${order.base_amount} ₽</span></div>
      <div class="m-row"><span>Скидка</span><span>-${order.discount} ₽</span></div>
      <div class="m-row"><span>К оплате</span><b>${order.amount} ${order.currency}</b></div>
      ${raised ? `<div class="m-note warn">Учтена актуальная цена ${order.base_amount} ₽ (на витрине было ${shownPrice} ₽). Сумма заказа зафиксирована.</div>` : ''}
      ${until ? `<div class="m-timer" id="resTimer"></div>` : ''}
      <p class="m-note">Сумма зафиксирована в заказе, дальнейшие изменения цены на него не влияют. Реальной оплаты нет - вебхук-заглушка по контракту.</p>
      <div class="m-actions">
        <button class="btn-primary" id="payOk">Оплатить - успех</button>
        <button class="btn-danger" id="payFail">Оплатить - неуспех</button>
      </div>`;

    const pay = async (result) => {
      $('#payOk').disabled = true;
      $('#payFail').disabled = true;
      clearModalTimer();
      try {
        await api('/api/pay/' + order.id, { method: 'POST', body: JSON.stringify({ result }) });
      } catch (e) {
        if (e.data?.error === 'reservation_expired') return drawExpired();
        if (!$('#payErr')) {
          modalBody.insertAdjacentHTML(
            'beforeend',
            `<div class="m-note err" id="payErr">Связь прервалась. Заказ мог быть оплачен — <a href="order.html?id=${encodeURIComponent(order.id)}">откройте статус заказа</a>. Повторное нажатие «Оплатить» ничего не задвоит.</div>`
          );
        }
        $('#payOk').disabled = false;
        $('#payFail').disabled = false;
        return;
      }
      location.href = 'order.html?id=' + encodeURIComponent(order.id);
    };
    $('#payOk').addEventListener('click', () => pay('success'));
    $('#payFail').addEventListener('click', () => pay('failed'));

    if (until) {
      const tick = () => {
        const t = $('#resTimer');
        if (!t) return clearModalTimer();
        const ms = until - Date.now();
        if (ms <= 0) return drawExpired();
        const s = Math.ceil(ms / 1000);
        t.textContent = `Бронь снята через ${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
        t.classList.toggle('is-soon', ms <= 30000);
      };
      tick();
      modalTimer = setInterval(tick, 1000);
    }
  };

  onProductUpdateForModal = (p) => {
    if (p.sku !== sku || stage !== 'draw') return;
    if (p.price !== shownPrice) {
      priceNote =
        p.price > shownPrice
          ? `Товар подорожал: было ${shownPrice} ₽, стало ${p.price} ₽`
          : `Цена снизилась: было ${shownPrice} ₽, стало ${p.price} ₽`;
    }
    draw();
  };

  const pending = getPending();
  if (pending?.id && pending.sku === sku) {
    try {
      const order = (await api('/api/orders/' + encodeURIComponent(pending.id))).order;
      if (order.status === 'created') return drawPay(order);
      if (!TERMINAL.has(order.status)) {
        return void (location.href = 'order.html?id=' + encodeURIComponent(order.id));
      }
      clearPending();
    } catch {
      clearPending();
    }
  }

  draw();
}

$('#topupPay').addEventListener('click', () => {
  openBuy('STEAM-TOPUP-500', $('#promoInput').value.trim());
});

renderBanner();
renderCatalogMenu();
renderServices();
renderCurrency();
renderChips();
renderPromoBox();
const headerSearch = $('.search__input');
const goSearch = () => {
  const v = headerSearch.value.trim();
  location.href = 'search.html' + (v ? '?q=' + encodeURIComponent(v) : '');
};
$('.search__go')?.addEventListener('click', goSearch);
headerSearch?.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') goSearch();
});

renderCards().then(connectStream);
renderResumeBar();
