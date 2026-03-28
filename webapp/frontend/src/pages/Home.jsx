import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api'

export default function Home() {
  const navigate = useNavigate()
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.getProfile()
      .then(setProfile)
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
      {/* Settings icon */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '8px 0' }}>
        <button
          className="settings-gear-btn"
          onClick={() => navigate('/settings')}
          aria-label="Настройки"
        >
          ⚙️
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

      {/* Quick Actions */}
      <div className="section-header">
        <div className="section-header__title">Быстрые действия</div>
      </div>
      <div className="quick-actions">
        <button className="quick-action" onClick={() => navigate('/new-case')}>
          <span>🔍</span>
          <span>Новое дело</span>
        </button>
        <button className="quick-action" onClick={() => navigate('/targets')}>
          <span>👥</span>
          <span>Мои цели</span>
        </button>
        <button className="quick-action" onClick={() => navigate('/dossier')}>
          <span>📁</span>
          <span>Картотека</span>
        </button>
        <button className="quick-action" onClick={() => navigate('/store')}>
          <span>🛍</span>
          <span>Магазин</span>
        </button>
      </div>

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
