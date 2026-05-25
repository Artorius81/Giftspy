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
  const displayPhone = tgUser.username ? `@${tgUser.username}` : `+573150981777`
  const displayName = profile.nickname || `${tgUser.first_name || ''} ${tgUser.last_name || ''}`.trim() || 'Пользователь'

  // Подсчитать общее количество целей
  const targetsCount = targetsData ? targetsData.length : 0
  const wishlistSubtitle = `${targetsCount} ${targetsCount === 1 ? 'идея' : targetsCount > 1 && targetsCount < 5 ? 'идеи' : 'идей'}`

  return (
    <div className="page page-profile-bg">
      {/* Шапка профиля */}
      <div className="new-header">
        <button className="new-header-btn" onClick={() => navigate('/settings')} aria-label="Настройки">
          <span>⚙️</span>
        </button>
        <h1 className="new-header-title">Профиль</h1>
        <div style={{ width: 36 }} /> {/* спейсер для центрирования */}
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

      {/* Карточка списка желаний (Редизайн) */}
      <div className="profile-wishlist-card">
        <div className="profile-wishlist-card-top" onClick={() => navigate('/targets')}>
          <div className="profile-wishlist-card-icon-container">
            📝❤️
          </div>
          <div className="profile-wishlist-card-details">
            <span className="profile-wishlist-card-title">Список желаний</span>
            <span className="profile-wishlist-card-subtitle">{wishlistSubtitle}</span>
          </div>
        </div>
        <button className="profile-wishlist-card-btn" onClick={() => navigate('/targets')}>
          <span style={{ fontSize: '18px', marginRight: '6px', fontWeight: 'bold' }}>+</span> Добавить идею
        </button>
      </div>

      {/* Список активных расследований (Редизайн) */}
      <div className="section-header" style={{ margin: '16px 0 12px' }}>
        <h2 className="section-header__title" style={{ fontSize: '17px', color: 'var(--text)' }}>Мои расследования</h2>
      </div>

      {allCases.length === 0 ? (
        <div className="new-orders-empty">
          <div className="new-orders-empty-icon">
            <svg viewBox="0 0 24 24" width="40" height="40" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" style={{ color: 'var(--text-secondary)' }}>
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </div>
          <div className="new-orders-empty-text">
            Все ваши расследования появятся здесь.
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingBottom: 100 }}>
          {sortedGroups.map(([target, group]) => {
            const isExpanded = collapsed[target] === true
            return (
              <div key={target} style={{ display: 'flex', flexDirection: 'column' }}>
                {/* Target Card in Profile Style */}
                <div
                  className="profile-order-card"
                  style={{ marginBottom: isExpanded ? 6 : 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                  onClick={() => toggleGroup(target)}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    <div className="card__avatar" style={{ width: 40, height: 40, fontSize: 20, borderRadius: '50%', background: 'var(--gradient-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {group.target_photo ? <img src={group.target_photo} alt="" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} /> : getTargetEmoji(group.target_db_id || 0)}
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 15, color: 'var(--text)' }}>{group.display}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>{target}</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {group.hasActive && <span className="status-dot status-dot--active" style={{ width: 6, height: 6, borderRadius: '50%', background: '#3b82f6', display: 'inline-block' }} />}
                    <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{group.cases.length} дел</span>
                    <span className={`collapse-arrow ${!isExpanded ? 'collapsed' : ''}`} style={{ fontSize: 18, color: 'var(--text-secondary)' }}>▾</span>
                  </div>
                </div>

                {/* Cases List */}
                <div className={`expandable-content ${isExpanded ? 'expanded' : ''}`} style={{ transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)' }}>
                  <div className="expandable-inner" style={{ paddingLeft: 12, display: 'flex', flexDirection: 'column', gap: 8, marginTop: 6, marginBottom: 6 }}>
                    {group.cases.map(c => {
                      const st = STATUS[c.status] || STATUS.error
                      return (
                        <div
                          key={c.id}
                          className="profile-order-card"
                          style={{
                            padding: '12px 16px',
                            background: 'var(--bg-secondary)',
                            border: '1px solid var(--card-border)',
                            borderRadius: '12px',
                            marginLeft: '8px',
                            marginBottom: 0
                          }}
                          onClick={() => navigate(`/dossier/${c.id}`)}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 }}>
                            <div className="card__avatar" style={{ width: 32, height: 32, fontSize: 16, borderRadius: '50%', background: 'rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                              {(c.status === 'done' || c.status === 'delivered') ? '🎁' : st.icon}
                            </div>
                            <div style={{ minWidth: 0, flex: 1 }}>
                              <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                Дело №{c.id}
                                {c.persona && <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 400, marginLeft: 6 }}>· {c.persona}</span>}
                              </div>
                              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
                                <span className={`status-dot status-dot--${st.dot}`} style={{ width: 6, height: 6, borderRadius: '50%', background: st.dot === 'done' ? '#22c55e' : st.dot === 'pending' ? '#f59e0b' : '#3b82f6', display: 'inline-block' }} />
                                {st.label}
                                {c.created_at && <span>· {timeAgo(c.created_at)}</span>}
                              </div>
                            </div>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            {c.has_report && <span className="badge badge--success" style={{ padding: '2px 6px', fontSize: 10 }}>📋</span>}
                            <span style={{ color: 'var(--text-secondary)', fontSize: 20 }}>›</span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

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
                    if (digits.length >= 4) v = digits.slice(0,2) + '.' + digits.slice(2,4) + '.' + digits.slice(4,8)
                    else if (digits.length >= 2) v = digits.slice(0,2) + '.' + digits.slice(2)
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
    </div>
  )
}
