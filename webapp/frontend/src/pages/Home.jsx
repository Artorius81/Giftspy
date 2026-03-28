import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api'
import { getTargetEmoji } from './TargetDetail'

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
  const [profile, setProfile] = useState(null)
  const [activeCases, setActiveCases] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      api.getProfile(),
      api.getCases()
    ])
      .then(([p, allCases]) => {
        setProfile(p)
        const active = allCases.filter(c => !['done', 'delivered', 'cancelled', 'error'].includes(c.status))
        setActiveCases(active)
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

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
        <div className="header__placeholder" />
        <span className="header__title">Профиль</span>
        <button className="header__btn" onClick={() => navigate('/settings')} aria-label="Настройки">
          <span className="icon">⚙️</span>
        </button>
      </div>

      {/* Profile Header */}
      <div className="profile-header">
        <div className="profile-header__avatar">
          {profile.photo && profile.photo !== 'None'
            ? <img src={profile.photo} alt="" />
            : '🕵️‍♂️'
          }
        </div>
        <div className="profile-header__name">{profile.nickname || 'Агент'}</div>
        <div className="profile-header__id">ID: {profile.user_id}</div>
        {profile.premium_until && (
          <div className="profile-header__premium">
            <span className="badge badge--success">👑 Premium</span>
          </div>
        )}
        <button
          className="btn btn--secondary profile-edit-btn"
          onClick={() => navigate('/profile/edit')}
        >
          ✏️ Редактировать профиль
        </button>
      </div>

      {/* Stats */}
      <div className="stats-row">
        <div className="stat-card">
          <div className="stat-card__value">{profile.balance}</div>
          <div className="stat-card__label">Расследований</div>
        </div>
        <div className="stat-card">
          <div className="stat-card__value">{profile.successful_cases}</div>
          <div className="stat-card__label">Закрыто дел</div>
        </div>
        <div className="stat-card">
          <div className="stat-card__value">{profile.active_cases}</div>
          <div className="stat-card__label">В работе</div>
        </div>
      </div>

      {/* Active Cases */}
      <div className="section-header">
        <div className="section-header__title">Текущие расследования</div>
      </div>

      {activeCases.length > 0 ? (
        activeCases.map(c => {
          const st = STATUS[c.status] || STATUS.error
          return (
            <div key={c.id} className="card" onClick={() => navigate(`/dossier/${c.id}`)}>
              <div className="card__header">
                <div className="card__avatar">
                  {c.target_photo ? <img src={c.target_photo} alt="" /> : getTargetEmoji(c.target_db_id || 0)}
                </div>
                <div className="card__info">
                  <div className="card__name">{c.display_name}</div>
                  <div className="card__sub">
                    <span className={`status-dot status-dot--${st.dot}`} />
                    {st.label} · Дело №{c.id}
                  </div>
                </div>
                {c.has_report && <span className="badge badge--success">📋 Отчёт</span>}
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

      {/* Bio */}
      {profile.description && (
        <>
          <div className="section-header">
            <div className="section-header__title">О себе</div>
          </div>
          <div className="card">
            <p style={{ fontSize: 14, color: 'var(--text-secondary)' }}>{profile.description}</p>
          </div>
        </>
      )}
    </div>
  )
}
