# Backend - построчный разбор

Стек: **Node.js + Express + better-sqlite3** (файл `data/app.db`). Никаких тяжёлых
зависимостей и ORM: гарантии «ровно один раз» держатся на точных SQL-запросах,
и их важно уметь объяснить.

---

## 0. Мини-словарь SQL (то, что реально используется)

| Приём | Что делает простыми словами |
|---|---|
| `PRIMARY KEY` / `UNIQUE` | БД **физически не даёт** вставить вторую строку с таким же значением в этом столбце. Попытка -> ошибка. |
| `INSERT ... ON CONFLICT(col) DO NOTHING` | «Вставь строку. Если такой `col` уже есть - молча не вставляй». После вызова смотрим `result.changes`: `1` - вставили, `0` - уже было. |
| `INSERT ... ON CONFLICT(col) DO UPDATE SET ...` | То же, но при конфликте не пропускаем, а обновляем существующую строку (upsert). |
| `UPDATE ... WHERE <условие> RETURNING <столбец>` | Обнови строки под условие и верни из них столбец. Если ничего не подошло - `undefined`, `changes === 0`. |
| подзапрос `(SELECT ... LIMIT 1)` | Запрос внутри запроса. Тут - «найди id первой свободной строки». |
| транзакция (`db.transaction(fn)`) | Пачка запросов: применяются **все или ни одного**. В `better-sqlite3` она ещё и **синхронная** - пока идёт транзакция, другой JS-код не вклинится. |
| `.run()` / `.get()` / `.all()` | выполнить (`{changes, lastInsertRowid}`) / первая строка / массив строк. |
| подготовленный запрос (`db.prepare`) | SQL компилируется один раз, значения подставляются через `@имя` или `?` безопасно. |
| `LEFT JOIN b ON ... WHERE b.x IS NULL` | «строки из `a`, у которых **нет** пары в `b`». Тут - заказы без записи о выдаче. |
| WAL (`journal_mode = WAL`) | режим журналирования, при котором чтение не блокируется идущей записью. |

---

## 1. `src/schema.sql` - таблицы

Главное в схеме - **где стоят ограничения уникальности**. Именно они, а не JS-код,
гарантируют «ровно один раз».

### `products` - каталог
`sku PRIMARY KEY, name, type, price INTEGER, currency, image`. Справочник товаров
из «Материалов». `price` - целые рубли.

### `key_pool` - пул ключей для выдачи
```
id INTEGER PRIMARY KEY AUTOINCREMENT,
code TEXT UNIQUE NOT NULL,
status TEXT DEFAULT 'free',            -- 'free' | 'claimed'
claimed_by_request_id TEXT,
claimed_at TEXT
```
- `code UNIQUE` - один ключ нельзя завести в пул дважды (важно при повторном `seed`).
- Занятие ключа = перевод `free -> claimed` одним атомарным запросом (см. `providers.js`).
- `claimed_by_request_id` - каким запросом занят; повтор того же запроса находит «свой» ключ.

### `provider_issues` - память поставщика
`request_id PRIMARY KEY, provider, code, created_at`.
Ключевая таблица против **ловушки таймаута**. Поставщик перед выдачей нового кода
смотрит: не выдавал ли уже по этому `request_id`. Повтор -> тот же `code`, новый
ключ не трогаем.

### `orders` - заказы
```
id TEXT PRIMARY KEY,
idempotency_key TEXT UNIQUE,           -- защита от двойного клика "Купить"
sku, base_amount, discount, amount, currency, promo_code,
status TEXT DEFAULT 'created',
recovery_reason TEXT,                  -- 'out_of_stock' | 'delivery_failed' | NULL
created_at, updated_at
```
- `idempotency_key UNIQUE` - фронт генерит один ключ на одно нажатие «Купить»; два запроса с ним -> второй не создаёт заказ.
- `base_amount` и `discount` - **посчитаны сервером**. Клиент цену/скидку не присылает.
- `status` - ровно из ТЗ: `created, paid, delivering, delivered, payment_failed, out_of_stock, delivery_failed`.
- `recovery_reason` - почему заказ «завис» (для админки и текста на странице статуса).
- `CREATE INDEX idx_orders_status` - ускоряет выборку «все заказы в статусе X».

