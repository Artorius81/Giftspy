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
  const [modelSelectorEnabled, setModelSelectorEnabled] = useState(true)
  const [togglingModel, setTogglingModel] = useState(false)
  const [customDetectivesEnabled, setCustomDetectivesEnabled] = useState(false)
  const [togglingCustomDetectives, setTogglingCustomDetectives] = useState(false)

  // Переключение подразделов настроек: 'main', 'account', 'theme'
  const [settingsScreen, setSettingsScreen] = useState('main')

  // Тема: 'dark', 'light', 'system'
  const [theme, setTheme] = useState(() => localStorage.getItem('giftspy-theme') || 'dark')

  useEffect(() => {
    if (profile) {
      const isPremium = !!profile.is_premium
      setSpyMode(isPremium ? !!profile.spy_mode : false)
      setModelSelectorEnabled(isPremium ? !!profile.model_selector_enabled : false)
      setCustomDetectivesEnabled(isPremium ? !!profile.custom_detectives_enabled : false)
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

  const handleToggleModelSelector = async (e) => {
    e.stopPropagation()
    triggerHaptic()
    setTogglingModel(true)
    try {
      const result = await api.toggleModelSelector()
      setModelSelectorEnabled(result.model_selector_enabled)
      if (profile) mutate({ ...profile, model_selector_enabled: result.model_selector_enabled })
    } catch (e) {
      await showAlert(e.message)
    }
    setTogglingModel(false)
  }

  const handleToggleCustomDetectives = async (e) => {
    e.stopPropagation()
    triggerHaptic()
    setTogglingCustomDetectives(true)
    try {
      const result = await api.toggleCustomDetectives()
      setCustomDetectivesEnabled(result.custom_detectives_enabled)
      if (profile) mutate({ ...profile, custom_detectives_enabled: result.custom_detectives_enabled })
    } catch (e) {
      await showAlert(e.message)
    }
    setTogglingCustomDetectives(false)
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

  // 3. ЭКРАН НАСТРОЕК УВЕДОМЛЕНИЙ (Notifications Screen)
  if (settingsScreen === 'notifications') {
    const handleToggleNotification = async (field, currentValue) => {
      triggerHaptic()
      const newValue = !currentValue
      try {
        await api.updateNotifications({ [field]: newValue })
        if (profile) mutate({ ...profile, [field]: newValue })
      } catch (e) {
        await showAlert(e.message)
      }
    }

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
            <h1 className="settings-new-title">Уведомления</h1>
            <div style={{ width: 36 }} />
          </div>

          <h2 className="settings-section-title">Каналы уведомлений</h2>
          <div className="settings-list-group">
            
            {/* Дни рождения */}
            <div 
              className="settings-list-item"
              onClick={() => handleToggleNotification('notify_birthdays', profile?.notify_birthdays !== false)}
            >
              <div className="settings-list-icon">🎁</div>
              <div className="settings-list-info">
                <div className="settings-list-title">Дни рождения</div>
                <div className="settings-list-subtitle">Напоминания о приближающихся праздниках близких</div>
              </div>
              <button
                className={`settings-toggle-btn ${profile?.notify_birthdays !== false ? 'active' : ''}`}
                onClick={(e) => { e.stopPropagation(); handleToggleNotification('notify_birthdays', profile?.notify_birthdays !== false); }}
              >
                <span className="settings-toggle-knob" />
              </button>
            </div>

            {/* Ход расследования */}
            <div 
              className="settings-list-item"
              onClick={() => handleToggleNotification('notify_dialogue', profile?.notify_dialogue !== false)}
            >
              <div className="settings-list-icon">💬</div>
              <div className="settings-list-info">
                <div className="settings-list-title">Ход расследования</div>
                <div className="settings-list-subtitle">Оповещения в чате о репликах цели и ответах детектива</div>
              </div>
              <button
                className={`settings-toggle-btn ${profile?.notify_dialogue !== false ? 'active' : ''}`}
                onClick={(e) => { e.stopPropagation(); handleToggleNotification('notify_dialogue', profile?.notify_dialogue !== false); }}
              >
                <span className="settings-toggle-knob" />
              </button>
            </div>

            {/* Отчеты */}
            <div 
              className="settings-list-item"
              onClick={() => handleToggleNotification('notify_reports', profile?.notify_reports !== false)}
            >
              <div className="settings-list-icon">📂</div>
              <div className="settings-list-info">
                <div className="settings-list-title">Результаты расследований</div>
                <div className="settings-list-subtitle">Получение готовых досье и отчетов о вишлистах целей</div>
              </div>
              <button
                className={`settings-toggle-btn ${profile?.notify_reports !== false ? 'active' : ''}`}
                onClick={(e) => { e.stopPropagation(); handleToggleNotification('notify_reports', profile?.notify_reports !== false); }}
              >
                <span className="settings-toggle-knob" />
              </button>
            </div>

          </div>

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
            className="settings-account-profile-capsule no-active-scale" 
            style={{ cursor: 'default', transform: 'none' }}
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
                <div className="settings-list-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span>Шпионский режим</span>
                  {!isPremium && <span style={{ fontSize: '12px' }}>🔒</span>}
                </div>
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

            {/* Выбор ИИ моделей */}
            <div 
              className="settings-list-item"
              onClick={() => {
                if (!isPremium) {
                  triggerHaptic();
                  navigate('/store');
                }
              }}
            >
              <div className="settings-list-icon">🤖</div>
              <div className="settings-list-info">
                <div className="settings-list-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span>Выбор ИИ моделей</span>
                  {!isPremium && <span style={{ fontSize: '12px' }}>🔒</span>}
                </div>
                <div className="settings-list-subtitle">
                  {isPremium 
                    ? 'Смена ИИ моделей (GPT-4o, Claude) при создании дел'
                    : 'Возможность выбирать умные ИИ модели (Премиум)'}
                </div>
              </div>
              
              <button
                className={`settings-toggle-btn ${modelSelectorEnabled ? 'active' : ''}`}
                disabled={!isPremium || togglingModel}
                onClick={handleToggleModelSelector}
              >
                <span className="settings-toggle-knob" />
              </button>
            </div>

            {/* Конструктор детективов */}
            <div 
              className="settings-list-item"
              onClick={() => {
                if (!isPremium) {
                  triggerHaptic();
                  navigate('/store');
                }
              }}
            >
              <div className="settings-list-icon">✍️</div>
              <div className="settings-list-info">
                <div className="settings-list-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span>Конструктор детективов</span>
                  {!isPremium && <span style={{ fontSize: '12px' }}>🔒</span>}
                </div>
                <div className="settings-list-subtitle">
                  {isPremium 
                    ? 'Создавайте собственных детективов с уникальным ИИ характером'
                    : 'Возможность создавать своих детективов (Премиум)'}
                </div>
              </div>
              
              <button
                className={`settings-toggle-btn ${customDetectivesEnabled ? 'active' : ''}`}
                disabled={!isPremium || togglingCustomDetectives}
                onClick={handleToggleCustomDetectives}
              >
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

          {/* Уведомления */}
          <div 
            className="settings-action-card"
            onClick={() => { triggerHaptic(); setSettingsScreen('notifications'); }}
          >
            <div className="settings-action-icon-wrapper">
              <div className="settings-action-glow-palette" style={{ background: 'radial-gradient(circle, rgba(168, 85, 247, 0.25) 0%, transparent 70%)' }}></div>
              <span className="settings-action-emoji">🔔</span>
            </div>
            <div className="settings-action-label">Уведомления</div>
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
