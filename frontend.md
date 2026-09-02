# Frontend - построчный разбор

Чистый HTML/CSS/JS, без сборки и фреймворков. Три страницы:
`public/index.html` (витрина), `public/order.html` (статус заказа),
`public/admin.html` (админка). Вся логика витрины - в `public/app.js`.

По ТЗ вёрстка нужна «структурно близко к макету», пиксель-в-пиксель не требуется.
Обязательны 5 интерактивов - они помечены ниже как **[Интерактив N]**.

---

## 1. `public/index.html` - разметка витрины

Порядок блоков повторяет макет (второй скриншот из задания).

### Шапка `<header class="header">`
- `button#catalogBtn` - кнопка «Каталог», `aria-haspopup`, `aria-expanded` переключается из JS.
- `.search` - поле поиска с инлайн-SVG иконками «сердце» и «лупа» (некликабельны, как в макете).
- `button.account` - инлайн-SVG иконка профиля (заглушка).
- `.catalog-menu#catalogMenu` с атрибутом `hidden` - выпадающее мега-меню. Левая
  колонка `.catalog-menu__side` (разделы), правая `#catalogCols` - колонки брендов,
  наполняются из JS.

### Баннер `<section class="banner" id="banner">`
- `#bannerTrack` - лента слайдов (флекс-строка, сдвигается через `transform`).
- `#bannerPrev` / `#bannerNext` - стрелки.
- `#bannerDots` - точки-индикаторы.

### Иконки сервисов `<section class="services" id="services">`
Пустой контейнер, плитки создаёт JS.

### Блок пополнения Steam `<section class="topup">`
- `.topup__brand` - логотип, заголовок «Пополнение Steam», бейдж `5%`,
  кнопка `#promoToggle` («Ввести промокод»).
- `.topup__field` - поле «Логин Steam» (не функционально, как в макете) + иконка `i`.
- `.topup__amount` - «Сумма 500 ₽» и переключатель валют `#currency` с тремя кнопками
  `$` / `₸` / `₽` (у `$` изначально класс `is-active`).
- `#topupPay` - кнопка «Оплатить 500$».
- `.topup__promo#promoBox` (`hidden`) - раскрываемое поле промокода: `#promoInput`,
  `#promoApply`, `#promoResult`.

### Каталог товаров `<section class="catalog">`
- Заголовок «Популярные товары» + контейнер `#chips`, чипсы-фильтры рендерит JS
  (переключение активного чипса работает, самой фильтрации нет - по ТЗ достаточно).
- `.cards#cards` - сетка карточек, наполняется из JS.

### Модалка `<div class="modal" id="modal" hidden>`
- `.modal__box` с `#modalClose` и контейнером `#modalBody`, куда JS рисует шаги
  оформления заказа и эмуляции оплаты.

---

## 2. `public/styles.css` - ключевые места

```css
[hidden] { display: none !important; }
```
Важная строка. У `.modal` и `.topup__promo` в CSS стоит `display: flex`, который по
специфичности перебил бы атрибут `hidden`. Это правило возвращает `hidden` силу -
скрытые элементы действительно скрыты, пока JS не снимет атрибут.

**Переменные темы** в `:root` - цвета, радиусы, тени. Одна светлая тема (тёмная по ТЗ
не нужна).

**[Интерактив 4] Иконки сервисов:**
```css
.service { transition: transform .18s ease, box-shadow .18s ease; }
.service:hover { transform: translateY(-4px); box-shadow: var(--shadow-hover); }
.service:hover .service__ico img { filter: brightness(1.08) saturate(1.12); transform: scale(1.06); }
```
Плавное выделение при наведении - целиком на CSS-переходах.

**[Интерактив 5] Карточки товара:**
```css
.card { border: 1px solid transparent;
        transition: transform .18s ease, box-shadow .18s ease, border-color .18s ease; }
.card:hover { transform: translateY(-6px); box-shadow: var(--shadow-hover); border-color: #d9dbdf; }
```
Подъём + тень + обводка при наведении, тоже чистый CSS.

**Переключатель валют** - активное состояние:
```css
.currency button.is-active { background: var(--accent); color: #fff; }
```

