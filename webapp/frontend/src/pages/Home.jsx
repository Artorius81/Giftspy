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

// Helper to calculate dynamic interrogation progress percentage mathematically
function getInterrogationProgress(c) {
  if (!c) return 0;
  if (['done', 'delivered'].includes(c.status)) return 100;
  if (['cancelled', 'error'].includes(c.status)) return 0;
  
  const msgCount = c.message_count || 0;
  if (c.status === 'pending' && msgCount === 0) return 10;
  
  // Dynamic calculation: base 15% + 7.5% per message, capped at 95%
  const progress = Math.min(95, 15 + (msgCount * 7.5));
  return Math.round(progress);
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

  // Extract active case and last completed case
  const activeCase = [...allCases]
    .filter(c => !['done', 'delivered', 'cancelled', 'error'].includes(c.status))
    .sort((a, b) => b.id - a.id)[0]

  const lastCompleted = [...allCases]
    .filter(c => ['done', 'delivered'].includes(c.status))
    .sort((a, b) => b.id - a.id)[0]

  // Format Russian plural suffix for targets
  const getTargetsText = (count) => {
    if (count % 10 === 1 && count % 100 !== 11) return `${count} цель`;
    if (count % 10 >= 2 && count % 10 <= 4 && (count % 100 < 10 || count % 100 >= 20)) return `${count} цели`;
    return `${count} целей`;
  }

  const getGreetingData = () => {
    const hr = new Date().getHours()
    const tgUser = window.Telegram?.WebApp?.initDataUnsafe?.user || {}
    const fullName = `${tgUser.first_name || ''} ${tgUser.last_name || ''}`.trim()
    const name = profile?.nickname || fullName || tgUser.first_name || tgUser.username || 'Детектив'
    
    let greetingText = 'Добрый вечер'
    if (hr < 6) greetingText = 'Доброй ночи'
    else if (hr < 12) greetingText = 'Доброе утро'
    else if (hr < 18) greetingText = 'Добрый день'
    
    return { greetingText, name }
  }

  return (
    <div className="page page-profile-bg" style={{ paddingBottom: '120px' }}>
      {/* Centered Premium Header with Greeting & No Header Buttons */}
      <div className="new-header" style={{ justifyContent: 'center', background: 'transparent', borderBottom: 'none', paddingBottom: '8px' }}>
        <h1 className="new-header-title" style={{ fontSize: '20px', fontWeight: '800', letterSpacing: '-0.3px', color: 'var(--text)' }}>
          {getGreetingData().greetingText}, <span className="greeting-nickname" style={{ 
            background: 'linear-gradient(135deg, #a78bfa 0%, #f472b6 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            fontWeight: '800'
          }}>{getGreetingData().name}</span>
        </h1>
      </div>

      {/* Breathing Detective Illustration Widget */}
      <div className="detective-container">
        <img src={detectiveImg} className="animated-detective" alt="Детектив" />
      </div>

      {/* Search-Alternative CTA Card (Opaque background blocks detective bottom crop) */}
      <div className="profile-wishlist-card profile-wishlist-card--opaque" style={{ marginBottom: '20px', position: 'relative', zIndex: 2, padding: '20px 24px' }}>
        {activeCase ? (
          // Active Case Layout: No left emoji, colored status dot, below-label target, progress bar
          <div 
            style={{ display: 'flex', flexDirection: 'column', gap: '14px', cursor: 'pointer' }}
            onClick={() => { triggerHaptic(); navigate(`/dossier/${activeCase.id}`); }}
          >
            {/* Header Row */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ 
                fontSize: '13px', 
                fontWeight: '800', 
                textTransform: 'uppercase', 
                letterSpacing: '0.6px',
                color: '#a78bfa' // Beautiful premium lavender, NOT pink!
              }}>
                В процессе • Дело №{activeCase.case_number || `oX${activeCase.id * 100}`}
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className="pulse-dot" style={{ 
                  width: '8px', 
                  height: '8px', 
                  borderRadius: '50%', 
                  backgroundColor: '#10b981',
                  display: 'inline-block'
                }} />
                <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: '600' }}>
                  {activeCase.status === 'pending' ? 'В режиме ожидания' :
                   activeCase.status === 'started' ? 'Расследование началось' :
                   activeCase.status === 'in_progress' ? 'Детектив ведет допрос' :
                   activeCase.status === 'manual_mode' ? 'Ручной перехват активен' : 'В процессе'}
                </span>
              </div>
            </div>

            {/* Middle Row with Detective Photo on the left, Target & Detective name on the right */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div style={{
                width: '48px',
                height: '70px',
                borderRadius: '10px',
                background: 'rgba(255,255,255,0.03)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
                flexShrink: 0,
                border: '1px solid var(--card-border)'
              }}>
                <img 
                  src={activeCase.persona_photo || detectiveImg} 
                  alt={activeCase.persona} 
                  style={{ 
                    width: '100%', 
                    height: '100%', 
                    objectFit: activeCase.persona_photo ? 'cover' : 'contain', 
                    padding: activeCase.persona_photo ? '0' : '6px',
                    boxSizing: 'border-box'
                  }} 
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: 0 }}>
                <span style={{ 
                  fontSize: '19px', 
                  fontWeight: '800', 
                  color: 'var(--text)',
                  letterSpacing: '-0.3px',
                  lineHeight: '1.2',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis'
                }}>
                  {activeCase.display_name}
                </span>
                <span style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: '500' }}>
                  Детектив: {activeCase.persona}
                </span>
              </div>
            </div>

            {/* Interrogation Progress Bar */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '2px' }}>
              <div style={{ 
                width: '100%', 
                height: '6px', 
                background: 'rgba(255,255,255,0.06)', 
                borderRadius: '10px', 
                overflow: 'hidden' 
              }}>
                <div style={{ 
                  width: `${getInterrogationProgress(activeCase)}%`, 
                  height: '100%', 
                  background: 'linear-gradient(90deg, #a78bfa 0%, #818cf8 100%)', 
                  borderRadius: '10px',
                  transition: 'width 0.4s ease'
                }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-secondary)', fontWeight: '600' }}>
                <span>Статус ведения допроса</span>
                <span>{getInterrogationProgress(activeCase)}%</span>
              </div>
            </div>

            <button 
              className="profile-wishlist-card-btn" 
              style={{ marginTop: '8px' }}
              onClick={(e) => { 
                e.stopPropagation(); 
                triggerHaptic(); 
                navigate(`/dossier/${activeCase.id}`); 
              }}
            >
              Следить за расследованием
            </button>
          </div>
        ) : lastCompleted ? (
          // Last Completed Case Layout: No left emoji, colored status dot, below-label target, 100% progress bar
          <div 
            style={{ display: 'flex', flexDirection: 'column', gap: '14px', cursor: 'pointer' }}
            onClick={() => { triggerHaptic(); navigate(`/dossier/${lastCompleted.id}`); }}
          >
            {/* Header Row */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ 
                fontSize: '13px', 
                fontWeight: '800', 
                textTransform: 'uppercase', 
                letterSpacing: '0.6px',
                color: '#34d399' // Premium emerald green
              }}>
                Завершено • Дело №{lastCompleted.case_number || `oX${lastCompleted.id * 100}`}
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ 
                  width: '8px', 
                  height: '8px', 
                  borderRadius: '50%', 
                  backgroundColor: '#34d399',
                  display: 'inline-block'
                }} />
                <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: '600' }}>
                  Досье собрано!
                </span>
              </div>
            </div>

            {/* Middle Row with Detective Photo on the left, Target & Detective name on the right */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div style={{
                width: '48px',
                height: '70px',
                borderRadius: '10px',
                background: 'rgba(255,255,255,0.03)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
                flexShrink: 0,
                border: '1px solid var(--card-border)'
              }}>
                <img 
                  src={lastCompleted.persona_photo || detectiveImg} 
                  alt={lastCompleted.persona} 
                  style={{ 
                    width: '100%', 
                    height: '100%', 
                    objectFit: lastCompleted.persona_photo ? 'cover' : 'contain', 
                    padding: lastCompleted.persona_photo ? '0' : '6px',
                    boxSizing: 'border-box'
                  }} 
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: 0 }}>
                <span style={{ 
                  fontSize: '19px', 
                  fontWeight: '800', 
                  color: 'var(--text)',
                  letterSpacing: '-0.3px',
                  lineHeight: '1.2',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis'
                }}>
                  {lastCompleted.display_name}
                </span>
                <span style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: '500' }}>
                  Детектив: {lastCompleted.persona}
                </span>
              </div>
            </div>

            {/* Completed Progress Bar */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '2px' }}>
              <div style={{ 
                width: '100%', 
                height: '6px', 
                background: 'rgba(255,255,255,0.06)', 
                borderRadius: '10px', 
                overflow: 'hidden' 
              }}>
                <div style={{ 
                  width: '100%', 
                  height: '100%', 
                  background: 'linear-gradient(90deg, #34d399 0%, #10b981 100%)', 
                  borderRadius: '10px'
                }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-secondary)', fontWeight: '600' }}>
                <span>Статус ведения допроса</span>
                <span>100%</span>
              </div>
            </div>

            <button 
              className="profile-wishlist-card-btn" 
              style={{ marginTop: '8px' }}
              onClick={(e) => { 
                e.stopPropagation(); 
                triggerHaptic(); 
                navigate(`/dossier/${lastCompleted.id}`); 
              }}
            >
              Посмотреть результаты
            </button>
          </div>
        ) : (
          // Default State: No cases (Simple Premium Greeting Card)
          <div 
            style={{ display: 'flex', flexDirection: 'column', gap: '14px', cursor: 'pointer' }}
            onClick={() => { triggerHaptic(); navigate('/new-case'); }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div className="profile-wishlist-card-icon-container" style={{ fontSize: '24px', background: 'rgba(255,255,255,0.03)' }}>
                🎁
              </div>
              <div className="profile-wishlist-card-details">
                <span className="profile-wishlist-card-subtitle" style={{ fontSize: '16px', fontWeight: '700', color: 'var(--text)' }}>Поиск идеального подарка</span>
                <span className="profile-wishlist-card-subtitle" style={{ opacity: 0.6, fontSize: '13px', fontWeight: '500', color: 'var(--text-secondary)' }}>Детектив готов начать расследование</span>
              </div>
            </div>
            <button 
              className="profile-wishlist-card-btn" 
              style={{ marginTop: '4px' }}
              onClick={(e) => { 
                e.stopPropagation(); 
                triggerHaptic(); 
                navigate('/new-case'); 
              }}
            >
              Начать новое дело
            </button>
          </div>
        )}
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
