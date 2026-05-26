import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api'
import { useData } from '../hooks/useData'
import { showAlert } from '../utils/popup'

export default function Settings() {
  const navigate = useNavigate()
  const { data: profile, loading, mutate } = useData('profile', api.getProfile)
  
  const [spyMode, setSpyMode] = useState(false)
  const [toggling, setToggling] = useState(false)

  // Theme
  const [theme, setTheme] = useState(() => localStorage.getItem('giftspy-theme') || 'dark')

  useEffect(() => {
    if (profile) {
      const isPremium = !!profile.is_premium
      setSpyMode(isPremium ? profile.spy_mode : false)
    }
  }, [profile])

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('giftspy-theme', theme)
  }, [theme])

  const triggerHaptic = (style = 'light') => {
    try {
      if (style === 'medium') {
        window.Telegram?.WebApp?.HapticFeedback?.impactOccurred('medium')
      } else {
        window.Telegram?.WebApp?.HapticFeedback?.impactOccurred('light')
      }
    } catch (e) {
      console.warn('Haptic not supported:', e)
    }
  }

  const handleToggleSpy = async (e) => {
    e.stopPropagation()
    triggerHaptic()
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

  const handleToggleTheme = () => {
    triggerHaptic('medium')
    const newTheme = theme === 'dark' ? 'light' : 'dark'
    setTheme(newTheme)
    showAlert(`Активирована ${newTheme === 'dark' ? 'тёмная' : 'светлая'} тема! ${newTheme === 'dark' ? '🌙' : '☀️'}`)
  }

  if (loading) return <div className="page page-profile-bg"><div className="loading"><div className="spinner" /></div></div>

  const isPremium = !!profile?.is_premium

  // Format premium expiration date
  const premiumExpiry = isPremium && profile?.premium_until
    ? new Date(profile.premium_until).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })
    : null

  return (
    <div className="page page-profile-bg" style={{ padding: 0 }}>
      <div className="settings-new-container">
        
        {/* Header matching user photo */}
        <div className="settings-new-header">
          <button 
            className="wishlist-header-btn" 
            onClick={() => navigate(-1)} 
            style={{ width: 36, height: 36 }}
            aria-label="Назад"
          >
            ‹
          </button>
          
          <h1 className="settings-new-title">Настройки</h1>
          
          <div style={{ width: 36 }} /> {/* spacer */}
        </div>

        {/* Top Grid of Actions (Wrench & Palette) */}
        <div className="settings-grid-actions">
          
          {/* Account settings card */}
          <div 
            className="settings-action-card"
            onClick={() => { triggerHaptic(); navigate('/profile/edit'); }}
          >
            <div className="settings-action-icon-wrapper">
              <div className="settings-action-glow-wrench"></div>
              <span className="settings-action-emoji">🔧</span>
            </div>
            <div className="settings-action-label">Аккаунт</div>
          </div>

          {/* Theme switcher card */}
          <div 
            className="settings-action-card"
            onClick={handleToggleTheme}
          >
            <div className="settings-action-icon-wrapper">
              <div className="settings-action-glow-palette"></div>
              <span className="settings-action-emoji">🎨</span>
            </div>
            <div className="settings-action-label">Оформление</div>
          </div>

        </div>

        {/* About Category */}
        <h2 className="settings-section-title">О Giftspy</h2>

        {/* Vertical Stacked Capsule List */}
        <div className="settings-list-group">
          
          {/* Premium Spy Mode setting */}
          <div 
            className="settings-list-item"
            onClick={() => {
              if (!isPremium) {
                triggerHaptic();
                navigate('/store');
              }
            }}
          >
            <div className="settings-list-icon">🕵️</div>
            <div className="settings-list-info">
              <div className="settings-list-title">Шпионский режим</div>
              <div className="settings-list-subtitle">
                {isPremium 
                  ? (premiumExpiry ? `Премиум активен до ${premiumExpiry}` : 'Активен')
                  : 'Слушайте разговоры и читайте переписку (Премиум)'}
              </div>
            </div>
            
            <button
              className={`settings-toggle-btn ${spyMode ? 'active' : ''}`}
              disabled={!isPremium || toggling}
              onClick={handleToggleSpy}
            >
              <span className="settings-toggle-knob" />
            </button>
          </div>

          {/* Terms & Conditions */}
          <div 
            className="settings-list-item"
            onClick={() => {
              triggerHaptic();
              showAlert('Пользовательское соглашение: Все подарки на платформе защищены и регулируются правилами сервиса 📜');
            }}
          >
            <div className="settings-list-icon">📄</div>
            <div className="settings-list-info">
              <div className="settings-list-title">Пользовательское соглашение</div>
            </div>
            <span className="settings-list-arrow">›</span>
          </div>

          {/* Privacy Policy */}
          <div 
            className="settings-list-item"
            onClick={() => {
              triggerHaptic();
              showAlert('Политика конфиденциальности: Ваши данные надежно зашифрованы и никогда не передаются третьим лицам 🔒');
            }}
          >
            <div className="settings-list-icon">🔒</div>
            <div className="settings-list-info">
              <div className="settings-list-title">Политика конфиденциальности</div>
            </div>
            <span className="settings-list-arrow">›</span>
          </div>

          {/* Contact */}
          <div 
            className="settings-list-item"
            onClick={() => {
              triggerHaptic();
              showAlert('Связаться с нами: Напишите в поддержку @giftspy_support_bot для решения любых вопросов ✉️');
            }}
          >
            <div className="settings-list-icon">✉️</div>
            <div className="settings-list-info">
              <div className="settings-list-title">Обратная связь</div>
            </div>
            <span className="settings-list-arrow">›</span>
          </div>

          {/* Join the Community */}
          <div 
            className="settings-list-item"
            onClick={() => {
              triggerHaptic();
              showAlert('Канал Giftspy: Присоединяйтесь к нашему Telegram-каналу, чтобы не пропустить обновления! 👥');
            }}
          >
            <div className="settings-list-icon">👥</div>
            <div className="settings-list-info">
              <div className="settings-list-title">Сообщество Giftspy</div>
            </div>
            <span className="settings-list-arrow">›</span>
          </div>

          {/* Give feedback */}
          <div 
            className="settings-list-item"
            onClick={() => {
              triggerHaptic();
              showAlert('Оставить отзыв: Нам очень важно ваше мнение! Напишите свои пожелания нашему боту поддержки ⭐');
            }}
          >
            <div className="settings-list-icon">⭐</div>
            <div className="settings-list-info">
              <div className="settings-list-title">Оценить приложение</div>
            </div>
            <span className="settings-list-arrow">›</span>
          </div>

        </div>

        {/* Exit Button */}
        <button 
          className="settings-signout-btn"
          onClick={() => {
            triggerHaptic();
            if (window.confirm('Вы действительно хотите выйти из аккаунта?')) {
              showAlert('Выход из аккаунта успешно выполнен 🚪');
            }
          }}
        >
          🚪 Выйти
        </button>

        {/* Footer Credit Matching photo */}
        <div className="settings-footer">
          <div className="settings-footer-version">1.0.0 (1)</div>
          <div className="settings-footer-copyright">Все права защищены © 2026 Giftspy Inc.</div>
        </div>

      </div>
    </div>
  )
}