### `payment_events` - журнал вебхуков
```
event_id TEXT PRIMARY KEY,             -- идемпотентность вебхука
order_id TEXT NOT NULL,                -- НЕ ссылка на orders - заказа может ещё не быть
status, amount, currency, raw, received_at, processed_at
```
- `event_id PRIMARY KEY` - «повтор приходит с тем же `event_id`». Второй `INSERT` не пройдёт -> мгновенный `200`.
- `order_id` намеренно **без** `REFERENCES orders` - вебхук может прийти раньше заказа, и его надо сохранить.
- `raw` - весь JSON вебхука для аудита. `processed_at` - когда событие доехало до заказа.

### `deliveries` - факт выдачи
`order_id PRIMARY KEY REFERENCES orders(id), code, request_id, provider, delivered_at`.
`order_id PRIMARY KEY` = **не более одной выдачи на заказ**. Последний рубеж:
даже если два потока оба получили код, `INSERT ... ON CONFLICT(order_id) DO NOTHING`
пропустит только первый.

### `promocodes` / `promo_redemptions` - этап 4
```
promocodes:        code PRIMARY KEY, type, value, currency, max_uses
promo_redemptions: id PK, code, order_id TEXT UNIQUE, created_at
```
- Одно применение = одна строка в `promo_redemptions`.
- `order_id UNIQUE` - повторное создание того же заказа не спишет промокод дважды.
- Лимит: `COUNT(*) строк с этим code < max_uses`, проверяется внутри вставки.

---

## 2. `src/config.js` - настройки

Всё из переменных окружения, чтобы скрипты гонок меняли поведение без правки кода.

```js
const num  = (v, d) => (v === undefined || v === '' ? d : Number(v));
const bool = (v, d) => (v === undefined || v === '' ? d : v === '1' || v === 'true');
```

- `providerTimeoutMs` (2500) - сколько ждём поставщика до вердикта «таймаут».
- `providerA/B.errorRate`, `.timeoutRate` (0..1, по умолчанию **0**) - вероятности,
  что заглушка упадёт или зависнет. По умолчанию 0 -> happy-path работает сразу.
- `enableDebug` (true) - включает `/debug/*`.
- `allowClientOrderId` (true) - разрешает скрипту задать `order_id` заранее
  (тест «вебхук раньше заказа»).

---

## 3. `src/db.js` - подключение

```js
export const db = new Database(config.dbPath);
db.pragma('journal_mode = WAL');       // чтение не блокируется записью
db.pragma('foreign_keys = ON');        // SQLite по умолчанию не проверяет FK
db.pragma('busy_timeout = 5000');      // подождать блокировку, а не падать
```
`now()` - единый ISO-таймстамп для всех вставок.

---

## 4. `src/seed-core.js` + `src/seed.js` - заливка справочных данных

`seed({reset})`:
1. `migrate()` - создать таблицы, если нет.
2. если `reset` - `DELETE FROM ...` по всем таблицам (чистый прогон тестов).
3. одна транзакция: товары и промокоды - `INSERT ... ON CONFLICT(...) DO UPDATE`
   (повторный `seed` обновит, не задублирует); ключи -
   `INSERT OR IGNORE INTO key_pool (code, status) VALUES (?, 'free')`.
4. вернуть счётчики.

`seed.js` - обёртка для терминала: `node src/seed.js [--reset]`.

---

## 5. `src/services/promo.js` - скидка и лимит (этап 4)

```js
export function computeDiscount(promo, baseAmount) {
  if (promo.type === 'percent') return Math.floor((baseAmount * promo.value) / 100);
  if (promo.type === 'amount')  return Math.min(promo.value, baseAmount);
  return 0;
}
```
Скидку считает **сервер** по таблице `promocodes`. `amount` не больше цены (чтобы не уйти в минус).

