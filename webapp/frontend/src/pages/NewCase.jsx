import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import api from '../api'
import { getTargetEmoji } from './TargetDetail'
import { useData } from '../hooks/useData'
import { showAlert, showConfirm } from '../utils/popup'
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
  '🎂 День Рождения', '🎄 Новый Год', '🎅 Тайный Санта',
  '💐 8 Марта', '🛡 23 Февраля', '💍 Годовщина',
  '👨 День отца', '👩 День матери', '🎓 Выпускной',
  '💑 День св. Валентина', '🏠 Новоселье', '🎉 Юбилей',
  '🎁 Просто так'
]

const BUDGET_OPTIONS = [
  'До 1 000 ₽', 'До 3 000 ₽', 'До 5 000 ₽',
  'До 10 000 ₽', 'До 30 000 ₽', 'Неограничен'
]

const STEPS = ['detective', 'target', 'holiday', 'context', 'budget', 'confirm']

const AI_MODELS = [
  { id: 'deepseek-v4', name: 'DeepSeek V4', icon: '⚡️', desc: 'По умолчанию (Бесплатно). Быстрая и высокоинтеллектуальная базовая модель.' },
  { id: 'deepseek-v4-pro', name: 'DeepSeek V4 Pro', icon: '🚀', desc: 'Премиум DeepSeek. Максимальный интеллект для сложных расследований.' },
  { id: 'claude-4-6-opus', name: 'Claude 4.6 Opus', icon: '👑', desc: 'Премиум Anthropic. Безупречный детективный разум и глубокое понимание психологии.' },
  { id: 'gemini-3.5-flash', name: 'Gemini 3.5 Flash', icon: '⚡️', desc: 'Базовая лаконичная модель Google.' },
  { id: 'gpt-4o', name: 'GPT-4o', icon: '🧠', desc: 'Флагман OpenAI. Превосходная логика, глубокий анализ и точность роли.' },
  { id: 'claude-opus-4-7', name: 'Claude Opus 4.7', icon: '👑', desc: 'Премиум Anthropic. Мощный анализ эмоций и безупречный интеллект.' },
  { id: 'gpt-4o-mini', name: 'GPT-4o Mini', icon: '🚀', desc: 'Быстрый, экономичный ИИ от OpenAI.' },
]

const getDetectiveStats = (name) => {
  if (!name) return { specialty: 'Секретное расследование', skills: [] };
  if (name.includes('Виктор')) {
    return {
      specialty: 'Классическое следствие 🧥',
      skills: [
        { label: 'Дедукция 🧠', val: 95, color: '#6c5ce7' },
        { label: 'Проницательность 👁️', val: 90, color: '#00cec9' },
        { label: 'Вежливость 🤝', val: 95, color: '#e84393' }
      ]
    }
  } else if (name.includes('Коржик')) {
    return {
      specialty: 'Вынюхивание радости 🐾',
      skills: [
        { label: 'Милота 🐾', val: 100, color: '#fdcb6e' },
        { label: 'Нюх на подарки 🦴', val: 95, color: '#e17055' },
        { label: 'Обаяние 🐕', val: 100, color: '#ff7675' }
      ]
    }
  } else if (name.includes('Зорп')) {
    return {
      specialty: 'Космический анализ 🛸',
      skills: [
        { label: 'Оригинальность 🛸', val: 100, color: '#0984e3' },
        { label: 'Межгалактический юмор 👽', val: 90, color: '#2ecc71' },
        { label: 'Логика гика 👾', val: 85, color: '#9b59b6' }
      ]
    }
  } else if (name.includes('Реджинальд') || name.includes('Фезерстон')) {
    return {
      specialty: 'Светские беседы 🎩',
      skills: [
        { label: 'Галантность 🧐', val: 100, color: '#ffeaa7' },
        { label: 'Манеры 🎩', val: 100, color: '#dfe6e9' },
        { label: 'Тактичность 🕰️', val: 95, color: '#74b9ff' }
      ]
    }
  } else if (name.includes('Гробовщик')) {
    return {
      specialty: 'Брутальный допрос 💀',
      skills: [
        { label: 'Прямолинейность 💀', val: 90, color: '#2d3436' },
        { label: 'Скрытность 🌑', val: 95, color: '#636e72' },
        { label: 'Чёрный юмор 🥃', val: 85, color: '#d63031' }
      ]
    }
  } else if (name.includes('Глитч')) {
    return {
      specialty: 'Кибернетический опрос 🤖',
      skills: [
        { label: 'Мемы 💾', val: 95, color: '#a29bfe' },
        { label: 'Непредсказуемость ⚡', val: 90, color: '#ffeaa7' },
        { label: 'Киберлогика ⚙️', val: 85, color: '#00cec9' }
      ]
    }
  } else if (name.includes('Гэндальф')) {
    return {
      specialty: 'Мудрое прорицание 🔮',
      skills: [
        { label: 'Мудрость 🔮', val: 98, color: '#ffeaa7' },
        { label: 'Чародейство ✨', val: 95, color: '#e84393' },
        { label: 'Загадочность 📜', val: 90, color: '#81ecec' }
      ]
    }
  } else if (name.includes('Джек') || name.includes('Капитан')) {
    return {
      specialty: 'Пиратский азарт 🏴‍☠️',
      skills: [
        { label: 'Харизма 🏴‍☠️', val: 99, color: '#e17055' },
        { label: 'Обаяние 🪙', val: 95, color: '#fdcb6e' },
        { label: 'Авантюризм 🌊', val: 100, color: '#0984e3' }
      ]
    }
  }
  return {
    specialty: 'Секретное расследование 🕵️‍♂️',
    skills: [
      { label: 'Дедукция 🧠', val: 90, color: '#6c5ce7' },
      { label: 'Скрытность 🤫', val: 90, color: '#00cec9' },
      { label: 'Обаяние ✨', val: 90, color: '#e84393' }
    ]
  }
}

