import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import api from '../api'
import { useData } from '../hooks/useData'
import { showAlert } from '../utils/popup'
import { getTargetEmoji } from './TargetDetail'

const CUTE_EMOJIS = ['🐰', '🦊', '🐼', '🐨', '🐱', '🐹', '🐯', '🦁', '🦄', '🐸'];

// Helper to format Russian birthday date nicely (e.g. December 6 -> 6 декабря)
function formatRussianBirthday(bdayStr) {
  if (!bdayStr) return '';
  const parts = bdayStr.split('.')
  if (parts.length >= 2) {
    const day = parseInt(parts[0], 10)
    const month = parseInt(parts[1], 10) - 1
    if (!isNaN(day) && !isNaN(month) && month >= 0 && month < 12) {
      const months = [
        'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
        'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'
      ]
      return `${day} ${months[month]}`
    }
  }
  return bdayStr
}

export default function WishlistDetail() {
  const { id } = useParams() // can be a target ID, or 'my'
  const isOwn = id === 'my' || !id
  const navigate = useNavigate()

  // Local state
  const [customIdeas, setCustomIdeas] = useState([])
  const [showAdd, setShowAdd] = useState(false)
  const [ideaInput, setIdeaInput] = useState('')
  
  // Advanced add gift options
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [holidayInput, setHolidayInput] = useState('Без повода')
  const [categoryInput, setCategoryInput] = useState('Другое')

  // Received toggle tracking for DB wishlist items on friends
  const [receivedDbItems, setReceivedDbItems] = useState(() => {
    if (isOwn) return {}
    const saved = localStorage.getItem(`received_db_items_${id}`)
    return saved ? JSON.parse(saved) : {}
  })

  // Keyboard active states for Android lifting adjustments
  const [isModalFocused, setIsModalFocused] = useState(false)

  // Fetch target or profile
  const { data: target, loading: tLoading, mutate: mutateTarget } = useData(
    isOwn ? 'profile' : `target_${id}`,
    isOwn ? api.getProfile : () => api.getTarget(id)
  )

  const loading = tLoading

  // Load custom ideas from local storage
  useEffect(() => {
    const key = isOwn ? 'my_custom_ideas' : `target_custom_ideas_${id}`
    const saved = localStorage.getItem(key)
    if (saved) {
      try {
        setCustomIdeas(JSON.parse(saved))
      } catch (e) {
        console.error('Failed to parse wishlist ideas:', e)
      }
    } else {
      setCustomIdeas([])
    }
  }, [id, isOwn])

  const triggerHaptic = () => {
    try {
      window.Telegram?.WebApp?.HapticFeedback?.impactOccurred('light')
    } catch (e) {
      console.warn('Haptic feedback not supported:', e)
    }
  }

  // Toggle Received status for own or friend's wishlist items
  const handleToggleReceived = (itemId, isDbItem = false) => {
    triggerHaptic()
    if (isDbItem) {
      // Toggle for DB items (only for friends)
      const updated = { ...receivedDbItems, [itemId]: !receivedDbItems[itemId] }
      localStorage.setItem(`received_db_items_${id}`, JSON.stringify(updated))
      setReceivedDbItems(updated)
    } else {
      // Toggle for custom local storage items (for both own and friend)
      const updated = customIdeas.map(item => {
        if (item.id === itemId) {
          return { ...item, received: !item.received }
        }
        return item
      })
      const key = isOwn ? 'my_custom_ideas' : `target_custom_ideas_${id}`
      localStorage.setItem(key, JSON.stringify(updated))
      setCustomIdeas(updated)
    }
  }

  // Delete local custom idea
  const handleDeleteCustomIdea = (itemId) => {
    triggerHaptic()
    const updated = customIdeas.filter(item => item.id !== itemId)
    const key = isOwn ? 'my_custom_ideas' : `target_custom_ideas_${id}`
    localStorage.setItem(key, JSON.stringify(updated))
    setCustomIdeas(updated)
  }

  // Add new wishlist item
  const handleAddGift = (e) => {
    e.preventDefault()
    const val = ideaInput.trim()
    if (!val) return

    const newItem = {
      id: `custom_${Date.now()}`,
      description: val,
      added_by: 'user',
      created_at: new Date().toISOString(),
      category: categoryInput,
      holiday: holidayInput,
      received: false
    }

    const updated = [newItem, ...customIdeas]
    const key = isOwn ? 'my_custom_ideas' : `target_custom_ideas_${id}`
    localStorage.setItem(key, JSON.stringify(updated))
    setCustomIdeas(updated)
    
    // Reset inputs
    setIdeaInput('')
    setShowAdd(false)
    setShowAdvanced(false)
    setHolidayInput('Без повода')
    setCategoryInput('Другое')
    triggerHaptic()
  }

  const handleShare = () => {
    triggerHaptic()
    try {
      const text = isOwn ? 'Посмотрите мой вишлист!' : `Посмотрите вишлист: ${target?.name || ''}`
      if (navigator.share) {
        navigator.share({
          title: 'Giftspy Вишлист',
          text: text,
          url: window.location.href,
        }).catch(console.error)
      } else {
        navigator.clipboard.writeText(window.location.href)
        showAlert('Ссылка на вишлист скопирована в буфер обмена! 🔗')
      }
    } catch (e) {
      console.error(e)
    }
  }

  const getDefaultAvatar = (userId) => {
    if (!userId) return '🐰'
    const idx = Math.abs(parseInt(userId, 10)) % CUTE_EMOJIS.length
    return CUTE_EMOJIS[idx]
  }

  if (loading) return <div className="page page-profile-bg"><div className="loading"><div className="spinner" /></div></div>
  if (!target) return <div className="page page-profile-bg"><div className="empty-state"><div className="empty-state__title">Вишлист не найден</div></div></div>

  const displayName = isOwn ? 'Мой вишлист' : `Вишлист: ${target.name || target.identifier}`
  const birthday = target.birthday || ''
  const avatarEmoji = isOwn ? getDefaultAvatar(target.user_id) : getTargetEmoji(target.id)
  const photo = target.photo

  // Combine database wishlist items for friends
  const dbWishlist = !isOwn ? (target.wishlist || []) : []
  const combinedWishlist = [...customIdeas, ...dbWishlist]

  // Render a specific wishlist grid card
  const renderWishlistCard = (item, idx) => {
    const isDb = !item.id.toString().startsWith('custom_')
    const isReceived = isDb ? !!receivedDbItems[item.id] : !!item.received

    return (
      <div 
        key={item.id || idx} 
        className="wishlist-grid-card"
        onClick={() => handleToggleReceived(item.id, isDb)}
        style={{ cursor: 'pointer' }}
      >
        {/* Delete button for custom local ideas */}
        {!isDb && (
          <button 
            className="wishlist-grid-card-delete"
            onClick={(e) => {
              e.stopPropagation()
              handleDeleteCustomIdea(item.id)
            }}
          >
            ✕
          </button>
        )}

        {/* Gift Circle Icon */}
        <div className="wishlist-grid-card-icon-circle">
          🎁
        </div>

        {/* Description */}
        <div className="wishlist-grid-card-desc">
          {item.description || item.gift_description}
        </div>

        {/* Holiday category info */}
        {item.holiday && item.holiday !== 'Без повода' && (
          <div className="wishlist-grid-card-holiday">
            🎉 {item.holiday}
          </div>
        )}

        {/* Received badge */}
        {isReceived && (
          <div className="wishlist-grid-card-received-badge">
            ✓ Получено
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="page page-profile-bg" style={{ paddingBottom: '140px' }}>
      
      {/* Header action bar (Photo 2) */}
      <div className="new-header" style={{ paddingBottom: '8px', borderBottom: 'none', background: 'transparent' }}>
        <button 
          className="wishlist-header-btn" 
          onClick={() => navigate(-1)} 
          style={{ width: 36, height: 36 }}
          aria-label="Назад"
        >
          ‹
        </button>
        
        <div style={{ display: 'flex', gap: 10 }}>
          {/* Share button */}
          <button 
            className="wishlist-header-btn" 
            onClick={handleShare}
            style={{ width: 36, height: 36 }}
            aria-label="Поделиться"
          >
            🔗
          </button>
          
          {/* Profile button (Requirements) */}
          <button 
            className="wishlist-header-btn" 
            onClick={() => {
              triggerHaptic()
              if (isOwn) navigate('/profile/edit')
              else navigate(`/targets/${id}/profile`)
            }}
            style={{ width: 36, height: 36 }}
            aria-label="Профиль"
          >
            👤
          </button>
        </div>
      </div>

      {/* Large centered rabbit/avatar section (Photo 2) */}
      <div className="wishlist-hero-section">
        <div className="wishlist-hero-avatar-wrapper">
          {photo && photo !== 'None' ? (
            <img src={photo} alt="" className="wishlist-hero-avatar" />
          ) : (
            <span className="wishlist-hero-avatar-emoji">{avatarEmoji}</span>
          )}
        </div>
        
        <h1 className="wishlist-hero-title">
          {displayName}
        </h1>
        
        {birthday && (
          <div className="wishlist-hero-birthday-badge">
            🎂 {formatRussianBirthday(birthday)}
          </div>
        )}
      </div>

      {/* Grid of wishlist items */}
      <div className="wishlist-items-grid-2col">
        
        {/* Dynamic "Add a new gift idea" card for Own wishlist (Photo 2) */}
        {isOwn && (
          <div 
            className="wishlist-grid-card-add-trigger" 
            onClick={() => { triggerHaptic(); setShowAdd(true); }}
          >
            <div className="wishlist-grid-card-add-circle">
              ＋
            </div>
            <div className="wishlist-grid-card-add-label">
              Добавить идею подарка...
            </div>
          </div>
        )}

        {/* Wishlist Items cards */}
        {combinedWishlist.length === 0 && !isOwn ? (
          <div className="wishlist-empty-state-fullcol">
            <span style={{ fontSize: '32px' }}>🎁</span>
            <div style={{ marginTop: '8px', fontWeight: 'bold' }}>Вишлист пуст</div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
              В вишлисте пока нет идей. Вы можете добавить первую с помощью кнопки внизу!
            </div>
          </div>
        ) : (
          combinedWishlist.map((item, idx) => renderWishlistCard(item, idx))
        )}
      </div>

      {/* Sticky Bottom pill button (Photo 2) */}
      <button 
        className="wishlist-sticky-bottom-btn" 
        onClick={() => { triggerHaptic(); setShowAdd(true); }}
      >
        ＋ Добавить подарок
      </button>

      {/* Custom design Photo 3 Bottom Sheet for adding item */}
      {showAdd && (
        <>
          <div className="bottom-sheet-backdrop" onClick={() => setShowAdd(false)} />
          <div 
            className="bottom-sheet wishlist-add-gift-sheet" 
            style={{ 
              zIndex: 1000,
              ...(isModalFocused ? { bottom: 'auto', top: '35%', transform: 'translate(-50%, -50%)', borderRadius: '24px' } : {})
            }}
          >
            {/* Top translucent grabber action */}
            <button 
              className="wishlist-add-gift-link-btn"
              onClick={() => {
                triggerHaptic()
                showAlert('Функция добавления по ссылке находится в разработке 🔗')
              }}
            >
              🔗 Добавить по ссылке
            </button>

            {/* Dark background container */}
            <form onSubmit={handleAddGift}>
              <div className="wishlist-add-gift-container-card">
                <div className="wishlist-add-gift-input-row">
                  <div className="wishlist-add-gift-circle-icon">
                    🎁
                  </div>
                  <input
                    className="wishlist-add-gift-input"
                    required
                    autoFocus
                    placeholder="Добавить идею подарка..."
                    maxLength={100}
                    value={ideaInput}
                    onChange={e => setIdeaInput(e.target.value)}
                    onFocus={() => setIsModalFocused(true)}
                    onBlur={() => setIsModalFocused(false)}
                  />
                </div>

                <hr className="wishlist-add-gift-separator" />

                {/* More options chevron link */}
                <div 
                  className="wishlist-add-gift-more-options"
                  onClick={() => { triggerHaptic(); setShowAdvanced(!showAdvanced); }}
                >
                  <span>Дополнительно</span>
                  <span style={{ fontSize: '16px', transform: showAdvanced ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }}>›</span>
                </div>

                {/* Expandable settings fields */}
                {showAdvanced && (
                  <div className="wishlist-add-gift-advanced-section">
                    <div className="input-group">
                      <label>🎉 Повод / Праздник</label>
                      <select 
                        className="input" 
                        value={holidayInput}
                        onChange={e => setHolidayInput(e.target.value)}
                      >
                        <option value="Без повода">Без повода</option>
                        <option value="День Рождения">День Рождения</option>
                        <option value="Новый Год">Новый Год</option>
                        <option value="8 Марта">8 Марта</option>
                        <option value="23 Февраля">23 Февраля</option>
                        <option value="Годовщина">Годовщина</option>
                      </select>
                    </div>

                    <div className="input-group">
                      <label>🏷️ Категория</label>
                      <select 
                        className="input" 
                        value={categoryInput}
                        onChange={e => setCategoryInput(e.target.value)}
                      >
                        <option value="Другое">Другое</option>
                        <option value="Одежда">Одежда</option>
                        <option value="Электроника">Электроника</option>
                        <option value="Книги">Книги</option>
                        <option value="Косметика">Косметика</option>
                        <option value="Дом">Дом</option>
                      </select>
                    </div>
                  </div>
                )}
              </div>

              {/* Bottom row actions: Solid Save button & Circle Close button */}
              <div className="wishlist-add-gift-bottom-row">
                <button 
                  className={`wishlist-add-gift-save-btn ${ideaInput.trim() ? 'active' : ''}`}
                  type="submit"
                  disabled={!ideaInput.trim()}
                >
                  Сохранить подарок
                </button>

                <button 
                  className="wishlist-add-gift-close-circle-btn"
                  type="button"
                  onClick={() => setShowAdd(false)}
                >
                  ✕
                </button>
              </div>
            </form>
          </div>
        </>
      )}

    </div>
  )
}
