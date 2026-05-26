import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api'
import { getTargetEmoji } from './TargetDetail'
import { useData } from '../hooks/useData'
import { showAlert } from '../utils/popup'

const CUTE_EMOJIS = ['🐰', '🦊', '🐼', '🐨', '🐱', '🐹', '🐯', '🦁', '🦄', '🐸'];

export default function Targets() {
  const navigate = useNavigate()
  
  // Data hooks
  const { data: profile } = useData('profile', api.getProfile)
  const { data: targetsData, loading, mutate } = useData('targets', api.getTargets)
  const targets = targetsData || []
  
  // Local state
  const [activeTab, setActiveTab] = useState('friends')
  const [showAdd, setShowAdd] = useState(false)
  const [showSearch, setShowSearch] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [form, setForm] = useState({ identifier: '', name: '', habits: '', birthday: '' })
  const [creating, setCreating] = useState(false)

  // Favorites state
  const [favorites, setFavorites] = useState(() => {
    const saved = localStorage.getItem('target_favorites')
    return saved ? JSON.parse(saved) : {}
  })

  // Focus state for lifting modals on Android
  const [isModalFocused, setIsModalFocused] = useState(false)

  const triggerHaptic = () => {
    try {
      window.Telegram?.WebApp?.HapticFeedback?.impactOccurred('light')
    } catch (e) {
      console.warn('Haptic feedback is not supported:', e)
    }
  }

  const load = () => {
    api.getTargets()
      .then(mutate)
      .catch(console.error)
  }

  const toggleFavorite = (tId) => {
    const updated = { ...favorites, [tId]: !favorites[tId] }
    localStorage.setItem('target_favorites', JSON.stringify(updated))
    setFavorites(updated)
    triggerHaptic()
  }

  const handleCreate = async (e) => {
    e.preventDefault()
    if (!form.identifier.trim() || !form.name.trim()) {
      await showAlert('Пожалуйста, заполните имя и юзернейм/телефон')
      return
    }
    setCreating(true)
    try {
      await api.createTarget({
        identifier: form.identifier.trim(),
        name: form.name.trim(),
        habits: form.habits.trim() || null,
        birthday: form.birthday.trim() || null,
      })
      setForm({ identifier: '', name: '', habits: '', birthday: '' })
      setShowAdd(false)
      triggerHaptic()
      load()
    } catch (err) {
      await showAlert(err.message)
    }
    setCreating(false)
  }

  const getDefaultAvatar = (userId) => {
    if (!userId) return '🐰'
    const idx = Math.abs(parseInt(userId, 10)) % CUTE_EMOJIS.length
    return CUTE_EMOJIS[idx]
  }

  const formatBirthday = (bday) => {
    if (!bday) return ''
    return `🎂 ${bday}`
  }

  if (loading) return <div className="page page-profile-bg"><div className="loading"><div className="spinner" /></div></div>

  // Filter friends list based on search query
  const filteredTargets = targets.filter(t => {
    const nameMatch = (t.name || '').toLowerCase().includes(searchQuery.toLowerCase())
    const idMatch = (t.identifier || '').toLowerCase().includes(searchQuery.toLowerCase())
    return nameMatch || idMatch
  })

  // Separate favorites vs. regular friends
  const favoritedTargets = filteredTargets.filter(t => favorites[t.id] === true)
  const regularTargets = filteredTargets.filter(t => favorites[t.id] !== true)

  const renderTargetRow = (t) => {
    const isFav = favorites[t.id] === true
    return (
      <div 
        key={t.id} 
        className="profile-order-card"
        onClick={() => {
          triggerHaptic()
          navigate(`/targets/${t.id}`)
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          {/* Avatar with dynamic contact-badge overlay */}
          <div className="wishlist-avatar-wrapper">
            <div 
              className="card__avatar" 
              style={{ 
                width: 44, 
                height: 44, 
                fontSize: 22, 
                borderRadius: '50%', 
                background: 'var(--gradient-primary)', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center' 
              }}
            >
              {t.photo ? (
                <img src={t.photo} alt="" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
              ) : (
                getTargetEmoji(t.id)
              )}
            </div>
            {/* Sync icon badge overlay */}
            <div className="avatar-sync-badge">👤</div>
          </div>
          
          <div>
            <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)' }}>
              {t.name || t.identifier}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 6 }}>
              <span>
                {(() => {
                  const count = t.wishlist_count || 0
                  if (count % 10 === 1 && count % 100 !== 11) return `${count} идея`;
                  if (count % 10 >= 2 && count % 10 <= 4 && (count % 100 < 10 || count % 100 >= 20)) return `${count} идеи`;
                  return `${count} идей`;
                })()}
              </span>
              {t.birthday && <span>· {formatBirthday(t.birthday)}</span>}
            </div>
          </div>
        </div>

        {/* Star favorites trigger circle */}
        <div 
          style={{ 
            width: 36, 
            height: 36, 
            borderRadius: '50%', 
            background: 'rgba(255,255,255,0.06)', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            fontSize: 16,
            color: isFav ? '#f59e0b' : 'var(--text-secondary)',
            cursor: 'pointer'
          }}
          onClick={(e) => {
            e.stopPropagation()
            toggleFavorite(t.id)
          }}
        >
          {isFav ? '★' : '☆'}
        </div>
      </div>
    )
  }

  return (
    <div className="page page-profile-bg" style={{ paddingBottom: '120px' }}>
      
      {/* Sleek Mockup Header (Photo 1) */}
      <div className="new-header" style={{ paddingBottom: '8px', borderBottom: 'none', background: 'transparent' }}>
        <button 
          className="wishlist-header-btn" 
          onClick={() => {
            triggerHaptic()
            showAlert('Функция контактов находится в разработке 👥')
          }}
          aria-label="Импорт контактов"
        >
          👥
        </button>
        <h1 className="new-header-title" style={{ fontSize: '20px', fontWeight: '800', color: 'var(--text)' }}>
          Вишлист
        </h1>
        <button 
          className="wishlist-header-btn" 
          onClick={() => {
            triggerHaptic()
            setShowSearch(!showSearch)
          }}
          aria-label="Поиск"
        >
          🔍
        </button>
      </div>

      {/* Real-time search bar toggle */}
      {showSearch && (
        <div style={{ padding: '0 8px 12px 8px', animation: 'fadeIn 0.2s ease' }}>
          <input
            className="input"
            autoFocus
            type="text"
            placeholder="Поиск по имени или никнейму..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{ borderRadius: 'var(--radius-full)', background: 'var(--card-bg)', border: '1px solid var(--card-border)', color: 'var(--text)' }}
          />
        </div>
      )}

      {/* Beautiful Document Roll Illustration Graphic (Photo 1) */}
      <div className="wishlist-mockup-container">
        <div className="wishlist-mockup-doc">
          <div className="wishlist-mockup-doc-heart">❤️</div>
          <div className="wishlist-mockup-doc-line" style={{ width: '80%' }}></div>
          <div className="wishlist-mockup-doc-line" style={{ width: '55%' }}></div>
          <div className="wishlist-mockup-doc-line" style={{ width: '70%' }}></div>
          <div className="wishlist-mockup-doc-roll"></div>
        </div>
      </div>

      {/* My Wishlist Card (Photo 1 top) */}
      <div 
        className="profile-order-card" 
        style={{ padding: '14px 18px', marginBottom: '24px' }} 
        onClick={() => {
          triggerHaptic()
          navigate('/targets/my')
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div 
            className="card__avatar" 
            style={{ 
              width: 44, 
              height: 44, 
              fontSize: 22, 
              borderRadius: '50%', 
              background: 'var(--gradient-primary)', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              boxShadow: 'var(--shadow-sm)'
            }}
          >
            {profile?.photo && profile.photo !== 'None' ? (
              <img src={profile.photo} alt="" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
            ) : (
              getDefaultAvatar(profile?.user_id)
            )}
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--text)' }}>Мой вишлист</div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>
              {(() => {
                const count = profile?.wishlist?.length || 0
                if (count % 10 === 1 && count % 100 !== 11) return `${count} идея`;
                if (count % 10 >= 2 && count % 10 <= 4 && (count % 100 < 10 || count % 100 >= 20)) return `${count} идеи`;
                return `${count} идей`;
              })()}
            </div>
          </div>
        </div>
        <div 
          style={{ 
            width: 36, 
            height: 36, 
            borderRadius: '50%', 
            background: 'rgba(255,255,255,0.06)', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            cursor: 'pointer', 
            fontSize: 18, 
            fontWeight: '600',
            color: 'var(--text)' 
          }}
          onClick={(e) => { 
            e.stopPropagation()
            triggerHaptic()
            navigate('/targets/my')
          }}
        >
          ＋
        </div>
      </div>

      {/* Filter Tabs & "Your friends" Header Section */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
        <h2 style={{ fontSize: '18px', fontWeight: '800', color: 'var(--text)', letterSpacing: '-0.3px' }}>
          Ваши друзья
        </h2>
        <div className="tab-filter-bar">
          <button 
            className={`tab-filter-btn ${activeTab === 'friends' ? 'active' : ''}`} 
            onClick={() => {
              triggerHaptic()
              setActiveTab('friends')
            }}
          >
            🛡️ Друзья
          </button>
          <button 
            className={`tab-filter-btn ${activeTab === 'contacts' ? 'active' : ''}`} 
            onClick={() => {
              triggerHaptic()
              showAlert('Импорт контактов находится в разработке 👥')
            }}
          >
            👤 Контакты
          </button>
        </div>
      </div>

      {/* Dotted "Add a Friend" trigger card */}
      <div className="add-friend-trigger-card" onClick={() => { triggerHaptic(); setShowAdd(true); }}>
        <div className="add-friend-trigger-circle">＋</div>
        <span style={{ fontWeight: 600, fontSize: 15, color: 'var(--text)' }}>Добавить друга</span>
      </div>

      {/* Friends List Split into Pinned Favorites and Regular list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {filteredTargets.length === 0 ? (
          <div className="new-orders-empty" style={{ padding: '30px 20px' }}>
            <div className="new-orders-empty-icon" style={{ fontSize: '32px' }}>👥</div>
            <div className="new-orders-empty-text">Список друзей пуст. Добавьте своего первого друга!</div>
          </div>
        ) : (
          <>
            {/* Pinned Favorites Section */}
            {favoritedTargets.length > 0 && (
              <>
                <div className="section-header" style={{ margin: '8px 0 6px 0', borderBottom: 'none' }}>
                  <h2 className="section-header__title" style={{ fontSize: '13px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: '700' }}>
                    ⭐ Избранные
                  </h2>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: '8px' }}>
                  {favoritedTargets.map(t => renderTargetRow(t))}
                </div>
              </>
            )}

            {/* Regular Friends Section */}
            {regularTargets.length > 0 && (
              <>
                {favoritedTargets.length > 0 && (
                  <div className="section-header" style={{ margin: '14px 0 6px 0', borderBottom: 'none' }}>
                    <h2 className="section-header__title" style={{ fontSize: '13px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: '700' }}>
                      👥 Другие друзья
                    </h2>
                  </div>
                )}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {regularTargets.map(t => renderTargetRow(t))}
                </div>
              </>
            )}
          </>
        )}
      </div>

      {/* iOS-Style modal bottom sheet for adding a new friend */}
      {showAdd && (
        <>
          <div className="bottom-sheet-backdrop" onClick={() => setShowAdd(false)} />
          <div 
            className="bottom-sheet" 
            style={{ 
              zIndex: 1000,
              ...(isModalFocused ? { bottom: 'auto', top: '35%', transform: 'translate(-50%, -50%)', borderRadius: '24px' } : {})
            }}
          >
            <div className="bottom-sheet-header">
              <span className="bottom-sheet-title">Добавить друга</span>
              <button className="bottom-sheet-close" onClick={() => setShowAdd(false)}>✕</button>
            </div>
            
            <form onSubmit={handleCreate}>
              <div className="input-group">
                <label>👤 Имя друга</label>
                <input
                  className="input"
                  required
                  placeholder="Как зовут вашего друга?"
                  maxLength={32}
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  onFocus={() => setIsModalFocused(true)}
                  onBlur={() => setIsModalFocused(false)}
                />
              </div>

              <div className="input-group">
                <label>📱 Юзернейм Telegram или телефон</label>
                <input
                  className="input"
                  required
                  placeholder="@username или +7..."
                  value={form.identifier}
                  onChange={e => setForm({ ...form, identifier: e.target.value })}
                  onFocus={() => setIsModalFocused(true)}
                  onBlur={() => setIsModalFocused(false)}
                />
              </div>

              <div className="input-group">
                <label>🎂 День рождения</label>
                <input
                  className="input"
                  placeholder="ДД.ММ.ГГГГ"
                  value={form.birthday}
                  onChange={e => setForm({ ...form, birthday: e.target.value })}
                  onFocus={() => setIsModalFocused(true)}
                  onBlur={() => setIsModalFocused(false)}
                />
              </div>

              <div className="input-group">
                <label>🎯 Увлечения / зацепки</label>
                <textarea
                  className="input"
                  placeholder="Чем он увлекается? Какие подарки любит?"
                  value={form.habits}
                  onChange={e => setForm({ ...form, habits: e.target.value })}
                  onFocus={() => setIsModalFocused(true)}
                  onBlur={() => setIsModalFocused(false)}
                />
              </div>

              <button className="btn btn--primary" type="submit" disabled={creating} style={{ marginTop: 8 }}>
                {creating ? '⏳ Создание...' : '✅ Добавить друга'}
              </button>
            </form>
          </div>
        </>
      )}

    </div>
  )
}
