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

const svg = (body, w = 64, h = 64) =>
  `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}">${body}</svg>`)}`;

const appIcon = (bg, inner) =>
  svg(`<rect width="64" height="64" rx="15" fill="${bg}"/>${inner}`);

const serviceIcons = {
  Steam: appIcon(
    '#1b2838',
    '<circle cx="28" cy="36" r="12" fill="none" stroke="#fff" stroke-width="3"/><circle cx="41" cy="22" r="7" fill="#fff"/><line x1="15" y1="47" x2="30" y2="37" stroke="#fff" stroke-width="3"/>'
  ),
  Telegram: appIcon('#29a9eb', '<path d="M14 33 L50 18 L44 48 L33 40 L27 46 L26 36 Z" fill="#fff"/>'),
  Roblox: appIcon('#f4f4f4', '<rect x="20" y="20" width="24" height="24" rx="3" transform="rotate(12 32 32)" fill="#1b1b1b"/><rect x="28" y="28" width="8" height="8" fill="#f4f4f4"/>'),
  'Brawl Stars': appIcon('#ffb300', '<path d="M32 14 L38 27 L52 28 L41 37 L45 51 L32 43 L19 51 L23 37 L12 28 L26 27 Z" fill="#fff"/>'),
  'PUBG Mob..': appIcon('#2b2b2b', '<text x="32" y="38" text-anchor="middle" font-family="Arial Black, Arial" font-weight="900" font-size="16" fill="#f2c200">PUBG</text>'),
  'App Store': appIcon('#1e7bf0', '<text x="32" y="42" text-anchor="middle" font-family="Arial" font-size="30" fill="#fff">&#63743;</text><path d="M20 44 L32 22 L44 44" stroke="#fff" stroke-width="4" fill="none" stroke-linecap="round"/><line x1="26" y1="40" x2="40" y2="40" stroke="#1e7bf0" stroke-width="4"/>'),
  ChatGPT: appIcon('#ffffff', '<circle cx="32" cy="32" r="16" fill="none" stroke="#10a37f" stroke-width="4"/><path d="M32 20 L32 32 L42 38" stroke="#10a37f" stroke-width="4" fill="none" stroke-linecap="round"/>'),
  'PlaySt..': appIcon('#0070d1', '<text x="32" y="42" text-anchor="middle" font-family="Arial Black, Arial" font-weight="900" font-size="22" fill="#fff">PS</text>'),
  TikTok: appIcon('#111', '<path d="M34 16 v22 a8 8 0 1 1 -8 -8" fill="none" stroke="#fff" stroke-width="4"/><path d="M34 16 c2 6 7 9 12 9" fill="none" stroke="#25f4ee" stroke-width="4"/>'),
  'Mobile Leg..': appIcon('#1b4db3', '<text x="32" y="39" text-anchor="middle" font-family="Arial Black, Arial" font-weight="900" font-size="17" fill="#ff9f1c">5v5</text>'),
};

const moreIcon = svg(
  '<circle cx="32" cy="32" r="30" fill="#e7e9ec"/><ellipse cx="32" cy="34" rx="14" ry="6" fill="#9aa0a6"/><ellipse cx="32" cy="28" rx="8" ry="7" fill="#c3c7cc"/>'
);

function gamePoster() {
  return svg(
    `<defs><linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#d8b483"/><stop offset="1" stop-color="#8a6a41"/></linearGradient></defs>
     <rect width="320" height="200" fill="url(#bg)"/>
     <g fill="#3a2f21" opacity="0.9">
       <ellipse cx="150" cy="62" rx="19" ry="21"/>
       <rect x="122" y="80" width="64" height="66" rx="12"/>
       <rect x="92" y="86" width="120" height="13" rx="6" transform="rotate(-12 152 92)"/>
       <rect x="180" y="96" width="44" height="9" rx="4" transform="rotate(-12 202 100)"/>
     </g>
     <rect x="0" y="150" width="320" height="50" fill="#0f0f0f" opacity="0.92"/>
     <text x="160" y="146" text-anchor="middle" font-family="Arial" font-size="8" fill="#e9e9e9" letter-spacing="3">PLAYERUNKNOWN'S</text>
     <text x="160" y="183" text-anchor="middle" font-family="Arial Black, Arial" font-weight="900" font-size="25" fill="#f2c200">BATTLEGROUNDS</text>`,
    320,
    200
  );
}

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

const services = Object.keys(serviceIcons);

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
        (name) =>
          `<div class="service"><div class="service__ico"><img alt="${name}" src="${serviceIcons[name]}" /></div><div class="service__name">${name}</div></div>`
      )
      .join('') +
    `<div class="service"><div class="service__ico"><img alt="еще" src="${moreIcon}" /></div><div class="service__name service__name--link">еще 841</div></div>`;
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
  const poster = gamePoster();
  $('#cards').innerHTML = products
    .slice(0, 5)
    .map((p) => {
      const old = Math.round(p.price * 1.5);
      return `<article class="card" data-sku="${p.sku}">
        <img class="card__img" alt="${p.name}" src="${poster}" />
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
