export class ProviderTimeout extends Error {
  constructor(message = 'timeout') {
    super(message);
    this.name = 'ProviderTimeout';
  }
}

export class ProviderError extends Error {
  constructor(reason = 'provider_error', httpStatus) {
    super(reason);
    this.name = 'ProviderError';
    this.reason = reason;
    this.httpStatus = httpStatus;
  }
}

export class OutOfStock extends Error {
  constructor() {
    super('out_of_stock');
    this.name = 'OutOfStock';
  }
}

export async function callProvider(baseUrl, body, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let response;
  try {
    response = await fetch(`${baseUrl}/issue`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (err) {
    if (err.name === 'AbortError') throw new ProviderTimeout();
    throw new ProviderError('network_error');
  } finally {
    clearTimeout(timer);
  }

  const data = await response.json().catch(() => ({}));

  if (response.status === 200 && data.status === 'ok' && data.code) {
    return { code: data.code };
  }
  if (response.status === 409 || data.reason === 'out_of_stock') {
    throw new OutOfStock();
  }
  throw new ProviderError(data.reason || 'provider_error', response.status);
}