`previewPromo(code, baseAmount)` - для фронта: скидка + остаток лимита. Ничего не списывает.

**Сердце этапа 4:**
```sql
INSERT INTO promo_redemptions (code, order_id, created_at)
SELECT @code, @orderId, @ts
 WHERE (SELECT COUNT(*) FROM promo_redemptions WHERE code = @code)
     < (SELECT max_uses FROM promocodes WHERE code = @code)
```
«Вставь применение промокода, **но только если** сейчас применений меньше `max_uses`».
Проверка счётчика и вставка - **один запрос**, между ними никто не влезет. Лимит выбран
 -> `WHERE` ложно -> `changes === 0` -> `ok:false`.

Почему не два запроса (`SELECT COUNT`, потом `INSERT`): два параллельных увидели бы
одинаковый счёт и оба вставили. Тут это невозможно.

`releasePromo(orderId)` - снять применение (`DELETE ... WHERE order_id = ?`).

---

## 6. `src/services/orders.js` - создание заказа

`getOrder(id)` - заказ + прицепленная выдача (код), если есть.

`createOrder({ sku, promoCode, idempotencyKey, clientOrderId })`:
1. товар есть? нет -> `unknown_sku`.
2. **двойной клик:** если `idempotencyKey` уже встречался - вернуть тот заказ, `reused:true`.
3. если задан `promoCode` - достать; нет -> `unknown_promo`.
4. `id`: обычно генерим `ord_<12hex>`; если `allowClientOrderId` и скрипт передал свой - берём его.
5. транзакция `createTx`: списать промокод (`redeemPromoWithin`) -> посчитать `discount` ->    `INSERT orders (... status='created')`. Всё в одной транзакции: лимит не прошёл ->    заказа нет; `INSERT` упал -> откат снимает и списание промокода.
6. `catch`: `INSERT` упал по `UNIQUE` (гонка по `idempotency_key`/`id`) -> находим уже
   созданный заказ и возвращаем.

Весь `createOrder` **синхронный** (нет `await`). В Node один поток -> два одновременных
«Купить» исполнятся друг за другом. Двойной клик закрыт даже без `idempotency_key` -
он просто явная страховка.

---

## 7. `src/services/providerClient.js` - HTTP-клиент к поставщику

Три класса ошибок, чтобы `fulfillment.js` понимал, **что** случилось:
`ProviderTimeout` (не дождались), `OutOfStock` (409 / `reason: out_of_stock`),
`ProviderError` (5xx, сеть).

```js
const controller = new AbortController();
const timer = setTimeout(() => controller.abort(), timeoutMs);
// fetch(..., { signal: controller.signal })
// AbortError -> ProviderTimeout
```
Не ответил за `timeoutMs` -> обрываем запрос, кидаем `ProviderTimeout`. Дальше
`fulfillment.js` делает **повтор с тем же `request_id`** - «таймаут != отказ».

---

## 8. `src/routes/providers.js` - две заглушки-поставщика

Генератор `makeProviderRouter(name, faults)` создаёт и A, и B.

**Атомарное занятие ключа:**
```js
const claimKeyForRequest = db.transaction((requestId, provider) => {
  const existing = findIssue.get(requestId);
  if (existing) return { code: existing.code, reused: true };            // (1)

  const claimed = db.prepare(`
    UPDATE key_pool
       SET status = 'claimed', claimed_by_request_id = @rid, claimed_at = @ts
     WHERE id = (SELECT id FROM key_pool WHERE status = 'free' ORDER BY id LIMIT 1)
     RETURNING code
  `).get({ rid: requestId, ts: now() });                                // (2)

  if (!claimed) return { outOfStock: true };                            // (3)

  db.prepare(`INSERT INTO provider_issues (request_id, provider, code, created_at)
              VALUES (?, ?, ?, ?)`).run(requestId, provider, claimed.code, now());  // (4)
  return { code: claimed.code, reused: false };
});
```
- **(1)** Уже выдавали по этому `request_id`? Верни тот же код (спасение после таймаута).
- **(2)** «Возьми id первой свободной строки, переведи в `claimed`, верни `code`» - одним запросом, два параллельных вызова не займут одну строку.
- **(3)** `RETURNING` пуст -> свободных нет -> `outOfStock`.
- **(4)** Запоминаем `request_id -> code`, чтобы (1) сработало на повторе.

