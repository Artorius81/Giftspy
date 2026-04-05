import { useLocation, useNavigate } from 'react-router-dom'
import api from '../api'
import { useData } from '../hooks/useData'

const tabs = [
  { path: '/', icon: '🏠', label: 'Главная' },
  { path: '/new-case', icon: '🕵️', label: 'Детектив' },
  { path: '/targets', icon: '👥', label: 'Цели' },
]

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

  return (
    <nav className="bottom-nav">
      {activeIndex >= 0 && (
        <div 
          className="bottom-nav-indicator"
          style={{ transform: `translateX(${activeIndex * 100}%)` }}
        />
      )}
      {tabs.map(tab => (
        <button
          key={tab.path}
          className={`nav-item ${location.pathname === tab.path ? 'active' : ''}`}
          onClick={() => {
            if (tab.path === location.pathname) return;
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
      ))}
      {/* Profile Avatar */}
      <button
        className={`nav-item ${location.pathname === '/profile/edit' ? 'active' : ''}`}
        onClick={() => {
          if (location.pathname === '/profile/edit') return;
          navigate('/profile/edit', { replace: true });
        }}
      >
        <span className="icon">
          <span className="nav-avatar">
            {profile?.photo && profile.photo !== 'None'
              ? <img src={profile.photo} alt="" className="nav-avatar__img" />
              : '👤'
            }
          </span>
        </span>
        <span>Профиль</span>
      </button>
    </nav>
  )
}