export default function NewCase() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const [step, setStep] = useState(0)
  const [collapsed, setCollapsed] = useState({})

  const toggleGroup = (target) => {
    setCollapsed(prev => ({ ...prev, [target]: !prev[target] }))
  }

  const { data: targetsData, loading: tLoading } = useData('targets', api.getTargets)
  const { data: personasData, loading: pLoading, mutate: mutatePersonas } = useData('personas', api.getPersonas)
  const { data: casesData, loading: cLoading, mutate: mutateCases } = useData('cases', api.getCases)
  const { data: profile } = useData('profile', api.getProfile)

  const targets = targetsData || []
  const personas = personasData || []
  const cases = casesData || []

  const displayPersonas = (() => {
    const filtered = personas.filter(p => {
      if (filterMyOnly) {
        return p.creator_id !== null && p.creator_id !== undefined;
      }
      return true;
    });
    
    const showAddCard = !profile?.is_premium || profile?.custom_detectives_enabled;
    const list = [...filtered];
    if (showAddCard) {
      list.push({
        id: 'add_new',
        name: 'Добавить',
        desc: 'Создайте своего собственного уникального детектива с уникальным ИИ характером!',
        photo: null,
        isVirtual: true
      });
    }
    return list;
  })();

  const [submitting, setSubmitting] = useState(false)
  const [activePersonaIdx, setActivePersonaIdx] = useState(0)
  const [filterMyOnly, setFilterMyOnly] = useState(false)
  const [showLibraryModal, setShowLibraryModal] = useState(false)
  const [libraryPersonas, setLibraryPersonas] = useState([])
  const [libraryLoading, setLibraryLoading] = useState(false)
  const [isDraggingTrack, setIsDraggingTrack] = useState(false)
  const [dragOffset, setDragOffset] = useState(0)
  const [transitionEnabled, setTransitionEnabled] = useState(true)
  const isSwipingLocked = useRef(false)

  const [targetDisplayName, setTargetDisplayName] = useState('')

  const [form, setForm] = useState({
    target: searchParams.get('target') || '',
    holiday: '',
    context: '',
    persona: localStorage.getItem('last_selected_persona') || '',
    budget: '',
    ai_model: 'deepseek-v4',
  })

  // Persist chosen persona
  useEffect(() => {
    if (form.persona) {
      localStorage.setItem('last_selected_persona', form.persona)
    }
  }, [form.persona])

  const isFirstLoad = useRef(true)

  const hasLoadedDefaultPersona = useRef(false)

  // Sync activePersonaIdx with selected persona in form & handle premium defaults on load
  useEffect(() => {
    if (personas.length > 0 && profile !== undefined) {
      if (!hasLoadedDefaultPersona.current) {
        hasLoadedDefaultPersona.current = true
        const hasPremium = profile?.is_premium
        let targetPersona = ''
        
        if (hasPremium) {
          targetPersona = localStorage.getItem('last_selected_persona') || personas[0]?.name || ''
        } else {
          // Non-premium users always default to Viktor Black (the first persona)
          targetPersona = personas[0]?.name || ''
        }
        
        const idx = personas.findIndex(p => p.name === targetPersona)
        const targetIdx = idx !== -1 ? idx : 0
        
        setActivePersonaIdx(targetIdx)
        setForm(prev => ({ ...prev, persona: personas[targetIdx]?.name || '' }))
      } else {
        // Subsequent syncs from form.persona changes (carousel swipes, user clicks)
        const idx = personas.findIndex(p => p.name === form.persona)
        let targetIdx = idx !== -1 ? idx : -1

        if (targetIdx === -1) {
          const savedPersona = localStorage.getItem('last_selected_persona')
          const savedIdx = savedPersona ? personas.findIndex(p => p.name === savedPersona) : -1
          if (savedIdx !== -1) {
            targetIdx = savedIdx
          } else {
            targetIdx = 0
          }
        }

        if (activePersonaIdx !== targetIdx) {
          setActivePersonaIdx(targetIdx)
        }
      }
    }
  }, [personas, form.persona, profile])

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

  const handleTouchStart = (e) => {
    touchStartX.current = e.touches[0].clientX
    dragOffsetRef.current = 0
    setIsDraggingTrack(true)
  }

  const handleTouchMove = (e) => {
    if (!isDraggingTrack || !touchStartX.current) return
    const currentX = e.touches[0].clientX
    const diff = currentX - touchStartX.current
    dragOffsetRef.current = diff
    setDragOffset(diff)
  }

  const handleTouchEnd = () => {
    if (!isDraggingTrack) return
    setIsDraggingTrack(false)
    setDragOffset(0)

    const dragThreshold = 55
    const offset = dragOffsetRef.current
    let newIdx = activePersonaIdx
    const N = displayPersonas.length
    if (N > 0) {
      if (offset > dragThreshold) {
        newIdx = activePersonaIdx - 1
      } else if (offset < -dragThreshold) {
        newIdx = activePersonaIdx + 1
      }
      selectPersonaIndex(newIdx)
    }

    dragOffsetRef.current = 0
    touchStartX.current = 0
  }

  const handleMouseDown = (e) => {
    touchStartX.current = e.clientX
    dragOffsetRef.current = 0
    setIsDraggingTrack(true)
  }

  const handleMouseMove = (e) => {
    if (!isDraggingTrack || !touchStartX.current) return
    const diff = e.clientX - touchStartX.current
    dragOffsetRef.current = diff
    setDragOffset(diff)
  }

  const handleMouseUpOrLeave = () => {
    if (!isDraggingTrack) return
    setIsDraggingTrack(false)
    setDragOffset(0)

    const dragThreshold = 55
    const offset = dragOffsetRef.current
    let newIdx = activePersonaIdx
    const N = displayPersonas.length
    if (N > 0) {
      if (offset > dragThreshold) {
        newIdx = activePersonaIdx - 1
      } else if (offset < -dragThreshold) {
        newIdx = activePersonaIdx + 1
      }
      selectPersonaIndex(newIdx)
    }

    dragOffsetRef.current = 0
    touchStartX.current = 0
  }

  const selectPersonaIndex = (newIdx, targetPersonas = displayPersonas) => {
    const N = targetPersonas.length
    if (N === 0) return
    const circularIdx = ((newIdx % N) + N) % N
    setActivePersonaIdx(circularIdx)
    setForm(prev => ({ ...prev, persona: targetPersonas[circularIdx]?.name || '' }))
  }

  // Fetch library detectives when modal opens
  useEffect(() => {
    if (showLibraryModal) {
      setLibraryLoading(true)
      api.getPublicPersonas()
        .then(data => {
          setLibraryPersonas(data)
          setLibraryLoading(false)
        })
        .catch(err => {
          console.error(err)
          setLibraryLoading(false)
        })
    }
  }, [showLibraryModal])

  const handleToggleLibraryAdd = async (p) => {
    triggerHaptic()
    const wasAdded = p.is_added
    try {
      if (wasAdded) {
        await api.removePersonaFromLibrary(p.id)
        p.is_added = false
      } else {
        await api.addPersonaToLibrary(p.id)
        p.is_added = true
      }
      setLibraryPersonas([...libraryPersonas])
      
      // Refresh carousel list in real time
      const updated = await api.getPersonas()
      mutatePersonas(updated)
    } catch (e) {
      await showAlert(e.message)
    }
  }

  const renderCarousel = () => {
    const N = displayPersonas.length

    return (
      <div className="wizard-step" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', padding: '0 8px' }}>
        
        {/* Carousel Navigation Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '20px', marginTop: '12px', marginBottom: '8px' }}>
          <button
            onClick={() => selectPersonaIndex(activePersonaIdx - 1)}
            style={{
              padding: '8px',
              borderRadius: '50%',
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              color: 'var(--text)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '18px',
              width: '36px',
              height: '36px',
              transition: 'var(--transition)'
            }}
          >
            ‹
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            {displayPersonas.map((_, index) => (
              <button
                key={index}
                onClick={() => selectPersonaIndex(index)}
                style={{
                  height: '6px',
                  borderRadius: '999px',
                  border: 'none',
                  cursor: 'pointer',
                  padding: 0,
                  transition: 'all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1)',
                  width: activePersonaIdx === index ? '18px' : '6px',
                  background: activePersonaIdx === index ? 'var(--accent)' : 'var(--card-border)'
                }}
                aria-label={`Go to slide ${index + 1}`}
              />
            ))}
          </div>

          <button
            onClick={() => selectPersonaIndex(activePersonaIdx + 1)}
            style={{
              padding: '8px',
              borderRadius: '50%',
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              color: 'var(--text)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '18px',
              width: '36px',
              height: '36px',
              transition: 'var(--transition)'
            }}
          >
            ›
          </button>
        </div>

        <div className="persona-carousel-container" style={{ width: '100%', overflow: 'hidden' }}>
          <div
            className="persona-carousel-track-wrapper"
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUpOrLeave}
            onMouseLeave={handleMouseUpOrLeave}
            style={{
              cursor: isDraggingTrack ? 'grabbing' : 'grab',
              position: 'relative',
              width: '100%',
              height: '220px',
              overflow: 'hidden',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            {displayPersonas.map((p, idx) => {
              let offset = idx - activePersonaIdx;
              if (N > 0) {
                if (offset > N / 2) offset -= N;
                if (offset < -N / 2) offset += N;
              }

              const isVisible = Math.abs(offset) <= 1;
              const isActive = offset === 0;
              const zIndex = 10 - Math.abs(offset);
              const scale = isActive ? 1.08 : 0.82;
              const opacity = isVisible ? (isActive ? 1 : 0.5) : 0;

              const shiftX = offset * 115 + dragOffset;

              if (p.isVirtual) {
                return (
                  <div
                    key="add_new"
                    className={`persona-carousel-slide ${isActive ? 'active' : ''}`}
                    onClick={async () => {
                      if (isDraggingTrack) return;
                      if (!profile?.is_premium) {
                        const confirmStore = await showConfirm(
                          "👑 Создание собственного детектива доступно только с Премиум-подпиской!\n\nХотите перейти в магазин, чтобы активировать Премиум?"
                        );
                        if (confirmStore) {
                          navigate('/store');
                        }
                      } else {
                        navigate('/detective/create');
                      }
                    }}
                    style={{
                      position: 'absolute',
                      left: '50%',
                      top: '50%',
                      zIndex: zIndex,
                      opacity: opacity,
                      pointerEvents: isVisible ? 'auto' : 'none',
                      transform: `translate3d(calc(-50% + ${shiftX}px), -50%, 0) scale(${scale})`,
                      transition: isDraggingTrack ? 'none' : 'transform 0.4s cubic-bezier(0.25, 0.8, 0.25, 1), opacity 0.4s ease',
                      willChange: 'transform, opacity',
                      margin: 0,
                      flex: 'none'
                    }}
                  >
                    <div className="persona-carousel-card" style={{
                      position: 'relative',
                      border: '2px dashed var(--accent)',
                      borderRadius: '16px',
                      background: 'rgba(255, 255, 255, 0.02)',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxSizing: 'border-box',
                      height: '180px',
                      width: '120px'
                    }}>
                      <span style={{ fontSize: '32px', color: 'var(--accent)', fontWeight: '300', marginBottom: '4px' }}>+</span>
                      <span style={{ fontSize: '12px', fontWeight: '800', color: 'var(--text)' }}>Добавить</span>
                    </div>
                  </div>
                );
              }

              const isPremiumLocked = (p.id ? p.id !== 1 : idx !== 0) && !profile?.is_premium;

              return (
                <div
                  key={idx}
                  className={`persona-carousel-slide ${isActive ? 'active' : ''}`}
                  onClick={() => {
                    if (isDraggingTrack) return;
                    selectPersonaIndex(idx);
                  }}
                  style={{
                    position: 'absolute',
                    left: '50%',
                    top: '50%',
                    zIndex: zIndex,
                    opacity: opacity,
                    pointerEvents: isVisible ? 'auto' : 'none',
                    transform: `translate3d(calc(-50% + ${shiftX}px), -50%, 0) scale(${scale})`,
                    transition: isDraggingTrack ? 'none' : 'transform 0.4s cubic-bezier(0.25, 0.8, 0.25, 1), opacity 0.4s ease',
                    willChange: 'transform, opacity',
                    margin: 0,
                    flex: 'none'
                  }}
                >
                  <div className="persona-carousel-card" style={{ position: 'relative' }}>
                    <img src={p.photo} alt={p.name} className="persona-carousel-photo" decoding="async" draggable="false" />
                    {isPremiumLocked && (
                      <div style={{
                        position: 'absolute',
                        top: '8px',
                        right: '8px',
                        background: 'rgba(15, 15, 20, 0.82)',
                        border: '1px solid rgba(255, 215, 0, 0.35)',
                        borderRadius: '8px',
                        padding: '3px 6px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '3px',
                        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3), 0 0 8px rgba(255, 215, 0, 0.1)',
                        backdropFilter: 'blur(5px)',
                        pointerEvents: 'none',
                        zIndex: 2
                      }}>
                        <span style={{ fontSize: '11px', lineHeight: '1' }}>👑</span>
                        <span style={{
                          fontSize: '8px',
                          fontWeight: 900,
                          color: '#ffd700',
                          letterSpacing: '0.5px',
                          textTransform: 'uppercase',
                          lineHeight: '1'
                        }}>Премиум</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {displayPersonas[activePersonaIdx] && (() => {
          const p = displayPersonas[activePersonaIdx];
          
          if (p.isVirtual) {
            return (
              <div className="detective-dossier-card" style={{
                width: '100%',
                maxWidth: '340px',
                background: 'rgba(255, 255, 255, 0.03)',
                border: '1px dashed var(--accent)',
                borderRadius: '16px',
                padding: '16px',
                marginTop: '12px',
                marginBottom: '16px',
                height: '240px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center',
                boxShadow: '0 8px 32px rgba(108, 92, 231, 0.08)',
                backdropFilter: 'blur(10px)',
                boxSizing: 'border-box',
                textAlign: 'center'
              }}>
                <span style={{ fontSize: '28px', marginBottom: '8px' }}>✍️</span>
                <h3 style={{ fontSize: '15px', fontWeight: '800', margin: '0 0 6px 0', color: 'var(--text)' }}>
                  Ваш собственный детектив
                </h3>
                <p style={{ fontSize: '11.5px', color: 'var(--text-secondary)', lineHeight: '1.45', margin: 0, padding: '0 10px' }}>
                  Настройте характер, специализацию, навыки и сгенерируйте уникальный аватар с помощью ИИ!
                </p>
                <button
                  className="btn btn--primary"
                  onClick={async () => {
                    if (!profile?.is_premium) {
                      const confirmStore = await showConfirm(
                        "👑 Создание собственного детектива доступно только с Премиум-подпиской!\n\nХотите перейти в магазин, чтобы активировать Премиум?"
                      );
                      if (confirmStore) {
                        navigate('/store');
                      }
                    } else {
                      navigate('/detective/create');
                    }
                  }}
                  style={{
                    marginTop: '12px',
                    padding: '8px 20px',
                    fontSize: '12px',
                    borderRadius: '20px',
                    width: 'auto'
                  }}
                >
                  🚀 Создать детектива
                </button>
              </div>
            );
          }

          const stats = p.skills && p.skills.length > 0
            ? { specialty: p.specialty || 'Секретное расследование 🕵️‍♂️', skills: p.skills }
            : getDetectiveStats(p.name);
          const isLocked = (p.id ? p.id !== 1 : activePersonaIdx !== 0) && !profile?.is_premium;
          
          return (
            <div className="detective-dossier-card" style={{
              width: '100%',
              maxWidth: '340px',
              background: 'rgba(255, 255, 255, 0.03)',
              border: isLocked ? '1px solid rgba(255, 215, 0, 0.2)' : '1px solid var(--card-border)',
              borderRadius: '16px',
              padding: '16px',
              marginTop: '12px',
              marginBottom: '16px',
              height: '240px', // Fixed height to prevent ANY layout shifting!
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              boxShadow: isLocked ? '0 8px 32px rgba(255, 215, 0, 0.05)' : '0 8px 32px rgba(0, 0, 0, 0.15)',
              backdropFilter: 'blur(10px)',
              boxSizing: 'border-box',
              textAlign: 'left'
            }}>
              {/* Header: Name and Status Badge */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ fontSize: '16px', fontWeight: '800', margin: 0, color: 'var(--text)' }}>
                  {p.name}
                </h3>
                <span style={{
                  fontSize: '10px',
                  fontWeight: 800,
                  padding: '3px 8px',
                  borderRadius: '10px',
                  background: isLocked ? 'rgba(255, 215, 0, 0.12)' : 'rgba(46, 204, 113, 0.12)',
                  color: isLocked ? '#ffd700' : '#2ecc71',
                  border: isLocked ? '1px solid rgba(255, 215, 0, 0.25)' : '1px solid rgba(46, 204, 113, 0.25)',
                  boxShadow: isLocked ? '0 0 10px rgba(255, 215, 0, 0.1)' : 'none',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px'
                }}>
                  {isLocked ? '👑 Премиум' : '🟢 Бесплатно'}
                </span>
              </div>
              
              {/* Specialty */}
              <div style={{ fontSize: '11px', color: isLocked ? '#ffd700' : 'var(--accent)', fontWeight: 700, marginTop: '2px', opacity: 0.9 }}>
                🔒 Специализация: {stats.specialty}
              </div>

              {/* Description - Fixed Height with Scroll if needed to keep layout stable */}
              <div style={{
                fontSize: '12px',
                color: 'var(--text-secondary)',
                lineHeight: '1.45',
                margin: '6px 0',
                height: '52px',
                overflowY: 'auto',
                scrollbarWidth: 'none',
                WebkitOverflowScrolling: 'touch'
              }} className="custom-scroll">
                {p.desc}
              </div>

              {/* Skills Progress Section */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {stats.skills.map((sk, idx) => (
                  <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10.5px', fontWeight: 700, color: 'var(--text-secondary)' }}>
                      <span>{sk.label}</span>
                      <span>{sk.val}%</span>
                    </div>
                    <div style={{ height: '4px', background: 'rgba(255,255,255,0.06)', borderRadius: '2px', overflow: 'hidden' }}>
                      <div style={{
                        height: '100%',
                        width: `${sk.val}%`,
                        background: sk.color || '#6c5ce7',
                        boxShadow: `0 0 8px ${sk.color || '#6c5ce7'}`,
                        borderRadius: '2px',
                        transition: 'width 0.8s cubic-bezier(0.25, 0.8, 0.25, 1)'
                      }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })()}

        <div style={{
          width: '100%',
          maxWidth: '320px',
          background: 'transparent',
          padding: '8px 0',
          marginTop: '4px'
        }}>
          <button
            className="btn btn--primary"
            onClick={async () => {
              const activePersona = personas[activePersonaIdx];
              const isLocked = activePersona && (activePersona.id ? activePersona.id !== 1 : activePersonaIdx !== 0) && !profile?.is_premium;
              if (isLocked) {
                const confirmUnlock = await showConfirm(
                  `👑 Детектив ${activePersona.name} доступен только с премиум подпиской!\n\nХотите перейти в магазин, чтобы активировать премиум?`
                );
                if (confirmUnlock) {
                  navigate('/store');
                }
                return;
              }
              triggerHaptic();
              setStep(2);
            }}
            style={{
              width: '100%',
              margin: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px'
            }}
          >
            🔍 Начать расследование
          </button>
        </div>
      </div>
    );
  };

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
    if (searchParams.get('target')) setStep(3) // go directly to holiday step (step 2 of wizard, index 3)
  }, [searchParams])

  const triggerHaptic = () => {
    try {
      window.Telegram?.WebApp?.HapticFeedback?.impactOccurred('light')
    } catch { }
  }

  const currentStepKey = step >= 2 ? STEPS[step - 1] : null

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
    const activeModel = profile?.model_selector_enabled !== false ? form.ai_model : 'deepseek-v4'
    try {
      await api.createCase({
        target: form.target,
        holiday: form.holiday || 'Без повода',
        context: form.context || 'Нет данных',
        persona: form.persona,
        budget: form.budget || 'Не указан',
        ai_model: activeModel,
      })

      // Reset form and return to dashboard
      setForm({
        target: '',
        holiday: '',
        context: '',
        persona: localStorage.getItem('last_selected_persona') || '',
        budget: '',
        ai_model: 'deepseek-v4',
      })
      setTargetDisplayName('')
      setStep(0)

      const updated = await api.getCases()
      mutateCases(updated)

      navigate('/', { replace: true })
    } catch (err) {
      await showAlert(err.message)
    }
    setSubmitting(false)
  }



  return (
    <div className="page page-profile-bg" style={{ paddingBottom: '120px' }}>
      {/* Sleek Custom Header */}
      <div className="new-header" style={{ paddingBottom: '8px', borderBottom: 'none', background: 'transparent' }}>
        {step === 0 ? (
          <div style={{ width: 36 }} />
        ) : step > 0 ? (
          <button
            className="wishlist-header-btn"
            onClick={() => {
              if (step === 2) {
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
          <div style={{ width: 36 }} />
        ) : (
          <div style={{ fontSize: 14, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', width: 40, flexShrink: 0 }}>
            {step >= 2 ? `${step}/${STEPS.length}` : ''}
          </div>
        )}
      </div>

      {/* Progress (only visible when in wizard) */}
      {step >= 2 && (
        <div className="wizard-progress">
          {STEPS.map((s, i) => (
            <div key={s} className={`wizard-dot ${i === (step - 1) ? 'active' : i < (step - 1) ? 'done' : ''}`} />
          ))}
        </div>
      )}

      {/* Step 0: Dashboard */}
      {step === 0 && (
        <div className="detective-dashboard" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* Filters and Library Header */}
          {profile?.is_premium && profile?.custom_detectives_enabled && (
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              width: '100%',
              padding: '0 8px',
              marginBottom: '-8px',
              marginTop: '4px'
            }}>
              {/* Toggle Switcher */}
              <div style={{
                display: 'flex',
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid var(--card-border)',
                borderRadius: '20px',
                padding: '3px'
              }}>
                <button
                  onClick={() => { triggerHaptic(); setFilterMyOnly(false); selectPersonaIndex(0, displayPersonas.filter(p => !filterMyOnly)); }}
                  style={{
                    padding: '6px 14px',
                    borderRadius: '17px',
                    border: 'none',
                    fontSize: '12px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    background: !filterMyOnly ? 'var(--accent)' : 'transparent',
                    color: !filterMyOnly ? '#fff' : 'var(--text-secondary)',
                    transition: 'all 0.2s ease'
                  }}
                >
                  Все
                </button>
                <button
                  onClick={() => { triggerHaptic(); setFilterMyOnly(true); selectPersonaIndex(0, displayPersonas.filter(p => filterMyOnly)); }}
                  style={{
                    padding: '6px 14px',
                    borderRadius: '17px',
                    border: 'none',
                    fontSize: '12px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    background: filterMyOnly ? 'var(--accent)' : 'transparent',
                    color: filterMyOnly ? '#fff' : 'var(--text-secondary)',
                    transition: 'all 0.2s ease'
                  }}
                >
                  Мои
                </button>
              </div>

              {/* Library Button */}
              <button
                onClick={() => { triggerHaptic(); setShowLibraryModal(true); }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: 'linear-gradient(135deg, rgba(167, 139, 250, 0.12) 0%, rgba(108, 92, 231, 0.12) 100%)',
                  border: '1px solid rgba(108, 92, 231, 0.25)',
                  borderRadius: '20px',
                  padding: '6px 14px',
                  fontSize: '12px',
                  fontWeight: 700,
                  color: 'var(--accent)',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
              >
                <span>🌍</span> Библиотека
              </button>
            </div>
          )}

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
                              className="profile-order-card no-active-scale"
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
                            <div className={`expandable-content ${isExpanded ? 'expanded' : ''}`}>
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
                                            <span className={`status-dot status-dot--${st.dot}`} style={{ width: 6, height: 6, borderRadius: '50%', display: 'inline-block' }} />
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
                  onClick={() => { setForm({ ...form, target: t.identifier }); setTargetDisplayName(t.name || ''); setStep(3) }}
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
          <button 
            className="btn btn--primary" 
            disabled={!form.target} 
            onClick={() => {
              let targetVal = form.target.trim();
              if (targetVal.startsWith('@')) {
                // Keep as is
              } else if (targetVal.includes('t.me/')) {
                const parts = targetVal.split('t.me/');
                const username = parts[parts.length - 1].replace('@', '');
                targetVal = '@' + username;
              } else {
                const digits = targetVal.replace(/\D/g, '');
                const isPossiblePhone = /^\+?[\d\s()+-]+$/.test(targetVal) && digits.length >= 9 && digits.length <= 15;
                
                if (isPossiblePhone) {
                  if (digits.length === 11 && digits.startsWith('8')) {
                    targetVal = '+7' + digits.slice(1);
                  } else if (digits.length === 11 && digits.startsWith('7')) {
                    targetVal = '+' + digits;
                  } else if (digits.length === 10) {
                    targetVal = '+7' + digits;
                  } else {
                    targetVal = '+' + digits;
                  }
                } else if (/^[a-zA-Z0-9_]{4,32}$/.test(targetVal)) {
                  targetVal = '@' + targetVal;
                }
              }
              setForm({ ...form, target: targetVal });
              setStep(3);
            }}
          >
            Далее →
          </button>
        </div>
      )}

      {/* Step 2: Holiday */}
      {currentStepKey === 'holiday' && (
        <div className="wizard-step">
          <div className="wizard-step__title">🎉 Какой повод?</div>
          <div className="wizard-step__desc">Выберите из вариантов или напишите свой</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: 'center', marginBottom: '16px' }}>
            {HOLIDAY_OPTIONS.map(h => {
              const isSelected = form.holiday === h;
              return (
                <div
                  key={h}
                  onClick={() => { triggerHaptic(); setForm({ ...form, holiday: h }); setStep(4) }}
                  style={{
                    background: isSelected ? 'rgba(108, 92, 231, 0.12)' : 'var(--card-bg)',
                    border: '1px solid',
                    borderColor: isSelected ? 'var(--accent)' : 'var(--card-border)',
                    borderRadius: '20px',
                    padding: '8px 14px',
                    fontSize: '13px',
                    color: 'var(--text)',
                    cursor: 'pointer',
                    transition: 'var(--transition)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontWeight: isSelected ? 600 : 400,
                    boxShadow: isSelected ? '0 0 8px rgba(108, 92, 231, 0.15)' : 'none'
                  }}
                >
                  {h}
                </div>
              );
            })}
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
          <div className="card no-active-scale">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 14 }}>
              <div><strong>🎯 Цель:</strong> {targetDisplayName || form.target}</div>
              <div><strong>🎉 Повод:</strong> {form.holiday || 'Без повода'}</div>
              <div><strong>🧩 Зацепки:</strong> {form.context || 'Нет данных'}</div>
              <div><strong>🕵️ Детектив:</strong> {form.persona}</div>
              <div><strong>💵 Бюджет:</strong> {form.budget || 'Не указан'}</div>
            </div>
          </div>

          {profile?.model_selector_enabled !== false && (
            <>
              <div className="section-header" style={{ marginTop: 24, marginBottom: 8 }}>
                <div className="section-header__title">🤖 Выберите ИИ модель детектива</div>
              </div>
              
              {/* Horizontal Scrollable Selector */}
              <div style={{
                display: 'flex',
                gap: '8px',
                overflowX: 'auto',
                paddingBottom: '8px',
                marginBottom: '12px',
                scrollbarWidth: 'none',
                WebkitOverflowScrolling: 'touch',
                width: '100%'
              }} className="model-selector-horizontal">
                {AI_MODELS.map(m => {
                  const isSelected = form.ai_model === m.id;
                  const isLocked = m.id !== 'deepseek-v4' && !profile?.is_premium;
                  return (
                    <div
                      key={m.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '10px 16px',
                        borderRadius: '20px',
                        border: '1px solid',
                        borderColor: isSelected ? 'var(--accent)' : 'var(--card-border)',
                        background: isSelected ? 'rgba(108, 92, 231, 0.12)' : 'var(--card-bg)',
                        whiteSpace: 'nowrap',
                        flexShrink: 0,
                        cursor: 'pointer',
                        opacity: isLocked ? 0.65 : 1,
                        fontSize: '13px',
                        fontWeight: 600,
                        transition: 'var(--transition)'
                      }}
                      onClick={async () => {
                        if (isLocked) {
                          const confirmStore = await showConfirm(
                            `👑 Модель ${m.name} доступна только с премиум подпиской!\n\nЖелаете перейти в магазин для активации?`
                          );
                          if (confirmStore) {
                            navigate('/store');
                          }
                          return;
                        }
                        triggerHaptic();
                        setForm({ ...form, ai_model: m.id });
                      }}
                    >
                      <span>{m.icon}</span>
                      <span>{m.name}</span>
                      {isLocked ? (
                        <span style={{ fontSize: '11px', marginLeft: '2px' }}>🔒</span>
                      ) : isSelected ? (
                        <span style={{ color: 'var(--accent)', fontWeight: 700, marginLeft: '2px' }}>✓</span>
                      ) : null}
                    </div>
                  );
                })}
              </div>

              {/* Dynamic Single Description Box */}
              {(() => {
                const selectedModelInfo = AI_MODELS.find(m => m.id === form.ai_model);
                return selectedModelInfo ? (
                  <div style={{
                    fontSize: '12px',
                    color: 'var(--text-secondary)',
                    background: 'rgba(255,255,255,0.02)',
                    padding: '10px 14px',
                    borderRadius: '12px',
                    border: '1px solid var(--card-border)',
                    marginBottom: 20,
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '8px',
                    lineHeight: '1.4',
                    textAlign: 'left'
                  }}>
                    <span style={{ fontSize: '14px' }}>💡</span>
                    <div>
                      <strong>{selectedModelInfo.name}:</strong> {selectedModelInfo.desc}
                    </div>
                  </div>
                ) : null;
              })()}
            </>
          )}

          <SlideToConfirm onConfirm={handleSubmit} submitting={submitting} />
        </div>
      )}
    {/* Community Library Bottom Sheet */}
    {showLibraryModal && (
      <>
        <div className="bottom-sheet-backdrop" onClick={() => setShowLibraryModal(false)} />
        <div className="bottom-sheet" style={{ height: '75vh', maxHeight: '600px', display: 'flex', flexDirection: 'column' }}>
          <div className="bottom-sheet-header" style={{ flexShrink: 0 }}>
            <span className="bottom-sheet-title">🌍 Библиотека детективов</span>
            <button className="bottom-sheet-close" onClick={() => setShowLibraryModal(false)}>✕</button>
          </div>
          
          <div style={{ flex: 1, overflowY: 'auto', padding: '0 4px', display: 'flex', flexDirection: 'column', gap: '12px' }} className="custom-scroll">
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', textAlign: 'center', margin: '4px 0 8px 0', lineHeight: '1.4' }}>
              Добавляйте к себе в карусель уникальных детективов, созданных сообществом Giftspy!
            </p>
            
            {libraryLoading ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '40px 0' }}><div className="spinner" /></div>
            ) : libraryPersonas.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 10px', color: 'var(--text-secondary)', fontSize: '13px' }}>
                Пока нет доступных публичных детективов от других пользователей. Будьте первыми, кто создаст! 🚀
              </div>
            ) : (
              libraryPersonas.map(p => (
                <div key={p.id} style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  background: 'rgba(255, 255, 255, 0.02)',
                  border: '1px solid var(--card-border)',
                  borderRadius: '16px',
                  padding: '12px 14px',
                  gap: '12px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0, flex: 1 }}>
                    <div style={{
                      width: '44px',
                      height: '44px',
                      borderRadius: '50%',
                      background: 'rgba(255,255,255,0.04)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      overflow: 'hidden',
                      flexShrink: 0
                    }}>
                      {p.photo ? <img src={p.photo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : '🕵️‍♂️'}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: '14.5px', color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</div>
                      <div style={{ fontSize: '11px', color: 'var(--accent)', fontWeight: 650, marginTop: '2px' }}>{p.specialty}</div>
                      <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)', marginTop: '4px', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', lineHeight: '1.3' }}>{p.desc}</div>
                    </div>
                  </div>
                  
                  <button
                    onClick={() => handleToggleLibraryAdd(p)}
                    className={`btn btn--small ${p.is_added ? 'btn--secondary' : 'btn--primary'}`}
                    style={{
                      width: 'auto',
                      padding: '8px 14px',
                      borderRadius: '16px',
                      fontSize: '11.5px',
                      fontWeight: 700,
                      margin: 0,
                      flexShrink: 0
                    }}
                  >
                    {p.is_added ? '✓ Добавлен' : '＋ Добавить'}
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </>
    )}
    </div>
  )
}
