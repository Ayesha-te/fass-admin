export const BASE_URL = 'https://backend-13lk.onrender.com/api';
export const API_ORIGIN = BASE_URL.replace(/\/api\/?$/, '');
const REQUEST_TIMEOUT_MS = 30000;
const inflightRequests = new Map();
const responseCache = new Map();
const GET_CACHE_TTL_MS = 30000;

function isFileLike(value) {
  return typeof File !== 'undefined' && value instanceof File;
}

function appendFormValue(formData, key, value) {
  if (value === undefined || value === null) {
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((item) => appendFormValue(formData, key, item));
    return;
  }

  formData.append(key, typeof value === 'string' ? value : String(value));
}

function prepareRequestBody(body) {
  if (!body || typeof body !== 'object' || body instanceof FormData) {
    return { body, isFormData: body instanceof FormData };
  }

  const primaryFile = isFileLike(body.image_file) ? body.image_file : null;
  const imageFiles = Array.isArray(body.image_files) ? body.image_files.filter(isFileLike) : [];
  const shouldUseFormData = Boolean(primaryFile || imageFiles.length);

  if (!shouldUseFormData) {
    return {
      body: JSON.stringify(body),
      isFormData: false,
    };
  }

  const formData = new FormData();
  Object.entries(body).forEach(([key, value]) => {
    if (key === 'image' || key === 'images' || key === 'image_file' || key === 'image_files' || key === 'compatible_fabrics') {
      return;
    }
    appendFormValue(formData, key, value);
  });

  const imageValue = typeof body.image === 'string' ? body.image.trim() : '';
  if (imageValue) {
    formData.append('image', imageValue);
  }

  const imageValues = Array.isArray(body.images)
    ? body.images.map((item) => String(item || '').trim()).filter(Boolean)
    : [];
  imageValues.forEach((item) => formData.append('images', item));

  if (primaryFile) {
    formData.append('image_file', primaryFile);
  }

  (imageFiles.length ? imageFiles : primaryFile ? [primaryFile] : []).forEach((file) => {
    formData.append('image_files', file);
  });

  if (Array.isArray(body.compatible_fabrics)) {
    formData.append(
      'compatible_fabrics_json',
      JSON.stringify(body.compatible_fabrics.map((item) => String(item || '').trim()).filter(Boolean))
    );
  }

  return {
    body: formData,
    isFormData: true,
  };
}

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
  const body = typeof options.body === 'string' ? options.body : options.body instanceof FormData ? '[form-data]' : '';
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
    const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;

    let response;

    try {
      response = await fetch(buildUrl(path, query), {
        headers: {
          ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
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
  createFabric: (payload, token) => {
    const prepared = prepareRequestBody(payload);
    return request('/admin/fabrics/', { method: 'POST', body: prepared.body }, token);
  },
  getDesigns: (token) => request('/admin/designs/', {}, token),
  createDesign: (payload, token) => {
    const prepared = prepareRequestBody(payload);
    return request('/admin/designs/', { method: 'POST', body: prepared.body }, token);
  },
};
