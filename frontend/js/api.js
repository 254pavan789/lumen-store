/**
 * API client - thin wrapper around fetch for the Express REST API.
 * Every failure becomes an ApiError carrying status, code, message and
 * field-level details produced by the Python engine.
 */
export class ApiError extends Error {
  constructor(status, code, message, details = []) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = Array.isArray(details) ? details : [];
  }
}

const BASE = '/api';

function qs(params = {}) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '' && value !== 'all') search.set(key, value);
  });
  const text = search.toString();
  return text ? `?${text}` : '';
}

async function request(method, path, body) {
  let response;
  try {
    response = await fetch(BASE + path, {
      method,
      headers: body !== undefined ? { 'Content-Type': 'application/json' } : {},
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (err) {
    throw new ApiError(0, 'NETWORK_ERROR', 'Cannot reach the server. Make sure the backend is running.');
  }
  let payload = null;
  try {
    payload = await response.json();
  } catch (err) {
    payload = null;
  }
  if (!response.ok || !payload || payload.success === false) {
    const error = (payload && payload.error) || {};
    throw new ApiError(
      response.status,
      error.code || `HTTP_${response.status}`,
      error.message || `Request failed with status ${response.status}`,
      error.details || []
    );
  }
  return payload;
}

export const api = {
  health: () => request('GET', '/health'),
  dashboard: () => request('GET', '/dashboard'),
  stock: (filters) => request('GET', `/stock${qs(filters)}`),

  itemTypes: {
    list: () => request('GET', '/item-types'),
    create: (data) => request('POST', '/item-types', data),
    update: (id, data) => request('PUT', `/item-types/${encodeURIComponent(id)}`, data),
    remove: (id) => request('DELETE', `/item-types/${encodeURIComponent(id)}`),
  },

  items: {
    list: (filters) => request('GET', `/items${qs(filters)}`),
    get: (id) => request('GET', `/items/${encodeURIComponent(id)}`),
    create: (data) => request('POST', '/items', data),
    update: (id, data) => request('PUT', `/items/${encodeURIComponent(id)}`, data),
    setStatus: (id, active) => request('PATCH', `/items/${encodeURIComponent(id)}/status`, { active }),
    remove: (id) => request('DELETE', `/items/${encodeURIComponent(id)}`),
  },

  purchases: {
    list: (filters) => request('GET', `/purchases${qs(filters)}`),
    get: (id) => request('GET', `/purchases/${encodeURIComponent(id)}`),
    nextOrderId: () => request('GET', '/purchases/next-order-id'),
    create: (data) => request('POST', '/purchases', data),
    update: (id, data) => request('PUT', `/purchases/${encodeURIComponent(id)}`, data),
    cancel: (id, reason) => request('POST', `/purchases/${encodeURIComponent(id)}/cancel`, { reason }),
    // No remove(): purchases are permanent historical records.
  },
};
