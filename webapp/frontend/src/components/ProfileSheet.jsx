import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api'
import { useData } from '../hooks/useData'

export default function ProfileSheet() {
  const navigate = useNavigate()
  const { data: profile } = useData('profile', api.getProfile)
  const [open, setOpen] = useState(false)
  const backdropRef = useRef(null)
  const sheetRef = useRef(null)
  const dragStartY = useRef(0)
  const dragDelta = useRef(0)

  // Close on backdrop click
  const handleBackdropClick = (e) => {
    if (e.target === backdropRef.current) setOpen(false)
  }

  // Drag to close
  const handleTouchStart = (e) => {
    dragStartY.current = e.touches[0].clientY
  }

  const handleTouchMove = (e) => {
    dragDelta.current = e.touches[0].clientY - dragStartY.current
    if (dragDelta.current > 0 && sheetRef.current) {
      sheetRef.current.style.transform = `translateY(${dragDelta.current}px)`
    }
  }

  const handleTouchEnd = () => {
    if (dragDelta.current > 100) {
      setOpen(false)
    }
    if (sheetRef.current) {
      sheetRef.current.style.transform = ''
    }
    dragDelta.current = 0
  }

  // Prevent body scroll when open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [open])

  if (!profile) return null

  return (
    <>
      {/* Avatar trigger in header */}
      <button className="profile-sheet-trigger" onClick={() => setOpen(true)}>
        <div className="profile-sheet-trigger__avatar">
          {profile.photo && profile.photo !== 'None'
            ? <img src={profile.photo} alt="" />
            : '🕵️‍♂️'
          }
        </div>
      </button>

      {/* BottomSheet */}
      {open && (
        <div className="profile-sheet-backdrop" ref={backdropRef} onClick={handleBackdropClick}>
          <div
            className="profile-sheet"
            ref={sheetRef}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            <div className="profile-sheet__handle" />

            <div className="profile-sheet__content">
              {/* Avatar */}
              <div className="profile-sheet__avatar">
                {profile.photo && profile.photo !== 'None'
                  ? <img src={profile.photo} alt="" />
                  : '🕵️‍♂️'
                }
              </div>

              {/* Name */}
              <div className="profile-sheet__name">{profile.nickname || 'Агент'}</div>
              <div className="profile-sheet__id">ID: {profile.user_id}</div>

              {/* Premium badge */}
              {profile.is_premium && (
                <div className="profile-sheet__premium">
                  <span className="badge badge--success">👑 Премиум</span>
                  {profile.premium_until && (
                    <span style={{ fontSize: 11, color: 'var(--text-secondary)', marginLeft: 6 }}>
                      до {new Date(profile.premium_until).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}
                    </span>
                  )}
                </div>
              )}

              {/* Stats */}
              <div className="profile-sheet__stats">
                <div className="profile-sheet__stat">
                  <div className="profile-sheet__stat-value">{profile.is_premium ? '∞' : profile.balance}</div>
                  <div className="profile-sheet__stat-label">Расследований</div>
                </div>
                <div className="profile-sheet__stat">
                  <div className="profile-sheet__stat-value">{profile.successful_cases}</div>
                  <div className="profile-sheet__stat-label">Закрыто</div>
                </div>
                <div className="profile-sheet__stat">
                  <div className="profile-sheet__stat-value">{profile.active_cases}</div>
                  <div className="profile-sheet__stat-label">В работе</div>
                </div>
              </div>

              {/* Actions */}
              <button
                className="btn btn--secondary"
                onClick={() => { setOpen(false); navigate('/profile/edit') }}
                style={{ marginTop: 16 }}
              >
                ✏️ Редактировать профиль
              </button>
              <button
                className="btn btn--secondary"
                onClick={() => { setOpen(false); navigate('/settings') }}
                style={{ marginTop: 8 }}
              >
                ⚙️ Настройки
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
