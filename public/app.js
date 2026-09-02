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

async function renderCards() {
  const data = await api('/api/catalog/products');
  products = data.products;
  $('#cards').innerHTML = products
    .slice(0, 5)
    .map((p) => {
      const old = Math.round(p.price * 1.5);
      return `<article class="card" data-sku="${p.sku}">
        <div class="card__media"><img alt="${p.name}" src="${PRODUCT_IMAGE}" loading="lazy" /></div>
        <div class="card__body">
          <div class="card__title">${p.name}</div>
          <div class="card__price"><b>${p.price} ₽</b><s>${old} ₽</s></div>
          <button class="card__buy">Купить</button>
        </div>
      </article>`;
    })
    .join('');

  $('#cards').addEventListener('click', (e) => {
    const buy = e.target.closest('.card__buy');
    if (!buy) return;
    const sku = e.target.closest('.card').dataset.sku;
    openBuy(sku);
  });
}

const modal = $('#modal');
const modalBody = $('#modalBody');
const closeModal = () => { modal.hidden = true; };
$('#modalClose').addEventListener('click', closeModal);
modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });

function openBuy(sku, presetPromo = '') {
  const product = products.find((p) => p.sku === sku);
  if (!product) return;
  modal.hidden = false;

  const idem = 'idem_' + crypto.randomUUID();
  let appliedPromo = null;

  const draw = (note = '') => {
    modalBody.innerHTML = `
      <h3>Оформление заказа</h3>
      <div class="m-row"><span>${product.name}</span><b>${product.price} ₽</b></div>
      <div class="m-promo">
        <input type="text" id="mPromo" placeholder="Промокод" value="${presetPromo}" />
        <button id="mPromoBtn">Применить</button>
      </div>
      <div class="m-note ${note.startsWith('OK') ? 'ok' : note ? 'err' : ''}" id="mNote">${note.replace(/^OK:? ?/, '')}</div>
      <div class="m-actions">
        <button class="btn-primary" id="mCreate">Создать заказ</button>
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
        drawPay(r.order);
      } catch (e) {
        $('#mCreate').disabled = false;
        draw(e.data?.error === 'promo_limit_reached' ? 'Лимит промокода исчерпан' : 'Не удалось создать заказ');
      }
    });
  };

  const drawPay = (order) => {
    modalBody.innerHTML = `
      <h3>Заказ ${order.id}</h3>
      <div class="m-row"><span>Товар</span><span>${order.sku}</span></div>
      <div class="m-row"><span>Скидка</span><span>-${order.discount} ₽</span></div>
      <div class="m-row"><span>К оплате</span><b>${order.amount} ${order.currency}</b></div>
      <p class="m-note">Реальной оплаты нет - это вебхук-заглушка по контракту.</p>
      <div class="m-actions">
        <button class="btn-primary" id="payOk">Оплатить - успех</button>
        <button class="btn-danger" id="payFail">Оплатить - неуспех</button>
      </div>`;

    const pay = async (result) => {
      $('#payOk').disabled = true;
      $('#payFail').disabled = true;
      await api('/api/pay/' + order.id, { method: 'POST', body: JSON.stringify({ result }) });
      location.href = 'order.html?id=' + encodeURIComponent(order.id);
    };
    $('#payOk').addEventListener('click', () => pay('success'));
    $('#payFail').addEventListener('click', () => pay('failed'));
  };

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
renderCards();
