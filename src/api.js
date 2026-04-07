const BASE_URL = 'http://localhost:8000/api';
const inflightRequests = new Map();

function buildRequestKey(path, options = {}, token) {
  const method = (options.method || 'GET').toUpperCase();
  const body = typeof options.body === 'string' ? options.body : '';
  return JSON.stringify([method, path, token || '', body]);
}

async function request(path, options = {}, token) {
  const requestKey = buildRequestKey(path, options, token);
  const existingRequest = inflightRequests.get(requestKey);
  if (existingRequest) {
    return existingRequest;
  }

  const fetchPromise = (async () => {
    const response = await fetch(`${BASE_URL}${path}`, {
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Token ${token}` } : {}),
        ...(options.headers || {}),
      },
      ...options,
    });

    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(payload.detail || payload.non_field_errors?.[0] || 'Request failed');
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
  getTailors: (token) => request('/admin/tailors/', {}, token),
  updateTailor: (id, payload, token) =>
    request(`/admin/tailors/${id}/`, { method: 'PATCH', body: JSON.stringify(payload) }, token),
  getDrivers: (token) => request('/admin/drivers/', {}, token),
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
