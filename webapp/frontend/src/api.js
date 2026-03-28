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

const api = {
  // Profile
  getProfile: () => request('/api/profile'),

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

  // Personas
  getPersonas: () => request('/api/personas'),

  // Settings
  toggleSpyMode: () => request('/api/settings/spy-mode', { method: 'POST' }),

  // Balance
  getBalance: () => request('/api/balance'),
}

export default api
