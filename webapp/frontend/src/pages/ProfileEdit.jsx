import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api'
import { useData } from '../hooks/useData'
import { showAlert } from '../utils/popup'
import { getTargetEmoji } from './TargetDetail'
import { timeAgo } from '../utils/timeAgo'

// Детерминированные эмодзи-аватары для пользователей по умолчанию
const CUTE_EMOJIS = ['🐰', '🦊', '🐼', '🐨', '🐱', '🐹', '🐯', '🦁', '🦄', '🐸'];

const STATUS = {
  pending: { icon: '🟡', label: 'Ожидание', dot: 'pending' },
  started: { icon: '🔵', label: 'Начато', dot: 'active' },
  in_progress: { icon: '🔵', label: 'Допрос', dot: 'active' },
  manual_mode: { icon: '🛑', label: 'Перехват', dot: 'active' },
  done: { icon: '✅', label: 'Готово', dot: 'done' },
  delivered: { icon: '✅', label: 'Доставлено', dot: 'done' },
  cancelled: { icon: '❌', label: 'Отменено', dot: 'cancelled' },
  error: { icon: '⚠️', label: 'Ошибка', dot: 'cancelled' },
}

const validateBirthday = (bdayStr) => {
  if (!bdayStr) return true;
  const parts = bdayStr.split('.')
  if (parts.length === 2) {
    const day = parseInt(parts[0], 10)
    const month = parseInt(parts[1], 10)
    if (isNaN(day) || isNaN(month)) return false
    if (month < 1 || month > 12) return false
    const maxDays = new Date(2024, month, 0).getDate()
    if (day < 1 || day > maxDays) return false
    return true
  }
  if (parts.length === 3) {
    const day = parseInt(parts[0], 10)
    const month = parseInt(parts[1], 10)
    const year = parseInt(parts[2], 10)
    if (isNaN(day) || isNaN(month) || isNaN(year)) return false
    if (month < 1 || month > 12) return false
    const currentYear = new Date().getFullYear()
    if (year < 1900 || year > currentYear) return false
    const maxDays = new Date(year, month, 0).getDate()
    if (day < 1 || day > maxDays) return false
    return true
  }
  return false
}

// Helper to format elapsed time in Russian compact format
function formatElapsedCompact(dateStr) {
  if (!dateStr) return '~1д';
  const created = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - created.getTime()
  const diffMins = Math.floor(diffMs / (1000 * 60))
  if (diffMins < 60) return `~${Math.max(1, diffMins)}м`;
  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24) return `~${diffHours}ч`;
  const diffDays = Math.floor(diffHours / 24)
  return `~${diffDays}д`;
}

// Helper to format item counts in Russian plural
function getItemsText(count) {
  if (count % 10 === 1 && count % 100 !== 11) return `${count} предмет`;
  if (count % 10 >= 2 && count % 10 <= 4 && (count % 100 < 10 || count % 100 >= 20)) return `${count} предмета`;
  return `${count} предметов`;
}

