const id = new URLSearchParams(location.search).get('id');
document.getElementById('oid').textContent = id || '-';

const order = ['created', 'paid', 'delivering', 'delivered'];
const labels = {
  created: 'создан',
  paid: 'оплачен',
  delivering: 'идёт выдача',
  delivered: 'выдан',
  payment_failed: 'оплата не прошла',
  out_of_stock: 'оплачен, ключа нет в наличии',
  delivery_failed: 'оплачен, выдача не удалась',
};

let stop = false;

async function tick() {
  if (stop || !id) return;
  let data;
  try {
    const res = await fetch('/api/orders/' + encodeURIComponent(id));
    data = await res.json();
    if (!res.ok) throw new Error(data.error);
  } catch (e) {
    document.getElementById('content').innerHTML = '<p>Заказ не найден.</p>';
    return;
  }

  const o = data.order;
  const badge = document.getElementById('badge');
  badge.textContent = labels[o.status] || o.status;
  badge.className = 'badge b-' + o.status;

  const reached = order.indexOf(o.status);
  document.querySelectorAll('#steps li').forEach((li) => {
    const idx = order.indexOf(li.dataset.s);
    li.classList.toggle('done', reached >= 0 && idx <= reached);
  });

  const content = document.getElementById('content');
  if (o.status === 'delivered' && o.delivery) {
    content.innerHTML = `<p>Ваш ключ:</p><div class="key-box">${o.delivery.code}</div><p class="recover" style="color:var(--muted)">Поставщик: ${o.delivery.provider}</p>`;
    stop = true;
  } else if (o.status === 'payment_failed') {
    content.innerHTML = '<p>Оплата не прошла. Заказ закрыт.</p>';
    stop = true;
  } else if (o.status === 'out_of_stock' || o.status === 'delivery_failed') {
    content.innerHTML =
      `<div class="recover">Оплата прошла, но ключ пока не выдан (${o.recovery_reason}). ` +
      `Заказ в восстановимом состоянии - после пополнения пула выдача произойдёт автоматически ` +
      `или вручную из админки. Страница обновляется сама.</div>`;
  } else {
    content.innerHTML = '<p>Обрабатываем заказ...</p>';
  }

  if (!stop) setTimeout(tick, 1000);
}

tick();
