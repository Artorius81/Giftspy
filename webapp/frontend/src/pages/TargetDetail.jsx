import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import api from '../api'
import { useData } from '../hooks/useData'
import { showAlert, showConfirm } from '../utils/popup'

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
  const [customIdeas, setCustomIdeas] = useState([])

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

    const savedIdeas = localStorage.getItem(`target_custom_ideas_${id}`)
    if (savedIdeas) {
      try {
        setCustomIdeas(JSON.parse(savedIdeas))
      } catch (e) {
        console.error('Failed to parse custom ideas:', e)
      }
    } else {
      setCustomIdeas([])
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
      localStorage.removeItem(`target_custom_ideas_${id}`)
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

  const handleAddIdea = (e) => {
    e.preventDefault()
    const val = ideaInput.trim()
    if (!val) return

    const newItem = {
      id: `custom_${Date.now()}`,
      description: val,
      added_by: 'user',
      created_at: new Date().toISOString(),
      category: 'Идея'
    }

    const updated = [newItem, ...customIdeas]
    localStorage.setItem(`target_custom_ideas_${id}`, JSON.stringify(updated))
    setCustomIdeas(updated)
    setIdeaInput('')
    setShowAddIdea(false)
    triggerHaptic()
  }

  const handleDeleteCustomIdea = (itemId) => {
    const updated = customIdeas.filter(item => item.id !== itemId)
    localStorage.setItem(`target_custom_ideas_${id}`, JSON.stringify(updated))
    setCustomIdeas(updated)
    triggerHaptic()
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
        const options = { weekday: 'short', month: 'short', day: 'numeric' }
        return date.toLocaleDateString('en-US', options) // e.g. "Fri, Jun 15"
      }
    }
    return bdayStr
  }

  if (loading) return <div className="page page-profile-bg"><div className="loading"><div className="spinner" /></div></div>
  if (!target) return <div className="page page-profile-bg"><div className="empty-state"><div className="empty-state__title">Друг не найден</div></div></div>

  const avatarEmoji = getTargetEmoji(target.id)

  // Merge database wishlist with custom user-added wishlist items
  const dbWishlist = target.wishlist || []
  const combinedWishlist = [...customIdeas, ...dbWishlist]

  return (
    <div className="page page-profile-bg" style={{ paddingBottom: '120px' }}>
      
      {/* Sleek Mockup Header (Photo 2) */}
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
          Profile
        </span>
        <div style={{ width: 36 }} />
      </div>

      {/* User Split Info Section (Photo 2 top) */}
      <div className="friend-profile-top">
        <div className="friend-profile-info">
          <h1 className="friend-profile-name">
            {target.name || target.identifier}
          </h1>
          <div className="friend-profile-phone">
            {target.identifier}
          </div>
        </div>

        {/* Large Editable Round Avatar on Right */}
        <div 
          className="friend-profile-avatar-container"
          onClick={() => fileInputRef.current?.click()}
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

      {/* Action Button Bar Strip (Photo 2) */}
      <div className="friend-profile-action-bar">
        <button 
          className="btn-pill-action" 
          onClick={() => {
            triggerHaptic()
            showAlert(`Контакты вашего друга синхронизированы! 👥`)
          }}
        >
          👥 Contact
        </button>
        
        <button 
          className="btn-circle-action" 
          onClick={() => {
            triggerHaptic()
            showAlert('Добавлено в избранное! ⭐')
          }}
          aria-label="В избранное"
        >
          ☆
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

      {/* Large Premium "Send Sherlock" CTA Button (Photo 2) */}
      <button 
        className="btn-sherlock" 
        onClick={() => {
          triggerHaptic()
          navigate(`/new-case?target=${encodeURIComponent(target.identifier)}`)
        }}
      >
        🔎 Send Sherlock
      </button>

      {/* "Easily send gifts to your contacts" Helper Address Banner (Photo 2) */}
      <div className="address-banner">
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <span style={{ fontSize: '32px', flexShrink: 0 }} role="img" aria-label="house">🏠</span>
          <div style={{ display: 'flex', flexDir: 'column', gap: 4 }}>
            <span style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text)', display: 'block' }}>
              Easily send gifts to your contacts
            </span>
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.4', display: 'block' }}>
              Add their address so you don't have to fill it in each time.
            </span>
          </div>
        </div>

        <button className="btn-add-address" onClick={() => { triggerHaptic(); setShowAddAddress(true); }}>
          ➕ Add address
        </button>

        <div className="address-lock-row">
          <span>🔒</span> Address details will only be visible to you
        </div>
      </div>

      {/* Birthday & Address Side-by-Side Cards (Photo 2) */}
      <div className="detail-grid">
        {/* Birthday card */}
        <div 
          className="detail-grid-card" 
          onClick={() => { triggerHaptic(); setEditing(true); }}
          style={{ cursor: 'pointer' }}
        >
          <span className="detail-grid-card-emoji">🎂</span>
          <div>
            <div className="detail-grid-card-label">Birthday</div>
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
            <div className="detail-grid-card-label">Address</div>
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
              {address || '➕ Add address'}
            </div>
          </div>
        </div>
      </div>

      {/* Friend Wishlist Section Box Card (Photo 2 bottom) */}
      <div className="friend-wishlist-card">
        <div className="friend-wishlist-card-top">
          {/* Custom wishlist sheet icon */}
          <div className="friend-wishlist-card-icon">
            <span className="friend-wishlist-card-icon-heart">❤️</span>
            <div className="friend-wishlist-card-icon-line" style={{ width: '85%' }}></div>
            <div className="friend-wishlist-card-icon-line" style={{ width: '55%' }}></div>
            <div className="friend-wishlist-card-icon-roll"></div>
          </div>
          <div>
            <span style={{ fontSize: '16px', fontWeight: '700', color: 'var(--text)', display: 'block' }}>
              Wishlist
            </span>
            <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
              {combinedWishlist.length} items
            </span>
          </div>
        </div>

        {/* Gift idea list inside the card */}
        {combinedWishlist.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 4 }}>
            {combinedWishlist.map(w => (
              <div 
                key={w.id} 
                className="profile-order-card"
                style={{ 
                  padding: '12px 14px', 
                  background: 'rgba(255,255,255,0.02)', 
                  border: '1px solid rgba(255,255,255,0.04)', 
                  margin: 0,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}
              >
                <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '16px', flexShrink: 0 }}>
                    {w.added_by === 'ai' ? '🤖' : '✍️'}
                  </div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: '13.5px', color: 'var(--text)', wordBreak: 'break-word', fontWeight: '500' }}>
                      {w.description}
                    </div>
                    {w.category && (
                      <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: 2 }}>{w.category}</div>
                    )}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <button 
                    style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px', color: 'var(--text-secondary)' }}
                    onClick={(e) => {
                      e.stopPropagation()
                      navigate(`/search?query=${encodeURIComponent(w.description)}`)
                    }}
                    title="Найти"
                  >
                    🔎
                  </button>

                  {/* If custom idea, support deleting */}
                  {w.id.toString().startsWith('custom_') && (
                    <button 
                      style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '15px', color: '#ef4444' }}
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDeleteCustomIdea(w.id)
                      }}
                      title="Удалить идею"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ padding: '16px 0', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '13px' }}>
            В вишлисте вашего друга пока нет идей. Нажмите кнопку ниже или отправьте Шерлока!
          </div>
        )}

        {/* Large pure white + Add gift idea button (Photo 2 bottom) */}
        <button className="btn-add-idea" onClick={() => { triggerHaptic(); setShowAddIdea(true); }}>
          ➕ Add gift idea
        </button>
      </div>

      {/* Edit Friend Modal bottom sheet */}
      {editing && (
        <>
          <div className="bottom-sheet-backdrop" onClick={() => setEditing(false)} />
          <div className="bottom-sheet" style={{ zIndex: 1000 }}>
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
                />
              </div>

              <div className="input-group">
                <label>🎯 Увлечения / зацепки</label>
                <textarea 
                  className="input" 
                  value={form.habits} 
                  onChange={e => setForm({ ...form, habits: e.target.value })} 
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
          <div className="bottom-sheet" style={{ zIndex: 1000 }}>
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
          <div className="bottom-sheet" style={{ zIndex: 1000 }}>
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
                />
              </div>

              <button className="btn btn--primary" type="submit" style={{ marginTop: 8 }}>
                ➕ Добавить в вишлист
              </button>
            </form>
          </div>
        </>
      )}

    </div>
  )
}
