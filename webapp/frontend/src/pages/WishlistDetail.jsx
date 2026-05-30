import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
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

/* ── Slide-to-Receive slider component ── */
function SlideToReceive({ onConfirm, isReceived }) {
  const trackRef = useRef(null)
  const [dragX, setDragX] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const [confirmed, setConfirmed] = useState(false)
  const startX = useRef(0)
  const thumbSize = 48
  const padding = 6

  const getMaxX = () => {
    if (!trackRef.current) return 200
    return trackRef.current.offsetWidth - thumbSize - padding * 2
  }

  const progress = Math.min(dragX / (getMaxX() || 1), 1)

  const handleStart = (clientX) => {
    if (confirmed || isReceived) return
    startX.current = clientX - dragX
    setIsDragging(true)
  }

  const handleMove = useCallback((clientX) => {
    if (!isDragging || confirmed || isReceived) return
    const maxX = getMaxX()
    const x = Math.max(0, Math.min(clientX - startX.current, maxX))
    setDragX(x)
  }, [isDragging, confirmed, isReceived])

  const handleEnd = useCallback(() => {
    if (!isDragging) return
    setIsDragging(false)
    const maxX = getMaxX()
    if (dragX >= maxX * 0.85) {
      setDragX(maxX)
      setConfirmed(true)
      try { window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred('success') } catch {}
      onConfirm()
    } else {
      setDragX(0)
    }
  }, [isDragging, dragX, onConfirm])

  // Mouse events
  useEffect(() => {
    if (!isDragging) return
    const onMouseMove = (e) => handleMove(e.clientX)
    const onMouseUp = () => handleEnd()
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
  }, [isDragging, handleMove, handleEnd])

  // Reset or set initial based on isReceived prop
  useEffect(() => {
    if (!isReceived) {
      setConfirmed(false)
      setDragX(0)
    } else {
      setConfirmed(true)
      const t = setTimeout(() => {
        const maxX = getMaxX()
        setDragX(maxX)
      }, 50)
      return () => clearTimeout(t)
    }
  }, [isReceived])

  return (
    <div
      ref={trackRef}
      className={`wishlist-slide-receive ${isDragging ? 'dragging' : ''} ${confirmed ? 'confirmed' : ''}`}
    >
      <div className="wishlist-slide-receive__fill" style={{ width: `${(dragX + thumbSize + padding * 2)}px` }} />
      <span className="wishlist-slide-receive__label" style={{ opacity: 1 - progress * 1.8 }}>
        Проведите для получения
      </span>
      {confirmed && (
        <span className="wishlist-slide-receive__label wishlist-slide-receive__label--done">
          ✓ Получено
        </span>
      )}
      <div
        className="wishlist-slide-receive__thumb"
        style={{
          transform: `translateX(${dragX}px)`,
          transition: isDragging ? 'none' : 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        }}
        onTouchStart={(e) => handleStart(e.touches[0].clientX)}
        onTouchMove={(e) => handleMove(e.touches[0].clientX)}
        onTouchEnd={handleEnd}
        onMouseDown={(e) => handleStart(e.clientX)}
      >
        <span className="wishlist-slide-receive__check">✓</span>
      </div>
    </div>
  )
}

