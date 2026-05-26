import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api'
import { mutateData } from '../hooks/useData'
import { showAlert } from '../utils/popup'

const PRODUCTS = [
  {
    id: 'inv_1',
    icon: '🔍',
    title: '1 Расследование',
    desc: 'Пополнение баланса на 1 расследование',
    price: '1 ₽',
  },
  {
    id: 'inv_3',
    icon: '🔍×3',
    title: '3 Расследования',
    desc: 'Выгодный набор — скидка 17%',
    price: '249 ₽',
    badge: 'Выгодно',
  },
  {
    id: 'prem_1',
    icon: '👑',
    title: 'Премиум (1 месяц)',
    desc: 'Безлимитные расследования + шпионский режим',
    price: '1 ₽',
    badge: 'Премиум',
  },
]

export default function Store() {
  const navigate = useNavigate()
  const [buying, setBuying] = useState(null)

  // Refresh profile when user returns from payment page
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        api.getProfile().then(data => mutateData('profile', data)).catch(() => {})
        api.getBalance().then(data => mutateData('balance', data)).catch(() => {})
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [])

  const handleBuy = async (productId) => {
    if (buying) return
    setBuying(productId)
    try {
      const result = await api.createPayment(productId)
      if (result.payment_url) {
        // Open payment page
        if (window.Telegram?.WebApp) {
          window.Telegram.WebApp.openLink(result.payment_url)
        } else {
          window.open(result.payment_url, '_blank')
        }
      }
    } catch (err) {
      const msg = err.message || 'Ошибка создания платежа'
      await showAlert(msg)
    }
    setBuying(null)
  }

  return (
    <div className="page store-new-container">
      
      {/* Premium Header */}
      <div className="settings-new-header" style={{ marginBottom: '16px' }}>
        <button 
          className="wishlist-header-btn" 
          onClick={() => navigate(-1)} 
          style={{ width: 36, height: 36 }}
          aria-label="Назад"
        >
          ‹
        </button>
        <h1 className="settings-new-title">🛍️ Магазин Giftspy</h1>
        <div style={{ width: 36 }} />
      </div>

      {/* VIP Premium Perks card */}
      <div className="store-premium-vip-card">
        <div className="store-premium-glow-circle" />
        
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
          <span style={{ fontSize: 32 }} role="img" aria-label="crown">👑</span>
          <div>
            <div className="store-vip-title">Преимущества Premium</div>
            <div className="store-vip-desc">Подключите подписку для безграничных возможностей</div>
          </div>
        </div>
        
        <ul className="store-vip-list">
          <li className="store-vip-item">
            <span className="store-vip-item-icon">🔮</span>
            <span style={{ color: 'var(--text-secondary)' }}><b>Безлимитные расследования</b> (без списания баланса)</span>
          </li>
          <li className="store-vip-item">
            <span className="store-vip-item-icon">🕵️‍♂️</span>
            <span style={{ color: 'var(--text-secondary)' }}><b>Шпионский режим</b> (просмотр допроса ИИ-детектива)</span>
          </li>
          <li className="store-vip-item">
            <span className="store-vip-item-icon">⚡</span>
            <span style={{ color: 'var(--text-secondary)' }}><b>Приоритетная скорость</b> и мгновенные отчеты</span>
          </li>
        </ul>
      </div>

      {/* Dynamic Products Grid list */}
      <div className="store-product-grid">
        {PRODUCTS.map(p => {
          const isPremium = p.id === 'prem_1'
          return (
            <div
              key={p.id}
              onClick={() => handleBuy(p.id)}
              className={`store-product-card ${isPremium ? 'premium-item' : ''}`}
              style={{
                opacity: buying === p.id ? 0.6 : 1,
              }}
            >
              {p.badge && (
                <span 
                  className="badge" 
                  style={{ 
                    position: 'absolute', 
                    top: 14, 
                    right: 18, 
                    background: isPremium ? 'linear-gradient(135deg, #8b5cf6, #ec4899)' : 'var(--gradient-primary)', 
                    color: '#fff',
                    fontWeight: 800,
                    fontSize: '10px',
                    padding: '3px 8px',
                    borderRadius: '20px',
                    textTransform: 'uppercase'
                  }}
                >
                  {p.badge}
                </span>
              )}
              
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <div className="store-product-icon-wrapper">
                  {p.icon}
                </div>
                
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="store-product-title">{p.title}</div>
                  <div className="store-product-desc">{p.desc}</div>
                </div>
              </div>
              
              <div className="store-product-footer">
                <span className="store-product-price-label">Стоимость</span>
                <button 
                  className="store-product-buy-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleBuy(p.id);
                  }}
                >
                  {buying === p.id ? '⏳ Покупка...' : p.price}
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
