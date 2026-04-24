const BASE_URL = 'https://backend-13lk.onrender.com/api';
const REQUEST_TIMEOUT_MS = 30000;
const inflightRequests = new Map();
const responseCache = new Map();
const GET_CACHE_TTL_MS = 30000;

function buildUrl(path, query = {}) {
  const searchParams = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      searchParams.set(key, String(value));
    }
  });
  const queryString = searchParams.toString();
  return `${BASE_URL}${path}${queryString ? `?${queryString}` : ''}`;
}

function buildRequestKey(path, options = {}, token, query = {}) {
  const method = (options.method || 'GET').toUpperCase();
  const body = typeof options.body === 'string' ? options.body : '';
  return JSON.stringify([method, path, token || '', body, query]);
}

async function request(path, options = {}, token, query = {}) {
  const requestKey = buildRequestKey(path, options, token, query);
  const method = (options.method || 'GET').toUpperCase();
  const cacheEntry = responseCache.get(requestKey);

  if (method === 'GET' && cacheEntry && cacheEntry.expiresAt > Date.now()) {
    return cacheEntry.data;
  }

  const existingRequest = inflightRequests.get(requestKey);
  if (existingRequest) {
    return existingRequest;
  }

  const fetchPromise = (async () => {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    let response;

    try {
      response = await fetch(buildUrl(path, query), {
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Token ${token}` } : {}),
          ...(options.headers || {}),
        },
        ...options,
        signal: controller.signal,
      });
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('The server is taking too long to respond. Please try again.');
      }
      throw new Error('Cannot reach the server right now. Please try again.');
    } finally {
      window.clearTimeout(timeoutId);
    }

    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(payload.detail || payload.non_field_errors?.[0] || 'Request failed');
    }

    if (method === 'GET') {
      responseCache.set(requestKey, {
        expiresAt: Date.now() + GET_CACHE_TTL_MS,
        data: payload,
      });
    } else {
      responseCache.clear();
    }

    return payload;
  })();

  inflightRequests.set(requestKey, fetchPromise);

  try {
    return await fetchPromise;
  } finally {
    inflightRequests.delete(requestKey);
  }
}

export const api = {
  login: (payload) => request('/auth/login/', { method: 'POST', body: JSON.stringify(payload) }),
  getOverview: (token) => request('/admin/overview/', {}, token),
  resetTestData: (token) => request('/admin/reset-test-data/', { method: 'POST' }, token),
  getTailors: (token) => request('/admin/tailors/', {}, token),
  updateTailor: (id, payload, token) =>
    request(`/admin/tailors/${id}/`, { method: 'PATCH', body: JSON.stringify(payload) }, token),
  getDrivers: (token, query) => request('/admin/drivers/', {}, token, query),
  updateDriver: (id, payload, token) =>
    request(`/admin/drivers/${id}/`, { method: 'PATCH', body: JSON.stringify(payload) }, token),
  getOrders: (token) => request('/admin/orders/', {}, token),
  updateOrder: (id, payload, token) =>
    request(`/admin/orders/${id}/`, { method: 'PATCH', body: JSON.stringify(payload) }, token),
  assignDriver: (orderId, payload, token) =>
    request(`/admin/orders/${orderId}/assign-driver/`, { method: 'POST', body: JSON.stringify(payload) }, token),
  getFabrics: (token) => request('/admin/fabrics/', {}, token),
  createFabric: (payload, token) =>
    request('/admin/fabrics/', { method: 'POST', body: JSON.stringify(payload) }, token),
  getDesigns: (token) => request('/admin/designs/', {}, token),
  createDesign: (payload, token) =>
    request('/admin/designs/', { method: 'POST', body: JSON.stringify(payload) }, token),
};