**Баннер** - сдвиг ленты:
```css
.banner__track { display: flex; transition: transform .5s ease; }
.banner__slide { min-width: 100%; }
.banner__dots span.is-active { background: #fff; }
```

Внизу файла - `@media (max-width: 1000px)` с перестройкой сеток (не обязательно по ТЗ,
но чтобы не разваливалось на узком экране).

---

## 3. `public/app.js` - логика витрины

### Хелперы
```js
const API = '';                       // тот же origin
const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

async function api(path, options) {
  const res = await fetch(API + path, { headers: { 'content-type': 'application/json' }, ...options });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error || res.statusText), { data, status: res.status });
  return data;
}
```
`api()` - обёртка над `fetch`: всегда JSON, при не-2xx кидает ошибку с `.data` и `.status`.

```js
const svg = (body, w, h) => `data:image/svg+xml,${encodeURIComponent('<svg ...>' + body + '</svg>')}`;
const appIcon = (bg, inner) => svg(`<rect ... rx="15" fill="${bg}"/>${inner}`);
function gamePoster() { return svg(`... BATTLEGROUNDS ...`, 320, 200); }
```
Все картинки рисуются инлайновым SVG и подставляются как `data:`-URL, файлов-ассетов
нет (CSP это не задевает, наполнение по ТЗ не оценивается).
- `serviceIcons` - словарь бренд-иконок сервисов (Steam, Telegram, TikTok и т.д.):
  скруглённый квадрат брендового цвета + простой глиф.
- `gamePoster()` - постер в стиле «PLAYERUNKNOWN'S BATTLEGROUNDS», один на все карточки
  (в макете арт на карточках одинаковый).
- `toast(message)` - всплывающее уведомление внизу экрана (используется для
  нереализованных разделов каталога).

### Данные (константы в файле)
`bannerSlides` - 5 слайдов (заголовок, текст, градиент фона).
`services` - `Object.keys(serviceIcons)`, подписи под иконками.
`catalogColumns` - структура мега-меню (Steam / PlayStation / Xbox / Nintendo / Battle.net).
`chips` - фильтры над карточками (название + эмодзи-иконка), рендерятся в `#chips`.

### [Интерактив 1] Баннер-карусель - `renderBanner()`
```js
const go = (i) => {
  index = (i + bannerSlides.length) % bannerSlides.length;      // зациклить
  track.style.transform = `translateX(-${index * 100}%)`;        // сдвиг ленты
  $$('#bannerDots span').forEach((d, di) => d.classList.toggle('is-active', di === index));
};
const start = () => { timer = setInterval(() => go(index + 1), 4000); };  // автопрокрутка
const stop  = () => clearInterval(timer);
```
- Стрелки `#bannerNext` / `#bannerPrev` вызывают `go(index ± 1)` и перезапускают таймер.
- Клик по точке - `go(Number(t.dataset.i))`.
- `mouseenter` на баннере - `stop()`, `mouseleave` - `start()` (пауза на наведении).
- В конце `go(0); start();` - стартовое состояние + запуск автопрокрутки.

Итог: переключение автоматически **и** стрелками, активная точка подсвечена.

### [Интерактив 2] Меню «Каталог» - `renderCatalogMenu()`
Сначала наполняет `#catalogCols` колонками из `catalogColumns` + колонка «Подборки».
Затем логика открытия/закрытия:
```js
const setOpen = (open) => {
  menu.hidden = !open;
  btn.setAttribute('aria-expanded', String(open));
};
btn.addEventListener('click', (e) => { e.stopPropagation(); setOpen(menu.hidden); });   // тоггл
document.addEventListener('click', (e) => {                                             // клик вне
  if (!menu.hidden && !menu.contains(e.target) && e.target !== btn) setOpen(false);
});
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') setOpen(false); });
```
- Клик по кнопке - переключает (`setOpen(menu.hidden)`): повторный клик закрывает.
- `e.stopPropagation()` не даёт этому же клику сразу попасть в обработчик «клик вне».
- Клик в любом месте вне меню и не по кнопке - закрывает.
- `Escape` - закрывает.
- Нереализованные разделы и колонки помечены бейджем «скоро»; клик по любой такой
  ссылке перехватывается (`e.preventDefault()`) и показывает `toast(...)` вместо
  перехода в никуда.

