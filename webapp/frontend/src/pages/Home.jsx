import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api'
import { getTargetEmoji } from './TargetDetail'
import { useData } from '../hooks/useData'
import { timeAgo, formatDuration } from '../utils/timeAgo'
import ProfileSheet from '../components/ProfileSheet'

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

const PERSONA_EMOJIS = {
  'Шерлок': '🧐', 'Пуаро': '🧐', 'Мисс Марпл': '👵',
  'Коломбо': '🕵️', 'R2-Spy': '🤖', 'Бонд': '🕶️',
}

function getPersonaEmoji(persona) {
  if (!persona) return '🕵️‍♂️'
  for (const [key, emoji] of Object.entries(PERSONA_EMOJIS)) {
    if (persona.includes(key)) return emoji
  }
  return '🕵️‍♂️'
}

export default function Home() {
  const navigate = useNavigate()
  const [completedExpanded, setCompletedExpanded] = useState(true)
  
  const { data: profile, loading: pLoading } = useData('profile', api.getProfile)
  const { data: cases, loading: cLoading } = useData('cases', api.getCases)
  
  const loading = pLoading || cLoading
  const activeCases = cases ? cases.filter(c => !['done', 'delivered', 'cancelled', 'error'].includes(c.status)) : []
  const completedCases = cases ? cases.filter(c => ['done', 'delivered', 'cancelled', 'error'].includes(c.status)) : []

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

  return (
    <div className="page">
      <div className="header">
        <ProfileSheet />
        <span className="header__title">Расследования</span>
        <button className="header__btn" onClick={() => navigate('/settings')} aria-label="Настройки">
          <span className="icon">⚙️</span>
        </button>
      </div>

      {/* Quick Stats */}
      <div className="stats-row">
        <div className="stat-card">
          <div className="stat-card__value">{activeCases.length}</div>
          <div className="stat-card__label">В работе</div>
        </div>
        <div className="stat-card">
          <div className="stat-card__value">{completedCases.filter(c => ['done', 'delivered'].includes(c.status)).length}</div>
          <div className="stat-card__label">Закрыто</div>
        </div>
        <div className="stat-card">
          <div className="stat-card__value">{profile.is_premium ? '∞' : profile.balance}</div>
          <div className="stat-card__label">Осталось</div>
        </div>
      </div>

      {/* Active Cases */}
      <div className="section-header">
        <div className="section-header__title">🔍 Текущие расследования</div>
        <button className="section-header__action" onClick={() => navigate('/new-case')}>+ Новое</button>
      </div>

      {activeCases.length > 0 ? (
        activeCases.map(c => {
          const st = STATUS[c.status] || STATUS.error
          return (
            <div key={c.id} className="card investigation-card" onClick={() => navigate(`/dossier/${c.id}`)}>
              <div className="card__header">
                <div className="card__avatar">
                  {c.target_photo ? <img src={c.target_photo} alt="" /> : getTargetEmoji(c.target_db_id || 0)}
                </div>
                <div className="card__info">
                  <div className="card__name">{c.display_name}</div>
                  <div className="card__sub">
                    <span className={`status-dot status-dot--${st.dot}`} />
                    {st.label}
                  </div>
                </div>
              </div>
              <div className="card__badges">
                {c.holiday && <span className="badge">🎉 {c.holiday.replace(/^[^\s]+\s/, '')}</span>}
                {c.persona && <span className="badge">{getPersonaEmoji(c.persona)} {c.persona}</span>}
                {c.created_at && <span className="badge" style={{opacity: 0.7}}>🕐 {timeAgo(c.created_at)}</span>}
              </div>
            </div>
          )
        })
      ) : (
        <div className="card" style={{ textAlign: 'center', padding: '24px 16px' }}>
          <div style={{ fontSize: 28, marginBottom: 8 }}>🕵️‍♂️</div>
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>Нет активных расследований</div>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
            Отправьте детектива на задание прямо сейчас!
          </div>
          <button className="btn btn--primary" onClick={() => navigate('/new-case')}>
            🔍 Отправить детектива
          </button>
        </div>
      )}

      {/* Completed Cases */}
      {completedCases.length > 0 && (
        <>
          <div
            className="section-header section-header--clickable"
            onClick={() => setCompletedExpanded(!completedExpanded)}
          >
            <div className="section-header__title">
              📁 Завершённые
              <span style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 400, marginLeft: 6 }}>
                ({completedCases.length})
              </span>
            </div>
            <span className={`collapse-arrow ${completedExpanded ? '' : 'collapsed'}`}>▼</span>
          </div>

          <div className={`expandable-content ${completedExpanded ? 'expanded' : ''}`}>
            <div className="expandable-inner">
              {completedCases.map(c => {
                const st = STATUS[c.status] || STATUS.error
                const duration = formatDuration(c.created_at, c.completed_at)
                return (
                  <div key={c.id} className="card investigation-card" onClick={() => navigate(`/dossier/${c.id}`)}>
                    <div className="card__header">
                      <div className="card__avatar">
                        {c.target_photo ? <img src={c.target_photo} alt="" /> : getTargetEmoji(c.target_db_id || 0)}
                      </div>
                      <div className="card__info">
                        <div className="card__name">{c.display_name}</div>
                        <div className="card__sub">
                          {st.icon} {st.label}
                          {c.completed_at && <> · {timeAgo(c.completed_at)}</>}
                        </div>
                      </div>
                      {c.has_report && <span className="badge badge--success">📋</span>}
                    </div>
                    <div className="card__badges">
                      {c.holiday && <span className="badge">🎉 {c.holiday.replace(/^[^\s]+\s/, '')}</span>}
                      {c.persona && <span className="badge">{getPersonaEmoji(c.persona)} {c.persona}</span>}
                      {c.budget && c.budget !== 'Не указан' && <span className="badge">💵 {c.budget}</span>}
                      {duration && <span className="badge" style={{opacity: 0.7}}>⏱ {duration}</span>}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
