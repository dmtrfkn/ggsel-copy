# GGSel-copy - магазин цифровых товаров

Витрина цифровых товаров для геймеров + бэкенд с гарантией **однократной выдачи
ключа под гонками**, восстановлением после сбоев и промокодами с лимитом.

Стек: **Node.js + Express + better-sqlite3** (файл БД `data/app.db`), фронт - чистый
HTML/CSS/JS без сборки.

- Построчный разбор бэкенда - [backend.md](backend.md)
- Построчный разбор фронтенда - [frontend.md](frontend.md)

---

## Запуск

Требуется Node.js >= 20.

```bash
npm install
npm run seed          # создаёт data/app.db и заливает каталог, пул ключей, промокоды
npm start             # http://localhost:3000
```

Открыть:

| Страница | URL |
|---|---|
| Витрина | http://localhost:3000/ |
| Статус заказа | http://localhost:3000/order.html?id=<order_id> |
| Админка | http://localhost:3000/admin.html (токен по умолчанию `dev-admin-token`) |

Ручной сценарий покупки: на витрине нажать **Купить** на любой карточке -> в модалке **Создать заказ** -> **Оплатить - успех** -> откроется страница статуса,
которая сама поллит заказ до выдачи ключа.

---

## Переменные окружения

| Переменная | По умолчанию | Назначение |
|---|---|---|
| `PORT` | `3000` | порт сервера |
| `DB_PATH` | `./data/app.db` | файл SQLite |
| `ADMIN_TOKEN` | `dev-admin-token` | токен для `/admin/*` (заголовок `x-admin-token`) |
| `PROVIDER_TIMEOUT_MS` | `2500` | таймаут ожидания поставщика |
| `PROVIDER_A_ERROR_RATE` / `PROVIDER_A_TIMEOUT_RATE` | `0` | доля 5xx / зависаний поставщика A (0..1) |
| `PROVIDER_B_ERROR_RATE` / `PROVIDER_B_TIMEOUT_RATE` | `0` | то же для резервного поставщика B |
| `ENABLE_DEBUG` | `true` | включает `/debug/*` (health, stats, reset) |
| `ALLOW_CLIENT_ORDER_ID` | `true` | разрешает задать `order_id` при создании заказа (для теста «вебхук раньше заказа») |

Доли сбоев можно менять и на лету (для сценариев без перезапуска):

```bash
curl -XPOST localhost:3000/provider-a/config \
  -H 'x-admin-token: dev-admin-token' -H 'content-type: application/json' \
  -d '{"errorRate":0.3,"timeoutRate":0.3}'
```

---

## Как воспроизвести проверку гонок

`npm run race:all` поднимает изолированный сервер на своём порту и БД и прогоняет
все сценарии подряд:

```bash
npm run race:all
```

Отдельные сценарии (нужен запущенный `npm start` в другом окне):

| Команда | Сценарий | Критерий приёмки |
|---|---|---|
| `npm run race:webhooks` | 50 параллельных вебхуков «paid» с **одним** `event_id` по одному заказу | 1 |
| `npm run race:webhooks-distinct` | 50 параллельных вебхуков с **разными** `event_id` по одному заказу | 1 |
| `npm run race:out-of-order` | вебхук приходит раньше заказа + запоздалый `failed` не по порядку | 3 |
| `npm run race:double-click` | два одновременных «Купить» с одним `idempotency_key` | этап 2 |
| `npm run race:empty-pool` | пустой пул -> `out_of_stock` без падения -> пополнение -> идемпотентный повтор выдачи | 4 |
| `npm run race:promo` | `LIMIT3` (30 параллельных) и `ONCEONLY` (25 параллельных) | 5 |
| `npm run race:provider-faults` | таймаут поставщика A (повтор с тем же `request_id`), fallback на B, оба недоступны -> восстановление | этап 3 |

Каждый скрипт печатает `✓` / `✗` по проверкам и завершает процесс с ненулевым
кодом при провале. Проверяемые инварианты берутся из `GET /debug/stats`
(состояние пула, число записей выдачи, число выдач поставщика, применения промокодов).

Пример вывода `race:webhooks`:

```
  ответов 200: 50/50, из них "duplicate": 49
  статус заказа: delivered, ключ: LFXC-TNCS-BPCD
  пул claimed: 0 -> 1
  записей выдачи: 0 -> 1
  ✓ израсходован ровно один ключ
```

---

## Как обеспечена однократная выдача (коротко)

1. **Вебхук идемпотентен по `event_id`**: `INSERT INTO payment_events ... ON CONFLICT(event_id) DO NOTHING`.
   Повтор и параллельные доставки одного события отсекаются на входе (`changes === 0` -> `200`, ничего не делаем).
2. **Переход `paid -> delivering`** - условный `UPDATE orders SET status='delivering' WHERE status IN ('paid', ...)`.
   Из 50 параллельных обработчиков дальше проходит ровно один, остальные видят `changes === 0` и выходят.
