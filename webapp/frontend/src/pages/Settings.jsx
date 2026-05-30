import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api'
import { useData } from '../hooks/useData'
import { showAlert } from '../utils/popup'

// Список дефолтных аватаров
const CUTE_EMOJIS = ['🐰', '🦊', '🐼', '🐨', '🐱', '🐹', '🐯', '🦁', '🦄', '🐸'];

export default function Settings() {
  const navigate = useNavigate()
  const { data: profile, loading, mutate } = useData('profile', api.getProfile)
  const tgUser = window.Telegram?.WebApp?.initDataUnsafe?.user || {}
  
  const [spyMode, setSpyMode] = useState(false)
  const [toggling, setToggling] = useState(false)

  // Переключение подразделов настроек: 'main', 'account', 'theme'
  const [settingsScreen, setSettingsScreen] = useState('main')

  // Тема: 'dark', 'light', 'system'
  const [theme, setTheme] = useState(() => localStorage.getItem('giftspy-theme') || 'dark')

  useEffect(() => {
    if (profile) {
      const isPremium = !!profile.is_premium
      setSpyMode(isPremium ? profile.spy_mode : false)
    }
  }, [profile])

  // Синхронизация системной темы и прослушивание изменений в ОС
  useEffect(() => {
    const applyTheme = () => {
      let activeTheme = theme
      if (theme === 'system') {
        const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches
        activeTheme = isDark ? 'dark' : 'light'
      }
      document.documentElement.setAttribute('data-theme', activeTheme)
    }

    applyTheme()
    localStorage.setItem('giftspy-theme', theme)

    if (theme === 'system') {
      const media = window.matchMedia('(prefers-color-scheme: dark)')
      const listener = () => applyTheme()
      media.addEventListener('change', listener)
      return () => media.removeEventListener('change', listener)
    }
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

  const getDefaultAvatar = (userId) => {
    if (!userId) return '🐰'
    const idx = Math.abs(parseInt(userId, 10)) % CUTE_EMOJIS.length
    return CUTE_EMOJIS[idx]
  }

  if (loading) return <div className="page page-profile-bg"><div className="loading"><div className="spinner" /></div></div>

  const isPremium = !!profile?.is_premium

  // Форматирование даты окончания премиума
  const premiumExpiry = isPremium && profile?.premium_until
    ? new Date(profile.premium_until).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })
    : null

  // 1. ЭКРАН ВЫБОРА ТЕМЫ (Theme Screen)
  if (settingsScreen === 'theme') {
    return (
      <div className="page page-profile-bg" style={{ padding: 0 }}>
        <div className="settings-new-container">
          
          <div className="settings-new-header">
            <button 
              className="wishlist-header-btn" 
              onClick={() => setSettingsScreen('main')} 
              style={{ width: 36, height: 36 }}
              aria-label="Назад"
            >
              ‹
            </button>
            <h1 className="settings-new-title">Оформление</h1>
            <div style={{ width: 36 }} />
          </div>

          {/* Сетка выбора тем с золотым/фиолетовым свечением */}
          <div className="settings-grid-actions">
            
            {/* Светлая тема */}
            <div 
              className={`settings-action-card settings-theme-card ${theme === 'light' ? 'active' : ''}`}
              onClick={() => { triggerHaptic(); setTheme('light'); }}
            >
              <div className="settings-action-icon-wrapper">
                <div className="settings-theme-glow-light"></div>
                <span className="settings-action-emoji">☀️</span>
              </div>
              <div className="settings-action-label">Светлая тема</div>
            </div>

            {/* Темная тема */}
            <div 
              className={`settings-action-card settings-theme-card ${theme === 'dark' ? 'active' : ''}`}
              onClick={() => { triggerHaptic(); setTheme('dark'); }}
            >
              <div className="settings-action-icon-wrapper">
                <div className="settings-theme-glow-dark"></div>
                <span className="settings-action-emoji">🌑</span>
              </div>
              <div className="settings-action-label">Тёмная тема</div>
            </div>

          </div>

          {/* Кнопка системной темы (подсвечивается зеленым, как на фото) */}
          <button 
            className={`settings-theme-system-btn ${theme === 'system' ? 'active' : ''}`}
            onClick={() => { triggerHaptic('medium'); setTheme('system'); }}
          >
            <span style={{ fontSize: '18px', marginRight: '4px' }}>📱</span>
            <span>Системная тема</span>
          </button>

        </div>
      </div>
    )
  }

  // 2. ЭКРАН НАСТРОЕК АККАУНТА (Account Screen с переносом Шпионского режима и заглушками)
  if (settingsScreen === 'account') {
    return (
      <div className="page page-profile-bg" style={{ padding: 0 }}>
        <div className="settings-new-container">
          
          <div className="settings-new-header">
            <button 
              className="wishlist-header-btn" 
              onClick={() => setSettingsScreen('main')} 
              style={{ width: 36, height: 36 }}
              aria-label="Назад"
            >
              ‹
            </button>
            <h1 className="settings-new-title">Аккаунт</h1>
            <div style={{ width: 36 }} />
          </div>

          {/* Плашка пользователя */}
          <div 
            className="settings-account-profile-capsule" 
            onClick={() => { triggerHaptic(); navigate('/profile/edit'); }}
          >
            <div className="settings-account-profile-avatar">
              {profile?.photo && profile?.photo !== 'None' ? (
                <img src={profile.photo} alt="" />
              ) : (
                <span>{getDefaultAvatar(profile?.user_id)}</span>
              )}
            </div>
            
            <div className="settings-account-profile-info">
              <div className="settings-account-profile-name">{profile?.nickname || 'Пользователь'}</div>
              <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                <div>Никнейм: {tgUser.username ? `@${tgUser.username}` : (profile?.nickname ? `@${profile.nickname.replace(/^@/, '')}` : 'Не указан')}</div>
                <div>Телефон: {profile?.phone || tgUser.phone_number || tgUser.phone || 'Не указан'}</div>
              </div>
            </div>
            
            <span className="settings-list-arrow">›</span>
          </div>

          <h2 className="settings-section-title">Премиум функции</h2>

          <div className="settings-list-group">
            
            {/* Шпионский режим */}
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

            {/* Будущая премиум-функция 1 */}
            <div className="settings-list-item" style={{ opacity: 0.65, cursor: 'default' }}>
              <div className="settings-list-icon">🚀</div>
              <div className="settings-list-info">
                <div className="settings-list-title">Супер-Детектив (Скоро)</div>
                <div className="settings-list-subtitle">Автоматический сбор подсказок искусственным интеллектом</div>
              </div>
              <button className="settings-toggle-btn" disabled>
                <span className="settings-toggle-knob" />
              </button>
            </div>

            {/* Будущая премиум-функция 2 */}
            <div className="settings-list-item" style={{ opacity: 0.65, cursor: 'default' }}>
              <div className="settings-list-icon">🎁</div>
              <div className="settings-list-info">
                <div className="settings-list-title">Умные рекомендации (Скоро)</div>
                <div className="settings-list-subtitle">Генерация подарков на основе характера цели</div>
              </div>
              <button className="settings-toggle-btn" disabled>
                <span className="settings-toggle-knob" />
              </button>
            </div>

          </div>

        </div>
      </div>
    )
  }

  // 3. ГЛАВНЫЙ ЭКРАН НАСТРОЕК
  return (
    <div className="page page-profile-bg" style={{ padding: 0 }}>
      <div className="settings-new-container">
        
        {/* Header */}
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
          <div style={{ width: 36 }} />
        </div>

        {/* Крупные кнопки-карточки */}
        <div className="settings-grid-actions">
          
          {/* Аккаунт */}
          <div 
            className="settings-action-card"
            onClick={() => { triggerHaptic(); setSettingsScreen('account'); }}
          >
            <div className="settings-action-icon-wrapper">
              <div className="settings-action-glow-wrench"></div>
              <span className="settings-action-emoji">🔧</span>
            </div>
            <div className="settings-action-label">Аккаунт</div>
          </div>

          {/* Оформление */}
          <div 
            className="settings-action-card"
            onClick={() => { triggerHaptic(); setSettingsScreen('theme'); }}
          >
            <div className="settings-action-icon-wrapper">
              <div className="settings-action-glow-palette"></div>
              <span className="settings-action-emoji">🎨</span>
            </div>
            <div className="settings-action-label">Оформление</div>
          </div>

        </div>

        {/* Раздел О приложении */}
        <h2 className="settings-section-title">О Giftspy</h2>

        <div className="settings-list-group">
          
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

        {/* Выйти */}
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

        {/* Футер */}
        <div className="settings-footer">
          <div className="settings-footer-version">1.0.0 (1)</div>
          <div className="settings-footer-copyright">Все права защищены © 2026 Giftspy Inc.</div>
        </div>

      </div>
    </div>
  )
}
