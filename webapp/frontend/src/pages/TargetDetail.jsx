import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import api from '../api'
import { useData } from '../hooks/useData'
import { showAlert, showConfirm } from '../utils/popup'
import { timeAgo } from '../utils/timeAgo'

// Emoji pool for target avatars (deterministic based on target ID)
const AVATAR_EMOJIS = ['🐱', '🐶', '🦊', '🐼', '🐨', '🦁', '🐸', '🐧', '🦋', '🌸', '🌻', '🍀', '⭐', '🌙', '🎈', '🎀', '🧸', '🦄', '🐝', '🐬']

export function getTargetEmoji(targetId) {
  return AVATAR_EMOJIS[targetId % AVATAR_EMOJIS.length]
}

export default function TargetDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { data: target, loading, mutate } = useData(`target_${id}`, () => api.getTarget(id))
  
  // Local state for modals & forms
  const [editing, setEditing] = useState(false)
  const [showAddAddress, setShowAddAddress] = useState(false)
  const [showAddIdea, setShowAddIdea] = useState(false)
  const [addressInput, setAddressInput] = useState('')
  const [ideaInput, setIdeaInput] = useState('')
  
  const [form, setForm] = useState({ name: '', habits: '', birthday: '' })
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef(null)

  // Local storage state for address & custom gift ideas
  const [address, setAddress] = useState('')

  // Favorites state synced with Targets list page
  const [favorites, setFavorites] = useState(() => {
    const saved = localStorage.getItem('target_favorites')
    return saved ? JSON.parse(saved) : {}
  })

  // Collapsible sections state for wishlist occasion grouping
  const [collapsed, setCollapsed] = useState({})

  // Keyboard active states for Android lifting adjustments
  const [isModalFocused, setIsModalFocused] = useState(false)

  useEffect(() => {
    if (target) {
      setForm({ name: target.name || '', habits: target.habits || '', birthday: target.birthday || '' })
    }
  }, [target])

  // Load local storage values
  useEffect(() => {
    const savedAddress = localStorage.getItem(`target_address_${id}`)
    if (savedAddress) {
      setAddress(savedAddress)
      setAddressInput(savedAddress)
    } else {
      setAddress('')
      setAddressInput('')
    }
  }, [id])

  const triggerHaptic = () => {
    try {
      window.Telegram?.WebApp?.HapticFeedback?.impactOccurred('light')
    } catch (e) {
      console.warn('Haptic feedback is not supported:', e)
    }
  }

  const load = () => {
    api.getTarget(id)
      .then(mutate)
      .catch(console.error)
  }

  const toggleFavorite = () => {
    const isFav = favorites[id] === true
    const updated = { ...favorites, [id]: !isFav }
    localStorage.setItem('target_favorites', JSON.stringify(updated))
    setFavorites(updated)
    triggerHaptic()
  }

  const toggleGroup = (holiday) => {
    setCollapsed(prev => ({ ...prev, [holiday]: !prev[holiday] }))
    triggerHaptic()
  }

  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      await api.updateTarget(id, {
        name: form.name || null,
        habits: form.habits || null,
        birthday: form.birthday || null,
      })
      setEditing(false)
      triggerHaptic()
      load()
    } catch (err) { 
      await showAlert(err.message) 
    }
    setSaving(false)
  }

  const handleDelete = async () => {
    triggerHaptic()
    if (!await showConfirm('Удалить этого друга из списка?')) return
    try {
      await api.deleteTarget(id)
      localStorage.removeItem(`target_address_${id}`)
      
      // Remove from favorites if favorited
      const updatedFavs = { ...favorites }
      delete updatedFavs[id]
      localStorage.setItem('target_favorites', JSON.stringify(updatedFavs))
      setFavorites(updatedFavs)

      navigate('/targets', { replace: true })
    } catch (err) { 
      await showAlert(err.message) 
    }
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
      const result = await api.uploadTargetPhoto(id, file)
      mutate({ ...target, photo: result.photo })
      triggerHaptic()
    } catch (err) {
      await showAlert(err.message)
    }
    setUploading(false)
  }

  const handleSaveAddress = (e) => {
    e.preventDefault()
    const val = addressInput.trim()
    localStorage.setItem(`target_address_${id}`, val)
    setAddress(val)
    setShowAddAddress(false)
    triggerHaptic()
  }

  const handleAddIdea = async (e) => {
    e.preventDefault()
    const val = ideaInput.trim()
    if (!val) return

    try {
      await api.addWishlistItem({
        target_id: parseInt(id),
        description: val,
        category: 'Идея',
        holiday: 'Личные идеи'
      })
      setIdeaInput('')
      setShowAddIdea(false)
      triggerHaptic()
      load()
    } catch (err) {
      console.error(err)
      await showAlert('Не удалось сохранить подарок 😢')
    }
  }

  const handleDeleteCustomIdea = async (itemId) => {
    triggerHaptic()
    if (!window.confirm('Удалить эту идею подарка?')) return
    try {
      await api.deleteWishlistItem(itemId)
      load()
    } catch (err) {
      console.error(err)
      await showAlert('Не удалось удалить подарок 😢')
    }
  }

  const formatBirthdayLabel = (bdayStr) => {
    if (!bdayStr) return 'Добавить дату'
    const parts = bdayStr.split('.')
    if (parts.length >= 2) {
      const day = parseInt(parts[0], 10)
      const month = parseInt(parts[1], 10) - 1
      const year = parts.length === 3 ? parseInt(parts[2], 10) : new Date().getFullYear()
      if (!isNaN(day) && !isNaN(month)) {
        const date = new Date(year, month, day)
        const options = { weekday: 'short', month: 'long', day: 'numeric' }
        let formatted = date.toLocaleDateString('ru-RU', options)
        return formatted.charAt(0).toUpperCase() + formatted.slice(1)
      }
    }
    return bdayStr
  }

  if (loading) return <div className="page page-profile-bg"><div className="loading"><div className="spinner" /></div></div>
  if (!target) return <div className="page page-profile-bg"><div className="empty-state"><div className="empty-state__title">Друг не найден</div></div></div>

  const avatarEmoji = getTargetEmoji(target.id)
  const isFav = favorites[id] === true

  // Merge database wishlist with custom user-added wishlist items
  const combinedWishlist = target.wishlist || []

  // Group wishlist items by holiday occasion + case_date
  const groups = {}
  combinedWishlist.forEach(w => {
    const holiday = w.holiday || 'Без повода'
    const key = `${holiday}__${w.case_date || ''}`
    if (!groups[key]) {
      groups[key] = { holiday, date: w.case_date, items: [] }
    }
    groups[key].items.push(w)
  })
  
  const sortedGroups = Object.values(groups)

  const getItemsText = (count) => {
    if (count % 10 === 1 && count % 100 !== 11) return `${count} идея`;
    if (count % 10 >= 2 && count % 10 <= 4 && (count % 100 < 10 || count % 100 >= 20)) return `${count} идеи`;
    return `${count} идей`;
  }

  return (
    <>
      <div className="page page-profile-bg" style={{ paddingBottom: '120px' }}>
      
      {/* Sleek Russian Header */}
      <div className="new-header" style={{ paddingBottom: '8px', borderBottom: 'none', background: 'transparent' }}>
        <button 
          className="wishlist-header-btn" 
          onClick={() => navigate(-1)} 
          style={{ width: 36, height: 36 }}
          aria-label="Назад"
        >
          ‹
        </button>
        <span className="new-header-title" style={{ fontSize: '18px', fontWeight: '800', color: 'var(--text)' }}>
          Профиль
        </span>
        <div style={{ width: 36 }} />
      </div>

      {/* User Split Info Section */}
      <div className="friend-profile-top">
        <div className="friend-profile-info">
          <h1 className="friend-profile-name">
            {target.name || target.identifier}
          </h1>
          <div className="friend-profile-phone">
            {target.identifier}
          </div>
        </div>

        {/* Large Editable Round Avatar */}
        <div 
          className="friend-profile-avatar-container"
          onClick={() => fileInputRef.current?.click()}
          style={{ cursor: 'pointer' }}
        >
          {uploading ? (
            <div className="spinner" style={{ width: 28, height: 28 }} />
          ) : target.photo ? (
            <img src={target.photo} alt="" />
          ) : (
            avatarEmoji
          )}
          <div className="avatar-overlay" style={{ fontSize: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>📷</div>
        </div>
        
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={handlePhotoUpload}
        />
      </div>

      {/* Action Button Bar Strip */}
      <div className="friend-profile-action-bar">
        <button 
          className="btn-pill-action" 
          onClick={() => {
            triggerHaptic()
            showAlert(`Контакты вашего друга синхронизированы! 👥`)
          }}
        >
          👥 Контакт
        </button>
        
        {/* Interactive star favorite button (syncs with localStorage) */}
        <button 
          className="btn-circle-action" 
          onClick={toggleFavorite}
          aria-label="В избранное"
          style={{ color: isFav ? '#f59e0b' : 'var(--text)' }}
        >
          {isFav ? '★' : '☆'}
        </button>
        
        <button 
          className="btn-circle-action" 
          onClick={() => {
            triggerHaptic()
            setEditing(true)
          }}
          aria-label="Редактировать"
        >
          ✏️
        </button>
        
        <button 
          className="btn-circle-action btn-circle-action--danger" 
          onClick={handleDelete}
          aria-label="Удалить"
        >
          🗑️
        </button>
      </div>

      {/* Primary "Send Detective" CTA */}
      <button 
        className="btn-sherlock" 
        onClick={() => {
          triggerHaptic()
          navigate(`/new-case?target=${encodeURIComponent(target.identifier)}`)
        }}
      >
        🕵️ Отправить детектива
      </button>

      {/* Helper Address Banner */}
      <div className="address-banner">
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <span style={{ fontSize: '32px', flexShrink: 0 }} role="img" aria-label="house">🏠</span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text)', display: 'block' }}>
              Легко отправляйте подарки
            </span>
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.4', display: 'block' }}>
              Добавьте адрес друга, чтобы детективу было проще доставить подарок.
            </span>
          </div>
        </div>

        <button className="btn-add-address" onClick={() => { triggerHaptic(); setShowAddAddress(true); }}>
          ➕ Добавить адрес
        </button>

        <div className="address-lock-row">
          <span>🔒</span> Адрес будет виден только вам
        </div>
      </div>

      {/* Birthday & Address Side-by-Side Cards */}
      <div className="detail-grid">
        {/* Birthday Card */}
        <div 
          className="detail-grid-card" 
          onClick={() => { triggerHaptic(); setEditing(true); }}
          style={{ cursor: 'pointer' }}
        >
          <span className="detail-grid-card-emoji">🎂</span>
          <div>
            <div className="detail-grid-card-label">День рождения</div>
            <div className="detail-grid-card-value">
              {target.birthday ? formatBirthdayLabel(target.birthday) : 'Добавить'}
            </div>
          </div>
        </div>

        {/* Address Card */}
        <div 
          className="detail-grid-card" 
          onClick={() => { triggerHaptic(); setShowAddAddress(true); }}
          style={{ cursor: 'pointer' }}
        >
          <span className="detail-grid-card-emoji">🏠</span>
          <div>
            <div className="detail-grid-card-label">Адрес доставки</div>
            <div 
              className="detail-grid-card-value" 
              style={{ 
                color: address ? 'var(--text)' : '#22c55e',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                maxWidth: '120px'
              }}
            >
              {address || '➕ Добавить'}
            </div>
          </div>
        </div>
      </div>
    </div>

      {/* Edit Friend Modal bottom sheet */}
      {editing && (
        <>
          <div className="bottom-sheet-backdrop" onClick={() => setEditing(false)} />
          <div 
            className="bottom-sheet" 
            style={{ 
              zIndex: 1000,
              ...(isModalFocused ? { bottom: 'auto', top: '35%', transform: 'translate(-50%, -50%)', borderRadius: '24px' } : {})
            }}
          >
            <div className="bottom-sheet-header">
              <span className="bottom-sheet-title">Редактировать друга</span>
              <button className="bottom-sheet-close" onClick={() => setEditing(false)}>✕</button>
            </div>
            
            <form onSubmit={handleSave}>
              <div className="input-group">
                <label>👤 Имя друга</label>
                <input 
                  className="input" 
                  required
                  value={form.name} 
                  onChange={e => setForm({ ...form, name: e.target.value })} 
                  onFocus={() => setIsModalFocused(true)}
                  onBlur={() => setIsModalFocused(false)}
                />
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
                  onFocus={() => setIsModalFocused(true)}
                  onBlur={() => setIsModalFocused(false)}
                />
              </div>

              <div className="input-group">
                <label>🎯 Увлечения / зацепки</label>
                <textarea 
                  className="input" 
                  value={form.habits} 
                  onChange={e => setForm({ ...form, habits: e.target.value })} 
                  onFocus={() => setIsModalFocused(true)}
                  onBlur={() => setIsModalFocused(false)}
                />
              </div>

              <button className="btn btn--primary" type="submit" disabled={saving} style={{ marginTop: 8 }}>
                {saving ? '⏳ Сохранение...' : '✅ Сохранить изменения'}
              </button>
            </form>
          </div>
        </>
      )}

      {/* Add Address Modal bottom sheet */}
      {showAddAddress && (
        <>
          <div className="bottom-sheet-backdrop" onClick={() => setShowAddAddress(false)} />
          <div 
            className="bottom-sheet" 
            style={{ 
              zIndex: 1000,
              ...(isModalFocused ? { bottom: 'auto', top: '35%', transform: 'translate(-50%, -50%)', borderRadius: '24px' } : {})
            }}
          >
            <div className="bottom-sheet-header">
              <span className="bottom-sheet-title">Адрес доставки</span>
              <button className="bottom-sheet-close" onClick={() => setShowAddAddress(false)}>✕</button>
            </div>
            
            <form onSubmit={handleSaveAddress}>
              <div className="input-group">
                <label>🏠 Адрес друга</label>
                <input 
                  className="input" 
                  required
                  autoFocus
                  placeholder="Улица, дом, квартира, город..." 
                  value={addressInput} 
                  onChange={e => setAddressInput(e.target.value)} 
                  onFocus={() => setIsModalFocused(true)}
                  onBlur={() => setIsModalFocused(false)}
                />
              </div>

              <button className="btn btn--primary" type="submit" style={{ marginTop: 8 }}>
                ✅ Сохранить адрес
              </button>
            </form>
          </div>
        </>
      )}

      {/* Add Gift Idea Modal bottom sheet */}
      {showAddIdea && (
        <>
          <div className="bottom-sheet-backdrop" onClick={() => setShowAddIdea(false)} />
          <div 
            className="bottom-sheet" 
            style={{ 
              zIndex: 1000,
              ...(isModalFocused ? { bottom: 'auto', top: '35%', transform: 'translate(-50%, -50%)', borderRadius: '24px' } : {})
            }}
          >
            <div className="bottom-sheet-header">
              <span className="bottom-sheet-title">Добавить идею подарка</span>
              <button className="bottom-sheet-close" onClick={() => setShowAddIdea(false)}>✕</button>
            </div>
            
            <form onSubmit={handleAddIdea}>
              <div className="input-group">
                <label>🎁 Идея подарка</label>
                <input 
                  className="input" 
                  required
                  autoFocus
                  maxLength={120}
                  placeholder="Что подарить? Например: Носки с уточками..." 
                  value={ideaInput} 
                  onChange={e => setIdeaInput(e.target.value)} 
                  onFocus={() => setIsModalFocused(true)}
                  onBlur={() => setIsModalFocused(false)}
                />
              </div>

              <button className="btn btn--primary" type="submit" style={{ marginTop: 8 }}>
                ➕ Добавить в вишлист
              </button>
            </form>
          </div>
        </>
      )}
    </>
  )
}
