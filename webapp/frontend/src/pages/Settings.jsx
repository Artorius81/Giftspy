import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api'
import { useData } from '../hooks/useData'
import { showAlert } from '../utils/popup'

const MARKETPLACES = [
  { key: 'wildberries', label: 'Wildberries', color: '#cb11ab' },
  { key: 'ozon', label: 'Ozon', color: '#005bff' },
  { key: 'yandex_market', label: 'Яндекс Маркет', color: '#fc0' },
]

export default function Settings() {
  const navigate = useNavigate()
  const { data: profile, loading, mutate } = useData('profile', api.getProfile)

  const [spyMode, setSpyMode] = useState(false)
  const [toggling, setToggling] = useState(false)

  // Marketplace search settings
  const [marketplaceSearch, setMarketplaceSearch] = useState(() => {
    return localStorage.getItem('giftspy-mp-search') !== 'false'
  })
  const [activeMarketplaces, setActiveMarketplaces] = useState(() => {
    const saved = localStorage.getItem('giftspy-marketplaces')
    return saved ? JSON.parse(saved) : ['wildberries', 'ozon', 'yandex_market']
  })

  // Theme
  const [theme, setTheme] = useState(() => localStorage.getItem('giftspy-theme') || 'dark')

  useEffect(() => {
    if (profile) {
      setSpyMode(profile.spy_mode)
    }
  }, [profile])

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('giftspy-theme', theme)
  }, [theme])

  useEffect(() => {
    localStorage.setItem('giftspy-mp-search', marketplaceSearch)
  }, [marketplaceSearch])

  useEffect(() => {
    localStorage.setItem('giftspy-marketplaces', JSON.stringify(activeMarketplaces))
  }, [activeMarketplaces])

  const handleToggleSpy = async () => {
    setToggling(true)
    try {
      const result = await api.toggleSpyMode()
      setSpyMode(result.spy_mode)
      if (profile) mutate({ ...profile, spy_mode: result.spy_mode })
    } catch (e) {
      await showAlert(e.message)
    }
    setToggling(false)
  }

  const handleToggleMarketplaceSearch = () => {
    setMarketplaceSearch(prev => !prev)
  }

  const toggleMarketplace = (key) => {
    setActiveMarketplaces(prev => {
      if (prev.includes(key)) {
        if (prev.length === 1) return prev
        return prev.filter(k => k !== key)
      }
      return [...prev, key]
    })
  }

  if (loading) return <div className="page"><div className="loading"><div className="spinner" /></div></div>

  const isPremium = !!profile?.is_premium

  // Format premium expiration date
  const premiumExpiry = isPremium && profile?.premium_until
    ? new Date(profile.premium_until).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })
    : null

  return (
    <div className="page">
      <div className="header">
        <button className="header__back" onClick={() => navigate(-1)}>
          <span className="icon">‹</span>
        </button>
        <span className="header__title">⚙️ Настройки</span>
        <div className="header__placeholder" />
      </div>

      {/* Premium Functions */}
      <div className="section-header">
        <div className="section-header__title">👑 Премиум</div>
      </div>

      <div className="settings-card">
        {/* Spy Mode Toggle */}
        <div className="settings-row">
          <div className="settings-row__info">
            <div className="settings-row__label">🕵️ Шпионский режим</div>
            <div className="settings-row__desc">
              {isPremium
                ? 'Просматривайте переписку и перехватывайте контроль'
                : 'Доступно с подпиской Премиум'}
            </div>
          </div>
          <button
            className={`toggle ${spyMode ? 'active' : ''}`}
            disabled={!isPremium || toggling}
            onClick={handleToggleSpy}
          >
            <span className="toggle__knob" />
          </button>
        </div>

        <div className="settings-divider" />

        {/* Marketplace Search Toggle */}
        <div className="settings-row">
          <div className="settings-row__info">
            <div className="settings-row__label">🛍 Поиск по маркетплейсам</div>
            <div className="settings-row__desc">
              {isPremium
                ? 'Ищите подарки на Ozon, Wildberries и Яндекс Маркет'
                : 'Доступно с подпиской Премиум'}
            </div>
          </div>
          <button
            className={`toggle ${marketplaceSearch ? 'active' : ''}`}
            disabled={!isPremium}
            onClick={handleToggleMarketplaceSearch}
          >
            <span className="toggle__knob" />
          </button>
        </div>

        {/* Marketplace selection (only when search is enabled) */}
        {isPremium && marketplaceSearch && (
          <div className="settings-mp-filters">
            <div className="settings-row__desc" style={{ marginBottom: 8 }}>Маркетплейсы для поиска:</div>
            <div className="mp-toggles mp-toggles--settings">
              {MARKETPLACES.map(mp => (
                <button
                  key={mp.key}
                  className={`mp-toggle ${activeMarketplaces.includes(mp.key) ? 'active' : ''}`}
                  style={activeMarketplaces.includes(mp.key) ? { borderColor: mp.color, background: mp.color + '18' } : {}}
                  onClick={() => toggleMarketplace(mp.key)}
                >
                  <span className="mp-toggle__dot" style={{ background: mp.color }} />
                  <span className="mp-toggle__label">{mp.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {isPremium && premiumExpiry && (
          <div className="settings-row__desc" style={{ marginTop: 12, fontSize: 12, color: 'var(--text-secondary)' }}>
            ✅ Подписка активна до {premiumExpiry}
          </div>
        )}

        {!isPremium && (
          <button className="btn btn--primary" style={{ marginTop: 12 }} onClick={() => navigate('/store')}>
            🛍 Купить Премиум
          </button>
        )}
      </div>

      {/* Theme */}
      <div className="section-header">
        <div className="section-header__title">🎨 Оформление</div>
      </div>

      <div className="settings-card">
        <div className="settings-row__label" style={{ marginBottom: 12 }}>Тема приложения</div>
        <div className="theme-switcher">
          <button
            className={`theme-option ${theme === 'dark' ? 'active' : ''}`}
            onClick={() => setTheme('dark')}
          >
            🌙 Тёмная
          </button>
          <button
            className={`theme-option ${theme === 'light' ? 'active' : ''}`}
            onClick={() => setTheme('light')}
          >
            ☀️ Светлая
          </button>
        </div>
      </div>

      {/* Language */}
      <div className="section-header">
        <div className="section-header__title">🌐 Язык</div>
      </div>

      <div className="settings-card">
        <div className="settings-row">
          <div className="settings-row__info">
            <div className="settings-row__label">Язык интерфейса</div>
            <div className="settings-row__desc">Русский</div>
          </div>
          <span className="badge">🇷🇺 RU</span>
        </div>
      </div>
    </div>
  )
}