**HTTP-ручка `POST /issue`:**
```js
const known = findIssue.get(requestId);
if (!known && Math.random() < faults.errorRate)
  return res.status(503).json({ status:'error', reason:'provider_unavailable' });   // сбой ДО списания

const result = claimKeyForRequest(requestId, name);
if (result.outOfStock) return res.status(409).json({ status:'error', reason:'out_of_stock' });

if (!result.reused && Math.random() < faults.timeoutRate)
  await sleep(config.providerTimeoutMs + 2000);   // "завис" ПОСЛЕ списания - ловушка

return res.status(200).json({ status:'ok', request_id: requestId, code: result.code });
```
- `errorRate` - падаем `503` **до** списания (ключ не тронут).
- `timeoutRate` - ключ уже занят и записан, но «зависаем» на `timeout + 2с`. Клиент
  отвалится по таймауту; повтор с тем же `request_id` попадёт в (1) и получит **тот же** код.
- Сбои - только на «первичных» запросах (`!known` / `!result.reused`), повтор всегда доводим.

`POST /config` (под токеном) - менять `errorRate`/`timeoutRate` на лету для скриптов этапа 3.

---

## 9. `src/services/fulfillment.js` - ядро выдачи (этапы 2-3)

`providers = [A, B]` - сначала A, при неудаче B (fallback из контракта).

**Перевод в «идёт выдача»:**
```sql
UPDATE orders SET status = 'delivering', updated_at = @ts
 WHERE id = @id AND status IN ('paid', 'out_of_stock', 'delivery_failed')
```
Первый поток переводит `paid -> delivering` (`changes === 1`) и идёт дальше. Второй
параллельный выполняет тот же `UPDATE`, но статус уже `delivering` - его нет в списке -> `changes === 0` -> выходит. К поставщику идёт **один**.

**Запись факта выдачи (`finalizeDelivery`, транзакция):**
```sql
INSERT INTO deliveries (order_id, code, request_id, provider, delivered_at)
VALUES (...) ON CONFLICT(order_id) DO NOTHING;
UPDATE orders SET status = 'delivered', recovery_reason = NULL, updated_at = @ts
 WHERE id = @orderId AND status != 'delivered';
```
Выдача по заказу уже есть -> вторая не запишется (`firstDelivery` покажет, мы ли записали).
Перевод в `delivered` идемпотентен.

**Восстановимый статус (`markRecoverable`):**
```sql
UPDATE orders SET status = @reason, recovery_reason = @reason, updated_at = @ts
 WHERE id = @orderId AND status IN ('paid','delivering','out_of_stock','delivery_failed')
```
`reason` - `'out_of_stock'` или `'delivery_failed'`. Наружу никаких исключений - заказ
просто помечается «оплачен, не выдан», сервер живёт (этап 3).

**Запрос к одному поставщику (`askProvider`):**
```js
try { return await callProvider(url, body, timeoutMs); }
catch (err) {
  if (err instanceof ProviderTimeout) {
    try { return await callProvider(url, body, timeoutMs * 2); }   // повтор, тот же request_id
    catch (retryErr) { return { failed: retryErr }; }
  }
  return { failed: err };
}
```

