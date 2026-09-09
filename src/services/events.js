const clients = new Set();
const buffer = [];
const BUFFER_LIMIT = 500;
const HEARTBEAT_MS = 15000;

let lastEventId = 0;
let nextClientId = 1;

function frame({ id, type, data }) {
  let out = '';
  if (id != null) out += `id: ${id}\n`;
  if (type) out += `event: ${type}\n`;
  out += `data: ${JSON.stringify(data)}\n\n`;
  return out;
}

function writeSafe(res, text) {
  try {
    res.write(text);
    return true;
  } catch {
    return false;
  }
}

export function publish(type, data) {
  const event = { id: ++lastEventId, type, data };

  buffer.push(event);
  if (buffer.length > BUFFER_LIMIT) buffer.shift();

  const text = frame(event);
  for (const client of clients) {
    if (!writeSafe(client.res, text)) dropClient(client);
  }
  return event.id;
}

function dropClient(client) {
  clients.delete(client);
  try {
    client.res.end();
  } catch {}
}

export function subscribe(res, lastSeenId = 0) {
  const client = { res, id: nextClientId++ };
  clients.add(client);

  writeSafe(res, 'retry: 3000\n\n');

  if (lastSeenId > 0) {
    for (const event of buffer) {
      if (event.id > lastSeenId) writeSafe(res, frame(event));
    }
  }

  return () => dropClient(client);
}

const heartbeat = setInterval(() => {
  for (const client of clients) {
    if (!writeSafe(client.res, `: ping ${Date.now()}\n\n`)) dropClient(client);
  }
}, HEARTBEAT_MS);
heartbeat.unref?.();

export const _stats = () => ({ clients: clients.size, lastEventId, buffered: buffer.length });