export default function WishlistDetail() {
  const { id } = useParams() // can be a target ID, or 'my'
  const isOwn = id === 'my' || !id
  const navigate = useNavigate()

  // Local state
  const [showAdd, setShowAdd] = useState(false)
  const [ideaInput, setIdeaInput] = useState('')
  
  // Advanced add gift options
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [holidayInput, setHolidayInput] = useState('Без повода')
  const [categoryInput, setCategoryInput] = useState('Другое')

  // Keyboard active states for Android lifting adjustments
  const [isModalFocused, setIsModalFocused] = useState(false)

  // Track currently active gift details view overlay with smooth transitions
  const [renderedGift, setRenderedGift] = useState(null)
  const [isOverlayOpen, setIsOverlayOpen] = useState(false)

  const handleOpenGiftDetails = (gift) => {
    triggerHaptic()
    setRenderedGift(gift)
    setTimeout(() => {
      setIsOverlayOpen(true)
    }, 20)
  }

  const handleCloseGiftDetails = () => {
    setIsOverlayOpen(false)
    setTimeout(() => {
      setRenderedGift(null)
    }, 350)
  }


  // Fetch target or profile
  const { data: target, loading: tLoading, mutate: mutateTarget } = useData(
    isOwn ? 'profile' : `target_${id}`,
    isOwn ? api.getProfile : () => api.getTarget(id)
  )

  const loading = tLoading

  const triggerHaptic = () => {
    try {
      window.Telegram?.WebApp?.HapticFeedback?.impactOccurred('light')
    } catch (e) {
      console.warn('Haptic feedback not supported:', e)
    }
  }

  const triggerConfetti = () => {
    const canvas = document.createElement('canvas');
    canvas.style.position = 'fixed';
    canvas.style.top = '0';
    canvas.style.left = '0';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.pointerEvents = 'none';
    canvas.style.zIndex = '10000';
    document.body.appendChild(canvas);

    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    let width = window.innerWidth;
    let height = window.innerHeight;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    const handleResize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.scale(dpr, dpr);
    };
    window.addEventListener('resize', handleResize);

    const colors = ['#f5576c', '#f093fb', '#6c5ce7', '#a78bfa', '#22c55e', '#3b82f6', '#f59e0b', '#ef4444'];
    const particles = [];
    for (let i = 0; i < 100; i++) {
      particles.push({
        x: Math.random() * width,
        y: Math.random() * -100 - 20,
        r: Math.random() * 6 + 4,
        color: colors[Math.floor(Math.random() * colors.length)],
        tilt: Math.random() * 10 - 5,
        tiltAngleIncremental: Math.random() * 0.07 + 0.02,
        tiltAngle: Math.random() * Math.PI,
        rotation: Math.random() * Math.PI,
        rotationSpeed: Math.random() * 0.05 - 0.025,
        vx: Math.random() * 4 - 2,
        vy: Math.random() * 5 + 4,
        opacity: 1
      });
    }

    let animationId;
    const startTime = Date.now();
    const duration = 4000;

    const animate = () => {
      const elapsed = Date.now() - startTime;
      if (elapsed > duration) {
        cancelAnimationFrame(animationId);
        window.removeEventListener('resize', handleResize);
        canvas.remove();
        return;
      }

      ctx.clearRect(0, 0, width, height);

      let activeParticles = 0;
      particles.forEach(p => {
        p.y += p.vy;
        p.x += p.vx;
        p.tiltAngle += p.tiltAngleIncremental;
        p.tilt = Math.sin(p.tiltAngle) * 12;
        p.rotation += p.rotationSpeed;
        p.vx += Math.sin(p.tiltAngle) * 0.05;

        if (elapsed > duration - 1000) {
          p.opacity = 1 - (elapsed - (duration - 1000)) / 1000;
        }

        if (p.y < height && p.opacity > 0) {
          activeParticles++;
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rotation);
          ctx.globalAlpha = p.opacity;
          ctx.fillStyle = p.color;

          ctx.beginPath();
          ctx.fillRect(-p.r, -p.r / 2, p.r * 2, p.r + p.tilt);
          ctx.restore();
        }
      });

      if (activeParticles > 0) {
        animationId = requestAnimationFrame(animate);
      } else {
        window.removeEventListener('resize', handleResize);
        canvas.remove();
      }
    };

    animate();
  }

  const loadTarget = async () => {
    try {
      const res = await (isOwn ? api.getProfile() : api.getTarget(id))
      mutateTarget(res)
    } catch (err) {
      console.error(err)
    }
  }

  // Toggle Received status for own or friend's wishlist items
  const handleToggleReceived = async (itemId) => {
    triggerHaptic()
    try {
      await api.toggleWishlistItemReceived(itemId)
      await loadTarget()
    } catch (err) {
      console.error(err)
      showAlert('Не удалось изменить статус получения 😢')
    }
  }

  // Delete local custom idea
  const handleDeleteCustomIdea = async (itemId) => {
    triggerHaptic()
    try {
      await api.deleteWishlistItem(itemId)
      await loadTarget()
    } catch (err) {
      console.error(err)
      showAlert('Не удалось удалить подарок 😢')
    }
  }

  // Add new wishlist item
  const handleAddGift = async (e) => {
    e.preventDefault()
    const val = ideaInput.trim()
    if (!val) return

    try {
      const targetId = isOwn ? target.self_target_id : target.id
      await api.addWishlistItem({
        target_id: targetId,
        description: val,
        category: categoryInput,
        holiday: holidayInput
      })
      await loadTarget()
      
      // Reset inputs
      setIdeaInput('')
      setShowAdd(false)
      setShowAdvanced(false)
      setHolidayInput('Без повода')
      setCategoryInput('Другое')
      triggerHaptic()
    } catch (err) {
      console.error(err)
      showAlert('Не удалось сохранить подарок 😢')
    }
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

  const combinedWishlist = target.wishlist || []

  // Render a specific wishlist grid card
  const renderWishlistCard = (item, idx) => {
    const isReceived = !!item.received

    return (
      <div 
        key={item.id || idx} 
        className="wishlist-grid-card"
        onClick={() => handleOpenGiftDetails(item)}
        style={{ cursor: 'pointer' }}
      >
        {/* Delete button */}
        <button 
          className="wishlist-grid-card-delete"
          onClick={(e) => {
            e.stopPropagation()
            if (window.confirm('Удалить эту идею подарка?')) {
              handleDeleteCustomIdea(item.id)
            }
          }}
        >
          ✕
        </button>

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

  // Collect all elements (Add trigger card + items cards) for distribution in masonry columns
  const cards = []
  
  if (isOwn) {
    cards.push(
      <div 
        key="add-trigger"
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
    )
  }

  combinedWishlist.forEach((item, idx) => {
    cards.push(renderWishlistCard(item, idx))
  })

  // Distribute cards into 2 columns for masonry layout
  const col1 = []
  const col2 = []
  cards.forEach((card, idx) => {
    if (idx % 2 === 0) {
      col1.push(card)
    } else {
      col2.push(card)
    }
  })

  return (
    <>
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

      {/* Grid of wishlist items / Masonry */}
      {cards.length === 0 ? (
        <div className="wishlist-empty-state-fullcol">
          <span style={{ fontSize: '32px' }}>🎁</span>
          <div style={{ marginTop: '8px', fontWeight: 'bold' }}>Вишлист пуст</div>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
            В вишлисте пока нет идей. Вы можете добавить первую с помощью кнопки внизу!
          </div>
        </div>
      ) : (
        <div className="wishlist-items-masonry">
          <div className="wishlist-masonry-col">
            {col1}
          </div>
          <div className="wishlist-masonry-col">
            {col2}
          </div>
        </div>
      )}

      {/* Sticky Bottom pill button (Photo 2) */}
      <button 
        className="wishlist-sticky-bottom-btn" 
        onClick={() => { triggerHaptic(); setShowAdd(true); }}
      >
        ＋ Добавить подарок
      </button>
    </div>

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

      {/* Selected Gift Details Overlay (Photo 2 design) */}
      {renderedGift && createPortal(
        <div className={`wishlist-details-overlay ${isOverlayOpen ? 'show' : ''}`}>
          
          {/* Header action bar */}
          <div className="wishlist-details-header">
            <button 
              className="wishlist-details-header-btn" 
              onClick={handleCloseGiftDetails} 
              aria-label="Назад"
            >
              ‹
            </button>
            
            <button 
              className="wishlist-details-header-btn" 
              onClick={handleShare}
              aria-label="Поделиться"
            >
              📤
            </button>
          </div>

          <div className="wishlist-details-content">
            
            {/* Centered giant gift emoji/visual */}
            <div className="wishlist-details-gift-visual">
              <div className="wishlist-details-gift-glow"></div>
              <div className="wishlist-details-gift-emoji">🎁</div>
            </div>

            {/* Left-aligned gift title */}
            <h1 className="wishlist-details-title">
              {renderedGift.description || renderedGift.gift_description}
            </h1>

            {/* Details Split Card */}
            <div className="wishlist-details-card">
              <div className="wishlist-details-grid-info">
                
                {/* Left col: Added by */}
                <div className="wishlist-details-col">
                  <span className="wishlist-details-label">Добавил(а)</span>
                  <span className="wishlist-details-value">
                    {renderedGift.added_by === 'user' ? 'Вы' : (target.name || 'Данил')}
                  </span>
                </div>
                
                {/* Vertical Divider */}
                <div className="wishlist-details-divider" />
                
                {/* Right col: Date */}
                <div className="wishlist-details-col">
                  <span className="wishlist-details-label">Дата</span>
                  <span className="wishlist-details-value">
                    {new Date(renderedGift.created_at || Date.now()).toLocaleDateString('ru-RU', { 
                      day: 'numeric', 
                      month: 'long', 
                      year: 'numeric' 
                    })}
                  </span>
                </div>
              </div>

              {/* Slider for marking as received */}
              <div className="wishlist-details-slider-wrapper">
                <SlideToReceive 
                  isReceived={!!renderedGift.received}
                  onConfirm={() => {
                    if (!renderedGift.received) {
                      handleToggleReceived(renderedGift.id)
                      triggerConfetti()
                      
                      // smooth auto-close overlay so user sees the progress completes
                      setTimeout(() => {
                        handleCloseGiftDetails()
                      }, 1500)
                    }
                  }} 
                />
              </div>
            </div>

            {/* Empty state: No nested gifts */}
            <div className="wishlist-details-nested-gifts">
              <span className="wishlist-details-nested-icon">🎁</span>
              <span className="wishlist-details-nested-text">Нет вложенных подарков</span>
            </div>
          </div>

          {/* Sticky Bottom Actions */}
          <div className="wishlist-details-bottom-bar">
            <button 
              className="wishlist-details-add-btn" 
              onClick={() => {
                triggerHaptic();
                handleCloseGiftDetails();
                setShowAdd(true);
              }}
            >
              ＋ Добавить идею
            </button>
            
            <button 
              className="wishlist-details-more-btn"
              onClick={() => {
                triggerHaptic();
                if (window.confirm('Удалить эту идею подарка?')) {
                  handleDeleteCustomIdea(renderedGift.id)
                  handleCloseGiftDetails()
                }
              }}
              aria-label="Опции"
            >
              •••
            </button>
          </div>

        </div>,
        document.body
      )}
    </>
  )
}
