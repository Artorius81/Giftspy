import { useLocation, useNavigate } from 'react-router-dom'
import api from '../api'
import { useData } from '../hooks/useData'

const tabs = [
  { path: '/', icon: '🏠', label: 'Главная' },
  { path: '/new-case', icon: '🕵️', label: 'Детектив' },
  { path: '/targets', icon: '🤍', label: 'Цели' },
]

const CUTE_EMOJIS = ['🐰', '🦊', '🐼', '🐨', '🐱', '🐹', '🐯', '🦁', '🦄', '🐸'];

export default function BottomNav() {
  const location = useLocation()
  const navigate = useNavigate()
  const { data: profile } = useData('profile', api.getProfile)

  const activeIndex = (() => {
    if (location.pathname === '/') return 0;
    if (location.pathname.startsWith('/new-case')) return 1;
    if (location.pathname.startsWith('/targets')) return 2;
    if (location.pathname.startsWith('/profile')) return 3;
    return -1;
  })();

  const isProfileActive = activeIndex === 3;

  const getDefaultAvatar = (userId) => {
    if (!userId) return '🐰'
    const idx = Math.abs(parseInt(userId, 10)) % CUTE_EMOJIS.length
    return CUTE_EMOJIS[idx]
  }

  const triggerHaptic = () => {
    try {
      window.Telegram?.WebApp?.HapticFeedback?.impactOccurred('light')
    } catch (e) {
      console.warn('Haptic feedback is not supported or failed:', e)
    }
  }

  return (
    <nav className="bottom-nav" style={{ padding: '6px 12px' }}>
      {/* Wrapper for the first 3 tabs to support smooth sliding indicator */}
      <div style={{ display: 'flex', flex: 1, position: 'relative', alignItems: 'center' }}>
        {/* Dynamic sliding selector indicator with nested inset pill */}
        <div 
          className="bottom-nav-indicator" 
          style={{
            transform: `translateX(${activeIndex >= 0 && activeIndex < 3 ? activeIndex * 100 : 0}%)`,
            opacity: activeIndex >= 0 && activeIndex < 3 ? 1 : 0
          }}
        >
          <div className="bottom-nav-indicator-pill" />
        </div>

        {tabs.map((tab, idx) => {
          const isActive = activeIndex === idx;
          return (
            <button
              key={tab.path}
              className={`nav-item ${isActive ? 'active' : ''}`}
              onClick={() => {
                triggerHaptic();
                if (isActive) return;
                if (tab.path === '/') {
                  navigate('/', { replace: true, state: { trapInitialized: true, isTrap: false } });
                } else {
                  navigate(tab.path, { replace: true });
                }
              }}
            >
              <span className="icon">{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Vertical Divider line */}
      <div className="bottom-nav-divider" />

      {/* Redesigned Profile Avatar Tab with divider and glowing active ring */}
      <button
        className="nav-item"
        onClick={() => {
          triggerHaptic();
          if (isProfileActive) return;
          navigate('/profile/edit', { replace: true });
        }}
        style={{
          flex: '0 0 auto',
          padding: '4px 6px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'none',
          border: 'none',
          cursor: 'pointer'
        }}
      >
        <div className={isProfileActive ? "bottom-nav-profile-active" : "bottom-nav-profile-inactive"}>
          {profile?.photo && profile.photo !== 'None' ? (
            <img src={profile.photo} alt="" />
          ) : (
            <span className={isProfileActive ? "bottom-nav-profile-active-emoji" : "bottom-nav-profile-inactive-emoji"}>
              {getDefaultAvatar(profile?.user_id)}
            </span>
          )}
        </div>
      </button>
    </nav>
  )
}