**Главная функция:**
```js
export async function attemptFulfillment(orderId, { force = false } = {}) {
  const existing = getDelivery.get(orderId);
  if (existing) return { status:'delivered', delivery: existing, alreadyDelivered: true };   // (A)

  const order = getOrder.get(orderId);
  if (!order) return { status:'unknown_order' };

  if (!force) {
    const moved = claimDeliveringSlot.run({ id: orderId, ts: now() });
    if (moved.changes === 0) return { status: getOrder.get(orderId).status, skipped: true };  // (B)
  }

  const requestId = `req_${orderId}`;                 // (C) стабильный на все повторы
  let lastReason = null;

  for (const provider of providers) {                 // (D) A, потом B
    const result = await askProvider(provider, requestId, order);
    if (result.failed) {
      lastReason = (result.failed instanceof OutOfStock) ? 'out_of_stock' : 'delivery_failed';
      continue;
    }
    const done = finalizeDelivery(orderId, result.code, requestId, provider.name);
    return { status:'delivered', delivery: done.delivery, firstDelivery: done.firstDelivery };
  }

  markRecoverable(orderId, lastReason || 'delivery_failed');    // (E) оба не смогли
  return { status: getOrder.get(orderId).status, recoveryReason: lastReason };
}
```
- **(A)** Уже выдано -> выходим. Идемпотентность на входе.
- **(B)** Не заняли слот `delivering` -> другой поток уже занимается / статус неподходящий -> выходим. `force:true` (админ-повтор, досбор) шаг пропускает.
- **(C)** `request_id = "req_" + orderId` - **один и тот же** при любом числе повторов и досборов. Поставщик по заказу не выдаст второй ключ.
- **(D)** A -> B. Успех у любого -> `finalizeDelivery`, выход.
- **(E)** Оба не смогли: нехватка ключей -> `out_of_stock`, иначе `delivery_failed`. Без падения.

**Тройная защита от задвоения:**
1. `claimDeliveringSlot` - к поставщику идёт один поток (обычный путь).
2. стабильный `request_id` + `provider_issues` - даже если дошло два, поставщик отдаёт один код.
3. `deliveries.order_id` PK + `ON CONFLICT DO NOTHING` - даже если код принесли дважды, запись одна.

**Фоновый досбор:**
```sql
SELECT o.id FROM orders o
  LEFT JOIN deliveries d ON d.order_id = o.id
 WHERE d.order_id IS NULL
   AND o.status IN ('paid','delivering','out_of_stock','delivery_failed')
   AND o.updated_at < @cutoff
```
`LEFT JOIN ... WHERE d.order_id IS NULL` - «оплачен, но выдачи нет». `updated_at < cutoff`
(12 с) - не трогаем живую выдачу. Для каждого - `attemptFulfillment(force)`. Покрывает
краш процесса посреди выдачи (застрял в `delivering`) и временную недоступность поставщиков.

`startRecoveryLoop(8000)` - раз при старте + каждые 8 с. `unref()` - таймер не держит процесс живым.

---

## 10. `src/services/reconcile.js` - «продвинуть заказ по событиям оплаты»

```js
const applyPaymentState = db.transaction((orderId) => {
  const order = getOrder.get(orderId);
  if (!order) return { buffered: true };                    // (1)

  const paid   = hasEvent.get(orderId, 'paid');
  const failed = hasEvent.get(orderId, 'failed');

  if (order.status === 'created') {
    if (paid)        // UPDATE ... SET status='paid'           WHERE id=? AND status='created'   (2)
    else if (failed) // UPDATE ... SET status='payment_failed' WHERE id=? AND status='created'
  }
  // UPDATE payment_events SET processed_at = now WHERE order_id=? AND processed_at IS NULL       (3)
  return { order: getOrder.get(orderId) };
});
```
- **(1)** Заказа ещё нет (вебхук раньше) -> `buffered`. Событие уже в `payment_events`, разберём при создании заказа (критерий 3).
- **(2)** `created -> paid` (или ` -> payment_failed`) **только если** ещё `created`. Повторы ничего не меняют. Есть и `paid`, и `failed` (не по порядку) -> приоритет `paid`: успешную оплату терять нельзя.
- **(3)** Помечаем события разобранными (аудит).

```js
export async function reconcileOrder(orderId) {
  const { buffered, order } = applyPaymentState(orderId);
  if (buffered) return { buffered: true };
  if (['paid','delivering','out_of_stock','delivery_failed'].includes(order.status))
    await attemptFulfillment(orderId);
  return { status: getOrder.get(orderId).status };
}
```
Вызывается из двух мест: из вебхука и **из создания заказа** (на случай, если событие
пришло раньше - тогда буферизованный вебхук подхватывается сразу, не дожидаясь досбора).

