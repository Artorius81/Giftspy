/**
 * API client for Giftspy Mini App.
 * Sends Telegram initData for authentication.
 */

const getInitData = () => {
  if (window.Telegram?.WebApp?.initData) {
    return window.Telegram.WebApp.initData
  }
  return ''
}

const getDevUserId = () => {
  // For local development without Telegram
  return localStorage.getItem('dev_user_id') || ''
}

async function request(path, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  }

  const initData = getInitData()
  if (initData) {
    headers['X-Telegram-Init-Data'] = initData
  } else {
    const devId = getDevUserId()
    if (devId) {
      headers['X-Dev-User-Id'] = devId
    }
  }

  const res = await fetch(path, { ...options, headers })

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Network error' }))
    throw new Error(err.detail || `HTTP ${res.status}`)
  }

  return res.json()
}

async function requestFile(path, file) {
  const headers = {}

  const initData = getInitData()
  if (initData) {
    headers['X-Telegram-Init-Data'] = initData
  } else {
    const devId = getDevUserId()
    if (devId) {
      headers['X-Dev-User-Id'] = devId
    }
  }

  const formData = new FormData()
  formData.append('file', file)

  const res = await fetch(path, {
    method: 'POST',
    headers,
    body: formData,
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Network error' }))
    throw new Error(err.detail || `HTTP ${res.status}`)
  }

  return res.json()
}

const api = {
  // Profile
  getProfile: () => request('/api/profile'),
  updateProfile: (data) => request('/api/profile', {
    method: 'PUT', body: JSON.stringify(data)
  }),
  uploadProfilePhoto: (file) => requestFile('/api/profile/photo', file),

  // Targets
  getTargets: () => request('/api/targets'),
  getTarget: (id) => request(`/api/targets/${id}`),
  createTarget: (data) => request('/api/targets', {
    method: 'POST', body: JSON.stringify(data)
  }),
  updateTarget: (id, data) => request(`/api/targets/${id}`, {
    method: 'PUT', body: JSON.stringify(data)
  }),
  deleteTarget: (id) => request(`/api/targets/${id}`, { method: 'DELETE' }),
  uploadTargetPhoto: (id, file) => requestFile(`/api/targets/${id}/photo`, file),

  // Cases
  getCases: () => request('/api/cases'),
  getCase: (id) => request(`/api/cases/${id}`),
  getCaseChat: (id) => request(`/api/cases/${id}/chat`),
  sendChatMessage: (id, message) => request(`/api/cases/${id}/chat`, {
    method: 'POST', body: JSON.stringify({ message })
  }),
  interceptCase: (id) => request(`/api/cases/${id}/intercept`, {
    method: 'POST'
  }),
  returnDetective: (id) => request(`/api/cases/${id}/return-detective`, {
    method: 'POST'
  }),
  createCase: (data) => request('/api/cases', {
    method: 'POST', body: JSON.stringify(data)
  }),
  cancelCase: (id) => request(`/api/cases/${id}/cancel`, { method: 'POST' }),
  deleteCase: (id) => request(`/api/cases/${id}`, { method: 'DELETE' }),

  // Personas
  getPersonas: () => request('/api/personas'),

  // Settings
  toggleSpyMode: () => request('/api/settings/spy-mode', { method: 'POST' }),

  // Marketplace search
  searchMarketplaces: (query, marketplaces, limit = 20) => request('/api/marketplace/search', {
    method: 'POST',
    body: JSON.stringify({ query, marketplaces, limit })
  }),

  // Balance
  getBalance: () => request('/api/balance'),

  // Payments
  createPayment: (productId) => request('/api/payments/create', {
    method: 'POST', body: JSON.stringify({ product_id: productId })
  }),
}
export default api