3. **`request_id = req_<order_id>`** стабилен на все повторы. Поставщик идемпотентен по нему
   (`provider_issues.request_id` - первичный ключ): повтор после таймаута возвращает **тот же** ключ, а не новый.
   Значит таймаут != отказ.
4. **`deliveries.order_id`** - первичный ключ; `INSERT ... ON CONFLICT(order_id) DO NOTHING` - финальный
   предохранитель: один факт выдачи, один израсходованный ключ, даже если что-то пошло не так на шагах выше.
5. **Занятие ключа из пула** атомарно: `UPDATE key_pool SET status='claimed' WHERE id=(SELECT id FROM key_pool WHERE status='free' ORDER BY id LIMIT 1) RETURNING code`.
6. **Промокод**: `INSERT INTO promo_redemptions ... SELECT ... WHERE (SELECT COUNT(*) ...) < max_uses` -
   проверка лимита и вставка в одном запросе, лимит не превышается под параллелью. Скидку считает сервер.
7. **Восстановление**: `out_of_stock` / `delivery_failed` не роняют процесс. Фоновый досбор (каждые 8 с)
   и админский `POST /admin/orders/:id/retry` доводят заказ через тот же `request_id` - идемпотентно.

---

## Модель статусов заказа

```
основной путь:  created -> paid -> delivering -> delivered
оплата не прошла: created -> payment_failed  (финал)

пул пуст:        delivering -> out_of_stock -> (пополнение + retry) -> delivered
поставщики упали: delivering -> delivery_failed -> (retry) -> delivered
```

`out_of_stock` и `delivery_failed` - **восстановимые**, не ошибка. Идемпотентность:
повтор оплаты или повтор выдачи не меняет уже финальный заказ.

---

## HTTP API

**Витрина/заказы**
- `GET  /api/catalog/products` - каталог
- `POST /api/orders` - `{ sku, promo_code?, idempotency_key?, order_id? }` -> создать заказ (скидку считает сервер)
- `POST /api/orders/preview-promo` - `{ sku, code }` -> предполагаемая скидка и остаток лимита
- `GET  /api/orders/:id` - статус заказа + выданный ключ
- `POST /api/pay/:orderId` - `{ result: "success" | "failed", event_id? }` - эмуляция оплаты: шлёт вебхук по контракту

**Вебхук оплаты**
- `POST /webhook/payment` - `{ event_id, order_id, status, amount, currency, created_at }` -> всегда быстрый `200`

**Заглушки-поставщики**
- `POST /provider-a/issue`, `POST /provider-b/issue` - `{ request_id, sku, order_id }` -> `{ status:"ok", code }` | `409 out_of_stock` | `503`
- `POST /provider-a/config`, `POST /provider-b/config` - `{ errorRate?, timeoutRate? }` (под токеном)

**Админка** (заголовок `x-admin-token`)
- `GET  /admin/orders/unfulfilled` - «оплачен, но не выдан» + состояние пула
- `POST /admin/orders/:id/retry` - безопасная идемпотентная повторная выдача
- `GET  /admin/pool`, `POST /admin/pool/refill` (`{ codes? , count? }`), `POST /admin/pool/drain`

**Debug** (при `ENABLE_DEBUG`)
- `GET  /debug/health`, `GET /debug/stats`, `POST /debug/reset`

---

## Структура

```
src/
  schema.sql          таблицы (где стоят UNIQUE/PK - там и гарантии)
  db.js               подключение к SQLite, миграция при импорте
  config.js           настройки из env
  seed-core.js/seed.js заливка справочных данных из "Материалов"
  services/
    orders.js         создание заказа, расчёт скидки, идемпотентность по ключу
    promo.js          скидка на сервере + применение промокода в пределах лимита
    reconcile.js      продвижение статуса заказа по событиям оплаты
    fulfillment.js    ядро выдачи: delivering-слот, A -> B, deliveries, восстановление, досбор
    providerClient.js HTTP-клиент к поставщику (таймаут / out_of_stock / ошибка)
  routes/
    catalog.js orders.js pay.js webhook.js providers.js admin.js debug.js
  server.js           сборка приложения
public/               витрина, order.html, admin.html
scripts/              воспроизведение состязательных сценариев
```

---

## Деплой

- **Фронт** статичен (`public/`), но обращается к API того же origin. Для отдельного
  хостинга фронта нужно поднять бэкенд и указать его адрес (в `public/app.js` вынести
  `const API = 'https://...'`).
- **Проще всего - всё локально** по этому README: `npm install && npm run seed && npm start`.
- БД (`data/app.db`) создаётся автоматически; в репозиторий не коммитится.

---

## Что оставлено намеренно

Отзывы, футер, мобильная и тёмная версии, детальная вёрстка колонок меню, реальный
эквайринг, полноценная авторизация - по ТЗ не требуются. Дизайн страницы статуса и
админки - рабочий вид без оформления.

---

## Время по факту

_Заполнить: ~ ... ч (бэкенд-ядро и сценарии гонок - основная часть, вёрстка - меньшая)._