---

## 11. `src/routes/webhook.js` - приём вебхука оплаты

```js
const inserted = recordEvent.run({ ... });
// recordEvent = INSERT INTO payment_events (...) VALUES (...) ON CONFLICT(event_id) DO NOTHING

if (inserted.changes === 0)
  return res.status(200).json({ ok: true, duplicate: true });   // (1)

try { await reconcileOrder(body.order_id); }                     // (2)
catch (err) { console.error(err); }

return res.status(200).json({ ok: true });                       // (3)
```
- **(1)** `event_id` уже был -> `changes === 0` -> мгновенный `200 {duplicate:true}`. Это критерий 2 и причина, почему 50 одинаковых вебхуков дают одну выдачу: 49 отваливаются здесь.
- **(2)** Событие новое -> продвигаем заказ. Ошибку выдачи **не** пробрасываем в HTTP: факт оплаты уже сохранён (`INSERT`), доведение подхватит досбор. Иначе платёжка по контракту заретраила бы вебхук на каждую заминку поставщика.
- **(3)** Всегда быстрый `200` - «`200 OK` принято, `5xx` платёжка повторит».

50 параллельных вебхуков с **разными** `event_id` по одному заказу: все записали событие
и зовут `reconcileOrder`, но `applyPaymentState` (синхронная транзакция) переведёт
`created -> paid` один раз, а `claimDeliveringSlot` пропустит дальше один поток. Остальные 49 -> `changes === 0` -> выход.

---

## 12. `src/routes/pay.js` - эмуляция оплаты

Реального эквайринга нет. Ручка «оплатить (успех/неуспех)» формирует вебхук по
контракту и шлёт на наш же `/webhook/payment`.

```js
const failed = (req.body?.result || 'success') === 'failed';
const payload = {
  event_id: req.body?.event_id || `evt_${crypto.randomUUID().slice(0,12)}`,
  order_id: order.id,
  status: failed ? 'failed' : 'paid',
  amount: order.amount, currency: order.currency,
  created_at: new Date().toISOString(),
};
await fetch(`http://127.0.0.1:${config.port}/webhook/payment`, { method:'POST', body: JSON.stringify(payload), ... });
```
- `result: 'success' | 'failed'` -> `status: 'paid' | 'failed'`.
- `event_id` можно передать свой (скрипты гонок шлют один и тот же 50 раз), иначе генерится.
- Возвращаем и payload, и ответ вебхука.

---

## 13. `src/routes/catalog.js` - каталог

`GET /api/catalog/products` (список), `GET /api/catalog/products/:sku` (один).
Только чтение, `ORDER BY rowid`.

---

## 14. `src/routes/orders.js` - REST заказов

- `POST /api/orders` - `{ sku, promo_code?, idempotency_key?, order_id? }` -> `createOrder`,
  затем (если заказ новый) `await reconcileOrder(id)` - подхватить вебхук, пришедший
  раньше. Ответ `201` (создан) или `200` (`reused`). Ошибки: `unknown_sku` 404,
  `unknown_promo` 400, `promo_limit_reached` 409.
- `POST /api/orders/preview-promo` - `{ sku, code }` -> предполагаемая скидка и остаток
  лимита. Цена берётся из БД по `sku`, клиентская не принимается.
- `GET /api/orders/:id` - статус + код, если выдан. Фронт этим поллит страницу статуса.

---

## 15. `src/routes/admin.js` - админка (этап 3)

Middleware: заголовок `x-admin-token` должен совпасть с `config.adminToken`, иначе `401`.

- `GET /admin/orders/unfulfilled` - «оплачен, но не выдан»:
  ```sql
  SELECT o.* FROM orders o
    LEFT JOIN deliveries d ON d.order_id = o.id
   WHERE d.order_id IS NULL
     AND o.status IN ('paid','delivering','out_of_stock','delivery_failed')
   ORDER BY o.created_at
  ```
  плюс состояние пула.
- `POST /admin/orders/:id/retry` - **безопасная ручная повторная выдача**:
  `attemptFulfillment(id, { force: true })`. Идемпотентна: уже выдано -> вернёт
  существующую выдачу; поставщик по `req_<id>` уже давал код -> вернётся тот же.
- `GET /admin/pool` - счётчики.
- `POST /admin/pool/refill` - долить ключи (`{ codes: [...] }` или `{ count: N }`).
- `POST /admin/pool/drain` - опустошить (`UPDATE key_pool SET status='claimed' WHERE status='free'`),
  чтобы смоделировать «остаток закончился».

---

## 16. `src/routes/debug.js` - служебное (только dev, при `enableDebug`)

- `GET /debug/health` - жив ли сервер (проверка «сервер не упал»).
- `GET /debug/stats` - весь срез: пул (`total/free/claimed`), заказы по статусам,
  число выдач, событий, `provider_issues`, применений промокодов, текущие настройки сбоев.
- `POST /debug/reset` - `seed({ reset: true })`, чистый старт между тестами.

---

## 17. `src/server.js` - сборка

```js
migrate();
seed({ reset: false });

