import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api'
import { useData } from '../hooks/useData'
import detectiveImg from '../assets/detective.png'
import { getTargetEmoji } from './TargetDetail'

// Helper to calculate days until birthday
function getDaysUntilBirthday(bdayStr) {
  if (!bdayStr) return null;
  const parts = bdayStr.split('.')
  if (parts.length < 2) return null;
  const day = parseInt(parts[0], 10)
  const month = parseInt(parts[1], 10) - 1
  if (isNaN(day) || isNaN(month) || month < 0 || month > 11 || day < 1 || day > 31) return null;
  
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  
  const currentYear = today.getFullYear()
  const bdayThisYear = new Date(currentYear, month, day)
  bdayThisYear.setHours(0, 0, 0, 0)
  
  if (bdayThisYear.getTime() < today.getTime()) {
    bdayThisYear.setFullYear(currentYear + 1)
  }
  
  const diffTime = bdayThisYear.getTime() - today.getTime()
  return Math.round(diffTime / (1000 * 60 * 60 * 24));
}

// Helper to format days until text in Russian
function formatDaysText(days) {
  if (days === 0) return 'Сегодня! 🎉';
  if (days === 1) return 'Завтра! 🎂';
  
  const mod10 = days % 10;
  const mod100 = days % 100;
  if (mod10 === 1 && mod100 !== 11) {
    return `${days} день`;
  }
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) {
    return `${days} дня`;
  }
  return `${days} дней`;
}

// Helper to format Russian birthday date nicely (e.g. 15.06 -> 15 июня)
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


export default function Home() {
  const navigate = useNavigate()

  const { data: profile, loading: pLoading } = useData('profile', api.getProfile)
  const { data: cases, loading: cLoading } = useData('cases', api.getCases)
  const { data: targetsData, loading: tLoading } = useData('targets', api.getTargets)

  const loading = pLoading || cLoading || tLoading

  if (loading) return <div className="page page-profile-bg"><div className="loading"><div className="spinner" /></div></div>

  if (!profile) {
    return (
      <div className="page page-profile-bg">
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

  const triggerHaptic = () => {
    try {
      window.Telegram?.WebApp?.HapticFeedback?.impactOccurred('light')
    } catch (e) {
      console.warn('Haptic feedback is not supported:', e)
    }
  }

  // Filter and sort targets that have birthdays filled in
  const upcomingBirthdays = (targetsData || [])
    .filter(t => t.birthday)
    .map(t => {
      const daysLeft = getDaysUntilBirthday(t.birthday)
      return { ...t, daysLeft }
    })
    .filter(t => t.daysLeft !== null)
    .sort((a, b) => a.daysLeft - b.daysLeft)

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

      {/* Upcoming Birthdays Section */}
      <div className="section-header" style={{ margin: '24px 0 12px' }}>
        <h2 className="section-header__title" style={{ fontSize: '17px', color: 'var(--text)' }}>Ближайшие дни рождения</h2>
      </div>

      {upcomingBirthdays.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', position: 'relative', zIndex: 2 }}>
          {upcomingBirthdays.map((t) => (
            <div key={t.id} className="home-birthday-card">
              
              {/* Card top row: avatar cube + info */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                {/* Left side: Avatar mini-card */}
                <div className="home-birthday-avatar-block">
                  <div className="home-birthday-avatar-emoji">
                    {t.photo && t.photo !== 'None' ? (
                      <img src={t.photo} alt="" style={{ width: 34, height: 34, borderRadius: '50%', objectFit: 'cover' }} />
                    ) : (
                      getTargetEmoji(t.id)
                    )}
                  </div>
                  <div className="home-birthday-days-badge">
                    {formatDaysText(t.daysLeft)}
                  </div>
                </div>

                {/* Right side: Name and formatted date */}
                <div className="home-birthday-info">
                  <span className="home-birthday-name">{t.name || t.identifier}</span>
                  <span className="home-birthday-date">{formatRussianBirthday(t.birthday)}</span>
                </div>
              </div>

              {/* Card actions bottom row */}
              <div className="home-birthday-actions">
                <button 
                  className="btn-birthday-wishlist"
                  onClick={() => {
                    triggerHaptic();
                    navigate(`/targets/${t.id}`);
                  }}
                >
                  ❤️ Вишлист
                </button>
                <button 
                  className="btn-birthday-sherlock"
                  onClick={() => {
                    triggerHaptic();
                    navigate(`/new-case?target=${encodeURIComponent(t.identifier)}`);
                  }}
                >
                  🕵️ Детектив
                </button>
              </div>

            </div>
          ))}

          {/* Add friend dashed full-width button */}
          <button 
            className="home-add-friend-dashed-btn"
            onClick={() => {
              triggerHaptic();
              navigate('/targets');
            }}
          >
            ＋ Добавить друга
          </button>
        </div>
      ) : (
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
            onClick={() => {
              triggerHaptic();
              navigate('/targets');
            }} 
          >
            👤 К друзьям
          </button>
        </div>
      )}

    </div>
  )
}
