import { useState, useEffect, useRef } from 'react'
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
  const [initialProfile, setInitialProfile] = useState(null)
  const isPollingRef = useRef(false)

  // Cache initial profile when mounting
  useEffect(() => {
    api.getProfile().then(p => {
      setInitialProfile(p)
    }).catch(console.error)
  }, [])

  // Poll for updates upon return and notify user
  useEffect(() => {
    let timer = null
    let attempts = 0
    const maxAttempts = 5

    const checkStatus = async () => {
      try {
        const newProfile = await api.getProfile()
        mutateData('profile', newProfile)
        
        if (initialProfile) {
          if (newProfile.is_premium && !initialProfile.is_premium) {
            await showAlert('👑 Поздравляем! Премиум успешно активирован!')
            setInitialProfile(newProfile)
            isPollingRef.current = false
            return true
          }
          if (newProfile.balance > initialProfile.balance) {
            const diff = newProfile.balance - initialProfile.balance
            await showAlert(`🎉 Баланс успешно пополнен! Добавлено расследований: ${diff}`)
            setInitialProfile(newProfile)
            isPollingRef.current = false
            return true
          }
        }
      } catch (e) {
        console.error(e)
      }
      return false
    }

    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && !isPollingRef.current) {
        isPollingRef.current = true
        attempts = 0
        
        const poll = async () => {
          const success = await checkStatus()
          if (success) return
          
          attempts++
          if (attempts < maxAttempts && isPollingRef.current) {
            timer = setTimeout(poll, 3000)
          } else {
            isPollingRef.current = false
          }
        }
        
        poll()
      }
    }

    document.addEventListener('visibilitychange', handleVisibility)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility)
      if (timer) clearTimeout(timer)
    }
  }, [initialProfile])

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
    <div className="page page-profile-bg store-new-container">
      
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
      <div className="store-premium-vip-card" style={{
        background: 'linear-gradient(135deg, rgba(25, 25, 35, 0.65) 0%, rgba(15, 15, 20, 0.85) 100%)',
        border: '1px solid rgba(255, 215, 0, 0.25)',
        boxShadow: '0 8px 32px rgba(255, 215, 0, 0.05)',
        backdropFilter: 'blur(10px)'
      }}>
        <div className="store-premium-glow-circle" />
        
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
          <span style={{ fontSize: 32 }} role="img" aria-label="crown">👑</span>
          <div>
            <div className="store-vip-title">Преимущества Premium</div>
            <div className="store-vip-desc">Подключите подписку для безграничных возможностей</div>
          </div>
        </div>
        
        <ul className="store-vip-list" style={{ gap: '10px' }}>
          <li className="store-vip-item">
            <span className="store-vip-item-icon">🔮</span>
            <span style={{ color: 'var(--text-secondary)' }}><b>Безлимитные дела</b> (расследования без списания баланса)</span>
          </li>
          <li className="store-vip-item">
            <span className="store-vip-item-icon">🕵️‍♂️</span>
            <span style={{ color: 'var(--text-secondary)' }}><b>Шпионский режим</b> (просмотр диалога ИИ-детектива в реальном времени)</span>
          </li>
          <li className="store-vip-item">
            <span className="store-vip-item-icon">🤖</span>
            <span style={{ color: 'var(--text-secondary)' }}><b>Выбор ИИ моделей</b> (выбирайте GPT-4o, Claude 4.6, Claude Opus и др.)</span>
          </li>
          <li className="store-vip-item">
            <span className="store-vip-item-icon">🎩</span>
            <span style={{ color: 'var(--text-secondary)' }}><b>Доступ ко всем детективам</b> (полный список из 8 харизматичных сыщиков)</span>
          </li>
          <li className="store-vip-item">
            <span className="store-vip-item-icon">⚡</span>
            <span style={{ color: 'var(--text-secondary)' }}><b>Приоритетная скорость</b> и мгновенные отчеты расследований</span>
          </li>
        </ul>
      </div>

      {/* Dynamic Products Grid list */}
      <div className="store-product-grid">
        {PRODUCTS.map(p => {
          const isPremium = p.id === 'prem_1'
          
          // Render custom icon JSX
          let iconJsx = <span style={{ fontSize: '26px' }}>{p.icon}</span>;
          if (p.id === 'inv_3') {
            iconJsx = (
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '42px', height: '42px' }}>
                <span style={{ fontSize: '28px', transform: 'translate(-2px, -2px)' }}>🔍</span>
                <span style={{
                  position: 'absolute',
                  bottom: '-2px',
                  right: '-2px',
                  background: 'var(--accent, #8b5cf6)',
                  color: '#ffffff',
                  fontSize: '10px',
                  fontWeight: '900',
                  borderRadius: '50%',
                  width: '18px',
                  height: '18px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '2px solid var(--card-bg, #15151f)',
                  boxShadow: '0 2px 5px rgba(0,0,0,0.3)',
                  lineHeight: '1'
                }}>3</span>
              </div>
            );
          } else if (p.id === 'inv_1') {
            iconJsx = <span style={{ fontSize: '26px' }}>🔍</span>;
          } else if (p.id === 'prem_1') {
            iconJsx = <span style={{ fontSize: '26px', filter: 'drop-shadow(0 0 8px rgba(255, 215, 0, 0.45))' }}>👑</span>;
          }

          return (
            <div
              key={p.id}
              onClick={() => handleBuy(p.id)}
              className={`store-product-card ${isPremium ? 'premium-item royal-premium-card-gradient' : ''}`}
              style={{
                opacity: buying === p.id ? 0.6 : 1,
                cursor: 'pointer'
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
                <div className="store-product-icon-wrapper" style={{ flexShrink: 0 }}>
                  {iconJsx}
                </div>
                
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="store-product-title">{p.title}</div>
                  <div className="store-product-desc">{p.desc}</div>
                </div>
              </div>
              
              <div className="store-product-footer">
                <span className="store-product-price-label">Стоимость</span>
                <button 
                  className={isPremium ? 'store-product-buy-btn premium-shimmer-btn' : 'store-product-buy-btn'}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleBuy(p.id);
                  }}
                  style={isPremium ? {
                    padding: '10px 22px',
                    fontSize: '14px'
                  } : {
                    background: 'rgba(255,255,255,0.05)',
                    color: 'var(--text)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    boxShadow: 'none',
                    fontWeight: 700
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
