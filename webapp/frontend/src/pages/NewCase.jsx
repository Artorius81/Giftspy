import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import api from '../api'
import { getTargetEmoji } from './TargetDetail'
import { useData } from '../hooks/useData'
import { showAlert } from '../utils/popup'
import { timeAgo } from '../utils/timeAgo'



/* ── Slide-to-confirm component ── */
function SlideToConfirm({ onConfirm, submitting }) {
  const trackRef = useRef(null)
  const [dragX, setDragX] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const [confirmed, setConfirmed] = useState(false)
  const startX = useRef(0)
  const thumbSize = 56
  const padding = 4

  const getMaxX = () => {
    if (!trackRef.current) return 200
    return trackRef.current.offsetWidth - thumbSize - padding * 2
  }

  const progress = Math.min(dragX / (getMaxX() || 1), 1)

  const handleStart = (clientX) => {
    if (submitting || confirmed) return
    startX.current = clientX - dragX
    setIsDragging(true)
  }

  const handleMove = useCallback((clientX) => {
    if (!isDragging || confirmed) return
    const maxX = getMaxX()
    const x = Math.max(0, Math.min(clientX - startX.current, maxX))
    setDragX(x)
  }, [isDragging, confirmed])

  const handleEnd = useCallback(() => {
    if (!isDragging) return
    setIsDragging(false)
    const maxX = getMaxX()
    if (dragX >= maxX * 0.85) {
      setDragX(maxX)
      setConfirmed(true)
      // haptic if available
      try { window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred('success') } catch { }
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

  // Reset when submitting ends with error
  useEffect(() => {
    if (!submitting && confirmed) {
      // keep confirmed if navigating away, otherwise reset after a delay
      const t = setTimeout(() => { setConfirmed(false); setDragX(0) }, 2000)
      return () => clearTimeout(t)
    }
  }, [submitting, confirmed])

  return (
    <div
      ref={trackRef}
      className={`slide-confirm ${isDragging ? 'dragging' : ''} ${confirmed ? 'confirmed' : ''}`}
    >
      {/* progress fill */}
      <div className="slide-confirm__fill" style={{ width: `${(dragX + thumbSize + padding * 2)}px` }} />

      {/* label */}
      <span className="slide-confirm__label" style={{ opacity: 1 - progress * 1.8 }}>
        {submitting ? '⏳ Отправка...' : 'Начать расследование'}
      </span>

      {/* confirmed label */}
      {confirmed && (
        <span className="slide-confirm__label slide-confirm__label--done">
          ✅ Отправлено!
        </span>
      )}

      {/* thumb */}
      <div
        className="slide-confirm__thumb"
        style={{
          transform: `translateX(${dragX}px)`,
          transition: isDragging ? 'none' : 'transform 0.35s cubic-bezier(0.4, 0, 0.2, 1)',
        }}
        onTouchStart={(e) => handleStart(e.touches[0].clientX)}
        onTouchMove={(e) => handleMove(e.touches[0].clientX)}
        onTouchEnd={handleEnd}
        onMouseDown={(e) => handleStart(e.clientX)}
      >
        <span className="slide-confirm__arrow">›</span>
      </div>
    </div>
  )
}
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

const HOLIDAY_OPTIONS = [
  '🎂 День Рождения', '💐 8 Марта', '🛡 23 Февраля',
  '🎄 Новый Год', '💍 Годовщина', '🎁 Просто так'
]

const BUDGET_OPTIONS = [
  'До 1 000 ₽', 'До 3 000 ₽', 'До 5 000 ₽',
  'До 10 000 ₽', 'До 30 000 ₽', 'Неограничен'
]

const STEPS = ['target', 'holiday', 'context', 'budget', 'confirm']

export default function NewCase() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const [step, setStep] = useState(0)
  const [collapsed, setCollapsed] = useState({})

  const toggleGroup = (target) => {
    setCollapsed(prev => ({ ...prev, [target]: !prev[target] }))
  }

  const { data: targetsData, loading: tLoading } = useData('targets', api.getTargets)
  const { data: personasData, loading: pLoading } = useData('personas', api.getPersonas)
  const { data: casesData, loading: cLoading, mutate: mutateCases } = useData('cases', api.getCases)

  const targets = targetsData || []
  const personas = personasData || []
  const cases = casesData || []

  const [submitting, setSubmitting] = useState(false)
  const [activePersonaIdx, setActivePersonaIdx] = useState(0)
  const [isDraggingTrack, setIsDraggingTrack] = useState(false)

  const [targetDisplayName, setTargetDisplayName] = useState('')

  const [form, setForm] = useState({
    target: searchParams.get('target') || '',
    holiday: '',
    context: '',
    persona: '',
    budget: '',
  })

  // Sync activePersonaIdx with selected persona in form
  useEffect(() => {
    if (personas.length > 0) {
      const idx = personas.findIndex(p => p.name === form.persona)
      if (idx !== -1) {
        setActivePersonaIdx(idx)
      } else {
        const middleIdx = Math.floor(personas.length / 2)
        setActivePersonaIdx(middleIdx)
        setForm(prev => ({ ...prev, persona: personas[middleIdx].name }))
      }
    }
  }, [personas, form.persona])

  const preloadedImagesRef = useRef([])

  // Preload all detective images inside the browser cache for instant rendering
  useEffect(() => {
    if (personas.length > 0 && preloadedImagesRef.current.length === 0) {
      personas.forEach(p => {
        if (p.photo) {
          const img = new Image()
          img.src = p.photo
          preloadedImagesRef.current.push(img) // Prevent garbage collection on iOS Safari!
        }
      })
    }
  }, [personas])

  const touchStartX = useRef(0)
  const dragOffsetRef = useRef(0)
  const trackRef = useRef(null)

  const handleTouchStart = (e) => {
    touchStartX.current = e.touches[0].clientX
    dragOffsetRef.current = 0
    setIsDraggingTrack(true)
    if (trackRef.current) {
      trackRef.current.style.transition = 'none'
    }
  }

  const handleTouchMove = (e) => {
    if (!isDraggingTrack || !touchStartX.current) return
    const currentX = e.touches[0].clientX
    const diff = currentX - touchStartX.current
    dragOffsetRef.current = diff
    
    // Smooth 120fps hardware-accelerated direct DOM updates
    if (trackRef.current) {
      trackRef.current.style.transform = `translateX(calc(-78px - (${activePersonaIdx} * 156px) + ${diff}px))`
    }
  }

  const handleTouchEnd = () => {
    if (!isDraggingTrack) return
    setIsDraggingTrack(false)
    
    const threshold = 50
    const offset = dragOffsetRef.current
    let newIdx = activePersonaIdx
    
    if (offset > threshold) {
      // Swipe right -> go to previous
      newIdx = (activePersonaIdx - 1 + personas.length) % personas.length
    } else if (offset < -threshold) {
      // Swipe left -> go to next
      newIdx = (activePersonaIdx + 1) % personas.length
    }
    
    setActivePersonaIdx(newIdx)
    setForm(prev => ({ ...prev, persona: personas[newIdx].name }))
    
    // Apply smooth snapping directly to DOM
    if (trackRef.current) {
      trackRef.current.style.transition = 'transform 0.65s cubic-bezier(0.16, 1, 0.3, 1)'
      trackRef.current.style.transform = `translateX(calc(-78px - (${newIdx} * 156px)))`
    }
    
    dragOffsetRef.current = 0
    touchStartX.current = 0
  }

  const handleMouseDown = (e) => {
    touchStartX.current = e.clientX
    dragOffsetRef.current = 0
    setIsDraggingTrack(true)
    if (trackRef.current) {
      trackRef.current.style.transition = 'none'
    }
  }

  const handleMouseMove = (e) => {
    if (!isDraggingTrack || !touchStartX.current) return
    const diff = e.clientX - touchStartX.current
    dragOffsetRef.current = diff
    if (trackRef.current) {
      trackRef.current.style.transform = `translateX(calc(-78px - (${activePersonaIdx} * 156px) + ${diff}px))`
    }
  }

  const handleMouseUpOrLeave = () => {
    if (!isDraggingTrack) return
    setIsDraggingTrack(false)
    
    const threshold = 50
    const offset = dragOffsetRef.current
    let newIdx = activePersonaIdx
    
    if (offset > threshold) {
      newIdx = (activePersonaIdx - 1 + personas.length) % personas.length
    } else if (offset < -threshold) {
      newIdx = (activePersonaIdx + 1) % personas.length
    }
    
    setActivePersonaIdx(newIdx)
    setForm(prev => ({ ...prev, persona: personas[newIdx].name }))
    
    if (trackRef.current) {
      trackRef.current.style.transition = 'transform 0.65s cubic-bezier(0.16, 1, 0.3, 1)'
      trackRef.current.style.transform = `translateX(calc(-78px - (${newIdx} * 156px)))`
    }
    
    dragOffsetRef.current = 0
    touchStartX.current = 0
  }

  const renderCarousel = () => (
    <div className="wizard-step" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', padding: '0 8px' }}>
      <div className="persona-carousel-container">
        <div 
          className="persona-carousel-track-wrapper"
          onTouchStart={handleTouchStart} 
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUpOrLeave}
          onMouseLeave={handleMouseUpOrLeave}
          style={{ cursor: isDraggingTrack ? 'grabbing' : 'grab' }}
        >
          <div
            ref={trackRef}
            className="persona-carousel-track"
            style={{
              transform: `translateX(calc(-78px - (${activePersonaIdx} * 156px)))`,
              transition: isDraggingTrack ? 'none' : 'transform 0.65s cubic-bezier(0.16, 1, 0.3, 1)'
            }}
          >
            {personas.map((p, idx) => {
              const isActive = idx === activePersonaIdx;
              return (
                <div
                  key={idx}
                  className={`persona-carousel-slide ${isActive ? 'active' : ''}`}
                  onClick={() => {
                    setActivePersonaIdx(idx);
                    setForm(prev => ({ ...prev, persona: p.name }));
                  }}
                >
                  <div className="persona-carousel-card">
                    <img src={p.photo} alt={p.name} className="persona-carousel-photo" decoding="async" draggable="false" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="carousel-dots">
          {personas.map((_, idx) => (
            <div
              key={idx}
              className={`carousel-dot ${idx === activePersonaIdx ? 'active' : ''}`}
              onClick={() => {
                setActivePersonaIdx(idx);
                setForm(prev => ({ ...prev, persona: personas[idx].name }));
              }}
            />
          ))}
        </div>
      </div>

      {personas[activePersonaIdx] && (
        <div className="active-detective-details" style={{ width: '100%', maxWidth: '340px', textAlign: 'center', marginTop: '16px', padding: '0 8px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: '800', margin: '0 0 6px 0', color: 'var(--text)', letterSpacing: '-0.3px' }}>
            {personas[activePersonaIdx].name}
          </h2>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.45', margin: '0 0 16px 0', minHeight: '56px' }}>
            {personas[activePersonaIdx].desc}
          </p>
        </div>
      )}

      <div style={{ 
        width: '100%', 
        maxWidth: '320px', 
        background: 'transparent',
        padding: '8px 0',
        marginTop: '8px'
      }}>
        <SlideToConfirm onConfirm={() => { triggerHaptic(); setStep(2); }} submitting={false} />
      </div>
    </div>
  );

  useEffect(() => {
    if (targetsData) {
      const preselected = searchParams.get('target')
      if (preselected) {
        const found = targetsData.find(t => t.identifier === preselected)
        if (found && found.name) setTargetDisplayName(found.name)
      }
    }
  }, [targetsData, searchParams])
  useEffect(() => {
    if (searchParams.get('target')) setStep(2) // go directly to holiday step (step 2)
  }, [searchParams])

  const triggerHaptic = () => {
    try {
      window.Telegram?.WebApp?.HapticFeedback?.impactOccurred('light')
    } catch { }
  }

  const currentStepKey = step >= 2 ? STEPS[step - 2] : null

  const hasCustomHoliday = form.holiday && !HOLIDAY_OPTIONS.includes(form.holiday) && form.holiday !== 'Без повода'

  const handleRefresh = async () => {
    try {
      const updated = await api.getCases()
      mutateCases(updated)
    } catch (e) {
      console.error(e)
    }
  }

  const handleSubmit = async () => {
    setSubmitting(true)
    try {
      await api.createCase({
        target: form.target,
        holiday: form.holiday || 'Без повода',
        context: form.context || 'Нет данных',
        persona: form.persona,
        budget: form.budget || 'Не указан',
      })

      // Reset form and return to dashboard
      setForm({
        target: '',
        holiday: '',
        context: '',
        persona: '',
        budget: '',
      })
      setTargetDisplayName('')
      setStep(0)

      const updated = await api.getCases()
      mutateCases(updated)

      navigate('/new-case', { replace: true })
    } catch (err) {
      await showAlert(err.message)
    }
    setSubmitting(false)
  }



  return (
    <div className="page" style={{ paddingBottom: '120px' }}>
      {/* Sleek Custom Header */}
      <div className="new-header" style={{ paddingBottom: '8px', borderBottom: 'none', background: 'transparent' }}>
        {step === 0 ? (
          cases.length > 0 ? (
            <button
              className="wishlist-header-btn"
              onClick={() => { triggerHaptic(); setStep(1); }}
              style={{ width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', fontWeight: '700' }}
              aria-label="Новое расследование"
            >
              ＋
            </button>
          ) : (
            <div style={{ width: 36 }} />
          )
        ) : step > 0 ? (
          <button
            className="wishlist-header-btn"
            onClick={() => {
              if (step === 2 && cases.length === 0) {
                setStep(0);
              } else {
                setStep(step - 1);
              }
            }}
            style={{ width: 36, height: 36 }}
            aria-label="Назад"
          >
            ‹
          </button>
        ) : (
          <div style={{ width: 36 }} />
        )}
        <span className="new-header-title" style={{ fontSize: '20px', fontWeight: '800', color: 'var(--text)' }}>
          {step === 0 ? 'Детектив' : 'Новое дело'}
        </span>
        {step === 0 ? (
          <button
            className="wishlist-header-btn"
            onClick={() => navigate('/settings')}
            style={{ width: 36, height: 36 }}
            aria-label="Настройки"
          >
            ⚙️
          </button>
        ) : (
          <div style={{ fontSize: 14, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', width: 40, flexShrink: 0 }}>
            {step >= 2 ? `${step - 1}/${STEPS.length}` : ''}
          </div>
        )}
      </div>

      {/* Progress (only visible when in wizard) */}
      {step >= 2 && (
        <div className="wizard-progress">
          {STEPS.map((s, i) => (
            <div key={s} className={`wizard-dot ${i === (step - 2) ? 'active' : i < (step - 2) ? 'done' : ''}`} />
          ))}
        </div>
      )}

      {/* Step 0: Dashboard */}
      {step === 0 && (
        <div className="detective-dashboard" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* 3D Touch Detective Carousel */}
          {renderCarousel()}

          {/* Search History (rendered below the carousel if cases exist) */}
          {cases.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', width: '100%', marginTop: '10px' }}>
              {/* History Header Section */}
              <div className="history-section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: '16px', color: 'var(--text-secondary)' }}>☰</span>
                  <span className="history-section-title">История поисков</span>
                </div>
                <button
                  className="btn-refresh-history"
                  onClick={handleRefresh}
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: '50%',
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    color: 'var(--text)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '14px',
                    transition: 'var(--transition)'
                  }}
                  aria-label="Обновить"
                >
                  ↻
                </button>
              </div>

              {/* History List */}
              <div className="history-list-container">
                {cLoading ? (
                  <div className="loading" style={{ padding: '20px 0' }}><div className="spinner" /></div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {(() => {
                      const groups = {}
                      cases.forEach(c => {
                        const targetKey = c.target
                        if (!groups[targetKey]) {
                          groups[targetKey] = {
                            display: c.display_name,
                            target_photo: c.target_photo,
                            target_db_id: c.target_db_id,
                            cases: [],
                            hasActive: false
                          }
                        }
                        groups[targetKey].cases.push(c)
                        if (['pending', 'started', 'in_progress', 'manual_mode'].includes(c.status)) {
                          groups[targetKey].hasActive = true
                        }
                      })
                      const sortedGroups = Object.entries(groups)

                      return sortedGroups.map(([target, group]) => {
                        const isExpanded = collapsed[target] === true
                        return (
                          <div key={target} style={{ display: 'flex', flexDirection: 'column' }}>
                            {/* Target Card in Profile Style */}
                            <div
                              className="profile-order-card"
                              style={{ marginBottom: isExpanded ? 6 : 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
                              onClick={() => toggleGroup(target)}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                                <div className="card__avatar" style={{ width: 40, height: 40, fontSize: 20, borderRadius: '50%', background: 'var(--gradient-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                  {group.target_photo ? <img src={group.target_photo} alt="" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} /> : getTargetEmoji(group.target_db_id || 0)}
                                </div>
                                <div>
                                  <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)' }}>{group.display}</div>
                                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>{target}</div>
                                </div>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                {group.hasActive && <span className="status-dot status-dot--active" style={{ width: 6, height: 6, borderRadius: '50%', background: '#3b82f6', display: 'inline-block' }} />}
                                <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{group.cases.length} дел</span>
                                <span className={`collapse-arrow ${!isExpanded ? 'collapsed' : ''}`} style={{ fontSize: 18, color: 'var(--text-secondary)', display: 'inline-block', transform: isExpanded ? 'none' : 'rotate(-90deg)', transition: 'transform 0.2s' }}>▾</span>
                              </div>
                            </div>

                            {/* Cases List */}
                            <div className={`expandable-content ${isExpanded ? 'expanded' : ''}`} style={{ display: isExpanded ? 'block' : 'none' }}>
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
                                        marginBottom: 0,
                                        cursor: 'pointer'
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
                      })
                    })()}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Step 1: Target */}
      {currentStepKey === 'target' && (
        <div className="wizard-step">
          <div className="wizard-step__title">🎯 Выберите цель</div>
          <div className="wizard-step__desc">Кого будем расследовать?</div>

          {targets.length > 0 && (
            <>
              <div className="section-header">
                <div className="section-header__title">Сохранённые цели</div>
              </div>
              {targets.map(t => (
                <div
                  key={t.id}
                  className={`card ${form.target === t.identifier ? 'selected' : ''}`}
                  style={form.target === t.identifier ? { borderColor: 'var(--accent)' } : {}}
                  onClick={() => { setForm({ ...form, target: t.identifier }); setTargetDisplayName(t.name || ''); setStep(2) }}
                >
                  <div className="card__header">
                    <div className="card__avatar">
                      {t.photo ? <img src={t.photo} alt="" /> : getTargetEmoji(t.id)}
                    </div>
                    <div className="card__info">
                      <div className="card__name">{t.name || t.identifier}</div>
                      <div className="card__sub">{t.identifier}</div>
                    </div>
                  </div>
                </div>
              ))}
            </>
          )}

          <div className="section-header">
            <div className="section-header__title">Или введите вручную</div>
          </div>
          <div className="input-group">
            <input
              className="input"
              placeholder="@username или +7..."
              value={form.target}
              onChange={e => setForm({ ...form, target: e.target.value })}
            />
          </div>
          <button className="btn btn--primary" disabled={!form.target} onClick={() => setStep(3)}>
            Далее →
          </button>
        </div>
      )}

      {/* Step 2: Holiday */}
      {currentStepKey === 'holiday' && (
        <div className="wizard-step">
          <div className="wizard-step__title">🎉 Какой повод?</div>
          <div className="wizard-step__desc">Выберите из вариантов или напишите свой</div>
          <div className="option-grid">
            {HOLIDAY_OPTIONS.map(h => (
              <div
                key={h}
                className={`option-item ${form.holiday === h ? 'selected' : ''}`}
                onClick={() => { setForm({ ...form, holiday: h }); setStep(4) }}
              >
                {h}
              </div>
            ))}
          </div>
          <div className="input-group" style={{ marginTop: 12 }}>
            <input
              className="input"
              placeholder="Или свой вариант..."
              value={hasCustomHoliday ? form.holiday : ''}
              onChange={e => setForm({ ...form, holiday: e.target.value })}
            />
          </div>
          {hasCustomHoliday ? (
            <button className="btn btn--primary" onClick={() => setStep(4)}>
              Далее →
            </button>
          ) : (
            <button className="btn btn--secondary" onClick={() => { setForm({ ...form, holiday: 'Без повода' }); setStep(4) }}>
              ⏩ Пропустить
            </button>
          )}
        </div>
      )}

      {/* Step 3: Context */}
      {currentStepKey === 'context' && (
        <div className="wizard-step">
          <div className="wizard-step__title">🧩 Зацепки</div>
          <div className="wizard-step__desc">Расскажите о человеке. Чем увлекается? Кем работает?</div>
          <div className="input-group">
            <textarea
              className="input"
              placeholder="Любит путешествия, работает дизайнером..."
              rows={4}
              value={form.context}
              onChange={e => setForm({ ...form, context: e.target.value })}
            />
          </div>
          <button className="btn btn--primary" onClick={() => setStep(5)}>
            {form.context ? 'Далее →' : '⏩ Пропустить'}
          </button>
        </div>
      )}

      {/* Step 5: Budget */}
      {currentStepKey === 'budget' && (
        <div className="wizard-step">
          <div className="wizard-step__title">💵 Бюджет</div>
          <div className="wizard-step__desc">Выберите бюджет на подарок</div>
          <div className="option-grid">
            {BUDGET_OPTIONS.map(b => (
              <div
                key={b}
                className={`option-item ${form.budget === b ? 'selected' : ''}`}
                onClick={() => { setForm({ ...form, budget: b }); setStep(6) }}
              >
                {b}
              </div>
            ))}
          </div>
          <button className="btn btn--secondary" style={{ marginTop: 12 }} onClick={() => { setForm({ ...form, budget: 'Не указан' }); setStep(6) }}>
            ⏩ Пропустить
          </button>
        </div>
      )}

      {/* Step 6: Confirm */}
      {currentStepKey === 'confirm' && (
        <div className="wizard-step">
          <div className="wizard-step__title">✅ Подтверждение</div>
          <div className="card">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 14 }}>
              <div><strong>🎯 Цель:</strong> {targetDisplayName || form.target}</div>
              <div><strong>🎉 Повод:</strong> {form.holiday || 'Без повода'}</div>
              <div><strong>🧩 Зацепки:</strong> {form.context || 'Нет данных'}</div>
              <div><strong>🕵️ Детектив:</strong> {form.persona}</div>
              <div><strong>💵 Бюджет:</strong> {form.budget || 'Не указан'}</div>
            </div>
          </div>
          <SlideToConfirm onConfirm={handleSubmit} submitting={submitting} />
        </div>
      )}
    </div>
  )
}