app.use(express.json());
app.use('/api/catalog', catalogRouter);
app.use('/api/orders',  ordersRouter);
app.use('/api/pay',     payRouter);
app.use('/webhook',     webhookRouter);
app.use('/provider-a',  providerA);      // заглушки на том же процессе/порте
app.use('/provider-b',  providerB);
app.use('/admin',       adminRouter);
if (config.enableDebug) app.use('/debug', makeDebugRouter());
app.use(express.static(path.join(config.root, 'public')));   // фронт

app.listen(config.port, () => { startRecoveryLoop(); });     // фоновый досбор
```
Поставщики на том же порте -> один `npm start`, но HTTP-граница между «магазином» и
«поставщиком» настоящая, и скрипты могут дёргать `/provider-a/issue` напрямую.

---

## Как файлы закрывают критерии приёмки

| Критерий | Где закрыт |
|---|---|
| 1. 50 параллельных «оплачено» -> 1 выдача, 1 ключ | `webhook.js` (дубли по `event_id`) + `claimDeliveringSlot` + `deliveries` PK + атомарный claim в `providers.js` |
| 2. Повтор `event_id` - ничего не меняет | `webhook.js`: `INSERT ... ON CONFLICT(event_id) DO NOTHING`, `changes===0` -> `200 duplicate` |
| 3. Вебхук раньше заказа / не по порядку | `payment_events.order_id` без FK; `reconcile.js` ветка `buffered`; вызов `reconcile` при создании заказа |
| 4. Пустой пул -> восстановимо, после пополнения ровно 1 ключ | `providers.js` -> `outOfStock`; `fulfillment.js` `markRecoverable`; `admin` `pool/refill` + `retry` (идемпотентно через `req_<id>`) |
| 5. Промокод с лимитом N под параллелью | `promo.js` `conditionalRedeem` - проверка `COUNT(*) < max_uses` внутри `INSERT` |

---

## Однократная выдача - коротко (для ответа в тестовом)

1. Вебхук идемпотентен по `event_id` (`ON CONFLICT DO NOTHING`) - повторы и параллельные
   доставки одного события отсекаются на входе.
2. Переход `paid -> delivering` - условный `UPDATE ... WHERE status IN (...)`; к поставщику
   уходит ровно один поток.
3. `request_id = req_<order_id>` стабилен, поставщик идемпотентен по нему
   (`provider_issues`) - повтор после таймаута возвращает тот же ключ, а не новый.
4. `deliveries.order_id` - первичный ключ; `INSERT ... ON CONFLICT(order_id) DO NOTHING` -
   финальный предохранитель: один факт выдачи, один израсходованный ключ.
5. Восстановление (`out_of_stock` / `delivery_failed`) не роняет процесс; фоновый досбор
   и админский `retry` доводят заказ через тот же `request_id` - идемпотентно.
