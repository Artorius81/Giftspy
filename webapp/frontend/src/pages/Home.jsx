import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api'
import { getTargetEmoji } from './TargetDetail'
import { useData } from '../hooks/useData'
import { timeAgo } from '../utils/timeAgo'

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

export default function Home() {
  const navigate = useNavigate()
  const [collapsed, setCollapsed] = useState({})
  const [inputQuery, setInputQuery] = useState('')

  const { data: profile, loading: pLoading } = useData('profile', api.getProfile)
  const { data: cases, loading: cLoading, mutate } = useData('cases', api.getCases)

  const loading = pLoading || cLoading
  const allCases = cases || []

  // Poll for status updates
  useEffect(() => {
    const interval = setInterval(() => {
      api.getCases().then(mutate).catch(console.error)
    }, 10000)
    return () => clearInterval(interval)
  }, [mutate])

  const toggleGroup = (target) => {
    setCollapsed(prev => ({ ...prev, [target]: !prev[target] }))
  }

  if (loading) return <div className="page"><div className="loading"><div className="spinner" /></div></div>

  if (!profile) {
    return (
      <div className="page">
        <div className="empty-state">
          <div className="empty-state__icon">🔒</div>
          <div className="empty-state__title">Не удалось загрузить профиль</div>
          <div className="empty-state__desc">Откройте приложение через Telegram</div>
        </div>
      </div>
    )
  }

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

  const activeCases = allCases.filter(c => !['done', 'delivered', 'cancelled', 'error'].includes(c.status))
  const completedCount = allCases.filter(c => ['done', 'delivered'].includes(c.status)).length

  const getGreeting = () => {
    const hr = new Date().getHours()
    if (hr < 6) return 'Доброй ночи'
    if (hr < 12) return 'Доброе утро'
    if (hr < 18) return 'Добрый день'
    return 'Добрый вечер'
  }

  return (
    <div className="page" style={{ paddingBottom: '30px' }}>
      {/* Redesigned Premium Header */}
      <div className="header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', height: 'auto', background: 'transparent', borderBottom: 'none', flexShrink: 0 }}>
        <button 
          onClick={() => navigate('/dossier')}
          style={{
            width: '42px',
            height: '42px',
            borderRadius: '50%',
            background: 'rgba(255, 255, 255, 0.03)',
            border: '1px solid rgba(255, 255, 255, 0.06)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--text)',
            fontSize: '18px',
            cursor: 'pointer'
          }}
          title="Дела"
        >
          📂
        </button>
        <span style={{ fontSize: '19px', fontWeight: '800', letterSpacing: '-0.3px', color: 'var(--text)' }}>
          {getGreeting()}
        </span>
        <button 
          onClick={() => navigate('/settings')}
          style={{
            width: '42px',
            height: '42px',
            borderRadius: '50%',
            background: 'rgba(255, 255, 255, 0.03)',
            border: '1px solid rgba(255, 255, 255, 0.06)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--text)',
            fontSize: '18px',
            cursor: 'pointer'
          }}
          title="Настройки"
        >
          ⚙️
        </button>
      </div>

      {/* Redesigned Detective & Capsule Search Section */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '10px 20px 24px', textAlign: 'center' }}>
        {/* Detective illustration holding magnifying glass */}
        <div style={{ position: 'relative', width: '130px', height: '130px', marginBottom: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {/* Subtle background glow */}
          <div style={{
            position: 'absolute',
            width: '90px',
            height: '90px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(100, 100, 255, 0.15) 0%, rgba(100,100,255,0) 70%)',
            zIndex: 1
          }} />
          <span style={{ fontSize: '80px', zIndex: 2, display: 'inline-block', transform: 'scaleX(-1)' }} role="img" aria-label="detective">
            🕵️‍♂️
          </span>
          <span style={{
            position: 'absolute',
            right: '12px',
            bottom: '12px',
            fontSize: '32px',
            zIndex: 3,
            transform: 'rotate(-15deg) scaleX(-1)',
            background: 'rgba(10,10,12,0.6)',
            borderRadius: '50%',
            padding: '2px'
          }} role="img" aria-label="magnifying glass">
            🔍
          </span>
        </div>

        {/* Pill Badge */}
        <div style={{
          background: 'rgba(255, 255, 255, 0.05)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '12px',
          padding: '4px 14px',
          fontSize: '11px',
          fontWeight: '700',
          color: '#c2c2c9',
          textTransform: 'uppercase',
          letterSpacing: '0.6px',
          marginBottom: '14px',
          display: 'inline-block'
        }}>
          Поиск идеального подарка
        </div>

        {/* Capsule Search Input */}
        <div style={{ position: 'relative', width: '100%', maxWidth: '350px', margin: '0 auto' }}>
          <span style={{
            position: 'absolute',
            left: '18px',
            top: '50%',
            transform: 'translateY(-50%)',
            fontSize: '20px',
            color: 'var(--text-secondary)',
            pointerEvents: 'none',
            opacity: 0.6
          }}>
            🔍
          </span>
          <input
            type="text"
            className="input"
            style={{
              width: '100%',
              padding: '14px 18px 14px 48px',
              fontSize: '14px',
              borderRadius: '26px',
              background: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              color: 'var(--text)',
              transition: 'all 0.25s ease',
              outline: 'none'
            }}
            placeholder="Что подарить? (например, кофеварка)..."
            value={inputQuery}
            onChange={(e) => setInputQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && inputQuery.trim()) {
                navigate(`/search?query=${encodeURIComponent(inputQuery)}`)
              }
            }}
          />
        </div>
      </div>

      {/* Quick Stats */}
      <div className="stats-row" style={{ marginTop: '0px', marginBottom: '24px' }}>
        <div className="stat-card">
          <div className="stat-card__value">{activeCases.length}</div>
          <div className="stat-card__label">В работе</div>
        </div>
        <div className="stat-card">
          <div className="stat-card__value">{completedCount}</div>
          <div className="stat-card__label">Закрыто</div>
        </div>
        <div className="stat-card" onClick={() => navigate('/store')} style={{ cursor: 'pointer' }}>
          <div className="stat-card__value">{profile.is_premium ? '∞' : profile.balance}</div>
          <div className="stat-card__label">Осталось 🛍</div>
        </div>
      </div>


      {/* Cases grouped by target */}
      <div className="section-header">
        <div className="section-header__title">🔍 Дела</div>
        <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
          {allCases.length} дел
        </span>
      </div>

      {allCases.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '24px 16px' }}>
          <div style={{ fontSize: 28, marginBottom: 8 }}>🕵️‍♂️</div>
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>Нет расследований</div>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
            Отправьте детектива на задание прямо сейчас!
          </div>
          <button className="btn btn--primary" onClick={() => navigate('/new-case')}>
            🔍 Отправить детектива
          </button>
        </div>
      ) : (
        sortedGroups.map(([target, group]) => {
          const isExpanded = collapsed[target] === true
          return (
            <div key={target} style={{ marginBottom: 16 }}>
              {/* Target Card */}
              <div
                className="card"
                style={{ marginBottom: isExpanded ? 8 : 0, transition: 'var(--transition)' }}
                onClick={() => toggleGroup(target)}
              >
                <div className="card__header" style={{ marginBottom: 0 }}>
                  <div className="card__avatar">
                    {group.target_photo ? <img src={group.target_photo} alt="" /> : getTargetEmoji(group.target_db_id || 0)}
                  </div>
                  <div className="card__info">
                    <div className="card__name">{group.display}</div>
                    <div className="card__sub">{target}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-secondary)' }}>
                    {group.hasActive && <span className="status-dot status-dot--active" />}
                    <span style={{ fontSize: 13, fontWeight: 500 }}>{group.cases.length} дел</span>
                    <span className={`collapse-arrow ${!isExpanded ? 'collapsed' : ''}`} style={{ fontSize: 18 }}>▾</span>
                  </div>
                </div>
              </div>

              {/* Cases List */}
              <div className={`expandable-content ${isExpanded ? 'expanded' : ''}`}>
                <div className="expandable-inner" style={{ paddingLeft: 12, paddingTop: isExpanded ? 4 : 0 }}>
                  {group.cases.map(c => {
                    const st = STATUS[c.status] || STATUS.error
                    return (
                      <div
                        key={c.id}
                        className="card"
                        style={{ padding: '12px 16px', marginBottom: 8, background: 'var(--bg-secondary)' }}
                        onClick={() => navigate(`/dossier/${c.id}`)}
                      >
                        <div className="card__header" style={{ marginBottom: 0 }}>
                          <div className="card__avatar" style={{ width: 36, height: 36, fontSize: 18 }}>
                            {(c.status === 'done' || c.status === 'delivered') ? '🎁' : st.icon}
                          </div>
                          <div className="card__info">
                            <div className="card__name" style={{ fontSize: 14 }}>
                              Дело №{c.id}
                              {c.persona && <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 400, marginLeft: 6 }}>· {c.persona}</span>}
                            </div>
                            <div className="card__sub" style={{ fontSize: 12 }}>
                              <span className={`status-dot status-dot--${st.dot}`} />
                              {st.label}
                              {c.created_at && <span style={{ marginLeft: 4 }}>· {timeAgo(c.created_at)}</span>}
                            </div>
                          </div>
                          {c.has_report && <span className="badge badge--success" style={{ padding: '2px 8px', fontSize: 10 }}>📋</span>}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )
        })
      )}

    </div>
  )
}
