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
    <div className="page">
      <div className="header">
        <button className="header__back" onClick={() => navigate(-1)}>
          <span className="icon">‹</span>
        </button>
        <h1 className="header__title">🛍 Магазин</h1>
        <div className="header__placeholder" />
      </div>

      <div style={{ marginBottom: 16, padding: '16px', background: 'var(--gradient-card)', border: '1px solid var(--card-border)', borderRadius: 'var(--radius-md)' }}>
        <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>👑 Премиум включает:</div>
        <ul style={{ fontSize: 13, color: 'var(--text-secondary)', listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 4 }}>
          <li>• Безлимитное количество дел</li>
          <li>• Шпионский режим (чтение переписок)</li>
          <li>• Приоритетная обработка дел</li>
        </ul>
      </div>

      {PRODUCTS.map(p => (
        <div
          key={p.id}
          className="card"
          onClick={() => handleBuy(p.id)}
          style={{ opacity: buying === p.id ? 0.6 : 1 }}
        >
          <div className="card__header">
            <div className="card__avatar" style={{ fontSize: p.icon.length > 2 ? 18 : 24, padding: p.icon.length > 2 ? '0 4px' : 0 }}>
              <span style={{ whiteSpace: 'nowrap' }}>{p.icon}</span>
            </div>
            <div className="card__info">
              <div className="card__name">{p.title}</div>
              <div className="card__sub">{p.desc}</div>
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
            <div style={{
              fontSize: 18, fontWeight: 700,
              background: 'var(--gradient-primary)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text'
            }}>
              {buying === p.id ? '⏳...' : p.price}
            </div>
            {p.badge && <span className="badge badge--success">{p.badge}</span>}
          </div>
        </div>
      ))}
    </div>
  )
}