### [Интерактив 3] Переключатель валют - `renderCurrency()`
```js
$('#currency').addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  $$('#currency button').forEach((x) => x.classList.toggle('is-active', x === b));
});
```
Клик по `$` / `₸` / `₽` снимает `is-active` со всех и вешает на нажатую. Пересчёта
суммы **нет** - по ТЗ это только отображение (рассинхрон валют в макете - заглушка).

### Блок промокода в шапке Steam - `renderPromoBox()`
- `#promoToggle` показывает/прячет `#promoBox`.
- `#promoApply` шлёт `POST /api/orders/preview-promo { sku: 'STEAM-TOPUP-500', code }`
  и выводит `-N ₽, к оплате M ₽, осталось применений: K` (зелёным) либо ошибку
  «Лимит промокода исчерпан» / «Промокод не найден» (красным).
- Скидку и остаток считает **сервер**, фронт только показывает ответ.

### Карточки товара - `renderCards()`
```js
const data = await api('/api/catalog/products');
products = data.products;
$('#cards').innerHTML = products.slice(0, 5).map((p) => `<article class="card" data-sku="${p.sku}"> ... Купить ...`).join('');
$('#cards').addEventListener('click', (e) => {
  const buy = e.target.closest('.card__buy');
  if (!buy) return;
  openBuy(e.target.closest('.card').dataset.sku);
});
```
Товары берутся из API. У каждой карточки - цена (зелёным), «старая» цена зачёркнута
(чисто визуально, `price * 1.5`), кнопка **Купить**. Делегированный обработчик по
`#cards` ловит клик и открывает модалку для нужного `sku`. `[Интерактив 5]` (ховер) -
на CSS.

### Флоу покупки - `openBuy(sku, presetPromo)`
Открывает модалку. Один `idempotency_key` на всё открытие модалки:
```js
const idem = 'idem_' + crypto.randomUUID();
```

**Шаг 1 - `draw(note)`**: показывает товар, поле промокода, кнопку «Создать заказ».
- «Применить» -> `POST /api/orders/preview-promo` -> если валиден, запоминает
  `appliedPromo = code` и перерисовывает с текстом скидки; иначе сбрасывает.
- «Создать заказ» -> `POST /api/orders { sku, idempotency_key: idem, promo_code: appliedPromo }`.
  Кнопка сразу `disabled` - плюс к тому, что сервер всё равно идемпотентен по `idem`
  (защита от двойного клика). При `promo_limit_reached` показывает ошибку.

**Шаг 2 - `drawPay(order)`**: показывает `order.id`, скидку, «К оплате», и две кнопки:
```js
const pay = async (result) => {
  $('#payOk').disabled = true; $('#payFail').disabled = true;
  await api('/api/pay/' + order.id, { method: 'POST', body: JSON.stringify({ result }) });
  location.href = 'order.html?id=' + encodeURIComponent(order.id);
};
$('#payOk').addEventListener('click',   () => pay('success'));
$('#payFail').addEventListener('click', () => pay('failed'));
```
«Оплатить - успех/неуспех» дёргает эмуляцию оплаты (`/api/pay/:id`), которая на
бэке шлёт вебхук по контракту, и уводит на страницу статуса.

### Кнопка «Оплатить 500$» в блоке Steam
```js
$('#topupPay').addEventListener('click', () => openBuy('STEAM-TOPUP-500', $('#promoInput').value.trim()));
```
Тот же флоу, но для `STEAM-TOPUP-500` и с промокодом из блока Steam - так этап 4
проходится через UI целиком.

### `renderServices()` / `renderChips()`
Строят ряд иконок сервисов (бренд-иконка + подпись, последняя плитка «еще 841») и
ряд чипсов-фильтров в `#chips`. У чипсов клик переключает активный класс.

### Инициализация (низ файла)
```js
renderBanner(); renderCatalogMenu(); renderServices();
renderCurrency(); renderChips(); renderPromoBox(); renderCards();
```

---