export default function ProfileEdit() {
  const navigate = useNavigate()
  const [collapsed, setCollapsed] = useState({})
  const { data: profile, loading, mutate } = useData('profile', api.getProfile)
  const { data: cases, mutate: mutateCases } = useData('cases', api.getCases)
  const { data: targetsData } = useData('targets', api.getTargets)

  // Poll for cases status updates
  useEffect(() => {
    const interval = setInterval(() => {
      api.getCases().then(mutateCases).catch(console.error)
    }, 10000)
    return () => clearInterval(interval)
  }, [mutateCases])

  const toggleGroup = (target) => {
    setCollapsed(prev => ({ ...prev, [target]: !prev[target] }))
  }

  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const fileInputRef = useRef(null)

  const [form, setForm] = useState({
    nickname: '',
    birthday: '',
  })

  useEffect(() => {
    if (profile) {
      setForm({
        nickname: profile.nickname || '',
        birthday: profile.birthday || '',
      })
    }
  }, [profile])

  const handleSave = async (e) => {
    e.preventDefault()
    if (!form.nickname.trim()) {
      await showAlert('Пожалуйста, введите имя')
      return
    }
    if (form.birthday && !validateBirthday(form.birthday)) {
      await showAlert('Пожалуйста, введите корректную дату рождения в формате ДД.ММ.ГГГГ')
      return
    }
    setSaving(true)
    try {
      await api.updateProfile({
        nickname: form.nickname.trim(),
        birthday: form.birthday || null,
      })
      // Reload profile
      const updated = await api.getProfile()
      mutate(updated)
      setShowEditModal(false)
      await showAlert('✅ Профиль обновлён!')
    } catch (err) {
      await showAlert(err.message)
    }
    setSaving(false)
  }

  const handlePhotoUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      await showAlert('Пожалуйста, выберите изображение')
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      await showAlert('Файл слишком большой (макс. 10 МБ)')
      return
    }

    setUploading(true)
    try {
      const result = await api.uploadProfilePhoto(file)
      mutate({ ...profile, photo: result.photo })
      await showAlert('📷 Фото профиля обновлено!')
    } catch (err) {
      await showAlert(err.message)
    }
    setUploading(false)
  }

  // Получить детерминированный случайный аватар на основе user_id
  const getDefaultAvatar = (userId) => {
    if (!userId) return '🐰'
    const idx = Math.abs(parseInt(userId, 10)) % CUTE_EMOJIS.length
    return CUTE_EMOJIS[idx]
  }

  // Форматирует дату ДД.ММ.ГГГГ или ДД.ММ в красивую строку на русском: "Сб, 6 дек"
  const formatBirthday = (bdayStr) => {
    if (!bdayStr) return 'Не указан'
    const parts = bdayStr.split('.')
    if (parts.length >= 2) {
      const day = parseInt(parts[0], 10)
      const month = parseInt(parts[1], 10) - 1
      const currentYear = new Date().getFullYear()
      if (!isNaN(day) && !isNaN(month) && month >= 0 && month < 12) {
        const date = new Date(currentYear, month, day)
        if (!isNaN(date.getTime())) {
          const weekdays = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб']
          const months = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек']
          return `${weekdays[date.getDay()]}, ${day} ${months[date.getMonth()]}`
        }
      }
    }
    return bdayStr
  }

  const handleAddressClick = () => {
    showAlert('Функция в разработке 🚀')
  }

  if (loading) return <div className="page page-profile-bg"><div className="loading"><div className="spinner" /></div></div>
  if (!profile) return <div className="page page-profile-bg"><div className="empty-state"><div className="empty-state__title">Ошибка загрузки</div></div></div>

  const allCases = cases || []

  // Group cases by target
  const grouped = {}
  allCases.forEach(c => {
    if (!grouped[c.target]) {
      grouped[c.target] = {
        display: c.display_name,
        cases: [],
        target_photo: c.target_photo,
        target_db_id: c.target_db_id,
        hasActive: false,
      }
    }
    grouped[c.target].cases.push(c)
    if (['pending', 'started', 'in_progress', 'manual_mode'].includes(c.status)) {
      grouped[c.target].hasActive = true
    }
  })

  // Sort: active-first targets
  const sortedGroups = Object.entries(grouped).sort(([, a], [, b]) => {
    if (a.hasActive && !b.hasActive) return -1
    if (!a.hasActive && b.hasActive) return 1
    return 0
  })

  // Получить имя и юзернейм из Telegram WebApp
  const tgUser = window.Telegram?.WebApp?.initDataUnsafe?.user || {}
  const displayPhone = profile?.phone || (tgUser.username ? `@${tgUser.username}` : 'Не указан')
  const displayName = profile.nickname || `${tgUser.first_name || ''} ${tgUser.last_name || ''}`.trim() || 'Пользователь'

  // Подсчитать общее количество целей
  const targetsCount = targetsData ? targetsData.length : 0
  const wishlistSubtitle = `${targetsCount} ${targetsCount === 1 ? 'идея' : targetsCount > 1 && targetsCount < 5 ? 'идеи' : 'идей'}`

  return (
    <>
      <div className="page page-profile-bg">
      {/* Шапка профиля — Убраны сторонние кнопки */}
      <div className="new-header" style={{ justifyContent: 'center', background: 'transparent', borderBottom: 'none', paddingBottom: '8px' }}>
        <h1 className="new-header-title" style={{ fontSize: '20px', fontWeight: '800', color: 'var(--text)' }}>Профиль</h1>
      </div>

      {/* Блок пользователя (Имя, Телефон, Бейдж, Аватар) */}
      <div className="new-profile-header">
        <div className="new-profile-info">
          <div className="new-profile-name">{displayName}</div>
          <div className="new-profile-phone">{displayPhone}</div>
          <div className="new-profile-actions">
            <div className="new-profile-badge">
              <span className="badge-icon">👤</span> Вы
            </div>
            <button
              className="new-profile-edit-btn"
              onClick={() => setShowEditModal(true)}
              aria-label="Редактировать профиль"
            >
              ✏️
            </button>
            <button
              className="new-profile-edit-btn"
              onClick={() => navigate('/settings')}
              aria-label="Настройки"
              style={{ marginLeft: 8 }}
            >
              ⚙️
            </button>
          </div>
        </div>

        {/* Кликабельный аватар для загрузки */}
        <div
          className="new-profile-avatar-container"
          onClick={() => fileInputRef.current?.click()}
        >
          {uploading ? (
            <div className="spinner" style={{ width: 28, height: 28 }} />
          ) : profile.photo && profile.photo !== 'None' ? (
            <img src={profile.photo} alt="" />
          ) : (
            <span className="new-profile-avatar-emoji">{getDefaultAvatar(profile.user_id)}</span>
          )}
          <div className="new-profile-avatar-overlay">📷</div>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={handlePhotoUpload}
        />
      </div>

      <hr className="new-profile-divider" />

      {/* Информация о балансе и Премиум подписке */}
      <div className="profile-balance-premium-container" style={{ margin: '16px 0', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {/* Карточка Баланса */}
        <div
          className="profile-order-card"
          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: 0, padding: '14px 18px', gap: 12 }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
            <span style={{ fontSize: 22, flexShrink: 0 }}>🔍</span>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)' }}>Баланс</div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2, whiteSpace: 'normal', wordBreak: 'break-word' }}>Используется для отправки Детектива</div>
            </div>
          </div>
          <div style={{ fontWeight: 800, fontSize: 16, color: 'var(--accent)', whiteSpace: 'nowrap', flexShrink: 0 }}>
            {profile.is_premium ? 'Безлимит 👑' : `${profile.balance || 0} шт.`}
          </div>
        </div>

        {/* Карточка Премиума */}
        {profile.is_premium ? (
          <div
            className="profile-order-card"
            style={{
              display: 'flex',
              justifyContent: 'flex-start',
              alignItems: 'center',
              gap: 14,
              margin: 0,
              padding: '14px 18px',
              background: 'linear-gradient(135deg, rgba(167, 139, 250, 0.1) 0%, rgba(139, 92, 246, 0.1) 100%)',
              border: '1px solid rgba(139, 92, 246, 0.2)'
            }}
          >
            <span style={{ fontSize: 24 }}>👑</span>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)' }}>Премиум активен</div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                До {new Date(profile.premium_until).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}
              </div>
            </div>
          </div>
        ) : (
          <div
            className="profile-order-card"
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
              margin: 0,
              padding: '16px 18px',
              background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.08) 0%, rgba(236, 72, 153, 0.08) 100%)',
              border: '1px solid rgba(139, 92, 246, 0.15)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <span style={{ fontSize: 26 }}>👑</span>
              <div>
                <div style={{ fontWeight: 800, fontSize: 15, color: 'var(--text)' }}>Получите Giftspy Premium</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2, lineHeight: 1.4 }}>
                  Безлимитные расследования, шпионский режим, умные рекомендации и приоритетная поддержка!
                </div>
              </div>
            </div>
            <button
              className="btn-send-detective"
              onClick={() => navigate('/store')}
              style={{
                margin: 0,
                width: '100%',
                background: 'linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%)',
                color: '#fff',
                fontWeight: 700,
                fontSize: 14,
                padding: '10px 0',
                borderRadius: '12px',
                border: 'none',
                boxShadow: '0 4px 12px rgba(139, 92, 246, 0.25)',
                cursor: 'pointer'
              }}
            >
              Активировать Premium
            </button>
          </div>
        )}
      </div>

      {/* Баннер доставки подарков */}
      <div className="receive-gifts-banner">
        <div className="receive-gifts-hero">
          <span className="receive-gifts-icon">🏠</span>
          <div className="receive-gifts-content">
            <span className="receive-gifts-title">Хотите получать подарки?</span>
            <span className="receive-gifts-desc">
              Добавьте свой адрес доставки, чтобы ваши друзья могли отправлять вам сюрпризы напрямую.
            </span>
          </div>
        </div>
        <button className="receive-gifts-btn" onClick={handleAddressClick}>
          <span>+</span> Добавить адрес
        </button>
        <div className="receive-gifts-lock">
          <span>🔒</span> Адрес будет виден только вам
        </div>
      </div>

      {/* Сетка: День рождения и Адрес */}
      <div className="profile-grid">
        {/* Карточка дня рождения */}
        <div className="profile-grid-card" onClick={() => setShowEditModal(true)} style={{ cursor: 'pointer' }}>
          <span className="profile-grid-card-icon">🎂</span>
          <div className="profile-grid-card-bottom">
            <span className="profile-grid-card-label">День рождения</span>
            <span className="profile-grid-card-value">{formatBirthday(profile.birthday)}</span>
          </div>
        </div>

        {/* Карточка добавления адреса */}
        <div className="profile-grid-card">
          <span className="profile-grid-card-icon">🏠</span>
          <button className="profile-grid-card-action" onClick={handleAddressClick}>
            <span>+</span> Добавить адрес
          </button>
        </div>
      </div>

      {/* Premium Wishlist Card Widget (mockup design) */}
      <div className="profile-wishlist-card-premium" style={{ marginBottom: '100px' }}>
        <div className="profile-wishlist-header-row" onClick={() => navigate('/targets/my')}>
          <div className="profile-wishlist-sheet-icon">
            📄<span className="profile-wishlist-heart-badge">❤️</span>
          </div>
          <div className="profile-wishlist-header-info">
            <span className="profile-wishlist-title">Вишлист</span>
            <span className="profile-wishlist-subtitle">{getItemsText(profile.wishlist?.length || 0)}</span>
          </div>
        </div>

        {profile.wishlist && profile.wishlist.length > 0 && (
          <div className="profile-wishlist-items-box">
            {profile.wishlist.map((item, idx) => (
              <div key={item.id || idx} className="profile-wishlist-item-row" onClick={() => navigate('/targets/my')}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', overflow: 'hidden' }}>
                  <span className="profile-wishlist-item-gift-icon">🎁</span>
                  <span className="profile-wishlist-item-desc">{item.description || item.gift_description}</span>
                </div>
                <span className="profile-wishlist-item-time">{formatElapsedCompact(item.created_at)}</span>
              </div>
            ))}
          </div>
        )}

        <button className="profile-wishlist-add-idea-btn" onClick={() => navigate('/targets/my')}>
          ＋ Добавить подарок
        </button>
      </div>
    </div>

    {/* iOS-Style Bottom Sheet форма редактирования */}
    {showEditModal && (
      <>
        <div className="bottom-sheet-backdrop" onClick={() => setShowEditModal(false)} />
        <div className="bottom-sheet">
          <div className="bottom-sheet-header">
            <span className="bottom-sheet-title">Редактировать профиль</span>
            <button className="bottom-sheet-close" onClick={() => setShowEditModal(false)}>✕</button>
          </div>

          <form onSubmit={handleSave}>
            <div className="input-group">
              <label>👤 Имя / Никнейм</label>
              <input
                className="input"
                placeholder="Как вас зовут?"
                maxLength={32}
                value={form.nickname}
                onChange={e => setForm({ ...form, nickname: e.target.value })}
              />
              <span className="input-hint">{form.nickname.length}/32</span>
            </div>

            <div className="input-group">
              <label>🎂 День рождения</label>
              <input
                className="input"
                placeholder="ДД.ММ.ГГГГ"
                inputMode="numeric"
                maxLength={10}
                value={form.birthday}
                onChange={e => {
                  let v = e.target.value.replace(/[^\d.]/g, '')
                  const digits = v.replace(/\./g, '')
                  if (digits.length >= 4) v = digits.slice(0, 2) + '.' + digits.slice(2, 4) + '.' + digits.slice(4, 8)
                  else if (digits.length >= 2) v = digits.slice(0, 2) + '.' + digits.slice(2)
                  else v = digits
                  setForm({ ...form, birthday: v })
                }}
              />
            </div>

            <button className="btn btn--primary" type="submit" disabled={saving} style={{ marginTop: 8 }}>
              {saving ? '⏳ Сохранение...' : '✅ Сохранить'}
            </button>
          </form>
        </div>
      </>
    )}
  </>
  )
}
