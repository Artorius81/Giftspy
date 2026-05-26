import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api'
import { useData } from '../hooks/useData'
import detectiveImg from '../assets/detective.png'

export default function Home() {
  const navigate = useNavigate()

  const { data: profile, loading: pLoading } = useData('profile', api.getProfile)
  const { data: cases, loading: cLoading } = useData('cases', api.getCases)
  const { data: targetsData, loading: tLoading } = useData('targets', api.getTargets)

  const loading = pLoading || cLoading || tLoading

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

  const allCases = cases || []
  const activeCases = allCases.filter(c => !['done', 'delivered', 'cancelled', 'error'].includes(c.status))
  const completedCount = allCases.filter(c => ['done', 'delivered'].includes(c.status)).length
  const targetsCount = targetsData ? targetsData.length : 0

  // Format Russian plural suffix for targets
  const getTargetsText = (count) => {
    if (count % 10 === 1 && count % 100 !== 11) return `${count} цель`;
    if (count % 10 >= 2 && count % 10 <= 4 && (count % 100 < 10 || count % 100 >= 20)) return `${count} цели`;
    return `${count} целей`;
  }

  const getGreeting = () => {
    const hr = new Date().getHours()
    if (hr < 6) return 'Доброй ночи'
    if (hr < 12) return 'Доброе утро'
    if (hr < 18) return 'Добрый день'
    return 'Добрый вечер'
  }

  return (
    <div className="page page-profile-bg" style={{ paddingBottom: '120px' }}>
      {/* Centered Premium Header with Greeting & No Header Buttons */}
      <div className="new-header" style={{ justifyContent: 'center', background: 'transparent', borderBottom: 'none', paddingBottom: '8px' }}>
        <h1 className="new-header-title" style={{ fontSize: '20px', fontWeight: '800', letterSpacing: '-0.3px', color: 'var(--text)' }}>
          {getGreeting()}
        </h1>
      </div>

      {/* Breathing Detective Illustration Widget */}
      <div className="detective-container">
        <img src={detectiveImg} className="animated-detective" alt="Детектив" />
      </div>

      {/* Search-Alternative CTA Card (Opaque background blocks detective bottom crop) */}
      <div className="profile-wishlist-card profile-wishlist-card--opaque" style={{ marginBottom: '20px', position: 'relative', zIndex: 2 }}>
        <div className="profile-wishlist-card-top" onClick={() => navigate('/new-case')}>
          <div className="profile-wishlist-card-icon-container" style={{ fontSize: '24px', background: 'rgba(255,255,255,0.03)' }}>
            🎁
          </div>
          <div className="profile-wishlist-card-details">
            <span className="profile-wishlist-card-title">Поиск идеального подарка</span>
            <span className="profile-wishlist-card-subtitle">Детектив готов начать расследование</span>
          </div>
        </div>
        <button className="profile-wishlist-card-btn" onClick={() => navigate('/new-case')}>
          Начать расследование
        </button>
      </div>



      {/* Upcoming Birthdays Card (Mockup Widget matching exact mockup content) */}
      <div className="section-header" style={{ margin: '24px 0 12px' }}>
        <h2 className="section-header__title" style={{ fontSize: '17px', color: 'var(--text)' }}>Ближайшие дни рождения</h2>
      </div>

      <div className="receive-gifts-banner" style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 'var(--radius-md)', padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px', boxSizing: 'border-box' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: '12px' }}>
          <span style={{ fontSize: '42px' }} role="img" aria-label="birthday cake">🎂</span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <span style={{ fontSize: '17px', fontWeight: '700', color: 'var(--text)' }}>Отслеживайте дни рождения</span>
            <span style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
              Добавьте дни рождения ваших близких в список целей, и детектив вовремя напомнит вам о подготовке!
            </span>
          </div>
        </div>
        <button 
          className="btn-mockup-cake" 
          onClick={() => navigate('/targets')} 
        >
          👤 К друзьям
        </button>
      </div>

    </div>
  )
}