## 4. `public/order.html` + `public/order.js` - страница статуса

Разметка: заголовок с `#oid`, бейдж статуса `#badge`, блок `#content`, список шагов
`#steps` (created -> paid -> delivering -> delivered).

`order.js`:
```js
const id = new URLSearchParams(location.search).get('id');
```
Берёт `id` из query-строки.

```js
async function tick() {
  const res = await fetch('/api/orders/' + encodeURIComponent(id));
  const data = await res.json();
  const o = data.order;

  badge.textContent = labels[o.status] || o.status;
  badge.className = 'badge b-' + o.status;                  // цвет по статусу

  const reached = order.indexOf(o.status);
  document.querySelectorAll('#steps li').forEach((li) => {
    li.classList.toggle('done', reached >= 0 && order.indexOf(li.dataset.s) <= reached);
  });

  if (o.status === 'delivered' && o.delivery) { /* показать ключ */ stop = true; }
  else if (o.status === 'payment_failed')      { /* оплата не прошла */ stop = true; }
  else if (o.status === 'out_of_stock' || o.status === 'delivery_failed') {
    /* показать: оплата прошла, ключ пока не выдан, состояние восстановимое */
  } else { /* «Обрабатываем заказ...» */ }

  if (!stop) setTimeout(tick, 1000);
}
tick();
```
Поллинг раз в секунду. Останавливается на финальных статусах (`delivered`,
`payment_failed`). На восстановимых (`out_of_stock` / `delivery_failed`) **не**
останавливается - если пул пополнят или сработает досбор/`retry`, страница сама
покажет выданный ключ. Дизайн - рабочий вид, как разрешает ТЗ.

---

## 5. `public/admin.html` + `public/admin.js` - админка

Разметка: поле токена, блок пула ключей с кнопками, таблица «оплачены, но не выданы».
Дизайн по ТЗ не нужен.

`admin.js`:
```js
let token = localStorage.getItem('adminToken') || '';

async function adm(path, options = {}) {
  const res = await fetch(path, {
    ...options,
    headers: { 'content-type': 'application/json', 'x-admin-token': token, ...(options.headers || {}) },
  });
  ...
}
```
Токен хранится в `localStorage`, во все запросы подставляется заголовок `x-admin-token`.

`load()` - `GET /admin/orders/unfulfilled`:
- показывает состояние пула (`всего / свободно / занято`);
- рисует строки заказов со статусом и `recovery_reason`;
- у каждой строки кнопка **«Повторить выдачу»** -> `POST /admin/orders/:id/retry`
  (на бэке идемпотентно), после чего `load()` обновляет таблицу.

Кнопки пула:
- **Пополнить (+5)** -> `POST /admin/pool/refill { count: 5 }`
- **Опустошить** -> `POST /admin/pool/drain`

Этого достаточно, чтобы руками пройти сценарий этапа 3: опустошить пул -> купить -> увидеть заказ в списке «оплачен, но не выдан» -> пополнить -> «Повторить выдачу» -> заказ становится `delivered`.

---

## Соответствие требованиям по макету

| Требование ТЗ | Где |
|---|---|
| Шапка, баннер, ряд иконок, блок пополнения Steam, один ряд карточек | `index.html` + `app.js` |
| 1. Баннер-карусель (авто + стрелки + точки) | `renderBanner()` |
| 2. «Каталог» - открытие/закрытие по клику, клик вне, Esc | `renderCatalogMenu()` |
| 3. Переключатель валют - активное состояние, без пересчёта | `renderCurrency()` |
| 4. Иконки сервисов - плавное выделение при наведении | CSS `.service:hover` |
| 5. Карточки - подъём/тень/обводка при наведении | CSS `.card:hover` |
| Покупка стартует с кнопки «Купить» | `renderCards()` -> `openBuy()` |
| Эмуляция оплаты «успех/неуспех» -> вебхук | `openBuy()` -> `POST /api/pay/:id` |
| Логин Steam оставить как в макете (не функционален) | поле в `.topup__field` |
| Страница статуса заказа | `order.html` / `order.js` |
| Отзывы, футер, мобильная/тёмная версии - не нужны | не делались |
